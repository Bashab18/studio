'use server';
/**
 * @fileOverview Flow for a user to manage their own profile data.
 *
 * Authorization: Uses Firestore security rules to ensure users can only update their own profiles.
 * The client SDK enforces these rules at the database level.
 *
 * - updateUserProfileInfo - A function that allows a user to update their profile information.
 */

import { ai } from '@/ai/genkit';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    UpdateUserProfileInfoInputSchema,
    UpdateUserProfileInfoOutputSchema,
    type UpdateUserProfileInfoInput,
    type UpdateUserProfileInfoOutput,
} from '@/ai/schemas/user-manages-own-profile';

export async function updateUserProfileInfo(input: UpdateUserProfileInfoInput): Promise<UpdateUserProfileInfoOutput> {
    return updateUserProfileInfoFlow(input);
}

const updateUserProfileInfoFlow = ai.defineFlow(
  {
    name: 'updateUserProfileInfoFlow',
    inputSchema: UpdateUserProfileInfoInputSchema,
    outputSchema: UpdateUserProfileInfoOutputSchema,
  },
  async ({ userId, profileInfo }) => {
    try {
      if (!userId || !userId.trim()) {
        throw new Error('User ID is required.');
      }

      // Validate profile info length (issue #10)
      const MAX_PROFILE_LENGTH = 5000;
      if (profileInfo && profileInfo.length > MAX_PROFILE_LENGTH) {
        throw new Error(`Profile info exceeds maximum length of ${MAX_PROFILE_LENGTH} characters.`);
      }

      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        profileInfo: profileInfo || '',
      });

      return {
        success: true,
        message: 'User profile updated successfully.',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error updating user profile:', errorMessage);

      // Handle permission errors from Firestore security rules
      if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
        return {
          success: false,
          message: 'You are not authorized to update this profile.',
        };
      }

      return {
        success: false,
        message: errorMessage || 'Failed to update user profile.',
      };
    }
  }
);
