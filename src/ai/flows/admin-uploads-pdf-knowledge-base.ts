'use server';
/**
 * @fileOverview Flow for admin to upload PDF documents to create a knowledge base for the chatbot.
 *
 * Server-side Firestore and Storage now use Firebase Admin SDK to bypass client security rules.
 * - adminUploadsPdfKnowledgeBase - Uploads PDFs to Storage and extracts content for each.
 * - extractDocumentContent - Extracts text from a single document using local PDF parsing (no Gemini needed).
 * - getKnowledgeDocuments - Retrieves all knowledge documents.
 * - deleteKnowledgeDocument - Deletes a single knowledge document.
 **/

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { firestore, storage as adminStorage } from '@/lib/firebase-admin';
import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import path from 'path';
// pdf-parse is CJS-only, must use require to avoid ESM default export error
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

const LOCAL_PDF_FOLDER = process.env.LOCAL_PDF_FOLDER || '';

export type KnowledgeDocument = {
  id: string;
  fileName: string;
  uploadedAt: { seconds: number; nanoseconds: number } | null;
  filePath: string;
  extractedContent?: string;
  extractedAt?: { seconds: number; nanoseconds: number } | null;
};

const PdfDocumentSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF document as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  fileName: z.string().describe('The name of the PDF file.'),
});

const AdminUploadsPdfKnowledgeBaseInputSchema = z.object({
  documents: z.array(PdfDocumentSchema)
});
export type AdminUploadsPdfKnowledgeBaseInput = z.infer<typeof AdminUploadsPdfKnowledgeBaseInputSchema>;

const AdminUploadsPdfKnowledgeBaseOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type AdminUploadsPdfKnowledgeBaseOutput = z.infer<typeof AdminUploadsPdfKnowledgeBaseOutputSchema>;

const DOCUMENTS_COLLECTION = 'production_knowledge_documents';
const STORAGE_BUCKET = 'm-health-jxug7.firebasestorage.app';

export async function adminUploadsPdfKnowledgeBase(
  input: AdminUploadsPdfKnowledgeBaseInput
): Promise<AdminUploadsPdfKnowledgeBaseOutput> {
  return adminUploadsPdfKnowledgeBaseFlow(input);
}

export async function getKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  try {
    const snapshot = await firestore.collection(DOCUMENTS_COLLECTION)
      .orderBy('uploadedAt', 'desc')
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        fileName: data.fileName,
        filePath: data.filePath,
        extractedContent: data.extractedContent || '',
        uploadedAt: data.uploadedAt
          ? { seconds: data.uploadedAt.seconds, nanoseconds: data.uploadedAt.nanoseconds }
          : null,
        extractedAt: data.extractedAt
          ? { seconds: data.extractedAt.seconds, nanoseconds: data.extractedAt.nanoseconds }
          : null,
      };
    });
  } catch (error) {
    console.error('Error fetching knowledge documents:', error);
    return [];
  }
}

/**
 * Extracts text content from a single PDF document and saves it to Firestore.
 * Designed to be called per-file from the client so each call stays well within
 * the server action timeout limit.
 */
export async function extractDocumentContent(docId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = firestore.collection(DOCUMENTS_COLLECTION).doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { success: false, error: 'Document not found in Firestore.' };
    }

    const docData = docSnap.data()!;
    const fileName = docData.fileName as string;

    if (!LOCAL_PDF_FOLDER) {
      return { success: false, error: 'LOCAL_PDF_FOLDER is not set in .env.local.' };
    }

    const localFilePath = path.join(LOCAL_PDF_FOLDER, fileName);

    let fileBuffer: Buffer;
    try {
      fileBuffer = await readFile(localFilePath);
    } catch (fsError: any) {
      console.error(`[KB] Could not read local file for "${fileName}":`, fsError?.message);
      return { success: false, error: `Local file not found: ${localFilePath}` };
    }

    const parsed = await pdfParse(fileBuffer);
    const extractedText = parsed.text?.trim() || '';

    if (!extractedText) {
      return { success: false, error: `No text could be extracted from "${fileName}". It may be a scanned/image-only PDF.` };
    }

    await docRef.update({
      extractedContent: extractedText,
      extractedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[KB] Extracted ${extractedText.length} chars from "${fileName}" (local).`);
    return { success: true };
  } catch (error: any) {
    console.error(`[KB] Error extracting content for doc ${docId}:`, error?.message);
    return { success: false, error: error?.message || 'Unknown error during extraction.' };
  }
}

export async function deleteKnowledgeDocument(docId: string): Promise<{ success: boolean; message: string }> {
  try {
    const docRef = firestore.collection(DOCUMENTS_COLLECTION).doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { success: false, message: 'Document not found.' };
    }

    const documentData = docSnap.data() as KnowledgeDocument;
    const file = adminStorage.bucket(STORAGE_BUCKET).file(documentData.filePath);
    await file.delete();
    await docRef.delete();

    return { success: true, message: `Document '${documentData.fileName}' deleted.` };
  } catch (error: any) {
    console.error('Error deleting document:', error);
    if (error.code === 403 || (error.message && error.message.includes('permission'))) {
      return {
        success: false,
        message: "Permission Denied. Please grant the 'Storage Admin' role to your App Hosting service account in the Google Cloud IAM console.",
      };
    }
    return { success: false, message: (error as Error).message || 'Failed to delete document.' };
  }
}

// Server Flows
const adminUploadsPdfKnowledgeBaseFlow = ai.defineFlow(
  {
    name: 'adminUploadsPdfKnowledgeBaseFlow',
    inputSchema: AdminUploadsPdfKnowledgeBaseInputSchema,
    outputSchema: AdminUploadsPdfKnowledgeBaseOutputSchema,
  },
  async (input) => {
    try {
      const bucket = adminStorage.bucket(STORAGE_BUCKET);
      const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(2);
      const newDocIds: string[] = [];

      for (const document of input.documents) {
        const filePath = `knowledge_base/${uniqueId}_${document.fileName}`;
        const file = bucket.file(filePath);

        const base64Data = document.pdfDataUri.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');

        await file.save(buffer, { metadata: { contentType: 'application/pdf' } });

        const newDocRef = firestore.collection(DOCUMENTS_COLLECTION).doc();
        await newDocRef.set({
          fileName: document.fileName,
          uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
          filePath,
          extractedContent: '',
        });
        newDocIds.push(newDocRef.id);
      }

      // Extract content for each newly uploaded file in parallel using local PDF parser
      const extractionResults = await Promise.allSettled(
        newDocIds.map(docId => extractDocumentContent(docId))
      );

      const failed = extractionResults.filter(
        r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
      ).length;

      if (failed > 0) {
        return {
          success: true,
          message: `${input.documents.length} PDF(s) uploaded. ${failed} file(s) could not be extracted — use "Rebuild" to retry.`,
        };
      }

      return {
        success: true,
        message: `${input.documents.length} PDF(s) uploaded and extracted successfully.`,
      };
    } catch (error: any) {
      console.error('Error processing PDFs:', error);
      if (error.code === 403 || (error.message && error.message.includes('permission'))) {
        return {
          success: false,
          message: "Permission Denied. Please grant the 'Storage Admin' role to your App Hosting service account in the Google Cloud IAM console.",
        };
      }
      return {
        success: false,
        message: (error as Error).message || 'Failed to process PDFs.',
      };
    }
  }
);
