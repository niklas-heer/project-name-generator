import chalk from "chalk";
import {
  generateNames,
  type GenerateOptions,
  type GeneratedName,
} from "./generator";
import type { Checker } from "./types";

// Simple readline interface for Bun
async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  for await (const line of console) {
    return line;
  }
  return "";
}

interface InteractiveSession {
  description: string;
  model: string;
  style?: GenerateOptions["style"];
  sources?: string[];
  allNames: GeneratedName[];
  excludedNames: string[];
  favorites: string[];
  checkers: Checker[];
}

async function quickCheck(
  name: string,
  checkers: Checker[],
): Promise<{ available: number; total: number }> {
  const results = await Promise.all(
    checkers.map((checker) => checker.check(name)),
  );

  let available = 0;
  let total = 0;

  for (const result of results) {
    // Skip uniqueness checker in count
    if (result.platform === "github-uniqueness") continue;
    total++;
    if (result.available && !result.error) available++;
  }

  return { available, total };
}

function printNames(names: GeneratedName[], startIndex: number = 0) {
  for (let i = 0; i < names.length; i++) {
    const { name, rationale, source } = names[i];
    const num = chalk.dim(`${(startIndex + i + 1).toString().padStart(2)}.`);
    const nameStr = chalk.bold.green(name);
    const sourceStr = source ? chalk.cyan(`[${source}]`) : "";
    console.log(`${num} ${nameStr} ${sourceStr}`);
    console.log(`    ${chalk.dim(rationale)}`);
  }
}

