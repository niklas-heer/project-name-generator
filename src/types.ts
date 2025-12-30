export interface VariantResult {
  variant: string;
  available: boolean;
  url?: string;
}

export interface CheckResult {
  name: string;
  platform: string;
  available: boolean;
  url?: string;
  error?: string;
  // Uniqueness data (for github-uniqueness checker)
  count?: number;
  activeCount?: number;
  // Variant data (for github-org checker)
  variants?: VariantResult[];
}

export interface Checker {
  name: string;
  category: "package" | "repository" | "domain" | "trademark" | "uniqueness";
  check(name: string): Promise<CheckResult>;
}

export interface CheckOptions {
  timeout?: number;
}

export const DEFAULT_TIMEOUT = 10000;

export const USER_AGENT =
  "checkname-cli https://github.com/niklas-heer/project-name-generator";
