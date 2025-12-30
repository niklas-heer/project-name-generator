#!/usr/bin/env bun
import { Command } from "commander";
import chalk from "chalk";
import { allCheckers } from "./checkers";
import type { CheckResult, Checker } from "./types";
import { generateNames, type GenerateOptions } from "./generator";
import { listModels, DEFAULT_MODEL, AVAILABLE_MODELS } from "./openrouter";
import { runInteractiveMode, runUntilAvailable } from "./interactive";
import { resolveCheckers, listProfiles } from "./profiles";
import { judgeNames, generateMarkdownReport } from "./judge";

interface CheckNameOptions {
  json?: boolean;
  only?: string;
  skip?: string;
}

interface OutputResult {
  name: string;
  results: CheckResult[];
  summary: {
    total: number;
    available: number;
    unavailable: number;
    errors: number;
    manualCheck: number;
  };
}

function formatResult(result: CheckResult, useJson: boolean): string {
  if (useJson) return "";

  const { platform, available, url, error, count, activeCount } = result;

  // Uniqueness checker has special formatting
  if (platform === "github-uniqueness" && count !== undefined) {
    const icon = chalk.magenta("📊");
    const countStr =
      count === 0
        ? chalk.green("0 similar repos")
        : count < 10
          ? chalk.yellow(`${count} similar repos`)
          : chalk.red(`${count} similar repos`);
    const activeStr =
      activeCount !== undefined ? ` (${activeCount} active)` : "";
    return `${icon} ${chalk.bold(platform)}: ${countStr}${chalk.dim(activeStr)} ${chalk.dim(url || "")}`;
  }

  // GitHub org checker with variants
  if (platform === "github-org" && result.variants) {
    const totalVariants = 15; // Total number of variants we check
    const availableCount = result.variants.length;
    const icon = available ? chalk.green("✓") : chalk.red("✗");
    const status = available ? chalk.green("available") : chalk.red("taken");
    const variantInfo = chalk.dim(
      `(${availableCount}/${totalVariants} variants available)`,
    );

    let output = `${icon} ${chalk.bold(platform)}: ${status} ${variantInfo}`;

    // Show available variants indented
    if (result.variants.length > 0) {
      for (const v of result.variants) {
        output += `\n      ${chalk.green("✓")} ${chalk.dim(v.variant)}`;
      }
    }

    return output;
  }

  if (error && !url) {
    return `${chalk.yellow("⚠")} ${chalk.bold(platform)}: ${chalk.yellow(error)}`;
  }

  if (error && url) {
    // Manual check required (trademark checks)
    return `${chalk.blue("?")} ${chalk.bold(platform)}: ${chalk.blue(error)} ${chalk.dim(url)}`;
  }

  if (available) {
    return `${chalk.green("✓")} ${chalk.bold(platform)}: ${chalk.green("available")}`;
  }

  return `${chalk.red("✗")} ${chalk.bold(platform)}: ${chalk.red("taken")} ${chalk.dim(url || "")}`;
}

function printTextOutput(output: OutputResult): void {
  console.log();
  console.log(chalk.bold.underline(`Results for "${output.name}":`));
  console.log();

  // Group by category
  const byCategory: Record<string, CheckResult[]> = {};
  for (const result of output.results) {
    const checker = allCheckers.find((c) => c.name === result.platform);
    const category = checker?.category || "other";
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(result);
  }

  const categoryOrder = [
    "package",
    "repository",
    "domain",
    "uniqueness",
    "trademark",
  ];
  const categoryLabels: Record<string, string> = {
    package: "Package Registries",
    repository: "Code Repositories",
    domain: "Domains",
    uniqueness: "Uniqueness",
    trademark: "Trademark Checks",
  };

  for (const category of categoryOrder) {
    const results = byCategory[category];
    if (!results || results.length === 0) continue;

    console.log(chalk.bold.cyan(`  ${categoryLabels[category] || category}:`));
    for (const result of results) {
      console.log(`    ${formatResult(result, false)}`);
    }
    console.log();
  }

  // Summary
  const { summary } = output;
  console.log(chalk.bold("Summary:"));
  console.log(
    `  ${chalk.green("✓")} Available: ${summary.available}/${summary.total - summary.manualCheck}`,
  );
  console.log(
    `  ${chalk.red("✗")} Taken: ${summary.unavailable}/${summary.total - summary.manualCheck}`,
  );
  if (summary.manualCheck > 0) {
    console.log(`  ${chalk.blue("?")} Manual check: ${summary.manualCheck}`);
  }
  if (summary.errors > 0) {
    console.log(`  ${chalk.yellow("⚠")} Errors: ${summary.errors}`);
  }
  console.log();
}

