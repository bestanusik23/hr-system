import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";
import { EXEC_TO_ISO_KPI_KEY } from "../../lib/hrKpiFormulas";

const KPI_KEYS = ["turnover", "eval_coverage", "orientation", "satisfaction", "probation_pass", "training_plan", "license"];

// license/orientation/probation_pass/training_plan are shared with the ISO KPI grid
// (FM-ISO-01 to 03) — for "month" periods their override is written straight into
// iso_kpi_overrides (as numerator/denominator, translating the kpi_key), so a backfill
// entered from either dashboard shows up in both instead of the two disagreeing.
// turnover/eval_coverage/satisfaction have no ISO equivalent and use exec_kpi_overrides
// (pct + free-text detail), as does a shared KPI viewed in "year" mode — ISO has no
// per-year override concept to share with.
function sharedIsoTarget(kpiKey: string, periodType: string, periodValue: string): { isoKey: string; yearBE: number; month: number } | null {
  const isoKey = EXEC_TO_ISO_KPI_KEY[kpiKey];
  if (!isoKey || periodType !== "month") return null;
  const m = /^(\d{4})-(\d{2})$/.exec(periodValue);
  if (!m) return null;
  return { isoKey, yearBE: Number(m[1]) + 543, month: Number(m[2]) };
}

// PATCH /api/exec/kpi-override  body: {kpi_key, period_type, period_value, pct, detail?, numerator?, denominator?}
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => ({})) as {
    kpi_key?: string; period_type?: string; period_value?: string;
    pct?: number; detail?: string; numerator?: number; denominator?: number;
  };
  if (!body.kpi_key || !KPI_KEYS.includes(body.kpi_key) || !["month", "year"].includes(body.period_type ?? "") || !body.period_value) {
    return Response.json({ ok: false, error: "ระบุ kpi_key/period_type/period_value ให้ถูกต้อง" }, { status: 400 });
  }

  const target = sharedIsoTarget(body.kpi_key, body.period_type!, body.period_value);
  if (target) {
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
    `).bind(target.isoKey, target.yearBE, target.month, Math.round(numerator), Math.round(denominator), user.full_name ?? user.username ?? "").run();
    return Response.json({ ok: true });
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

  const target = sharedIsoTarget(kpiKey, periodType!, periodValue);
  if (target) {
    await ctx.env.HR_DB.prepare(
      "DELETE FROM iso_kpi_overrides WHERE kpi_key = ? AND year = ? AND month = ?"
    ).bind(target.isoKey, target.yearBE, target.month).run();
    return Response.json({ ok: true });
  }

  await ctx.env.HR_DB.prepare(
    "DELETE FROM exec_kpi_overrides WHERE kpi_key = ? AND period_type = ? AND period_value = ?"
  ).bind(kpiKey, periodType, periodValue).run();

  return Response.json({ ok: true });
};
