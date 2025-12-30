import type { Checker, CheckResult } from "../types";
import { fetchWithTimeout, createErrorResult } from "./base";

export const npmChecker: Checker = {
  name: "npm",
  category: "package",
  async check(name: string): Promise<CheckResult> {
    try {
      const response = await fetchWithTimeout(
        `https://registry.npmjs.org/${encodeURIComponent(name)}`
      );
      const available = response.status === 404;
      return {
        name,
        platform: "npm",
        available,
        url: available ? undefined : `https://www.npmjs.com/package/${name}`,
      };
    } catch (error) {
      return createErrorResult(
        "npm",
        name,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  },
};

export const npmOrgChecker: Checker = {
  name: "npm-org",
  category: "package",
  async check(name: string): Promise<CheckResult> {
    try {
      const response = await fetchWithTimeout(
        `https://registry.npmjs.org/-/org/${encodeURIComponent(name)}`
      );
      const available = response.status === 404;
      return {
        name,
        platform: "npm-org",
        available,
        url: available ? undefined : `https://www.npmjs.com/org/${name}`,
      };
    } catch (error) {
      return createErrorResult(
        "npm-org",
        name,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  },
};
