import chalk from "chalk";
import { generateNames, type GeneratedName } from "./generator";
import { judgeNames, type NameScore } from "./judge";
import type { Checker, CheckResult } from "./types";
import {
  getOrCreateProject,
  getProjectNames,
  addName,
  getNameId,
  addAvailabilityCheck,
  addScore,
} from "./db";

export interface FindOptions {
  description: string;
  targetCount: number; // How many quality candidates to find
  batchSize: number; // Names to generate per iteration
  threshold: number; // Availability threshold (0-1)
  minScore: number; // Minimum judge score (e.g., 3.5)
  verdicts: string[]; // Accepted verdicts: ["strong", "consider"]
  maxIterations: number; // Safety limit
  generateModel: string;
  judgeModel: string;
  checkers: Checker[];
  style?: "short" | "word" | "compound" | "all";
  sources?: string[];
  quiet?: boolean; // Suppress progress output
  project?: string; // Project tag for database tracking
}

export interface ScoredCandidate {
  name: string;
  rationale: string;
  source?: string;
  availability: number;
  availableChecks: number;
  totalChecks: number;
  score: NameScore;
}

export interface FindResult {
  description: string;
  generateModel: string;
  judgeModel: string;
  candidates: ScoredCandidate[];
  iterations: number;
  totalGenerated: number;
  totalJudged: number;
  allGeneratedNames: string[];
}

interface NameWithAvailability extends GeneratedName {
  availability: number;
  availableChecks: number;
  totalChecks: number;
}

async function quickCheck(
  name: string,
  checkers: Checker[],
): Promise<{ available: number; total: number; results: CheckResult[] }> {
  const results = await Promise.all(
    checkers.map((checker) => checker.check(name)),
  );

  let available = 0;
  let total = 0;

  for (const result of results) {
    // Skip uniqueness checker from availability count
    if (result.platform === "github-uniqueness") continue;

    total++;
    if (result.available && !result.error) {
      available++;
    }
  }

  return { available, total, results };
}

