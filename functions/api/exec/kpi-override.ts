import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

const KPI_KEYS = ["turnover", "eval_coverage", "orientation", "satisfaction", "probation_pass", "training_plan", "license"];

// PATCH /api/exec/kpi-override  body: {kpi_key, period_type, period_value, pct, detail?}
// Saves (or overwrites) a manual backfill for one Executive Dashboard KPI card, for the exact period the dashboard's own selector is showing.
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => ({})) as {
    kpi_key?: string; period_type?: string; period_value?: string; pct?: number; detail?: string;
  };
  if (!body.kpi_key || !KPI_KEYS.includes(body.kpi_key) || !["month", "year"].includes(body.period_type ?? "") || !body.period_value) {
    return Response.json({ ok: false, error: "ระบุ kpi_key/period_type/period_value ให้ถูกต้อง" }, { status: 400 });
  }
  if (typeof body.pct !== "number" || !Number.isFinite(body.pct) || body.pct < 0 || body.pct > 100) {
    return Response.json({ ok: false, error: "ร้อยละต้องอยู่ระหว่าง 0-100" }, { status: 400 });
  }

  await ctx.env.HR_DB.prepare(`
    INSERT INTO exec_kpi_overrides (kpi_key, period_type, period_value, pct, detail, updated_by)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(kpi_key, period_type, period_value) DO UPDATE SET
      pct = excluded.pct, detail = excluded.detail,
      updated_by = excluded.updated_by, updated_at = datetime('now')
  `).bind(body.kpi_key, body.period_type, body.period_value, body.pct, body.detail ?? "", user.full_name ?? user.username ?? "").run();

  return Response.json({ ok: true });
};

// DELETE /api/exec/kpi-override?kpi_key=&period_type=&period_value=  — clears the override, reverting to the live-computed value.
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url         = new URL(ctx.request.url);
  const kpiKey      = url.searchParams.get("kpi_key");
  const periodType  = url.searchParams.get("period_type");
  const periodValue = url.searchParams.get("period_value");
  if (!kpiKey || !KPI_KEYS.includes(kpiKey) || !["month", "year"].includes(periodType ?? "") || !periodValue) {
    return Response.json({ ok: false, error: "ระบุ kpi_key/period_type/period_value ให้ถูกต้อง" }, { status: 400 });
  }

  await ctx.env.HR_DB.prepare(
    "DELETE FROM exec_kpi_overrides WHERE kpi_key = ? AND period_type = ? AND period_value = ?"
  ).bind(kpiKey, periodType, periodValue).run();

  return Response.json({ ok: true });
};
