'use server';
/**
 * @fileOverview RAG indexing and semantic retrieval layer.
 *
 * - indexDocumentChunks   — Chunk text and store embeddings in Firestore.
 * - deleteDocumentChunks  — Remove all chunks belonging to a source document.
 * - clearAllChunks        — Wipe the entire chunk index (used before a full rebuild).
 * - semanticSearch        — Embed a query and return the top-k most relevant chunks.
 */

import { ai } from '@/ai/genkit';
import { firestore } from '@/lib/firebase-admin';
import admin from 'firebase-admin';
import { chunkText, cosineSimilarity, batchArray } from '@/lib/rag-utils';
import { COLLECTIONS } from '@/lib/constants';

const CHUNKS_COLLECTION = COLLECTIONS.KNOWLEDGE_CHUNKS;
const EMBEDDING_MODEL = 'googleai/text-embedding-004';
const DEFAULT_TOP_K = 5;
const FIRESTORE_BATCH_LIMIT = 400; // stay safely below the 500-op Firestore limit

export type KnowledgeChunk = {
  id: string;
  sourceDocId: string;
  fileName: string;
  content: string;
  embedding: number[];
  chunkIndex: number;
};

// ---------------------------------------------------------------------------
// Indexing
// ---------------------------------------------------------------------------

export async function indexDocumentChunks(
  text: string,
  sourceDocId: string,
  fileName: string
): Promise<void> {
  const chunks = chunkText(text);
  if (chunks.length === 0) return;

  // Generate all embeddings in parallel
  const embeddings: number[][] = await Promise.all(
    chunks.map(async chunk => {
      const result = await ai.embed({ embedder: EMBEDDING_MODEL, content: chunk });
      return result[0].embedding;
    })
  );

  // Write to Firestore in batches
  const records = chunks.map((content, i) => ({
    sourceDocId,
    fileName,
    content,
    embedding: embeddings[i],
    chunkIndex: i,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }));

  for (const batch of batchArray(records, FIRESTORE_BATCH_LIMIT)) {
    const writeBatch = firestore.batch();
    batch.forEach(data => {
      writeBatch.set(firestore.collection(CHUNKS_COLLECTION).doc(), data);
    });
    await writeBatch.commit();
  }
}

export async function deleteDocumentChunks(sourceDocId: string): Promise<void> {
  const snapshot = await firestore
    .collection(CHUNKS_COLLECTION)
    .where('sourceDocId', '==', sourceDocId)
    .get();

  for (const batch of batchArray(snapshot.docs, FIRESTORE_BATCH_LIMIT)) {
    const writeBatch = firestore.batch();
    batch.forEach(doc => writeBatch.delete(doc.ref));
    await writeBatch.commit();
  }
}

export async function clearAllChunks(): Promise<void> {
  const snapshot = await firestore.collection(CHUNKS_COLLECTION).get();
  if (snapshot.empty) return;

  for (const batch of batchArray(snapshot.docs, FIRESTORE_BATCH_LIMIT)) {
    const writeBatch = firestore.batch();
    batch.forEach(doc => writeBatch.delete(doc.ref));
    await writeBatch.commit();
  }
}

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

export async function semanticSearch(
  query: string,
  topK: number = DEFAULT_TOP_K
): Promise<KnowledgeChunk[]> {
  const [queryEmbeddingResult, snapshot] = await Promise.all([
    ai.embed({ embedder: EMBEDDING_MODEL, content: query }),
    firestore.collection(CHUNKS_COLLECTION).get(),
  ]);
  const queryEmbedding = queryEmbeddingResult[0].embedding;

  if (snapshot.empty) return [];

  const chunks: KnowledgeChunk[] = snapshot.docs.map(d => ({
    id: d.id,
    ...(d.data() as Omit<KnowledgeChunk, 'id'>),
  }));

  return chunks
    .map(chunk => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.chunk);
}
