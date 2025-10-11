'use server';
/**
 * @fileOverview Flow for admin to upload PDF documents to create a knowledge base for the chatbot.
 *
 * Server-side Firestore and Storage now use Firebase Admin SDK to bypass client security rules.
 * - adminUploadsPdfKnowledgeBase - A function that handles the PDF upload and knowledge base creation process.
 * - AdminUploadsPdfKnowledgeBaseInput - The input type for the adminUploadsPdfKnowledgeBase function.
 * - AdminUploadsPdfKnowledgeBaseOutput - The return type for the adminUploadsPdfKnowledgeBase function.
 * - getKnowledgeDocuments - A function to retrieve all knowledge documents.
 * - deleteKnowledgeDocument - A function to delete a knowledge document.
 * - rebuildKnowledgeBase - A function to manually trigger a rebuild of the entire knowledge base from Storage.
 **/

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { v4 as uuidv4 } from 'uuid';
import { firestore, storage as adminStorage } from '@/lib/firebase-admin';
import admin from 'firebase-admin';
import { googleAI } from '@genkit-ai/googleai';

export type KnowledgeDocument = {
  id: string;
  fileName: string;
  uploadedAt: { seconds: number; nanoseconds: number } | null;
  filePath: string;
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

const RebuildKnowledgeBaseOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type RebuildKnowledgeBaseOutput = z.infer<typeof RebuildKnowledgeBaseOutputSchema>;

const KNOWLEDGE_COLLECTION = 'production_knowledge_base';
const KNOWLEDGE_DOCUMENT_ID = 'main_document';
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
        uploadedAt: data.uploadedAt
          ? { seconds: data.uploadedAt.seconds, nanoseconds: data.uploadedAt.nanoseconds }
          : null,
      };
    });
  } catch (error) {
    console.error('Error fetching knowledge documents:', error);
    return [];
  }
}

export async function deleteKnowledgeDocument(docId: string): Promise<{ success: boolean; message: string }> {
  return deleteKnowledgeDocumentFlow({ docId });
}

export async function rebuildKnowledgeBase(): Promise<RebuildKnowledgeBaseOutput> {
  return rebuildKnowledgeBaseFlow({});
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
      const batch = firestore.batch();

      for (const document of input.documents) {
        const uniqueId = uuidv4();
        const filePath = `knowledge_base/${uniqueId}_${document.fileName}`;
        const file = bucket.file(filePath);

        const base64Data = document.pdfDataUri.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');

        await file.save(buffer, { metadata: { contentType: 'application/pdf' } });

        const newDocRef = firestore.collection(DOCUMENTS_COLLECTION).doc();
        batch.set(newDocRef, {
          fileName: document.fileName,
          uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
          filePath,
        });
      }

      await batch.commit();

      const rebuildResult = await rebuildKnowledgeBaseFlow({});
      if (!rebuildResult.success) {
        throw new Error(`Knowledge base rebuild failed: ${rebuildResult.message}`);
      }

      return {
        success: true,
        message: `${input.documents.length} PDF(s) uploaded. Knowledge base is being updated.`,
      };
    } catch (error: any) {
      console.error('Error processing PDFs:', error);
      return {
        success: false,
        message: (error as Error).message || 'Failed to process PDFs.',
      };
    }
  }
);

const deleteKnowledgeDocumentFlow = ai.defineFlow(
  {
    name: 'deleteKnowledgeDocumentFlow',
    inputSchema: z.object({ docId: z.string() }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ docId }) => {
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

      await rebuildKnowledgeBaseFlow({});

      return { success: true, message: `Document '${documentData.fileName}' deleted. Knowledge base is being updated.` };
    } catch (error) {
      console.error('Error deleting document:', error);
      return { success: false, message: 'Failed to delete document.' };
    }
  }
);

const rebuildKnowledgeBaseFlow = ai.defineFlow(
  {
    name: 'rebuildKnowledgeBaseFlow',
    inputSchema: z.object({}),
    outputSchema: RebuildKnowledgeBaseOutputSchema,
  },
  async () => {
    try {
      const allDocs = await getKnowledgeDocuments();
      const bucket = adminStorage.bucket(STORAGE_BUCKET);
      const knowledgeDocRef = firestore.collection(KNOWLEDGE_COLLECTION).doc(KNOWLEDGE_DOCUMENT_ID);

      if (allDocs.length === 0) {
        await knowledgeDocRef.set(
          {
            content: '',
            lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return { success: true, message: 'Knowledge base is empty and has been cleared.' };
      }

      const textExtractionPromises = allDocs.map(async (docInfo) => {
        try {
          const file = bucket.file(docInfo.filePath);
          const [exists] = await file.exists();
          if (!exists) {
            console.warn(`File ${docInfo.filePath} not found in Storage for rebuild, skipping.`);
            return '';
          }

          const [fileBuffer] = await file.download();
          const base64Data = fileBuffer.toString('base64');

          const textContent = await (googleAI as any).extractText({
            media: { data: base64Data, mimeType: 'application/pdf' },
          });

          return `\n\n--- Content from ${docInfo.fileName} ---\n\n${textContent}`;
        } catch (fetchError) {
          console.error(`Error processing file ${docInfo.fileName} for rebuild, skipping. Error:`, fetchError);
          return '';
        }
      });

      const allTextContents = await Promise.all(textExtractionPromises);
      const combinedContent = allTextContents.filter(Boolean).join('');

      await knowledgeDocRef.set(
        {
          content: combinedContent,
          lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { success: true, message: 'Knowledge base rebuilt successfully.' };
    } catch (error) {
      console.error('Error rebuilding knowledge base:', error);
      return { success: false, message: 'Failed to rebuild knowledge base.' };
    }
  }
);
