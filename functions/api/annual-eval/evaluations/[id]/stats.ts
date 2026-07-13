import type { Env } from "../../../../lib/types";
import { getTokenFromCookie, getSessionUser, hasRole } from "../../../../lib/auth";
import { scoreForMetricValue, type ScoreBandMetric } from "../../../../lib/annualEval";

interface StatsRow {
  id: number; annual_evaluation_id: number; period_start: string | null; period_end: string | null;
  sick_leave_days: number; personal_leave_days: number; vacation_leave_days: number; late_minutes: number;
  training_count: number; hospital_activity_count: number; committee_count: number; warning_count: number;
  source: string; updated_by: string | null; updated_at: string;
}
interface BandRow { metric: string; level_group: string | null; min_value: number | null; max_value: number | null; score: number; }

const METRIC_FIELD: Record<ScoreBandMetric, keyof StatsRow> = {
  sick_leave: "sick_leave_days", personal_leave: "personal_leave_days", vacation_leave: "vacation_leave_days",
  late_minutes: "late_minutes", training_count: "training_count",
  hospital_activity: "hospital_activity_count", committee: "committee_count",
};

async function suggestScores(db: D1Database, stats: StatsRow, levelGroup: string) {
  const bands = await db.prepare("SELECT metric, level_group, min_value, max_value, score FROM annual_eval_score_bands").all<BandRow>();
  const byMetric = new Map<string, BandRow[]>();
  for (const b of bands.results ?? []) {
    if (!byMetric.has(b.metric)) byMetric.set(b.metric, []);
    byMetric.get(b.metric)!.push(b);
  }
  const suggestions: Record<string, number | null> = {};
  for (const metric of Object.keys(METRIC_FIELD) as ScoreBandMetric[]) {
    const value = Number(stats[METRIC_FIELD[metric]] ?? 0);
    suggestions[metric] = scoreForMetricValue(byMetric.get(metric) ?? [], value, levelGroup);
  }
  return suggestions;
}

// GET /api/annual-eval/evaluations/:id/stats — current stats + suggested scores from the
// admin-configured bands (suggestions only — HR still enters the actual item scores by hand
// in the "กฎระเบียบ" category; this just gives them a starting point per the original form).
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = Number(ctx.params.id);
  const db = ctx.env.HR_DB;
  const ev = await db.prepare("SELECT id, snap_job_level FROM annual_evaluations WHERE id = ?").bind(id).first<{ id: number; snap_job_level: number }>();
  if (!ev) return Response.json({ ok: false, error: "ไม่พบใบประเมินนี้" }, { status: 404 });

  let stats = await db.prepare("SELECT * FROM annual_eval_stats WHERE annual_evaluation_id = ?").bind(id).first<StatsRow>();
  if (!stats) {
    stats = {
      id: 0, annual_evaluation_id: id, period_start: null, period_end: null,
      sick_leave_days: 0, personal_leave_days: 0, vacation_leave_days: 0, late_minutes: 0,
      training_count: 0, hospital_activity_count: 0, committee_count: 0, warning_count: 0,
      source: "manual", updated_by: null, updated_at: "",
    };
  }

  const levelGroup = ev.snap_job_level === 1 ? "1" : ev.snap_job_level === 4 ? "4" : "2-3";
  const suggested_scores = await suggestScores(db, stats, levelGroup);

  return Response.json({ ok: true, stats, suggested_scores });
};

// PUT /api/annual-eval/evaluations/:id/stats — HR enters/updates the leave/lateness/training stats.
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!hasRole(user, "hr", "deputyHR", "admin")) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = Number(ctx.params.id);
  const db = ctx.env.HR_DB;
  const ev = await db.prepare("SELECT id FROM annual_evaluations WHERE id = ?").bind(id).first();
  if (!ev) return Response.json({ ok: false, error: "ไม่พบใบประเมินนี้" }, { status: 404 });

  const body = await ctx.request.json().catch(() => null) as Partial<StatsRow> | null;
  if (!body) return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  await db.prepare(`
    INSERT INTO annual_eval_stats (
      annual_evaluation_id, period_start, period_end, sick_leave_days, personal_leave_days,
      vacation_leave_days, late_minutes, training_count, hospital_activity_count, committee_count,
      warning_count, source, updated_by, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, datetime('now'))
    ON CONFLICT(annual_evaluation_id) DO UPDATE SET
      period_start = excluded.period_start, period_end = excluded.period_end,
      sick_leave_days = excluded.sick_leave_days, personal_leave_days = excluded.personal_leave_days,
      vacation_leave_days = excluded.vacation_leave_days, late_minutes = excluded.late_minutes,
      training_count = excluded.training_count, hospital_activity_count = excluded.hospital_activity_count,
      committee_count = excluded.committee_count, warning_count = excluded.warning_count,
      updated_by = excluded.updated_by, updated_at = excluded.updated_at
  `).bind(
    id, body.period_start ?? null, body.period_end ?? null,
    num(body.sick_leave_days), num(body.personal_leave_days), num(body.vacation_leave_days), num(body.late_minutes),
    num(body.training_count), num(body.hospital_activity_count), num(body.committee_count), num(body.warning_count),
    user.full_name,
  ).run();

  return Response.json({ ok: true });
};
