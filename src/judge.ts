import { callOpenRouter } from "./openrouter";
import path from "path";

export interface NameScore {
  name: string;
  typability: number;
  memorability: number;
  meaning: number;
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
          meaning: item.meaning || 0,
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
          meaning: parseInt(mean) || 0,
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

  const response = await callOpenRouter({
    model,
    systemPrompt: promptTemplate.system,
    userPrompt,
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
  lines.push(`**Project:** ${result.description}`);
  lines.push(`**Judge Model:** ${result.model}`);
  lines.push(`**Date:** ${new Date().toISOString().split("T")[0]}`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push(
    `- **Strong candidates:** ${result.summary.strong}/${result.scores.length}`,
  );
  lines.push(
    `- **Worth considering:** ${result.summary.consider}/${result.scores.length}`,
  );
  lines.push(
    `- **Rejected:** ${result.summary.reject}/${result.scores.length}`,
  );
  lines.push("");

  // Scoring table
  lines.push("## Detailed Scores");
  lines.push("");
  lines.push(
    "| Name | Typ | Mem | Mean | Uniq | Risk | Overall | Verdict | Weaknesses |",
  );
  lines.push(
    "|------|-----|-----|------|------|------|---------|---------|------------|",
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
      `| **${score.name}** | ${score.typability} | ${score.memorability} | ${score.meaning} | ${score.uniqueness} | ${score.culturalRisk} | ${score.overall.toFixed(1)} | ${verdictEmoji} ${score.verdict} | ${score.weaknesses} |`,
    );
  }

  lines.push("");

  // Legend
  lines.push("## Scoring Legend");
  lines.push("");
  lines.push("- **Typ** = Typability (easy to type, no awkward key combos)");
  lines.push("- **Mem** = Memorability (sticks in the mind)");
  lines.push("- **Mean** = Meaning (relevant to project purpose)");
  lines.push("- **Uniq** = Uniqueness (stands out, not generic)");
  lines.push(
    "- **Risk** = Cultural Risk (1=safe, 5=problematic in some cultures)",
  );
  lines.push("");
  lines.push("Scores: 1=Poor, 2=Below Average, 3=Average, 4=Good, 5=Excellent");
  lines.push("");

  // Top recommendations
  const strong = sorted.filter((s) => s.verdict === "strong");
  if (strong.length > 0) {
    lines.push("## Top Recommendations");
    lines.push("");
    for (const s of strong.slice(0, 3)) {
      lines.push(`1. **${s.name}** (${s.overall.toFixed(1)}/5)`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
