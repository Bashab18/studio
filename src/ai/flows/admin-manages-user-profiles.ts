'use server';
/**
 * @fileOverview Flow for admin to manage user profile data.
 *
 * Authorization: Firestore security rules restrict this operation to admin users only.
 * The client SDK enforces these rules at the database level.
 *
 * - updateUserAdminNotes - A function that allows an admin to update the notes for a specific user.
 */

import { ai } from '@/ai/genkit';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    UpdateUserAdminNotesInputSchema,
    UpdateUserAdminNotesOutputSchema,
    type UpdateUserAdminNotesInput,
    type UpdateUserAdminNotesOutput,
} from '@/ai/schemas/admin-manages-user-profiles';

export async function updateUserAdminNotes(input: UpdateUserAdminNotesInput): Promise<UpdateUserAdminNotesOutput> {
    return updateUserAdminNotesFlow(input);
}

const updateUserAdminNotesFlow = ai.defineFlow(
  {
    name: 'updateUserAdminNotesFlow',
    inputSchema: UpdateUserAdminNotesInputSchema,
    outputSchema: UpdateUserAdminNotesOutputSchema,
  },
  async ({ userId, notes }) => {
    try {
      if (!userId || !userId.trim()) {
        throw new Error('User ID is required.');
      }

      // Validate notes length
      const MAX_NOTES_LENGTH = 10000;
      if (notes && notes.length > MAX_NOTES_LENGTH) {
        throw new Error(`Notes exceed maximum length of ${MAX_NOTES_LENGTH} characters.`);
      }

      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        adminNotes: notes || '',
      });

      return {
        success: true,
        message: 'User notes updated successfully.',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error updating user notes:', errorMessage);

      // Handle permission errors from Firestore security rules
      if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
        return {
          success: false,
          message: 'You do not have permission to update user notes. Admin role required.',
        };
      }

      return {
        success: false,
        message: errorMessage || 'Failed to update user notes.',
      };
    }
  }
);
