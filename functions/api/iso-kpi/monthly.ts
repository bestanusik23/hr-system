import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";
import { monthBounds } from "../../lib/periodBounds";
import { computeOrientation, computeProbationPass, computeLicense, computeTrainingPlan } from "../../lib/hrKpiFormulas";

const KPI_KEYS = ["license", "orientation", "competency", "training"];

// GET /api/iso-kpi/monthly?year=2569&kpi=license|orientation|competency|training
// Returns 12 months of {month, numerator, denominator, pct, source} for one
// of the four ISO quality-objective KPIs (FM-ISO-01-03). Computed live from
// existing tables by default; a month with a saved iso_kpi_overrides row
// (for backfilling periods before this tracking existed, where the live
// figure doesn't match what HR knows actually happened) returns that
// instead, with source:"manual" so the UI can flag it.
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url    = new URL(ctx.request.url);
  const yearBE = parseInt(url.searchParams.get("year") ?? "", 10);
  const kpi    = url.searchParams.get("kpi");
  if (!yearBE || !KPI_KEYS.includes(kpi ?? "")) {
    return Response.json({ ok: false, error: "ระบุปีและ kpi ให้ถูกต้อง" }, { status: 400 });
  }
  const yearCE = yearBE - 543;
  const db = ctx.env.HR_DB;

  const overrideRows = await db.prepare(
    "SELECT month, numerator, denominator FROM iso_kpi_overrides WHERE kpi_key = ? AND year = ?"
  ).bind(kpi, yearBE).all<{ month: number; numerator: number; denominator: number }>();
  const overrides = new Map((overrideRows.results ?? []).map(r => [r.month, r]));

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const results: { month: number; numerator: number; denominator: number; pct: number | null; source: "manual" | "computed" }[] = [];

  for (const m of months) {
    const override = overrides.get(m);
    let numerator: number, denominator: number, source: "manual" | "computed";

    if (override) {
      numerator = override.numerator; denominator = override.denominator; source = "manual";
    } else {
      source = "computed";
      // Same period bounds and formulas as /api/exec/kpi.ts (see hrKpiFormulas.ts /
      // periodBounds.ts) so the two dashboards always report identical numbers.
      const { pStart, pEnd } = monthBounds(yearCE, m);
      let result: { numerator: number; denominator: number };
      if (kpi === "license")          result = await computeLicense(db, pEnd);
      else if (kpi === "orientation") result = await computeOrientation(db, pStart, pEnd);
      else if (kpi === "competency")  result = await computeProbationPass(db, pStart, pEnd);
      else                            result = await computeTrainingPlan(db, pStart, pEnd);
      numerator = result.numerator; denominator = result.denominator;
    }

    const pct = denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
    results.push({ month: m, numerator, denominator, pct, source });
  }

  return Response.json({ ok: true, kpi, year: yearBE, months: results });
};

// PATCH /api/iso-kpi/monthly  body: {kpi, year, month, numerator, denominator}
// Saves (or overwrites) a manual override for one month.
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => ({})) as {
    kpi?: string; year?: number; month?: number; numerator?: number; denominator?: number;
  };
  if (!body.kpi || !KPI_KEYS.includes(body.kpi) || !body.year || !body.month || body.month < 1 || body.month > 12) {
    return Response.json({ ok: false, error: "ระบุ kpi/ปี/เดือนให้ถูกต้อง" }, { status: 400 });
  }
  const numerator   = body.numerator ?? 0;
  const denominator = body.denominator ?? 0;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator < 0 || denominator < 0) {
    return Response.json({ ok: false, error: "ตัวเลขต้องเป็นจำนวนบวก" }, { status: 400 });
  }

  await ctx.env.HR_DB.prepare(`
    INSERT INTO iso_kpi_overrides (kpi_key, year, month, numerator, denominator, updated_by)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(kpi_key, year, month) DO UPDATE SET
      numerator = excluded.numerator, denominator = excluded.denominator,
      updated_by = excluded.updated_by, updated_at = datetime('now')
  `).bind(body.kpi, body.year, body.month, Math.round(numerator), Math.round(denominator), user.full_name ?? user.username ?? "").run();

  return Response.json({ ok: true });
};

// DELETE /api/iso-kpi/monthly?kpi=&year=&month=  — clears the override, reverting to the live-computed value.
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url    = new URL(ctx.request.url);
  const kpi    = url.searchParams.get("kpi");
  const yearBE = parseInt(url.searchParams.get("year") ?? "", 10);
  const month  = parseInt(url.searchParams.get("month") ?? "", 10);
  if (!kpi || !KPI_KEYS.includes(kpi) || !yearBE || !month) {
    return Response.json({ ok: false, error: "ระบุ kpi/ปี/เดือนให้ถูกต้อง" }, { status: 400 });
  }

  await ctx.env.HR_DB.prepare(
    "DELETE FROM iso_kpi_overrides WHERE kpi_key = ? AND year = ? AND month = ?"
  ).bind(kpi, yearBE, month).run();

  return Response.json({ ok: true });
};
