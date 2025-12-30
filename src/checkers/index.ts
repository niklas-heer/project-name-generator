import type { Checker } from "../types";
import { npmChecker, npmOrgChecker } from "./npm";
import { pypiChecker } from "./pypi";
import { cratesChecker } from "./crates";
import { nugetChecker } from "./nuget";
import { goChecker } from "./go";
import { packagistChecker } from "./packagist";
import { homebrewChecker } from "./homebrew";
import {
  githubChecker,
  githubOrgChecker,
  githubUniquenessChecker,
} from "./github";
import { gitlabChecker } from "./gitlab";
import { nixpkgsChecker } from "./nixpkgs";
import { devDomainChecker } from "./domain";
import {
  usptoChecker,
  googleSoftwareChecker,
  googleOpenSourceChecker,
  fossmarksChecker,
} from "./trademark";

export const allCheckers: Checker[] = [
  // Package registries
  npmChecker,
  npmOrgChecker,
  pypiChecker,
  cratesChecker,
  nugetChecker,
  goChecker,
  packagistChecker,
  homebrewChecker,
  nixpkgsChecker,
  // Repositories
  githubChecker,
  githubOrgChecker,
  gitlabChecker,
  // Domains
  devDomainChecker,
  // Uniqueness
  githubUniquenessChecker,
  // Trademarks
  usptoChecker,
  googleSoftwareChecker,
  googleOpenSourceChecker,
  fossmarksChecker,
];

export const packageCheckers = allCheckers.filter(
  (c) => c.category === "package",
);
export const repositoryCheckers = allCheckers.filter(
  (c) => c.category === "repository",
);
export const domainCheckers = allCheckers.filter(
  (c) => c.category === "domain",
);
export const trademarkCheckers = allCheckers.filter(
  (c) => c.category === "trademark",
);
export const uniquenessCheckers = allCheckers.filter(
  (c) => c.category === "uniqueness",
);

export function getCheckersByNames(names: string[]): Checker[] {
  const lowerNames = names.map((n) => n.toLowerCase());
  return allCheckers.filter((c) => lowerNames.includes(c.name.toLowerCase()));
}

export {
  npmChecker,
  npmOrgChecker,
  pypiChecker,
  cratesChecker,
  nugetChecker,
  goChecker,
  packagistChecker,
  homebrewChecker,
  githubChecker,
  githubOrgChecker,
  githubUniquenessChecker,
  gitlabChecker,
  nixpkgsChecker,
  devDomainChecker,
  usptoChecker,
  googleSoftwareChecker,
  googleOpenSourceChecker,
  fossmarksChecker,
};
