import { parse } from "yaml";
import path from "path";

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

interface ModelConfig {
  id: string;
  description: string;
}

interface ModelsConfig {
  models: Record<string, ModelConfig>;
  defaults: {
    generate: string;
    judge: string;
  };
  temperature: {
    generate: number;
    refine: number;
    judge: number;
  };
}

let modelsConfig: ModelsConfig | null = null;

async function loadModelsConfig(): Promise<ModelsConfig> {
  if (modelsConfig) return modelsConfig;

  const configPath = path.join(import.meta.dir, "..", "config", "models.yaml");
  const content = await Bun.file(configPath).text();
  modelsConfig = parse(content) as ModelsConfig;
  return modelsConfig;
}

export async function getModelId(alias: string): Promise<string> {
  const config = await loadModelsConfig();
  if (alias in config.models) {
    return config.models[alias].id;
  }
  // Allow passing full model IDs directly
  return alias;
}

export async function listModels(): Promise<string[]> {
  const config = await loadModelsConfig();
  return Object.keys(config.models);
}

export async function getModelDetails(): Promise<Record<string, ModelConfig>> {
  const config = await loadModelsConfig();
  return config.models;
}

export async function getDefaultModel(
  command: "generate" | "judge",
): Promise<string> {
  const config = await loadModelsConfig();
  return config.defaults[command];
}

export async function getTemperature(
  task: "generate" | "refine" | "judge",
): Promise<number> {
  const config = await loadModelsConfig();
  return config.temperature[task];
}

export async function chat(
  messages: OpenRouterMessage[],
  model: string,
  temperature?: number,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not set. Add it to your .env file.");
  }

  const modelId = await getModelId(model);

  const body: Record<string, unknown> = {
    model: modelId,
    messages,
  };

  if (temperature !== undefined) {
    body.temperature = temperature;
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/niklas-heer/project-name-generator",
      "X-Title": "Project Name Generator",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  return data.choices[0]?.message?.content || "";
}

// Helper for simple system + user prompt calls
export async function callOpenRouter(options: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}): Promise<string> {
  return chat(
    [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userPrompt },
    ],
    options.model,
    options.temperature,
  );
}
