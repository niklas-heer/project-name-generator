import type { Checker, CheckResult } from "../types";
import { fetchWithTimeout, createErrorResult } from "./base";

export const nixpkgsChecker: Checker = {
  name: "nixpkgs",
  category: "package",
  async check(name: string): Promise<CheckResult> {
    try {
      const lowerName = name.toLowerCase();
      // Nixpkgs by-name uses first 2 chars as directory prefix
      const prefix = lowerName.slice(0, 2);

      // Check if package exists in pkgs/by-name structure
      const url = `https://api.github.com/repos/NixOS/nixpkgs/contents/pkgs/by-name/${prefix}/${lowerName}`;
      const response = await fetchWithTimeout(url);

      if (response.status === 200) {
        // Package exists in by-name
        return {
          name,
          platform: "nixpkgs",
          available: false,
          url: `https://search.nixos.org/packages?query=${encodeURIComponent(name)}`,
        };
      }

      if (response.status === 404) {
        // Not in by-name, but could be in all-packages.nix (legacy)
        // Do a GitHub code search as fallback
        const searchUrl = `https://api.github.com/search/code?q=${encodeURIComponent(name)}+repo:NixOS/nixpkgs+filename:all-packages.nix`;
        const searchResponse = await fetchWithTimeout(searchUrl);

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.total_count > 0) {
            // Found in legacy location
            return {
              name,
              platform: "nixpkgs",
              available: false,
              url: `https://search.nixos.org/packages?query=${encodeURIComponent(name)}`,
            };
          }
        }

        // Not found anywhere
        return {
          name,
          platform: "nixpkgs",
          available: true,
        };
      }

      // Rate limited or other error
      if (response.status === 403) {
        return createErrorResult("nixpkgs", name, "GitHub API rate limited");
      }

      return createErrorResult(
        "nixpkgs",
        name,
        `GitHub API returned ${response.status}`,
      );
    } catch (error) {
      return createErrorResult(
        "nixpkgs",
        name,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
};
