/// <reference types="@cloudflare/workers-types" />

// Per-person values used by the รายงาน RAM GROUP (HQ report) that the employees table
// does not hold. Written from the Manpower new-hire / resign forms so HR enters them
// once; the report menu can still correct them later.
// Only the fields passed in are touched, so saving one never clears another.

export interface HqExtraFields { age?: number | null; sourcing_channel?: string | null; reason?: string | null }

export async function upsertHqExtra(db: D1Database, employeeId: number, f: HqExtraFields, actor: string): Promise<void> {
  const cols = (Object.keys(f) as (keyof HqExtraFields)[]).filter(k => f[k] !== undefined);
  if (cols.length === 0) return;
  const vals = cols.map(k => f[k] ?? null);
  try {
    await db.prepare(`
      INSERT INTO hq_report_extra (employee_id, ${cols.join(", ")}, updated_by, updated_at)
      VALUES (?, ${cols.map(() => "?").join(", ")}, ?, datetime('now'))
      ON CONFLICT(employee_id) DO UPDATE SET
        ${cols.map(c => `${c} = excluded.${c}`).join(", ")},
        updated_by = excluded.updated_by, updated_at = excluded.updated_at
    `).bind(employeeId, ...vals, actor).run();
  } catch { /* hq_report_extra missing (migration 0048 not run) — non-critical */ }
}

/** Parse optional age from a request body: undefined = not sent, null = cleared. */
export function parseAge(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || String(v).trim() === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 15 && n <= 90 ? n : null;
}

export function parseText(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  const s = String(v ?? "").trim();
  return s || null;
}
