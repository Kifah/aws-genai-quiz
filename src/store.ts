/**
 * Attempt-history persistence — thin I/O wrapper around a local JSON log.
 *
 * The history file is a flat JSON array of AttemptRecord objects stored at the
 * project root as `.quiz-history.json` (gitignored — it is per-user progress).
 * All statistics are DERIVED from this log by src/history.ts, so the store
 * itself stays deliberately simple: read all, append, write all.
 */

import * as fs   from 'fs';
import * as path from 'path';
import { AttemptRecord } from './history';

const HISTORY_PATH = path.join(__dirname, '..', '.quiz-history.json');

/** Read the full attempt log. Returns [] if the file is missing or unreadable. */
export function readHistory(): AttemptRecord[] {
  try {
    const raw = fs.readFileSync(HISTORY_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AttemptRecord[]) : [];
  } catch {
    // Missing file or corrupt JSON → start fresh rather than crash the quiz.
    return [];
  }
}

/** Append new attempt records to the log (creates the file if needed). */
export function recordAttempts(records: AttemptRecord[]): void {
  if (records.length === 0) return;
  const existing = readHistory();
  existing.push(...records);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(existing, null, 2) + '\n');
}

/** Generate a session id (timestamp + short random suffix). */
export function newSessionId(): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const rand  = Math.random().toString(36).slice(2, 6);
  return `s${stamp}-${rand}`;
}

/** Expose the resolved path (used by the stats command to report location). */
export function historyPath(): string {
  return HISTORY_PATH;
}