async function checkName(
  name: string,
  options: CheckNameOptions,
): Promise<OutputResult> {
  // Normalize the name
  let normalizedName = name.trim().toLowerCase();
  if (normalizedName.includes(" ")) {
    normalizedName = normalizedName.replace(/\s+/g, "-");
  }

  // Filter checkers based on options
  let checkers: Checker[] = [...allCheckers];

  if (options.only) {
    const onlyList = options.only.split(",").map((s) => s.trim().toLowerCase());
    checkers = checkers.filter((c) => onlyList.includes(c.name.toLowerCase()));
  }

  if (options.skip) {
    const skipList = options.skip.split(",").map((s) => s.trim().toLowerCase());
    checkers = checkers.filter((c) => !skipList.includes(c.name.toLowerCase()));
  }

  // Run all checks in parallel
  const results = await Promise.all(
    checkers.map((checker) => checker.check(normalizedName)),
  );

  // Calculate summary (exclude uniqueness checkers from available/unavailable counts)
  let available = 0;
  let unavailable = 0;
  let errors = 0;
  let manualCheck = 0;

  for (const result of results) {
    // Skip uniqueness checkers in summary counts
    if (result.platform === "github-uniqueness") {
      continue;
    }
    if (result.error && result.url) {
      // Manual check required
      manualCheck++;
    } else if (result.error) {
      errors++;
    } else if (result.available) {
      available++;
    } else {
      unavailable++;
    }
  }

  // Count non-uniqueness results for total
  const nonUniquenessCount = results.filter(
    (r) => r.platform !== "github-uniqueness",
  ).length;

  return {
    name: normalizedName,
    results,
    summary: {
      total: nonUniquenessCount,
      available,
      unavailable,
      errors,
      manualCheck,
    },
  };
}

const program = new Command();

program
  .name("checkname")
  .description(
    "Check name availability across package registries, repositories, domains, and trademarks",
  )
  .version("0.1.0")
  .enablePositionalOptions()
  .passThroughOptions();

program
  .command("check", { isDefault: true })
  .description("Check name availability across all platforms")
  .argument("<name>", "The name to check")
  .option("-j, --json", "Output results as JSON")
  .option(
    "-o, --only <checkers>",
    "Only run specific checkers (comma-separated)",
  )
  .option("-s, --skip <checkers>", "Skip specific checkers (comma-separated)")
  .action(async (name: string, options: CheckNameOptions) => {
    const output = await checkName(name, options);

    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      printTextOutput(output);
    }
  });

program
  .command("list")
  .description("List all available checkers")
  .action(() => {
    console.log(chalk.bold("\nAvailable checkers:\n"));

    const byCategory: Record<string, Checker[]> = {};
    for (const checker of allCheckers) {
      if (!byCategory[checker.category]) byCategory[checker.category] = [];
      byCategory[checker.category].push(checker);
    }

    const categoryLabels: Record<string, string> = {
      package: "Package Registries",
      repository: "Code Repositories",
      domain: "Domains",
      uniqueness: "Uniqueness",
      trademark: "Trademark Checks",
    };

    for (const [category, checkers] of Object.entries(byCategory)) {
      console.log(
        chalk.bold.cyan(`  ${categoryLabels[category] || category}:`),
      );
      for (const checker of checkers) {
        console.log(`    - ${checker.name}`);
      }
      console.log();
    }
  });

interface GenerateCommandOptions {
  count: string;
  model: string;
  style: string;
  sources?: string;
  json?: boolean;
  check?: boolean;
  interactive?: boolean;
  untilAvailable?: string;
  threshold?: string;
  profile?: string;
  checkers?: string;
  exclude?: string;
  excludeFrom?: string;
}

