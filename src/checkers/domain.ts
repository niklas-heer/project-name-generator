import type { Checker, CheckResult } from "../types";
import { fetchWithTimeout, createErrorResult } from "./base";

export const devDomainChecker: Checker = {
  name: "domain-dev",
  category: "domain",
  async check(name: string): Promise<CheckResult> {
    const domain = `${name}.dev`;
    try {
      // Use RDAP (Registration Data Access Protocol) for .dev domains
      // Google runs the .dev TLD registry via pubapi.registry.google
      const response = await fetchWithTimeout(
        `https://pubapi.registry.google/rdap/domain/${encodeURIComponent(domain)}`,
      );

      // 404 means the domain is available
      // 200 means it's registered
      const available = response.status === 404;

      return {
        name,
        platform: "domain-dev",
        available,
        url: available ? undefined : `https://${domain}`,
      };
    } catch (error) {
      return createErrorResult(
        "domain-dev",
        name,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
};
