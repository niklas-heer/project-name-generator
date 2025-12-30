import type { Checker, CheckResult } from "../types";
import { fetchWithTimeout, createErrorResult } from "./base";

export const pypiChecker: Checker = {
  name: "pypi",
  category: "package",
  async check(name: string): Promise<CheckResult> {
    try {
      const response = await fetchWithTimeout(
        `https://pypi.org/pypi/${encodeURIComponent(name)}/json`
      );
      const available = response.status === 404;
      return {
        name,
        platform: "pypi",
        available,
        url: available ? undefined : `https://pypi.org/project/${name}/`,
      };
    } catch (error) {
      return createErrorResult(
        "pypi",
        name,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  },
};
