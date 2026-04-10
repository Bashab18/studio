'use server';
/**
 * @fileOverview Flow for an admin to manage application settings.
 *
 * - updateChatbotPersona - A function that allows an admin to update the chatbot's persona.
 * - getChatbotPersona - A function that retrieves the chatbot's current persona.
 * - updateChatbotModel - A function that allows an admin to update the chatbot's model.
 * - getChatbotModel - A function that retrieves the chatbot's current model.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { googleAI } from '@genkit-ai/googleai';
import { LIMITS, VALID_MODELS, DEFAULT_MODEL, isValidModel } from '@/lib/constants';

const SETTINGS_COLLECTION = 'settings';
const CHATBOT_PERSONA_DOC_ID = 'chatbot_persona';
const CHATBOT_MODEL_DOC_ID = 'chatbot_model';

const UpdateChatbotPersonaOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type UpdateChatbotPersonaOutput = z.infer<typeof UpdateChatbotPersonaOutputSchema>;

const GetChatbotPersonaOutputSchema = z.object({
  persona: z.string().optional(),
});
export type GetChatbotPersonaOutput = z.infer<typeof GetChatbotPersonaOutputSchema>;

const UpdateChatbotModelOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type UpdateChatbotModelOutput = z.infer<typeof UpdateChatbotModelOutputSchema>;

const GetChatbotModelOutputSchema = z.object({
  model: z.string().optional(),
});
export type GetChatbotModelOutput = z.infer<typeof GetChatbotModelOutputSchema>;


export async function updateChatbotPersona(persona: string): Promise<UpdateChatbotPersonaOutput> {
    return updateChatbotPersonaFlow(persona);
}

export async function getChatbotPersona(): Promise<GetChatbotPersonaOutput> {
    return getChatbotPersonaFlow({});
}

export async function updateChatbotModel(model: string): Promise<UpdateChatbotModelOutput> {
    return updateChatbotModelFlow(model);
}

export async function getChatbotModel(): Promise<GetChatbotModelOutput> {
    return getChatbotModelFlow({});
}

const updateChatbotPersonaFlow = ai.defineFlow(
  {
    name: 'updateChatbotPersonaFlow',
    inputSchema: z.string(),
    outputSchema: UpdateChatbotPersonaOutputSchema,
  },
  async (persona) => {
    try {
      // Validate persona length
      if (persona && persona.length > LIMITS.CHATBOT_PERSONA_MAX) {
        return {
          success: false,
          message: `Persona exceeds maximum length of ${LIMITS.CHATBOT_PERSONA_MAX} characters.`,
        };
      }

      const personaDocRef = doc(db, SETTINGS_COLLECTION, CHATBOT_PERSONA_DOC_ID);
      await setDoc(personaDocRef, {
        persona: persona || '',
        updatedAt: serverTimestamp(),
      }, { merge: true });

      return {
        success: true,
        message: 'Chatbot persona updated successfully.',
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Error updating chatbot persona:', errorMsg);
      if (errorMsg.includes('permission-denied')) {
        return {
          success: false,
          message: "Permission Denied. Please grant the 'Cloud Datastore User' role to your App Hosting service account in the Google Cloud IAM console.",
        };
      }
      return {
        success: false,
        message: errorMsg || 'Failed to update chatbot persona.',
      };
    }
  }
);

const getChatbotPersonaFlow = ai.defineFlow(
  {
    name: 'getChatbotPersonaFlow',
    inputSchema: z.object({}),
    outputSchema: GetChatbotPersonaOutputSchema,
  },
  async () => {
    try {
      const personaDocRef = doc(db, SETTINGS_COLLECTION, CHATBOT_PERSONA_DOC_ID);
      const docSnap = await getDoc(personaDocRef);

      if (docSnap.exists()) {
        return { persona: docSnap.data().persona };
      } else {
        return { persona: '' };
      }
    } catch (error) {
      console.error('Error getting chatbot persona:', error);
      return { persona: '' };
    }
  }
);

const updateChatbotModelFlow = ai.defineFlow(
  {
    name: 'updateChatbotModelFlow',
    inputSchema: z.string(),
    outputSchema: UpdateChatbotModelOutputSchema,
  },
  async (model) => {
    try {
      // Validate model name
      if (!model || !isValidModel(model)) {
        return {
          success: false,
          message: `Invalid model. Allowed models are: ${VALID_MODELS.join(', ')}`,
        };
      }

      const modelDocRef = doc(db, SETTINGS_COLLECTION, CHATBOT_MODEL_DOC_ID);
      await setDoc(modelDocRef, {
        model: model,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      return {
        success: true,
        message: 'Chatbot model updated successfully.',
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Error updating chatbot model:', errorMsg);
      if (errorMsg.includes('permission-denied')) {
        return {
          success: false,
          message: "Permission Denied. Please grant the 'Cloud Datastore User' role to your App Hosting service account in the Google Cloud IAM console.",
        };
      }
      return {
        success: false,
        message: errorMsg || 'Failed to update chatbot model.',
      };
    }
  }
);

const getChatbotModelFlow = ai.defineFlow(
  {
    name: 'getChatbotModelFlow',
    inputSchema: z.object({}),
    outputSchema: GetChatbotModelOutputSchema,
  },
  async () => {
    try {
      const modelDocRef = doc(db, SETTINGS_COLLECTION, CHATBOT_MODEL_DOC_ID);
      const docSnap = await getDoc(modelDocRef);

      if (docSnap.exists() && docSnap.data().model) {
        const storedModel = docSnap.data().model;
        // Validate stored model is still valid
        return { model: isValidModel(storedModel) ? storedModel : DEFAULT_MODEL };
      } else {
        // Return default model if not set
        return { model: DEFAULT_MODEL };
      }
    } catch (error) {
      console.error('Error getting chatbot model:', error);
      return { model: DEFAULT_MODEL };
    }
  }
);
