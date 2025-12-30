import type { Checker, CheckResult } from "../types";
import { fetchWithTimeout, createErrorResult } from "./base";

export const nugetChecker: Checker = {
  name: "nuget",
  category: "package",
  async check(name: string): Promise<CheckResult> {
    try {
      const response = await fetchWithTimeout(
        `https://api.nuget.org/v3/registration5-semver1/${encodeURIComponent(name.toLowerCase())}/index.json`
      );
      const available = response.status === 404;
      return {
        name,
        platform: "nuget",
        available,
        url: available ? undefined : `https://www.nuget.org/packages/${name}`,
      };
    } catch (error) {
      return createErrorResult(
        "nuget",
        name,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  },
};
