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
 *
 * Both save/load paths log failures to the browser console (prefixed "[hrwt]")
 * instead of swallowing them silently, since a silent failure here looks
 * identical to "the import just didn't save" from the user's side.
 */

import type { ParseResult } from "./types";

const STORAGE_KEY = "hrwt:lastImport";
const API_URL = "/api/manpower/workforce-import";

export interface StoredImport {
  parsed: ParseResult;
  importedAt: string;
}

/**
 * Drops the verbose `code`/`name` fields from every shift record before
 * persisting. Nothing downstream reads them after parsing (only `date`,
 * `isActive`, and `ranges` are used) — they were carrying full Thai shift
 * descriptions like "วันงาน 08.00 - 16.00 (ทำงาน 8 ชั่วโมง)(วิชาชีพ)" repeated
 * across every record, which roughly doubles the JSON size for no benefit and
 * makes it more likely to bump into a storage size limit (D1 row size,
 * localStorage quota).
 */
function compactForStorage(parsed: ParseResult): ParseResult {
  return {
    ...parsed,
    employees: parsed.employees.map(emp => ({
      ...emp,
      records: emp.records.map(rec => ({ date: rec.date, code: "", name: "", ranges: rec.ranges, isActive: rec.isActive })),
    })),
  };
}

// ─── Local cache (instant, per-browser) ───────────────────────────────────────

export function saveImportLocal(parsed: ParseResult, importedAt: string): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ parsed: compactForStorage(parsed), importedAt }));
    return true;
  } catch (err) {
    console.error("[hrwt] saveImportLocal failed (localStorage quota/private mode?):", err);
    return false;
  }
}

export function loadImportLocal(): StoredImport | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredImport;
  } catch (err) {
    console.error("[hrwt] loadImportLocal failed (corrupt localStorage value?):", err);
    return null;
  }
}

// ─── Server (shared across users/devices) ────────────────────────────────────

/** Saves the import to the server so every user sees it. Returns whether it actually succeeded. */
export async function saveImportRemote(parsed: ParseResult, importedAt: string): Promise<boolean> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parsed: compactForStorage(parsed), importedAt }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[hrwt] saveImportRemote failed: HTTP ${res.status} — ${text}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[hrwt] saveImportRemote failed (network error):", err);
    return false;
  }
}

/** Loads the team's shared import from the server, or null if none saved yet / request failed. */
export async function loadImportRemote(): Promise<StoredImport | null> {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[hrwt] loadImportRemote failed: HTTP ${res.status} — ${text}`);
      return null;
    }
    const json = await res.json() as { ok: boolean; dataset: { parsed: ParseResult; importedAt: string } | null };
    if (!json.ok || !json.dataset) return null;
    return { parsed: json.dataset.parsed, importedAt: json.dataset.importedAt };
  } catch (err) {
    console.error("[hrwt] loadImportRemote failed (network error):", err);
    return null;
  }
}
