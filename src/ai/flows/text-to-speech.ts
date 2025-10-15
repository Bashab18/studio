'use server';
/**
 * @fileOverview A flow to convert text to speech.
 *
 * - textToSpeech - A function that takes text and returns audio data.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit';
import wav from 'wav';

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

export const TextToSpeechOutputSchema = z.object({
  audio: z.string().describe('The base64 encoded audio data.'),
});
export type TextToSpeechOutput = z.infer<typeof TextToSpeechOutputSchema>;

export async function textToSpeech(text: string): Promise<TextToSpeechOutput> {
  return textToSpeechFlow(text);
}

const textToSpeechFlow = ai.defineFlow(
  {
    name: 'textToSpeechFlow',
    inputSchema: z.string(),
    outputSchema: TextToSpeechOutputSchema,
  },
  async (query) => {
    const { media } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-preview-tts'),
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Algenib' },
          },
        },
      },
      prompt: query,
    });
    if (!media) {
      throw new Error('No audio was generated.');
    }
    const audioBuffer = Buffer.from(
      media.url.substring(media.url.indexOf(',') + 1),
      'base64'
    );
    const wavData = await toWav(audioBuffer);
    return {
      audio: 'data:audio/wav;base64,' + wavData,
    };
  }
);