export async function findNames(options: FindOptions): Promise<FindResult> {
  const {
    description,
    targetCount,
    batchSize,
    threshold,
    minScore,
    verdicts,
    maxIterations,
    generateModel,
    judgeModel,
    checkers,
    style,
    sources,
    quiet = false,
    project,
  } = options;

  const candidates: ScoredCandidate[] = [];
  const allGeneratedNames: string[] = [];
  let iterations = 0;
  let totalJudged = 0;

  // Database tracking
  let projectId: number | null = null;
  if (project) {
    projectId = getOrCreateProject(project, description);
    // Load previously generated names to exclude
    const existingNames = getProjectNames(projectId);
    allGeneratedNames.push(...existingNames);
  }

  const log = (msg: string) => {
    if (!quiet) console.log(msg);
  };

  log("");
  log(
    chalk.bold(
      `Finding ${targetCount} quality candidates for: "${description.slice(0, 60)}${description.length > 60 ? "..." : ""}"`,
    ),
  );
  if (project) {
    log(
      chalk.dim(
        `Project: ${project} (${allGeneratedNames.length} names already in database)`,
      ),
    );
  }
  log("");

  while (candidates.length < targetCount && iterations < maxIterations) {
    iterations++;

    // Generate batch
    log(chalk.dim(`Iteration ${iterations}: Generating ${batchSize} names...`));

    const generateResult = await generateNames({
      description,
      count: batchSize,
      model: generateModel,
      style,
      sources,
      excludedNames: allGeneratedNames,
    });

    const generatedNames = generateResult.names;
    allGeneratedNames.push(...generatedNames.map((n) => n.name));

    // Store names in database
    if (projectId) {
      for (const name of generatedNames) {
        addName(projectId, name.name, name.rationale, name.source);
      }
    }

    // Check availability for each name
    log(chalk.dim(`  Checking availability...`));

    const availabilityResults = await Promise.all(
      generatedNames.map(async (name): Promise<NameWithAvailability> => {
        const { available, total, results } = await quickCheck(
          name.name,
          checkers,
        );

        // Store availability in database
        if (projectId) {
          const nameId = getNameId(projectId, name.name);
          if (nameId) {
            for (const result of results) {
              addAvailabilityCheck(
                nameId,
                result.platform,
                result.available && !result.error,
                result.url,
              );
            }
          }
        }

        return {
          ...name,
          availability: total > 0 ? available / total : 0,
          availableChecks: available,
          totalChecks: total,
        };
      }),
    );

    // Filter by availability threshold
    const qualifiedNames = availabilityResults.filter(
      (n) => n.availability >= threshold,
    );

    log(
      chalk.dim(
        `  ${qualifiedNames.length}/${generatedNames.length} names meet ${Math.round(threshold * 100)}% availability threshold`,
      ),
    );

    if (qualifiedNames.length === 0) {
      log(chalk.yellow(`  No names qualified, generating more...`));
      continue;
    }

    // Judge the qualified names
    log(chalk.dim(`  Judging ${qualifiedNames.length} candidates...`));

    const judgeResult = await judgeNames({
      names: qualifiedNames.map((n) => ({
        name: n.name,
        rationale: n.rationale,
        source: n.source,
      })),
      description,
      model: judgeModel,
    });

    totalJudged += qualifiedNames.length;

    // Filter by score and verdict
    for (const score of judgeResult.scores) {
      const qualifiedName = qualifiedNames.find((n) => n.name === score.name);
      if (!qualifiedName) continue;

      // Store score in database
      if (projectId) {
        const nameId = getNameId(projectId, score.name);
        if (nameId) {
          addScore(nameId, {
            model: judgeModel,
            typability: score.typability,
            memorability: score.memorability,
            meaning: score.meaning,
            uniqueness: score.uniqueness,
            culturalRisk: score.culturalRisk,
            overall: score.overall,
            verdict: score.verdict,
            weaknesses: score.weaknesses,
          });
        }
      }

      const passesScore = score.overall >= minScore;
      const passesVerdict = verdicts.includes(score.verdict);

      if (passesScore && passesVerdict) {
        candidates.push({
          name: score.name,
          rationale: qualifiedName.rationale,
          source: qualifiedName.source,
          availability: qualifiedName.availability,
          availableChecks: qualifiedName.availableChecks,
          totalChecks: qualifiedName.totalChecks,
          score,
        });

        const verdictIcon =
          score.verdict === "strong" ? chalk.green("✓") : chalk.yellow("~");
        log(
          `  ${verdictIcon} ${chalk.bold(score.name)} (${score.overall.toFixed(1)}) - ${score.verdict}`,
        );
      } else {
        log(
          chalk.dim(
            `  ✗ ${score.name} (${score.overall.toFixed(1)}) - ${score.verdict}${!passesScore ? " [score too low]" : ""}`,
          ),
        );
      }
    }

    log("");
    log(
      chalk.cyan(
        `  Progress: ${candidates.length}/${targetCount} candidates found`,
      ),
    );
    log("");

    // Stop if we have enough
    if (candidates.length >= targetCount) {
      break;
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score.overall - a.score.overall);

  // Trim to target count
  const finalCandidates = candidates.slice(0, targetCount);

  log(
    chalk.bold.green(
      `\nFound ${finalCandidates.length} candidates in ${iterations} iterations`,
    ),
  );
  log(
    chalk.dim(
      `(${allGeneratedNames.length} names generated, ${totalJudged} judged)`,
    ),
  );
  log("");

  return {
    description,
    generateModel,
    judgeModel,
    candidates: finalCandidates,
    iterations,
    totalGenerated: allGeneratedNames.length,
    totalJudged,
    allGeneratedNames,
  };
}

export function generateFindReport(result: FindResult): string {
  const lines: string[] = [];

  lines.push(`# Project Name Candidates`);
  lines.push("");
  lines.push(`**Project:** ${result.description}`);
  lines.push(`**Generator Model:** ${result.generateModel}`);
  lines.push(`**Judge Model:** ${result.judgeModel}`);
  lines.push(`**Date:** ${new Date().toISOString().split("T")[0]}`);
  lines.push("");
  lines.push(`## Search Statistics`);
  lines.push("");
  lines.push(`- **Iterations:** ${result.iterations}`);
  lines.push(`- **Names Generated:** ${result.totalGenerated}`);
  lines.push(`- **Names Judged:** ${result.totalJudged}`);
  lines.push(`- **Quality Candidates Found:** ${result.candidates.length}`);
  lines.push("");
  lines.push(`---`);
  lines.push("");

  // Candidates
  lines.push(`## Top ${result.candidates.length} Candidates`);
  lines.push("");

  for (let i = 0; i < result.candidates.length; i++) {
    const c = result.candidates[i];
    const verdictIcon =
      c.score.verdict === "strong"
        ? "✅"
        : c.score.verdict === "consider"
          ? "🤔"
          : "❌";

    lines.push(
      `### ${i + 1}. ${c.name} (${c.score.overall.toFixed(1)}/5) ${verdictIcon} ${c.score.verdict}`,
    );
    lines.push("");
    lines.push(`**Rationale:** ${c.rationale}`);
    if (c.source) {
      lines.push(`**Source:** ${c.source}`);
    }
    lines.push(
      `**Availability:** ${Math.round(c.availability * 100)}% (${c.availableChecks}/${c.totalChecks} checks passed)`,
    );
    lines.push("");
    lines.push(`| Criteria | Score |`);
    lines.push(`|----------|-------|`);
    lines.push(`| Typability | ${c.score.typability}/5 |`);
    lines.push(`| Memorability | ${c.score.memorability}/5 |`);
    lines.push(`| Meaning | ${c.score.meaning}/5 |`);
    lines.push(`| Uniqueness | ${c.score.uniqueness}/5 |`);
    lines.push(`| Cultural Risk | ${c.score.culturalRisk}/5 |`);
    lines.push("");
    if (c.score.weaknesses) {
      lines.push(`**Weaknesses:** ${c.score.weaknesses}`);
      lines.push("");
    }
    lines.push(`---`);
    lines.push("");
  }

  // Quick reference table
  lines.push(`## Quick Reference`);
  lines.push("");
  lines.push(`| Rank | Name | Score | Verdict | Availability |`);
  lines.push(`|------|------|-------|---------|--------------|`);

  for (let i = 0; i < result.candidates.length; i++) {
    const c = result.candidates[i];
    const verdictIcon =
      c.score.verdict === "strong"
        ? "✅"
        : c.score.verdict === "consider"
          ? "🤔"
          : "❌";
    lines.push(
      `| ${i + 1} | **${c.name}** | ${c.score.overall.toFixed(1)}/5 | ${verdictIcon} ${c.score.verdict} | ${Math.round(c.availability * 100)}% |`,
    );
  }

  lines.push("");
  lines.push(`## Scoring Legend`);
  lines.push("");
  lines.push(`- **Typability** - Easy to type, no awkward key combos`);
  lines.push(`- **Memorability** - Sticks in the mind`);
  lines.push(`- **Meaning** - Relevant to project purpose`);
  lines.push(`- **Uniqueness** - Stands out, not already overused`);
  lines.push(`- **Cultural Risk** - 1=safe, 5=problematic`);
  lines.push("");
  lines.push(`Scale: 1=Poor, 2=Below Average, 3=Average, 4=Good, 5=Excellent`);

  return lines.join("\n");
}
