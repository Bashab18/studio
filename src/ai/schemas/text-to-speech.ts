/**
 * @fileOverview Schemas for the text-to-speech flow.
 * 
 * - TextToSpeechOutputSchema - The Zod schema for the output of the textToSpeech function.
 * - TextToSpeechOutput - The TypeScript type for the output of the textToSpeech function.
 */

import { z } from 'genkit';

export const TextToSpeechOutputSchema = z.object({
  audio: z.string().describe('The base64 encoded audio data.'),
});
export type TextToSpeechOutput = z.infer<typeof TextToSpeechOutputSchema>;
