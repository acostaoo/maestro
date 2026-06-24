import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Minimal .env loader (no external dependency). Reads KEY=VALUE lines from a
 * `.env` file at the backend root and populates process.env for any keys that
 * aren't already set. Lines starting with # and blank lines are ignored; values
 * may be wrapped in single or double quotes.
 *
 * This exists so a local run can supply secrets like GEMINI_API_KEY without
 * committing them — the .env file is gitignored.
 */
export function loadEnv(): void {
  // dist/main.js lives at backend/dist/main.js, so the backend root is two up.
  const file = join(__dirname, '..', '.env');
  if (!existsSync(file)) {
    return;
  }
  for (const rawLine of readFileSync(file, 'utf-8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
