import OpenAI from "openai";
import { config } from "../core/config.js";

let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  if (!config.OPENAI_API_KEY) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}
