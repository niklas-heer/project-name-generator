import type { Checker, CheckResult } from "../types";
import { fetchWithTimeout, createErrorResult } from "./base";

export const homebrewChecker: Checker = {
  name: "homebrew",
  category: "package",
  async check(name: string): Promise<CheckResult> {
    try {
      // Check both formula and cask
      const [formulaRes, caskRes] = await Promise.all([
        fetchWithTimeout(
          `https://formulae.brew.sh/api/formula/${encodeURIComponent(name)}.json`
        ),
        fetchWithTimeout(
          `https://formulae.brew.sh/api/cask/${encodeURIComponent(name)}.json`
        ),
      ]);

      const formulaExists = formulaRes.status === 200;
      const caskExists = caskRes.status === 200;
      const available = !formulaExists && !caskExists;

      let url: string | undefined;
      if (caskExists) {
        url = `https://formulae.brew.sh/cask/${name}`;
      } else if (formulaExists) {
        url = `https://formulae.brew.sh/formula/${name}`;
      }

      return {
        name,
        platform: "homebrew",
        available,
        url,
      };
    } catch (error) {
      return createErrorResult(
        "homebrew",
        name,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  },
};
