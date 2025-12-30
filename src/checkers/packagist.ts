import type { Checker, CheckResult } from "../types";
import { fetchWithTimeout, createErrorResult } from "./base";

export const packagistChecker: Checker = {
  name: "packagist",
  category: "package",
  async check(name: string): Promise<CheckResult> {
    try {
      // Packagist uses vendor/package format, so we search for packages containing the name
      const response = await fetchWithTimeout(
        `https://packagist.org/search.json?q=${encodeURIComponent(name)}`
      );
      const json = await response.json();
      // Check if any package has an exact name match
      const exactMatch = json.results?.some(
        (pkg: { name: string }) =>
          pkg.name.toLowerCase() === name.toLowerCase() ||
          pkg.name.toLowerCase().endsWith(`/${name.toLowerCase()}`)
      );
      const available = !exactMatch;
      return {
        name,
        platform: "packagist",
        available,
        url: available
          ? undefined
          : `https://packagist.org/search/?q=${encodeURIComponent(name)}`,
      };
    } catch (error) {
      return createErrorResult(
        "packagist",
        name,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  },
};
