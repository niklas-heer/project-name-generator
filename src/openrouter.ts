const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      content: string;
    };
  }[];
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Popular models for name generation
export const AVAILABLE_MODELS = {
  "claude-sonnet": "anthropic/claude-sonnet-4",
  "claude-haiku": "anthropic/claude-3-5-haiku",
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "llama-70b": "meta-llama/llama-3.3-70b-instruct",
  "gemini-flash": "google/gemini-2.0-flash-001",
  "gemini-2.5-pro": "google/gemini-2.5-pro-preview-06-05",
} as const;

export type ModelAlias = keyof typeof AVAILABLE_MODELS;

export const DEFAULT_MODEL: ModelAlias = "claude-sonnet";

export function getModelId(alias: string): string {
  if (alias in AVAILABLE_MODELS) {
    return AVAILABLE_MODELS[alias as ModelAlias];
  }
  // Allow passing full model IDs directly
  return alias;
}

export async function chat(
  messages: OpenRouterMessage[],
  model: string = AVAILABLE_MODELS[DEFAULT_MODEL],
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not set. Add it to your .env file.");
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/niklas-heer/project-name-generator",
      "X-Title": "Project Name Generator",
    },
    body: JSON.stringify({
      model,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  return data.choices[0]?.message?.content || "";
}

export function listModels(): string[] {
  return Object.keys(AVAILABLE_MODELS);
}

// Helper for simple system + user prompt calls
export async function callOpenRouter(options: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<string> {
  const modelId = getModelId(options.model);
  return chat(
    [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userPrompt },
    ],
    modelId,
  );
}