export async function runInteractiveMode(
  description: string,
  options: {
    model: string;
    style?: GenerateOptions["style"];
    sources?: string[];
    count: number;
    checkers: Checker[];
    excludedNames?: string[];
  },
): Promise<void> {
  const session: InteractiveSession = {
    description,
    model: options.model,
    style: options.style,
    sources: options.sources,
    allNames: [],
    excludedNames: options.excludedNames ? [...options.excludedNames] : [],
    favorites: [],
    checkers: options.checkers,
  };

  console.log(chalk.bold.underline("\nInteractive Name Generation\n"));
  console.log(
    chalk.dim(
      `Using ${session.checkers.length} checkers: ${session.checkers.map((c) => c.name).join(", ")}`,
    ),
  );
  console.log();
  console.log(chalk.dim("Commands:"));
  console.log(chalk.dim("  more          - Generate more names"));
  console.log(
    chalk.dim(
      "  more <feedback> - Generate more with feedback (e.g., 'more shorter names')",
    ),
  );
  console.log(
    chalk.dim("  check <num>   - Check availability for a name by number"),
  );
  console.log(chalk.dim("  check all     - Check availability for all names"));
  console.log(chalk.dim("  fav <num>     - Add a name to favorites"));
  console.log(chalk.dim("  favs          - Show favorites"));
  console.log(chalk.dim("  done          - Exit and show summary"));
  console.log();

  // Initial generation
  console.log(
    chalk.dim(`Generating ${options.count} names using ${options.model}...\n`),
  );

  try {
    const result = await generateNames({
      description: session.description,
      count: options.count,
      model: session.model,
      style: session.style,
      sources: session.sources,
    });

    session.allNames = result.names;
    session.excludedNames = result.names.map((n) => n.name);

    console.log(chalk.bold.underline("Generated Names:\n"));
    printNames(result.names);
    console.log();
  } catch (error) {
    console.error(
      chalk.red(`Error: ${error instanceof Error ? error.message : error}`),
    );
    return;
  }

  // Interactive loop
  while (true) {
    const input = await prompt(chalk.cyan("\n> "));
    const trimmed = input.trim().toLowerCase();

    if (trimmed === "done" || trimmed === "quit" || trimmed === "exit") {
      break;
    }

    if (trimmed === "favs" || trimmed === "favorites") {
      if (session.favorites.length === 0) {
        console.log(chalk.dim("No favorites yet. Use 'fav <num>' to add."));
      } else {
        console.log(chalk.bold("\nFavorites:"));
        session.favorites.forEach((name, i) => {
          console.log(`  ${i + 1}. ${chalk.green(name)}`);
        });
      }
      continue;
    }

    if (trimmed.startsWith("fav ")) {
      const numStr = trimmed.slice(4).trim();
      const num = parseInt(numStr, 10);
      if (isNaN(num) || num < 1 || num > session.allNames.length) {
        console.log(
          chalk.red(`Invalid number. Use 1-${session.allNames.length}`),
        );
        continue;
      }
      const name = session.allNames[num - 1].name;
      if (!session.favorites.includes(name)) {
        session.favorites.push(name);
        console.log(chalk.green(`Added "${name}" to favorites`));
      } else {
        console.log(chalk.dim(`"${name}" is already in favorites`));
      }
      continue;
    }

    if (trimmed.startsWith("check ")) {
      const arg = trimmed.slice(6).trim();

      if (arg === "all") {
        console.log(chalk.dim("\nChecking all names...\n"));
        for (let i = 0; i < session.allNames.length; i++) {
          const name = session.allNames[i].name;
          const { available, total } = await quickCheck(name, session.checkers);
          const pct = Math.round((available / total) * 100);
          const color =
            pct >= 80 ? chalk.green : pct >= 50 ? chalk.yellow : chalk.red;
          console.log(
            `  ${(i + 1).toString().padStart(2)}. ${chalk.bold(name)}: ${color(`${available}/${total} available (${pct}%)`)}`,
          );
        }
        continue;
      }

      const num = parseInt(arg, 10);
      if (isNaN(num) || num < 1 || num > session.allNames.length) {
        console.log(
          chalk.red(
            `Invalid number. Use 1-${session.allNames.length} or 'check all'`,
          ),
        );
        continue;
      }

      const name = session.allNames[num - 1].name;
      console.log(chalk.dim(`\nChecking "${name}"...\n`));
      const { available, total } = await quickCheck(name, session.checkers);
      const pct = Math.round((available / total) * 100);
      const color =
        pct >= 80 ? chalk.green : pct >= 50 ? chalk.yellow : chalk.red;
      console.log(
        `  ${chalk.bold(name)}: ${color(`${available}/${total} available (${pct}%)`)}`,
      );
      continue;
    }

    if (trimmed === "more" || trimmed.startsWith("more ")) {
      const feedback = trimmed === "more" ? undefined : input.slice(5).trim();

      console.log(
        chalk.dim(
          `\nGenerating more names${feedback ? ` (${feedback})` : ""}...\n`,
        ),
      );

      try {
        const result = await generateNames({
          description: session.description,
          count: options.count,
          model: session.model,
          style: session.style,
          sources: session.sources,
          excludedNames: session.excludedNames,
          feedback,
        });

        const startIndex = session.allNames.length;
        session.allNames.push(...result.names);
        session.excludedNames.push(...result.names.map((n) => n.name));

        console.log(chalk.bold.underline("Generated Names:\n"));
        printNames(result.names, startIndex);
      } catch (error) {
        console.error(
          chalk.red(`Error: ${error instanceof Error ? error.message : error}`),
        );
      }
      continue;
    }

    console.log(chalk.dim("Unknown command. Type 'done' to exit."));
  }

  // Final summary
  console.log(chalk.bold.underline("\n\nSession Summary:\n"));
  console.log(`Total names generated: ${session.allNames.length}`);

  if (session.favorites.length > 0) {
    console.log(chalk.bold("\nYour favorites:"));
    session.favorites.forEach((name, i) => {
      console.log(`  ${i + 1}. ${chalk.green(name)}`);
    });
  }
  console.log();
}

export interface UntilAvailableResult {
  description: string;
  model: string;
  profile: string[];
  threshold: number;
  iterations: number;
  totalGenerated: number;
  allGeneratedNames: string[];
  qualifiedNames: Array<GeneratedName & { availability: number }>;
}

