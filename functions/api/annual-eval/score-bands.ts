import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser, hasRole } from "../../lib/auth";

const VALID_METRICS = [
  "sick_leave", "personal_leave", "vacation_leave", "late_minutes",
  "training_count", "hospital_activity", "committee",
];

// GET /api/annual-eval/score-bands — all threshold bands, grouped by metric (admin config
// screen). Not hardcoded in the frontend — this is the whole point of the table.
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rows = await ctx.env.HR_DB.prepare(
    "SELECT * FROM annual_eval_score_bands ORDER BY metric, level_group, sort_order"
  ).all();
  return Response.json({ ok: true, bands: rows.results ?? [] });
};

// PUT /api/annual-eval/score-bands — replace the full band list for one (metric, level_group)
// pair. Bulk-replace rather than per-row edit: these bands are always edited as a complete
// ladder (e.g. all 6 sick-leave tiers together), so partial edits would risk leaving gaps.
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!hasRole(user, "hr", "deputyHR", "admin")) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => null) as {
    metric?: string; level_group?: string | null;
    bands?: { min_value: number | null; max_value: number | null; score: number; sort_order: number }[];
  } | null;
  if (!body?.metric || !VALID_METRICS.includes(body.metric)) {
    return Response.json({ ok: false, error: "metric ไม่ถูกต้อง" }, { status: 400 });
  }
  if (!Array.isArray(body.bands) || body.bands.length === 0) {
    return Response.json({ ok: false, error: "กรุณาระบุเกณฑ์อย่างน้อย 1 ช่วง" }, { status: 400 });
  }
  for (const b of body.bands) {
    if (typeof b.score !== "number" || b.score < 0 || b.score > 5) {
      return Response.json({ ok: false, error: "คะแนนต้องอยู่ระหว่าง 0-5" }, { status: 400 });
    }
  }

  const db = ctx.env.HR_DB;
  const levelGroup = body.level_group ?? null;
  const statements = [
    levelGroup
      ? db.prepare("DELETE FROM annual_eval_score_bands WHERE metric = ? AND level_group = ?").bind(body.metric, levelGroup)
      : db.prepare("DELETE FROM annual_eval_score_bands WHERE metric = ? AND level_group IS NULL").bind(body.metric),
    ...body.bands.map(b => db.prepare(
      "INSERT INTO annual_eval_score_bands (metric, level_group, min_value, max_value, score, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(body.metric, levelGroup, b.min_value, b.max_value, b.score, b.sort_order)),
  ];
  await db.batch(statements);

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'annual_eval','update_score_bands','annual_eval_score_bands',0,?)"
    ).bind(user.id, user.full_name, `${body.metric} (${levelGroup ?? "ทุกระดับ"})`).run();
  } catch { /* non-critical */ }

  return Response.json({ ok: true });
};
