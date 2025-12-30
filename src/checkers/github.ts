import { Octokit } from "octokit";
import type { Checker, CheckResult, VariantResult } from "../types";
import { createErrorResult } from "./base";

// Global flag to track if we've hit rate limit
let usePublicApiOnly = false;
let rateLimitResetTime = 0;

function getOctokit(): Octokit | null {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return null;
  }
  return new Octokit({ auth: token });
}

function shouldUsePublicApi(): boolean {
  // Reset the flag if we're past the reset time
  if (usePublicApiOnly && Date.now() > rateLimitResetTime) {
    usePublicApiOnly = false;
  }
  return usePublicApiOnly;
}

function markRateLimited(resetTime?: number) {
  usePublicApiOnly = true;
  // Default to 1 hour if no reset time provided
  rateLimitResetTime = resetTime || Date.now() + 3600000;
}

// Unauthenticated fallback using public API (60 requests/hour)
async function checkOrgExistsPublic(
  orgName: string,
): Promise<{ available: boolean; url?: string }> {
  try {
    const response = await fetch(`https://api.github.com/orgs/${orgName}`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "project-name-generator",
      },
    });

    if (response.status === 404) {
      // Org doesn't exist, check if user exists (they share namespace)
      return checkUserExistsPublic(orgName);
    }

    if (response.ok) {
      const data = (await response.json()) as { html_url: string };
      return { available: false, url: data.html_url };
    }

    // Rate limited - return optimistic result
    if (response.status === 403 || response.status === 429) {
      return { available: true };
    }

    return { available: true };
  } catch {
    return { available: true };
  }
}

async function checkUserExistsPublic(
  username: string,
): Promise<{ available: boolean; url?: string }> {
  try {
    const response = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "project-name-generator",
      },
    });

    if (response.status === 404) {
      return { available: true };
    }

    if (response.ok) {
      const data = (await response.json()) as { html_url: string };
      return { available: false, url: data.html_url };
    }

    return { available: true };
  } catch {
    return { available: true };
  }
}

// Check repo existence via public API
async function checkRepoExistsPublic(
  name: string,
): Promise<{ available: boolean; url?: string }> {
  try {
    const response = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(name)}+in:name&per_page=10`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "project-name-generator",
        },
      },
    );

    if (!response.ok) {
      return { available: true };
    }

    const data = (await response.json()) as {
      items: Array<{
        name: string;
        stargazers_count: number;
        html_url: string;
      }>;
    };

    // Filter for exact matches with >10 stars
    const match = data.items.find(
      (item) =>
        item.name.toLowerCase() === name.toLowerCase() &&
        item.stargazers_count > 10,
    );

    return {
      available: !match,
      url: match?.html_url,
    };
  } catch {
    return { available: true };
  }
}

export const githubChecker: Checker = {
  name: "github",
  category: "repository",
  async check(name: string): Promise<CheckResult> {
    // Try public API first if we've hit rate limit
    if (shouldUsePublicApi()) {
      const result = await checkRepoExistsPublic(name);
      return {
        name,
        platform: "github",
        available: result.available,
        url: result.url,
      };
    }

    const octokit = getOctokit();
    if (!octokit) {
      // No token - use public API
      const result = await checkRepoExistsPublic(name);
      return {
        name,
        platform: "github",
        available: result.available,
        url: result.url,
      };
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

      return {
        name,
        platform: "github",
        available: existsUrl === undefined,
        url: existsUrl,
      };
    } catch (error: unknown) {
      // Check for rate limit error
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        (error.status === 403 || error.status === 429)
      ) {
        markRateLimited();
        // Fall back to public API
        const result = await checkRepoExistsPublic(name);
        return {
          name,
          platform: "github",
          available: result.available,
          url: result.url,
        };
      }

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
    // Use public API for uniqueness check - it's less critical
    try {
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(name)}+in:name+stars:>=1&per_page=100`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "project-name-generator",
          },
        },
      );

      if (!response.ok) {
        return createErrorResult(
          "github-uniqueness",
          name,
          `GitHub API error: ${response.status}`,
        );
      }

      const data = (await response.json()) as {
        total_count: number;
        items: Array<{ pushed_at: string }>;
      };

      const totalCount = data.total_count;

      // Filter for active repos (pushed within last 5 years)
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      const activeRepos = data.items.filter((item) => {
        const pushedAt = new Date(item.pushed_at);
        return pushedAt >= fiveYearsAgo;
      });

      return {
        name,
        platform: "github-uniqueness",
        available: true,
        count: totalCount,
        activeCount: activeRepos.length,
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

export const githubOrgChecker: Checker = {
  name: "github-org",
  category: "repository",
  async check(name: string): Promise<CheckResult> {
    try {
      // Always use public API for org checks - it's more efficient
      // and doesn't burn through our authenticated rate limit
      // Process variants in small batches to avoid rate limiting
      const batchSize = 3;
      const allResults: VariantResult[] = [];

      for (let i = 0; i < ORG_VARIANT_SUFFIXES.length; i += batchSize) {
        const batch = ORG_VARIANT_SUFFIXES.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (suffix): Promise<VariantResult> => {
            const variantName = `${name}${suffix}`;
            const result = await checkOrgExistsPublic(variantName);
            return {
              variant: variantName,
              available: result.available,
              url: result.url,
            };
          }),
        );
        allResults.push(...batchResults);

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < ORG_VARIANT_SUFFIXES.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const availableVariants = allResults.filter((r) => r.available);
      const hasAvailableVariant = availableVariants.length > 0;

      return {
        name,
        platform: "github-org",
        available: hasAvailableVariant,
        url: hasAvailableVariant ? undefined : allResults[0].url,
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
