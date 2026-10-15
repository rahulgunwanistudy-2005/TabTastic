import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './paths.js';
import type { Run } from './types.js';

fs.mkdirSync(dataDir, { recursive: true });
export const db = new Database(path.join(dataDir, 'journeyproof.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
// Portable SQL: IDs and timestamps are text; payloads can migrate to JSONB.
db.exec(`
CREATE TABLE IF NOT EXISTS runs (
 id TEXT PRIMARY KEY, url TEXT NOT NULL, journey TEXT NOT NULL,
 status TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT,
 parent_id TEXT REFERENCES runs(id), payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS steps (
 run_id TEXT NOT NULL REFERENCES runs(id), step_index INTEGER NOT NULL,
 timestamp TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(run_id, step_index)
);
CREATE TABLE IF NOT EXISTS findings (
 run_id TEXT NOT NULL REFERENCES runs(id), id TEXT NOT NULL,
 rule TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(run_id, id)
);
CREATE TABLE IF NOT EXISTS fixes (
 run_id TEXT NOT NULL REFERENCES runs(id), id TEXT NOT NULL,
 approved INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(run_id, id)
);
CREATE TABLE IF NOT EXISTS billing_sessions (
 id TEXT PRIMARY KEY, plan TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
`);
const upsert = db.prepare(`INSERT INTO runs VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id)
 DO UPDATE SET status=excluded.status, completed_at=excluded.completed_at, payload=excluded.payload`);
const step = db.prepare('INSERT OR REPLACE INTO steps VALUES (?,?,?,?)');
const finding = db.prepare('INSERT OR REPLACE INTO findings VALUES (?,?,?,?)');
const fix = db.prepare('INSERT OR REPLACE INTO fixes VALUES (?,?,?,?)');
export const saveRun = db.transaction((run: Run) => {
 upsert.run(run.id, run.url, run.journey, run.status, run.createdAt, run.completedAt ?? null, run.parentId ?? null, JSON.stringify(run));
 for (const s of run.steps) step.run(run.id, s.index, s.timestamp, JSON.stringify(s));
 for (const f of run.findings) finding.run(run.id, f.id, f.rule, JSON.stringify(f));
 for (const f of run.fixes) fix.run(run.id, f.id, Number(f.approved), JSON.stringify(f));
});
export function getRun(id: string): Run | undefined {
 const row = db.prepare('SELECT payload FROM runs WHERE id=?').get(id) as {payload:string}|undefined;
 return row ? JSON.parse(row.payload) : undefined;
}
export function listRuns(): Run[] {
 return (db.prepare('SELECT payload FROM runs ORDER BY created_at DESC LIMIT 50').all() as {payload:string}[]).map(x => JSON.parse(x.payload));
}
// An interrupted browser process must never leave a run appearing live forever.
for (const run of listRuns()) if (run.status === 'running' || run.status === 'queued') {
 run.status = 'error'; run.reason = 'Runner restarted before this journey finished.';
 run.completedAt = new Date().toISOString(); saveRun(run);
}
