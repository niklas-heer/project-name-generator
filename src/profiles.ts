import { parse } from "yaml";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { allCheckers } from "./checkers";
import type { Checker } from "./types";

interface ProfileConfig {
  description: string;
  checkers: string[];
}

interface ProfilesFile {
  profiles: Record<string, ProfileConfig>;
  default: string;
}

const PROFILES_FILE = "config/profiles.yaml";

let cachedProfiles: ProfilesFile | null = null;

async function loadProfiles(): Promise<ProfilesFile> {
  if (cachedProfiles) return cachedProfiles;

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(currentDir, "..");
  const profilesPath = resolve(projectRoot, PROFILES_FILE);

  const content = await Bun.file(profilesPath).text();
  cachedProfiles = parse(content) as ProfilesFile;
  return cachedProfiles;
}

export async function getProfile(name: string): Promise<ProfileConfig | null> {
  const profiles = await loadProfiles();
  return profiles.profiles[name] || null;
}

export async function getDefaultProfileName(): Promise<string> {
  const profiles = await loadProfiles();
  return profiles.default;
}

export async function listProfiles(): Promise<Record<string, ProfileConfig>> {
  const profiles = await loadProfiles();
  return profiles.profiles;
}

export async function getCheckersForProfile(profileName: string): Promise<Checker[]> {
  const profile = await getProfile(profileName);
  if (!profile) {
    throw new Error(`Unknown profile: ${profileName}`);
  }

  const checkerNames = profile.checkers.map((n) => n.toLowerCase());
  return allCheckers.filter((c) => checkerNames.includes(c.name.toLowerCase()));
}

export function getCheckersByNames(names: string[]): Checker[] {
  const lowerNames = names.map((n) => n.toLowerCase());
  return allCheckers.filter((c) => lowerNames.includes(c.name.toLowerCase()));
}

export async function resolveCheckers(options: {
  profile?: string;
  checkers?: string;
}): Promise<Checker[]> {
  // Explicit checkers take precedence
  if (options.checkers) {
    const names = options.checkers.split(",").map((s) => s.trim());
    const resolved = getCheckersByNames(names);
    if (resolved.length === 0) {
      throw new Error(`No valid checkers found in: ${options.checkers}`);
    }
    return resolved;
  }

  // Use profile (or default)
  const profileName = options.profile || (await getDefaultProfileName());
  return getCheckersForProfile(profileName);
}
