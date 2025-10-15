import { config } from 'dotenv';
config();

import '@/ai/flows/admin-uploads-pdf-knowledge-base.ts';
import '@/ai/flows/chatbot-answers-questions-from-knowledge-base.ts';
import '@/ai/flows/admin-manages-user-profiles.ts';
import '@/ai/schemas/admin-manages-user-profiles.ts';
import '@/ai/flows/user-manages-own-profile.ts';
import '@/ai/schemas/user-manages-own-profile.ts';
import '@/ai/flows/admin-manages-settings.ts';
import '@/ai/flows/user-clears-chat-history.ts';
import '@/ai/flows/text-to-speech.ts';
import '@/ai/schemas/text-to-speech.ts';
