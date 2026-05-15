import { WatsonxChatModel } from "beeai-framework/adapters/watsonx/backend/chat";
import { UserMessage } from "beeai-framework/backend/message";
import { config } from "dotenv";

config();

export type LLMProvider = "watsonx" | "openai-compatible";

export interface ChatLLMOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface ChatLLM {
  provider: LLMProvider;
  model: string;
  complete(prompt: string, options?: ChatLLMOptions): Promise<string>;
}

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
  projectId?: string;
  baseUrl?: string;
}

class WatsonxLLMAdapter implements ChatLLM {
  provider: LLMProvider = "watsonx";
  model: string;
  private llm: WatsonxChatModel;

  constructor(config: Required<Pick<LLMConfig, "apiKey" | "model" | "projectId">> & Pick<LLMConfig, "baseUrl">) {
    this.model = config.model;
    this.llm = new WatsonxChatModel(config.model, {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      projectId: config.projectId,
    });
  }

  async complete(prompt: string, options?: ChatLLMOptions): Promise<string> {
    this.llm.config({
      parameters: {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      },
    });

    const response = await this.llm.create({
      messages: [new UserMessage(prompt)],
    });
    return response.getTextContent();
  }
}

class OpenAICompatibleLLMAdapter implements ChatLLM {
  provider: LLMProvider = "openai-compatible";
  model: string;
  private apiKey?: string;
  private baseUrl: string;

  constructor(config: Pick<LLMConfig, "apiKey" | "baseUrl"> & { model: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  }

  async complete(prompt: string, options?: ChatLLMOptions): Promise<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI-compatible request failed (${response.status}): ${body}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI-compatible response did not include message content.");
    }
    return content;
  }
}

function getProvider(customConfig?: Partial<LLMConfig>): LLMProvider {
  const provider = customConfig?.provider || process.env.LLM_PROVIDER || "watsonx";
  if (provider === "watsonx" || provider === "openai-compatible") {
    return provider;
  }
  throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
}

export function createLLM(customConfig?: Partial<LLMConfig>): ChatLLM {
  const provider = getProvider(customConfig);

  if (provider === "openai-compatible") {
    return new OpenAICompatibleLLMAdapter({
      apiKey: customConfig?.apiKey || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY,
      baseUrl: customConfig?.baseUrl || process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL,
      model: customConfig?.model || process.env.LLM_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
    });
  }

  return createWatsonxLLM(customConfig);
}

function createWatsonxLLM(customConfig?: Partial<LLMConfig>): ChatLLM {
  const apiKey = customConfig?.apiKey || process.env.LLM_API_KEY || process.env.WATSONX_API_KEY;
  const model = customConfig?.model || process.env.LLM_MODEL || process.env.WATSONX_CHAT_MODEL || "ibm/granite-3-3-8b-instruct";
  const projectId = customConfig?.projectId || process.env.WATSONX_PROJECT_ID;
  const baseUrl = customConfig?.baseUrl || process.env.LLM_BASE_URL || process.env.WATSONX_URL;

  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY or WATSONX_API_KEY is required for the WatsonX provider."
    );
  }
  if (!projectId) {
    throw new Error(
      "WATSONX_PROJECT_ID is required for the WatsonX provider."
    );
  }

  return new WatsonxLLMAdapter({ apiKey, model, projectId, baseUrl });
}

export function getDefaultLLM(): ChatLLM {
  return createLLM();
}
