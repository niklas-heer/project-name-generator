import { chat, getModelId, getTemperature } from "./openrouter";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

export interface GenerateOptions {
  description: string;
  count: number;
  model: string;
  style?: "short" | "word" | "compound" | "all";
  sources?: string[];
  excludedNames?: string[];
  feedback?: string; // Additional user feedback for refinement
}

export interface GeneratedName {
  name: string;
  rationale: string;
  source?: string; // e.g., "German", "Latin", "Japanese"
}

export interface GenerateResult {
  names: GeneratedName[];
  model: string;
  prompt: string;
}

const PROMPT_FILE = "prompts/generate-names.md";

async function loadPromptFile(): Promise<{
  systemPrompt: string;
  userTemplate: string;
}> {
  // Get the project root directory
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(currentDir, "..");
  const promptPath = resolve(projectRoot, PROMPT_FILE);

  const content = await Bun.file(promptPath).text();

  // Split on the "---" separator
  const parts = content.split(/\n---\n/);

  if (parts.length < 2) {
    throw new Error(`Invalid prompt file format: ${promptPath}`);
  }

  // Extract system prompt (everything after "## System Prompt" until "---")
  const systemSection = parts[0];
  const systemPrompt = systemSection
    .replace(/^#\s+Name Generation Prompt\s*\n+/, "")
    .replace(/^##\s+System Prompt\s*\n+/, "")
    .trim();

  // Extract user template (everything after "## User Prompt Template")
  const userSection = parts[1];
  const userTemplate = userSection
    .replace(/^##\s+User Prompt Template\s*\n+/, "")
    .trim();

  return { systemPrompt, userTemplate };
}

function getStyleGuidance(style?: string): string {
  switch (style) {
    case "short":
      return "Focus on ultra-short names (2-4 characters) like rg, fd, jq, uv.";
    case "word":
      return "Focus on single evocative words (4-6 characters) like Rust, Vite, Bun, Swift.";
    case "compound":
      return "Focus on short compound names (6-10 characters) like FastAPI, ripgrep.";
    default:
      return "Mix of ultra-short (2-4 chars), single words (4-6 chars), and short compounds.";
  }
}

function getSourceGuidance(sources?: string[]): string {
  if (sources && sources.length > 0) {
    return `Draw primarily from these language sources: ${sources.join(", ")}.`;
  }
  return "Draw from German, Latin, Greek, Japanese, Spanish, and English word sources.";
}

function getExcludedNamesSection(
  excludedNames?: string[],
  feedback?: string,
): string {
  const parts: string[] = [];

  if (excludedNames && excludedNames.length > 0) {
    parts.push(`**Previously Suggested Names (DO NOT suggest these again):**
${excludedNames.join(", ")}

These names have already been suggested or are unavailable. Generate completely different names.`);
  }

  if (feedback) {
    parts.push(`**User Feedback:**
${feedback}`);
  }

  return parts.join("\n\n");
}

function buildUserPrompt(template: string, options: GenerateOptions): string {
  const styleGuidance = getStyleGuidance(options.style);
  const sourceGuidance = getSourceGuidance(options.sources);
  const excludedSection = getExcludedNamesSection(
    options.excludedNames,
    options.feedback,
  );

  return template
    .replace(/\{\{count\}\}/g, options.count.toString())
    .replace(/\{\{description\}\}/g, options.description)
    .replace(/\{\{styleGuidance\}\}/g, styleGuidance)
    .replace(/\{\{sourceGuidance\}\}/g, sourceGuidance)
    .replace(/\{\{excludedNames\}\}/g, excludedSection);
}

export async function generateNames(
  options: GenerateOptions,
): Promise<GenerateResult> {
  const modelId = await getModelId(options.model);

  const { systemPrompt, userTemplate } = await loadPromptFile();
  const userPrompt = buildUserPrompt(userTemplate, options);

  // Use high temperature for creative generation, lower for refinement
  const isRefinement =
    options.excludedNames && options.excludedNames.length > 0;
  const temperature = await getTemperature(
    isRefinement ? "refine" : "generate",
  );

  const response = await chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    modelId,
    temperature,
  );

  // Parse the JSON response
  let names: GeneratedName[] = [];
  try {
    // Handle potential markdown code blocks
    let jsonStr = response.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    names = JSON.parse(jsonStr);
  } catch (error) {
    throw new Error(`Failed to parse AI response as JSON: ${response}`);
  }

  return {
    names,
    model: modelId,
    prompt: userPrompt,
  };
}
