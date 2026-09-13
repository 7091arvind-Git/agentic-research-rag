import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

export function getApiKey(): string {
  return process.env.GEMINI_API_KEY || "";
}

export function hasApiKey(): boolean {
  const key = getApiKey();
  return Boolean(key && key.trim().length > 0);
}

export function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = getApiKey();
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}
