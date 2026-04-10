'use server';
/**
 * @fileOverview Flow for a user to clear their chat history.
 *
 * Authorization: Firestore security rules restrict access to user's own chat history.
 * The client SDK enforces these rules at the database level.
 *
 * - clearChatHistory - A function that deletes all messages for a specific user.
 * - ClearChatHistoryOutput - The return type for the clearChatHistory function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, query, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const ClearChatHistoryOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type ClearChatHistoryOutput = z.infer<typeof ClearChatHistoryOutputSchema>;

export async function clearChatHistory(userId: string): Promise<ClearChatHistoryOutput> {
  return clearChatHistoryFlow(userId);
}

const clearChatHistoryFlow = ai.defineFlow(
  {
    name: 'clearChatHistoryFlow',
    inputSchema: z.string(),
    outputSchema: ClearChatHistoryOutputSchema,
  },
  async (userId) => {
    try {
      if (!userId || !userId.trim()) {
        throw new Error('User ID is required.');
      }

      const messagesRef = collection(db, 'chats', userId, 'messages');
      const q = query(messagesRef);
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: true, message: 'Chat history is already empty.' };
      }

      const batch = writeBatch(db);
      querySnapshot.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });

      await batch.commit();

      return {
        success: true,
        message: 'Chat history has been successfully cleared.',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error clearing chat history:', errorMessage);

      // Handle permission errors from Firestore security rules
      if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
        return {
          success: false,
          message: 'You are not authorized to delete this chat history.',
        };
      }

      return {
        success: false,
        message: errorMessage || 'Failed to clear chat history.',
      };
    }
  }
);
