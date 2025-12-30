import type { Checker, CheckResult } from "../types";
import { fetchWithTimeout, createErrorResult } from "./base";

export const cratesChecker: Checker = {
  name: "crates.io",
  category: "package",
  async check(name: string): Promise<CheckResult> {
    try {
      const response = await fetchWithTimeout(
        `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`
      );
      const available = response.status === 404;
      return {
        name,
        platform: "crates.io",
        available,
        url: available ? undefined : `https://crates.io/crates/${name}`,
      };
    } catch (error) {
      return createErrorResult(
        "crates.io",
        name,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  },
};