program
  .command("generate")
  .description("Generate project name candidates using AI")
  .argument("<description>", "Description of your project")
  .option("-n, --count <number>", "Number of names to generate", "20")
  .option(
    "-m, --model <model>",
    `AI model to use (${listModels().join(", ")})`,
    DEFAULT_MODEL,
  )
  .option(
    "-s, --style <style>",
    "Name style: short (2-4 chars), word (4-6 chars), compound (6-10 chars), all",
    "all",
  )
  .option(
    "--sources <languages>",
    "Comma-separated language sources (german,latin,greek,japanese,spanish,english)",
  )
  .option("-j, --json", "Output as JSON")
  .option("-c, --check", "Run availability checks on generated names")
  .option("-i, --interactive", "Interactive mode with continuous generation")
  .option(
    "-u, --until-available <number>",
    "Keep generating until N names meet availability threshold",
  )
  .option(
    "-t, --threshold <percent>",
    "Availability threshold for --until-available (default: 80)",
    "80",
  )
  .option(
    "-p, --profile <name>",
    "Checker profile to use (minimal, node, python, rust, go, full, complete)",
  )
  .option(
    "--checkers <list>",
    "Comma-separated list of specific checkers to use (overrides --profile)",
  )
  .option(
    "-e, --exclude <names>",
    "Comma-separated list of names to exclude from generation",
  )
  .option(
    "--exclude-from <file>",
    "File containing names to exclude (one per line, or JSON from previous run)",
  )
  .action(async (description: string, options: GenerateCommandOptions) => {
    const count = parseInt(options.count, 10);
    if (isNaN(count) || count < 1 || count > 50) {
      console.error(chalk.red("Count must be between 1 and 50"));
      process.exit(1);
    }

    const sources = options.sources?.split(",").map((s) => s.trim());

    // Parse excluded names from --exclude and --exclude-from
    const excludedNames: string[] = [];

    if (options.exclude) {
      excludedNames.push(
        ...options.exclude.split(",").map((s) => s.trim().toLowerCase()),
      );
    }

    if (options.excludeFrom) {
      try {
        const fileContent = await Bun.file(options.excludeFrom).text();
        const trimmed = fileContent.trim();

        // Try to parse as JSON (from previous run output)
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          const parsed = JSON.parse(trimmed);

          // Handle UntilAvailableResult format
          if (
            parsed.allGeneratedNames &&
            Array.isArray(parsed.allGeneratedNames)
          ) {
            // Use allGeneratedNames if available (includes all names, not just qualified)
            excludedNames.push(
              ...parsed.allGeneratedNames.map((n: string) => n.toLowerCase()),
            );
          } else if (
            parsed.qualifiedNames &&
            Array.isArray(parsed.qualifiedNames)
          ) {
            // Fallback to qualifiedNames for older format
            excludedNames.push(
              ...parsed.qualifiedNames.map((n: { name: string }) =>
                n.name.toLowerCase(),
              ),
            );
          }
          // Handle array of names
          else if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (typeof item === "string") {
                excludedNames.push(item.toLowerCase());
              } else if (item.name) {
                excludedNames.push(item.name.toLowerCase());
              }
            }
          }
          // Handle GenerateResult format
          else if (parsed.names && Array.isArray(parsed.names)) {
            excludedNames.push(
              ...parsed.names.map((n: { name: string }) =>
                n.name.toLowerCase(),
              ),
            );
          }
        } else {
          // Plain text: one name per line
          excludedNames.push(
            ...trimmed
              .split("\n")
              .map((s) => s.trim().toLowerCase())
              .filter((s) => s.length > 0 && !s.startsWith("#")),
          );
        }
      } catch (error) {
        console.error(
          chalk.red(
            `Error reading exclude file: ${error instanceof Error ? error.message : error}`,
          ),
        );
        process.exit(1);
      }
    }

    // Resolve checkers from profile or explicit list
    let checkers;
    try {
      checkers = await resolveCheckers({
        profile: options.profile,
        checkers: options.checkers,
      });
    } catch (error) {
      console.error(
        chalk.red(`Error: ${error instanceof Error ? error.message : error}`),
      );
      process.exit(1);
    }

    // Interactive mode
    if (options.interactive) {
      await runInteractiveMode(description, {
        model: options.model,
        style: options.style as GenerateOptions["style"],
        sources,
        count,
        checkers,
        excludedNames: excludedNames.length > 0 ? excludedNames : undefined,
      });
      return;
    }

    // Until-available mode
    if (options.untilAvailable) {
      const targetAvailable = parseInt(options.untilAvailable, 10);
      const threshold = parseInt(options.threshold || "80", 10) / 100;

      if (isNaN(targetAvailable) || targetAvailable < 1) {
        console.error(chalk.red("--until-available must be a positive number"));
        process.exit(1);
      }

      await runUntilAvailable(description, {
        model: options.model,
        style: options.style as GenerateOptions["style"],
        sources,
        count,
        targetAvailable,
        availabilityThreshold: threshold,
        checkers,
        json: options.json,
        excludedNames: excludedNames.length > 0 ? excludedNames : undefined,
      });
      return;
    }

    if (!options.json) {
      console.log(
        chalk.dim(`\nGenerating ${count} names using ${options.model}...\n`),
      );
    }

    try {
      const result = await generateNames({
        description,
        count,
        model: options.model,
        style: options.style as GenerateOptions["style"],
        sources,
        excludedNames: excludedNames.length > 0 ? excludedNames : undefined,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.bold.underline("Generated Names:\n"));
        for (let i = 0; i < result.names.length; i++) {
          const { name, rationale, source } = result.names[i];
          const num = chalk.dim(`${(i + 1).toString().padStart(2)}.`);
          const nameStr = chalk.bold.green(name);
          const sourceStr = source ? chalk.cyan(`[${source}]`) : "";
          console.log(`${num} ${nameStr} ${sourceStr}`);
          console.log(`    ${chalk.dim(rationale)}`);
        }
        console.log();
        console.log(chalk.dim(`Model: ${result.model}`));
      }

      // Run availability checks if requested
      if (options.check) {
        console.log(chalk.dim("\nRunning availability checks...\n"));
        for (const { name } of result.names) {
          console.log(chalk.bold(`\n--- Checking: ${name} ---`));
          const checkResult = await checkName(name, {
            skip: "uspto,google-software,google-opensource,fossmarks",
          });
          printTextOutput(checkResult);
        }
      }
    } catch (error) {
      console.error(
        chalk.red(`Error: ${error instanceof Error ? error.message : error}`),
      );
      process.exit(1);
    }
  });

