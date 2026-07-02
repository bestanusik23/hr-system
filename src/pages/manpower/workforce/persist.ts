/**
 * persist.ts
 * Keeps the last imported payroll file in localStorage so the dashboard doesn't
 * reset to empty/mock data every time the page is closed or navigated away from.
 *
 * WorkforceTimeline is mounted in two places (the standalone /workforce-timeline
 * page and embedded inside ManpowerDashboard) — since each mount has its own
 * component state, reading from the same localStorage key on mount is what keeps
 * both in sync with whichever file was imported most recently.
 */

import type { ParseResult } from "./types";

const STORAGE_KEY = "hrwt:lastImport";

export interface StoredImport {
  parsed: ParseResult;
  importedAt: string;
}

export function saveImport(parsed: ParseResult, importedAt: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ parsed, importedAt }));
  } catch {
    // localStorage unavailable (private browsing, quota exceeded, etc.) —
    // the import still works for this session, it just won't survive a reload.
  }
}

export function loadImport(): StoredImport | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredImport;
  } catch {
    return null;
  }
}
