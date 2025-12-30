import { Octokit } from "octokit";
import type { Checker, CheckResult, VariantResult } from "../types";
import { createErrorResult } from "./base";

function getOctokit(): Octokit | null {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return null;
  }
  return new Octokit({ auth: token });
}

export const githubChecker: Checker = {
  name: "github",
  category: "repository",
  async check(name: string): Promise<CheckResult> {
    const octokit = getOctokit();
    if (!octokit) {
      return createErrorResult(
        "github",
        name,
        "GITHUB_TOKEN not set. See --help for instructions.",
      );
    }

    try {
      const response = await octokit.request(
        "GET /search/repositories?q={name}&type=repositories",
        {
          name: encodeURIComponent(name),
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );

      // Filter for exact name matches with significant stars (>10)
      const repositories = response.data.items
        .filter(
          (item: { name: string; stargazers_count: number }) =>
            item.name.toLowerCase() === name.toLowerCase() &&
            item.stargazers_count > 10,
        )
        .sort(
          (a: { stargazers_count: number }, b: { stargazers_count: number }) =>
            b.stargazers_count - a.stargazers_count,
        );

      const existsUrl = repositories[0]?.html_url;
      const available = existsUrl === undefined;

      return {
        name,
        platform: "github",
        available,
        url: existsUrl,
      };
    } catch (error) {
      return createErrorResult(
        "github",
        name,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
};

export const githubUniquenessChecker: Checker = {
  name: "github-uniqueness",
  category: "uniqueness",
  async check(name: string): Promise<CheckResult> {
    const octokit = getOctokit();
    if (!octokit) {
      return createErrorResult(
        "github-uniqueness",
        name,
        "GITHUB_TOKEN not set. See --help for instructions.",
      );
    }

    try {
      // Search for repositories with the name, requiring at least 1 star
      const response = await octokit.request("GET /search/repositories", {
        q: `${name} in:name stars:>=1`,
        per_page: 100,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      const totalCount = response.data.total_count;

      // Filter for active repos (pushed within last 5 years)
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      const activeRepos = response.data.items.filter(
        (item: { pushed_at: string }) => {
          const pushedAt = new Date(item.pushed_at);
          return pushedAt >= fiveYearsAgo;
        },
      );

      // Note: activeCount is based on the first 100 results
      // For a more accurate count, we'd need pagination, but this gives a good estimate
      const activeCount = activeRepos.length;

      return {
        name,
        platform: "github-uniqueness",
        available: true, // This checker doesn't determine availability
        count: totalCount,
        activeCount,
        url: `https://github.com/search?q=${encodeURIComponent(name)}+in%3Aname+stars%3A%3E%3D1&type=repositories`,
      };
    } catch (error) {
      return createErrorResult(
        "github-uniqueness",
        name,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
};

// Variant suffixes to check for org names
const ORG_VARIANT_SUFFIXES = [
  "", // base name
  "-dev",
  "dev",
  "-org",
  "org",
  "-hq",
  "hq",
  "-io",
  "io",
  "-app",
  "app",
  "-labs",
  "labs",
  "-oss",
];

async function checkOrgExists(
  octokit: Octokit,
  orgName: string,
): Promise<{ available: boolean; url?: string }> {
  try {
    const response = await octokit.request("GET /orgs/{org}", {
      org: orgName,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    return { available: false, url: response.data.html_url };
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 404
    ) {
      return { available: true };
    }
    throw error;
  }
}

export const githubOrgChecker: Checker = {
  name: "github-org",
  category: "repository",
  async check(name: string): Promise<CheckResult> {
    const octokit = getOctokit();
    if (!octokit) {
      return createErrorResult(
        "github-org",
        name,
        "GITHUB_TOKEN not set. See --help for instructions.",
      );
    }

    try {
      // Generate all variants
      const variantNames = ORG_VARIANT_SUFFIXES.map(
        (suffix) => `${name}${suffix}`,
      );

      // Check all variants in parallel
      const results = await Promise.all(
        variantNames.map(async (variantName): Promise<VariantResult> => {
          const result = await checkOrgExists(octokit, variantName);
          return {
            variant: variantName,
            available: result.available,
            url: result.url,
          };
        }),
      );

      // Filter to only available variants
      const availableVariants = results.filter((r) => r.available);

      // Count as available if ANY variant is available (you can use that org name)
      const hasAvailableVariant = availableVariants.length > 0;

      return {
        name,
        platform: "github-org",
        available: hasAvailableVariant,
        url: hasAvailableVariant ? undefined : results[0].url,
        variants: availableVariants,
      };
    } catch (error) {
      return createErrorResult(
        "github-org",
        name,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
};