program
  .command("models")
  .description("List available AI models for name generation")
  .action(() => {
    console.log(chalk.bold("\nAvailable models:\n"));
    for (const [alias, fullId] of Object.entries(AVAILABLE_MODELS)) {
      const isDefault = alias === DEFAULT_MODEL;
      const defaultBadge = isDefault ? chalk.green(" (default)") : "";
      console.log(`  ${chalk.bold(alias)}${defaultBadge}`);
      console.log(`    ${chalk.dim(fullId)}`);
    }
    console.log();
  });

program
  .command("profiles")
  .description("List available checker profiles")
  .action(async () => {
    const profiles = await listProfiles();
    console.log(chalk.bold("\nAvailable profiles:\n"));
    for (const [name, config] of Object.entries(profiles)) {
      console.log(`  ${chalk.bold.cyan(name)}`);
      console.log(`    ${chalk.dim(config.description)}`);
      console.log(
        `    ${chalk.dim("Checkers:")} ${config.checkers.join(", ")}`,
      );
      console.log();
    }
  });

interface JudgeCommandOptions {
  model: string;
  output?: string;
  json?: boolean;
  fromFile?: string;
}

program
  .command("judge")
  .description("Evaluate name candidates with a critical AI judge")
  .argument("<description>", "Description of your project")
  .argument("[names...]", "Names to evaluate (or use --from-file)")
  .option(
    "-m, --model <model>",
    `Judge model to use (${listModels().join(", ")})`,
    "gemini-2.5-pro",
  )
  .option("-o, --output <file>", "Write markdown report to file")
  .option("-j, --json", "Output raw JSON instead of markdown")
  .option(
    "-f, --from-file <file>",
    "Read names from file (JSON from generate command, or one name per line)",
  )
  .action(
    async (
      description: string,
      names: string[],
      options: JudgeCommandOptions,
    ) => {
      // Parse names from arguments and/or file
      const parsedNames: Array<{
        name: string;
        rationale?: string;
        source?: string;
      }> = [];

      // Load from file if specified
      if (options.fromFile) {
        try {
          const fileContent = await Bun.file(options.fromFile).text();
          const trimmed = fileContent.trim();

          if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            const parsed = JSON.parse(trimmed);

            // Handle UntilAvailableResult format (qualifiedNames with full details)
            if (parsed.qualifiedNames && Array.isArray(parsed.qualifiedNames)) {
              parsedNames.push(
                ...parsed.qualifiedNames.map(
                  (n: {
                    name: string;
                    rationale?: string;
                    source?: string;
                  }) => ({
                    name: n.name.toLowerCase(),
                    rationale: n.rationale,
                    source: n.source,
                  }),
                ),
              );
            }
            // Handle GenerateResult format
            else if (parsed.names && Array.isArray(parsed.names)) {
              parsedNames.push(
                ...parsed.names.map(
                  (n: {
                    name: string;
                    rationale?: string;
                    source?: string;
                  }) => ({
                    name: n.name.toLowerCase(),
                    rationale: n.rationale,
                    source: n.source,
                  }),
                ),
              );
            }
            // Handle plain array
            else if (Array.isArray(parsed)) {
              for (const item of parsed) {
                if (typeof item === "string") {
                  parsedNames.push({ name: item.toLowerCase() });
                } else if (item.name) {
                  parsedNames.push({
                    name: item.name.toLowerCase(),
                    rationale: item.rationale,
                    source: item.source,
                  });
                }
              }
            }
          } else {
            // Plain text: one name per line
            parsedNames.push(
              ...trimmed
                .split("\n")
                .map((s) => s.trim().toLowerCase())
                .filter((s) => s.length > 0 && !s.startsWith("#"))
                .map((name) => ({ name })),
            );
          }
        } catch (error) {
          console.error(
            chalk.red(
              `Error reading file: ${error instanceof Error ? error.message : error}`,
            ),
          );
          process.exit(1);
        }
      }

      // Add names from command line arguments
      for (const arg of names) {
        if (arg.includes(",")) {
          parsedNames.push(
            ...arg.split(",").map((n) => ({ name: n.trim().toLowerCase() })),
          );
        } else {
          parsedNames.push({ name: arg.trim().toLowerCase() });
        }
      }

      if (parsedNames.length === 0) {
        console.error(chalk.red("No names provided to evaluate"));
        process.exit(1);
      }

      if (!options.json) {
        console.log(
          chalk.dim(
            `\nEvaluating ${parsedNames.length} names with ${options.model}...\n`,
          ),
        );
      }

      try {
        const result = await judgeNames({
          names: parsedNames,
          description,
          model: options.model,
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          const report = generateMarkdownReport(result);

          if (options.output) {
            await Bun.write(options.output, report);
            console.log(chalk.green(`Report written to ${options.output}`));
          } else {
            console.log(report);
          }

          // Print quick summary
          console.log();
          console.log(
            chalk.bold(
              `Verdict: ${chalk.green(`${result.summary.strong} strong`)}, ${chalk.yellow(`${result.summary.consider} consider`)}, ${chalk.red(`${result.summary.reject} reject`)}`,
            ),
          );
        }
      } catch (error) {
        console.error(
          chalk.red(`Error: ${error instanceof Error ? error.message : error}`),
        );
        process.exit(1);
      }
    },
  );

program.addHelpText(
  "after",
  `
${chalk.bold("GitHub Token Setup:")}
  To check GitHub repositories and organizations, you need a GitHub token.

  1. Go to https://github.com/settings/tokens
  2. Click "Generate new token (classic)"
  3. Give it a name (e.g., "checkname-cli")
  4. Select the "public_repo" scope (or no scopes for read-only public access)
  5. Generate and copy the token
  6. Set it as an environment variable:

     export GITHUB_TOKEN="your_token_here"

     Or add it to your shell profile (~/.bashrc, ~/.zshrc, etc.)

${chalk.bold("Examples:")}
  $ checkname myproject              Check all platforms
  $ checkname myproject --json       Output as JSON
  $ checkname myproject -o npm,pypi  Only check npm and PyPI
  $ checkname myproject -s trademark Skip trademark checks
  $ checkname list                   List all available checkers
`,
);

program.parse();
