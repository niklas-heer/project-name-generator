import type { Checker, CheckResult } from "../types";
import { fetchWithTimeout, createErrorResult } from "./base";

export const goChecker: Checker = {
  name: "go",
  category: "package",
  async check(name: string): Promise<CheckResult> {
    try {
      const response = await fetchWithTimeout(
        `https://pkg.go.dev/search?q=${encodeURIComponent(name)}&m=package`
      );
      const text = await response.text();
      // Parse the search results count from the page
      const regex = /Showing <strong>(\d+)<\/strong>/;
      const match = text.match(regex);
      let searchCount = 0;
      if (match && match[1]) {
        searchCount = parseInt(match[1], 10);
      }
      const available = searchCount === 0;
      return {
        name,
        platform: "go",
        available,
        url: available
          ? undefined
          : `https://pkg.go.dev/search?q=${encodeURIComponent(name)}&m=package`,
      };
    } catch (error) {
      return createErrorResult(
        "go",
        name,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  },
};
