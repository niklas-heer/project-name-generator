import { Database } from "bun:sqlite";
import path from "path";
import os from "os";

// Database location: ~/.config/checkname/names.db
const DB_DIR = path.join(os.homedir(), ".config", "checkname");
const DB_PATH = path.join(DB_DIR, "names.db");

let db: Database | null = null;

function ensureDbDir(): void {
  const fs = require("fs");
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

export function getDb(): Database {
  if (db) return db;

  ensureDbDir();
  db = new Database(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  initSchema();
  return db;
}

function initSchema(): void {
  if (!db) return;

  db.exec(`
    -- Projects you're naming
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY,
      tag TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- All generated names
    CREATE TABLE IF NOT EXISTS names (
      id INTEGER PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      rationale TEXT,
      source TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(project_id, name)
    );

    -- Availability checks
    CREATE TABLE IF NOT EXISTS availability_checks (
      id INTEGER PRIMARY KEY,
      name_id INTEGER REFERENCES names(id) ON DELETE CASCADE,
      checker TEXT NOT NULL,
      available INTEGER,
      url TEXT,
      checked_at TEXT DEFAULT (datetime('now')),
      UNIQUE(name_id, checker)
    );

    -- Judge scores
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY,
      name_id INTEGER REFERENCES names(id) ON DELETE CASCADE,
      model TEXT NOT NULL,
      typability INTEGER,
      memorability INTEGER,
      meaning INTEGER,
      uniqueness INTEGER,
      cultural_risk INTEGER,
      overall REAL,
      verdict TEXT,
      weaknesses TEXT,
      judged_at TEXT DEFAULT (datetime('now'))
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_names_project ON names(project_id);
    CREATE INDEX IF NOT EXISTS idx_scores_name ON scores(name_id);
    CREATE INDEX IF NOT EXISTS idx_scores_verdict ON scores(verdict);
  `);
}

// Project operations
export function getOrCreateProject(tag: string, description?: string): number {
  const db = getDb();

  // Try to get existing project
  const existing = db
    .query<{ id: number }, [string]>("SELECT id FROM projects WHERE tag = ?")
    .get(tag);

  if (existing) {
    // Update description if provided
    if (description) {
      db.run("UPDATE projects SET description = ?, updated_at = datetime('now') WHERE id = ?", [
        description,
        existing.id,
      ]);
    }
    return existing.id;
  }

  // Create new project
  const result = db.run("INSERT INTO projects (tag, description) VALUES (?, ?)", [
    tag,
    description || null,
  ]);
  return Number(result.lastInsertRowid);
}

export function getProject(tag: string): { id: number; tag: string; description: string | null } | null {
  const db = getDb();
  return db
    .query<{ id: number; tag: string; description: string | null }, [string]>(
      "SELECT id, tag, description FROM projects WHERE tag = ?"
    )
    .get(tag);
}

export function listProjects(): Array<{
  tag: string;
  description: string | null;
  nameCount: number;
  strongCount: number;
}> {
  const db = getDb();
  return db
    .query<
      { tag: string; description: string | null; nameCount: number; strongCount: number },
      []
    >(
      `SELECT
        p.tag,
        p.description,
        COUNT(DISTINCT n.id) as nameCount,
        COUNT(DISTINCT CASE WHEN s.verdict = 'strong' THEN n.id END) as strongCount
      FROM projects p
      LEFT JOIN names n ON n.project_id = p.id
      LEFT JOIN scores s ON s.name_id = n.id
      GROUP BY p.id
      ORDER BY p.updated_at DESC`
    )
    .all();
}

// Name operations
export function addName(
  projectId: number,
  name: string,
  rationale?: string,
  source?: string
): number | null {
  const db = getDb();
  try {
    const result = db.run(
      "INSERT INTO names (project_id, name, rationale, source) VALUES (?, ?, ?, ?)",
      [projectId, name.toLowerCase(), rationale || null, source || null]
    );
    return Number(result.lastInsertRowid);
  } catch {
    // Name already exists for this project
    return null;
  }
}

export function getNameId(projectId: number, name: string): number | null {
  const db = getDb();
  const result = db
    .query<{ id: number }, [number, string]>(
      "SELECT id FROM names WHERE project_id = ? AND name = ?"
    )
    .get(projectId, name.toLowerCase());
  return result?.id || null;
}

export function getProjectNames(projectId: number): string[] {
  const db = getDb();
  return db
    .query<{ name: string }, [number]>("SELECT name FROM names WHERE project_id = ?")
    .all(projectId)
    .map((r) => r.name);
}

// Availability operations
export function addAvailabilityCheck(
  nameId: number,
  checker: string,
  available: boolean,
  url?: string
): void {
  const db = getDb();
  db.run(
    `INSERT OR REPLACE INTO availability_checks (name_id, checker, available, url, checked_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [nameId, checker, available ? 1 : 0, url || null]
  );
}

export function getAvailability(
  nameId: number
): Array<{ checker: string; available: boolean; url: string | null }> {
  const db = getDb();
  return db
    .query<{ checker: string; available: number; url: string | null }, [number]>(
      "SELECT checker, available, url FROM availability_checks WHERE name_id = ?"
    )
    .all(nameId)
    .map((r) => ({ ...r, available: r.available === 1 }));
}

// Score operations
export function addScore(
  nameId: number,
  score: {
    model: string;
    typability: number;
    memorability: number;
    meaning: number;
    uniqueness: number;
    culturalRisk: number;
    overall: number;
    verdict: string;
    weaknesses?: string;
  }
): void {
  const db = getDb();
  db.run(
    `INSERT INTO scores (name_id, model, typability, memorability, meaning, uniqueness, cultural_risk, overall, verdict, weaknesses)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nameId,
      score.model,
      score.typability,
      score.memorability,
      score.meaning,
      score.uniqueness,
      score.culturalRisk,
      score.overall,
      score.verdict,
      score.weaknesses || null,
    ]
  );
}

export function getLatestScore(nameId: number): {
  model: string;
  typability: number;
  memorability: number;
  meaning: number;
  uniqueness: number;
  culturalRisk: number;
  overall: number;
  verdict: string;
  weaknesses: string | null;
} | null {
  const db = getDb();
  return db
    .query<
      {
        model: string;
        typability: number;
        memorability: number;
        meaning: number;
        uniqueness: number;
        cultural_risk: number;
        overall: number;
        verdict: string;
        weaknesses: string | null;
      },
      [number]
    >(
      `SELECT model, typability, memorability, meaning, uniqueness, cultural_risk, overall, verdict, weaknesses
       FROM scores WHERE name_id = ? ORDER BY judged_at DESC LIMIT 1`
    )
    .get(nameId);
}

// Leaderboard query
export interface LeaderboardEntry {
  name: string;
  rationale: string | null;
  source: string | null;
  overall: number;
  verdict: string;
  typability: number;
  memorability: number;
  meaning: number;
  uniqueness: number;
  culturalRisk: number;
  weaknesses: string | null;
  availabilityPercent: number;
}

export function getLeaderboard(
  projectId: number,
  options: {
    minScore?: number;
    verdicts?: string[];
    limit?: number;
  } = {}
): LeaderboardEntry[] {
  const db = getDb();
  const { minScore = 0, verdicts = ["strong", "consider", "reject"], limit = 20 } = options;

  const verdictsPlaceholder = verdicts.map(() => "?").join(", ");

  const query = `
    SELECT
      n.name,
      n.rationale,
      n.source,
      s.overall,
      s.verdict,
      s.typability,
      s.memorability,
      s.meaning,
      s.uniqueness,
      s.cultural_risk as culturalRisk,
      s.weaknesses,
      COALESCE(
        100.0 * SUM(CASE WHEN ac.available = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(ac.id), 0),
        0
      ) as availabilityPercent
    FROM names n
    JOIN scores s ON s.name_id = n.id
    LEFT JOIN availability_checks ac ON ac.name_id = n.id
    WHERE n.project_id = ?
      AND s.overall >= ?
      AND s.verdict IN (${verdictsPlaceholder})
      AND s.id = (SELECT MAX(id) FROM scores WHERE name_id = n.id)
    GROUP BY n.id
    ORDER BY s.overall DESC, s.verdict = 'strong' DESC
    LIMIT ?
  `;

  return db
    .query<LeaderboardEntry, [number, number, ...string[], number]>(query)
    .all(projectId, minScore, ...verdicts, limit);
}

// Delete a project and all its data
export function deleteProject(tag: string): boolean {
  const db = getDb();
  const project = getProject(tag);
  if (!project) return false;

  db.run("DELETE FROM projects WHERE id = ?", [project.id]);
  return true;
}

// Close database connection
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
