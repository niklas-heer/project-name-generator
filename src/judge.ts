import { callOpenRouter, getTemperature } from "./openrouter";
import path from "path";

export interface NameScore {
  name: string;
  typability: number;
  memorability: number;
  story: number; // renamed from "meaning" - how clever is the metaphor/connection?
  uniqueness: number;
  culturalRisk: number;
  overall: number;
  verdict: "strong" | "consider" | "reject";
  weaknesses: string;
}

export interface JudgeResult {
  description: string;
  model: string;
  scores: NameScore[];
  summary: {
    strong: number;
    consider: number;
    reject: number;
  };
}

async function loadJudgePrompt(): Promise<{ system: string; user: string }> {
  const promptPath = path.join(
    import.meta.dir,
    "..",
    "prompts",
    "judge-names.md",
  );
  const content = await Bun.file(promptPath).text();

  const parts = content.split("---");
  if (parts.length < 3) {
    throw new Error(
      "Judge prompt file must have system and user sections separated by ---",
    );
  }

  return {
    system: parts[1].trim(),
    user: parts[2].trim(),
  };
}

function parseJudgeResponse(response: string): NameScore[] {
  const scores: NameScore[] = [];

  // Look for JSON block in response
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          name: item.name || "",
          typability: item.typability || 0,
          memorability: item.memorability || 0,
          story: item.story || item.meaning || 0, // support both "story" and legacy "meaning"
          uniqueness: item.uniqueness || 0,
          culturalRisk: item.culturalRisk || item.cultural_risk || 0,
          overall: item.overall || 0,
          verdict: item.verdict || "reject",
          weaknesses: item.weaknesses || "",
        }));
      }
    } catch {
      // Fall through to table parsing
    }
  }

  // Parse markdown table format as fallback
  const lines = response.split("\n");
  let inTable = false;

  for (const line of lines) {
    if (line.includes("|") && line.includes("Name")) {
      inTable = true;
      continue;
    }
    if (inTable && line.match(/^\s*\|[-:\s|]+\|\s*$/)) {
      continue; // Skip separator line
    }
    if (inTable && line.includes("|")) {
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      if (cells.length >= 7) {
        const [name, typ, mem, mean, uniq, cult, overall, verdict, ...rest] =
          cells;
        const weaknesses = rest.join(" ").trim();

        scores.push({
          name: name.replace(/\*\*/g, "").trim(),
          typability: parseInt(typ) || 0,
          memorability: parseInt(mem) || 0,
          story: parseInt(mean) || 0, // table column is still called "mean" but maps to story
          uniqueness: parseInt(uniq) || 0,
          culturalRisk: parseInt(cult) || 0,
          overall: parseFloat(overall) || 0,
          verdict: (verdict?.toLowerCase() as NameScore["verdict"]) || "reject",
          weaknesses: weaknesses || "",
        });
      }
    }
  }

  return scores;
}

export async function judgeNames(options: {
  names: Array<{ name: string; rationale?: string; source?: string }>;
  description: string;
  model?: string;
}): Promise<JudgeResult> {
  const { names, description, model = "gemini-2.5-pro" } = options;

  const promptTemplate = await loadJudgePrompt();

  // Format names for the prompt
  const namesList = names
    .map((n) => {
      let line = `- **${n.name}**`;
      if (n.source) line += ` [${n.source}]`;
      if (n.rationale) line += `: ${n.rationale}`;
      return line;
    })
    .join("\n");

  const userPrompt = promptTemplate.user
    .replace("{{DESCRIPTION}}", description)
    .replace("{{NAMES}}", namesList)
    .replace("{{COUNT}}", names.length.toString());

  // Use low temperature for analytical evaluation
  const temperature = await getTemperature("judge");

  const response = await callOpenRouter({
    model,
    systemPrompt: promptTemplate.system,
    userPrompt,
    temperature,
  });

  const scores = parseJudgeResponse(response);

  // Calculate summary
  const summary = {
    strong: scores.filter((s) => s.verdict === "strong").length,
    consider: scores.filter((s) => s.verdict === "consider").length,
    reject: scores.filter((s) => s.verdict === "reject").length,
  };

  return {
    description,
    model,
    scores,
    summary,
  };
}

export function generateMarkdownReport(result: JudgeResult): string {
  const lines: string[] = [];

  lines.push(`# Name Evaluation Report`);
  lines.push("");
  lines.push(
    `${result.description} | ✅ ${result.summary.strong} strong, 🤔 ${result.summary.consider} consider, ❌ ${result.summary.reject} reject`,
  );
  lines.push("");

  // Scoring table
  lines.push(
    "| Name | Typ | Mem | Story | Uniq | Risk | Score | Verdict | Weaknesses |",
  );
  lines.push(
    "|------|-----|-----|-------|------|------|-------|---------|------------|",
  );

  // Sort by overall score descending
  const sorted = [...result.scores].sort((a, b) => b.overall - a.overall);

  for (const score of sorted) {
    const verdictEmoji =
      score.verdict === "strong"
        ? "✅"
        : score.verdict === "consider"
          ? "🤔"
          : "❌";

    lines.push(
      `| **${score.name}** | ${score.typability} | ${score.memorability} | ${score.story} | ${score.uniqueness} | ${score.culturalRisk} | ${score.overall.toFixed(1)} | ${verdictEmoji} | ${score.weaknesses} |`,
    );
  }

  lines.push("");
  lines.push(
    `_Typ=Typability, Mem=Memorability, Story=Metaphor/connection, Uniq=Uniqueness, Risk=Cultural (1=safe, 5=bad)_`,
  );

  return lines.join("\n");
}
