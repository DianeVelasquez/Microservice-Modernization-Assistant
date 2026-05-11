import { WatsonxChatModel } from "beeai-framework/adapters/watsonx/backend/chat";
import { config } from "dotenv";

config();

export interface LLMConfig {
  apiKey: string;
  model: string;
  projectId?: string;
  baseUrl?: string;
}

export function createWatsonxLLM(customConfig?: Partial<LLMConfig>) {
  const apiKey = customConfig?.apiKey || process.env.WATSONX_API_KEY;
  const model = customConfig?.model || process.env.WATSONX_CHAT_MODEL || "ibm/granite-3-3-8b-instruct";
  const projectId = customConfig?.projectId || process.env.WATSONX_PROJECT_ID;
  const baseUrl = customConfig?.baseUrl || process.env.WATSONX_URL;

  if (!apiKey) {
    throw new Error(
      "WATSONX_API_KEY is required. Please set it in your .env file or pass it as a parameter."
    );
  }
  if (!projectId) {
    throw new Error(
      "WATSONX_PROJECT_ID is required. Please set it in your .env file or pass it as a parameter."
    );
  }

  return new WatsonxChatModel(model, {
    apiKey,
    baseUrl,
    projectId,
  });
}

export function getDefaultLLM() {
  return createWatsonxLLM();
}

// Alias for consistency
export const createWatsonxChatLLM = createWatsonxLLM;