import type { Checker, CheckResult } from "../types";
import { fetchWithTimeout, createErrorResult } from "./base";

export const gitlabChecker: Checker = {
  name: "gitlab",
  category: "repository",
  async check(name: string): Promise<CheckResult> {
    try {
      // GitLab doesn't have a direct project lookup, so we search
      // We only check first few pages to avoid rate limiting
      for (let page = 1; page <= 3; page++) {
        const response = await fetchWithTimeout(
          `https://gitlab.com/api/v4/projects?search=${encodeURIComponent(name)}&per_page=100&page=${page}`
        );

        if (!response.ok) {
          // GitLab rate limits aggressively
          if (response.status === 429) {
            return createErrorResult("gitlab", name, "Rate limited by GitLab");
          }
          break;
        }

        const json = await response.json();
        if (json.length === 0) break;

        const exactMatch = json.find(
          (project: { name: string }) =>
            project.name.toLowerCase() === name.toLowerCase()
        );

        if (exactMatch) {
          return {
            name,
            platform: "gitlab",
            available: false,
            url: exactMatch.web_url,
          };
        }
      }

      return {
        name,
        platform: "gitlab",
        available: true,
      };
    } catch (error) {
      return createErrorResult(
        "gitlab",
        name,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  },
};
