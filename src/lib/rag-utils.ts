/**
 * Splits text into overlapping chunks, respecting paragraph boundaries where possible.
 */
export function chunkText(text: string, chunkSize = 1500, overlap = 150): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length + 2 <= chunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
    } else {
      if (currentChunk) chunks.push(currentChunk);

      if (trimmed.length > chunkSize) {
        // Single paragraph exceeds chunk size — split with overlap
        let start = 0;
        while (start < trimmed.length) {
          const end = Math.min(start + chunkSize, trimmed.length);
          chunks.push(trimmed.slice(start, end));
          if (end === trimmed.length) break;
          start += chunkSize - overlap;
        }
        currentChunk = '';
      } else {
        currentChunk = trimmed;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);

  return chunks.filter(c => c.trim().length > 30);
}

/**
 * Computes cosine similarity between two equal-length vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Splits an array into batches of a given size.
 */
export function batchArray<T>(arr: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    batches.push(arr.slice(i, i + size));
  }
  return batches;
}