export async function runUntilAvailable(
  description: string,
  options: {
    model: string;
    style?: GenerateOptions["style"];
    sources?: string[];
    count: number;
    targetAvailable: number;
    availabilityThreshold: number; // e.g., 0.8 = 80% of checks must pass
    checkers: Checker[];
    json?: boolean;
    excludedNames?: string[];
  },
): Promise<UntilAvailableResult> {
  const excludedNames: string[] = options.excludedNames
    ? [...options.excludedNames]
    : [];
  const qualifiedNames: Array<GeneratedName & { availability: number }> = [];
  let iterations = 0;
  const maxIterations = 10;

  if (!options.json) {
    console.log(chalk.bold.underline("\nAuto-Generate Until Available\n"));
    console.log(
      chalk.dim(
        `Target: ${options.targetAvailable} names with ≥${options.availabilityThreshold * 100}% availability`,
      ),
    );
    console.log(
      chalk.dim(
        `Using ${options.checkers.length} checkers: ${options.checkers.map((c) => c.name).join(", ")}`,
      ),
    );
    console.log();
  }

  while (
    qualifiedNames.length < options.targetAvailable &&
    iterations < maxIterations
  ) {
    iterations++;
    if (!options.json) {
      console.log(
        chalk.dim(
          `\nIteration ${iterations}: Generating ${options.count} names...\n`,
        ),
      );
    }

    try {
      const result = await generateNames({
        description,
        count: options.count,
        model: options.model,
        style: options.style,
        sources: options.sources,
        excludedNames: excludedNames.length > 0 ? excludedNames : undefined,
      });

      // Add to excluded list
      excludedNames.push(...result.names.map((n) => n.name));

      // Check availability for each name
      for (const nameObj of result.names) {
        if (qualifiedNames.length >= options.targetAvailable) break;

        if (!options.json) {
          process.stdout.write(chalk.dim(`  Checking ${nameObj.name}... `));
        }
        const { available, total } = await quickCheck(
          nameObj.name,
          options.checkers,
        );
        const pct = available / total;

        if (pct >= options.availabilityThreshold) {
          if (!options.json) {
            console.log(
              chalk.green(
                `✓ ${available}/${total} (${Math.round(pct * 100)}%)`,
              ),
            );
          }
          qualifiedNames.push({ ...nameObj, availability: pct });
        } else {
          if (!options.json) {
            console.log(
              chalk.red(`✗ ${available}/${total} (${Math.round(pct * 100)}%)`),
            );
          }
        }
      }
    } catch (error) {
      if (!options.json) {
        console.error(
          chalk.red(`Error: ${error instanceof Error ? error.message : error}`),
        );
      }
      break;
    }
  }

  // Get only the names generated in this run (not the ones passed in via options.excludedNames)
  const initialExcludedCount = options.excludedNames?.length ?? 0;
  const generatedInThisRun = excludedNames.slice(initialExcludedCount);

  const resultData: UntilAvailableResult = {
    description,
    model: options.model,
    profile: options.checkers.map((c) => c.name),
    threshold: options.availabilityThreshold,
    iterations,
    totalGenerated: generatedInThisRun.length,
    allGeneratedNames: generatedInThisRun,
    qualifiedNames,
  };

  // Final output
  if (options.json) {
    console.log(JSON.stringify(resultData, null, 2));
  } else {
    console.log(chalk.bold.underline("\n\nQualified Names:\n"));
    if (qualifiedNames.length === 0) {
      console.log(chalk.yellow("No names met the availability threshold."));
    } else {
      for (let i = 0; i < qualifiedNames.length; i++) {
        const { name, rationale, source, availability } = qualifiedNames[i];
        const num = chalk.dim(`${(i + 1).toString().padStart(2)}.`);
        const nameStr = chalk.bold.green(name);
        const sourceStr = source ? chalk.cyan(`[${source}]`) : "";
        const availStr = chalk.dim(
          `(${Math.round(availability * 100)}% available)`,
        );
        console.log(`${num} ${nameStr} ${sourceStr} ${availStr}`);
        console.log(`    ${chalk.dim(rationale)}`);
      }
    }
    console.log();
  }

  return resultData;
}
