/**
 * Application constants
 */

// Firestore collection names
export const COLLECTIONS = {
  USERS: 'users',
  CHATS: 'chats',
  MESSAGES: 'messages',
  SETTINGS: 'settings',
  KNOWLEDGE_BASE: 'production_knowledge_base',
  KNOWLEDGE_DOCUMENTS: 'production_knowledge_documents',
  KNOWLEDGE_CHUNKS: 'knowledge_chunks',
} as const;

// Valid Genkit model names for the chatbot
export const VALID_MODELS = [
  'googleai/gemini-2.5-flash',
  'googleai/gemini-1.5-flash-latest',
  'googleai/gemini-1.5-pro-latest',
] as const;

export const DEFAULT_MODEL = 'googleai/gemini-2.5-flash';

// Validation functions
export function isValidModel(model: string): boolean {
  return VALID_MODELS.includes(model as any);
}

// UI-friendly model names
export const MODEL_DISPLAY_NAMES: Record<typeof VALID_MODELS[number], string> = {
  'googleai/gemini-2.5-flash': 'Gemini 2.5 Flash (Latest)',
  'googleai/gemini-1.5-flash-latest': 'Gemini 1.5 Flash',
  'googleai/gemini-1.5-pro-latest': 'Gemini 1.5 Pro',
};

// Max input/output lengths
export const LIMITS = {
  PROFILE_INFO_MAX: 5000,
  ADMIN_NOTES_MAX: 10000,
  CHAT_MESSAGE_MAX: 50000,
  CHATBOT_PERSONA_MAX: 50000,
} as const;

// Timeouts (in milliseconds)
export const TIMEOUTS = {
  CHATBOT_REQUEST: 30000, // 30 seconds
  FIREBASE_OPERATION: 10000, // 10 seconds
} as const;
