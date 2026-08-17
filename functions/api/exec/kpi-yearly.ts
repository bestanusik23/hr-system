import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";
import { monthBounds } from "../../lib/periodBounds";
import {
  computeTurnover, computeEvalCoverage, computeOrientation, computeSatisfaction,
  computeProbationPass, computeTrainingPlan, computeLicense, EXEC_TO_ISO_KPI_KEY,
} from "../../lib/hrKpiFormulas";

const KPI_KEYS = ["turnover", "eval_coverage", "orientation", "satisfaction", "probation_pass", "training_plan", "license"] as const;
type KpiKey = typeof KPI_KEYS[number];

// GET /api/exec/kpi-yearly?year=2026 (CE) — 12 months of every KPI card, for the
// "ภาพรวมรายปี" trend view: one bar chart per KPI instead of a single-period snapshot.
// Reuses the exact same per-month formulas/bounds as /api/exec/kpi.ts and
// /api/iso-kpi/monthly.ts (see hrKpiFormulas.ts) so the trend always matches whatever
// the single-month view and the ISO grid show for the same month.
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "deputy", "deputyHR", "admin"].includes(user.role)) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url    = new URL(ctx.request.url);
  const yearCE = parseInt(url.searchParams.get("year") ?? "", 10);
  if (!yearCE || yearCE < 2000 || yearCE > 3000) {
    return Response.json({ ok: false, error: "ระบุปีให้ถูกต้อง" }, { status: 400 });
  }
  const yearBE = yearCE + 543;
  const db = ctx.env.HR_DB;

  // Overrides for all 12 months of this year, both stores at once.
  const isoOverrideRows = await db.prepare(
    "SELECT kpi_key, month, numerator, denominator FROM iso_kpi_overrides WHERE year = ?"
  ).bind(yearBE).all<{ kpi_key: string; month: number; numerator: number; denominator: number }>();
  const isoOverrides = new Map((isoOverrideRows.results ?? []).map(r => [`${r.kpi_key}-${r.month}`, r]));
  const execOverrideRows = await db.prepare(
    "SELECT kpi_key, period_value, pct FROM exec_kpi_overrides WHERE period_type = 'month' AND period_value LIKE ?"
  ).bind(`${yearCE}-%`).all<{ kpi_key: string; period_value: string; pct: number }>();
  const execOverrides = new Map((execOverrideRows.results ?? []).map(r => [`${r.kpi_key}-${Number(r.period_value.slice(5, 7))}`, r.pct]));

  const kpis: Record<KpiKey, { month: number; numerator: number; denominator: number; pct: number | null; source: "manual" | "computed" }[]> =
    { turnover: [], eval_coverage: [], orientation: [], satisfaction: [], probation_pass: [], training_plan: [], license: [] };

  for (let m = 1; m <= 12; m++) {
    const { pStart, pEnd } = monthBounds(yearCE, m);

    const computed: Record<KpiKey, { numerator: number; denominator: number; pct: number | null }> = {
      turnover:       await computeTurnover(db, pStart, pEnd),
      eval_coverage:  await computeEvalCoverage(db, pStart, pEnd),
      orientation:    await computeOrientation(db, pStart, pEnd),
      satisfaction:   await computeSatisfaction(db, pStart, pEnd),
      probation_pass: await computeProbationPass(db, pStart, pEnd),
      training_plan:  await computeTrainingPlan(db, pStart, pEnd),
      license:        await computeLicense(db, pStart, pEnd),
    };

    for (const key of KPI_KEYS) {
      const isoKey = EXEC_TO_ISO_KPI_KEY[key];
      const isoOv = isoKey ? isoOverrides.get(`${isoKey}-${m}`) : undefined;
      const execOv = execOverrides.get(`${key}-${m}`);
      if (isoOv) {
        kpis[key].push({
          month: m, numerator: isoOv.numerator, denominator: isoOv.denominator,
          pct: isoOv.denominator > 0 ? Math.round((isoOv.numerator / isoOv.denominator) * 1000) / 10 : 0,
          source: "manual",
        });
      } else if (execOv !== undefined) {
        kpis[key].push({ month: m, numerator: computed[key].numerator, denominator: computed[key].denominator, pct: execOv, source: "manual" });
      } else {
        kpis[key].push({ month: m, numerator: computed[key].numerator, denominator: computed[key].denominator, pct: computed[key].pct, source: "computed" });
      }
    }
  }

  return Response.json({ ok: true, year: yearCE, kpis });
};
