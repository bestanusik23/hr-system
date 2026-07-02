/**
 * persist.ts
 * Keeps the last imported payroll file in sync across the whole team, not just
 * one browser:
 *   - Server (D1 via /api/manpower/workforce-import): shared across every user
 *     and device. This is the source of truth.
 *   - localStorage: an instant local fallback/cache so the page doesn't flash
 *     back to the static example while the server request is in flight, and
 *     still works offline for whoever last imported on this browser.
 *
 * WorkforceTimeline is also mounted in two places (the standalone
 * /workforce-timeline page and embedded inside ManpowerDashboard) — since each
 * mount has its own component state, both reading from the same server dataset
 * on mount is what keeps them showing the same data.
 */

import type { ParseResult } from "./types";

const STORAGE_KEY = "hrwt:lastImport";
const API_URL = "/api/manpower/workforce-import";

export interface StoredImport {
  parsed: ParseResult;
  importedAt: string;
}

// ─── Local cache (instant, per-browser) ───────────────────────────────────────

export function saveImportLocal(parsed: ParseResult, importedAt: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ parsed, importedAt }));
  } catch {
    // localStorage unavailable (private browsing, quota exceeded, etc.) — the
    // import still works for this session, it just won't survive a reload.
  }
}

export function loadImportLocal(): StoredImport | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredImport;
  } catch {
    return null;
  }
}

// ─── Server (shared across users/devices) ────────────────────────────────────

/** Saves the import to the server so every user sees it. Errors are swallowed —
 *  the local cache above already keeps this browser working either way. */
export async function saveImportRemote(parsed: ParseResult, importedAt: string): Promise<void> {
  try {
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parsed, importedAt }),
    });
  } catch {
    // Network/server error — the local cache still has this import for this browser.
  }
}

/** Loads the team's shared import from the server, or null if none saved yet / request failed. */
export async function loadImportRemote(): Promise<StoredImport | null> {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) return null;
    const json = await res.json() as { ok: boolean; dataset: { parsed: ParseResult; importedAt: string } | null };
    if (!json.ok || !json.dataset) return null;
    return { parsed: json.dataset.parsed, importedAt: json.dataset.importedAt };
  } catch {
    return null;
  }
}
