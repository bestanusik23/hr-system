import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET   /api/manpower/ot-entries?month=07/2569   → all dept OT amounts saved for that month
// GET   /api/manpower/ot-entries?months=all      → totals per month (Bar Analytics trend)
// PATCH /api/manpower/ot-entries                 → upsert one department's amount (hr/admin/deputyHR)

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url   = new URL(ctx.request.url);
  const month = url.searchParams.get("month");

  // Trend mode — one row per month, used by Bar Analytics. Kept on this endpoint
  // (instead of a new one) so the same table stays the single source of OT money.
  if (!month && url.searchParams.get("months") === "all") {
    const totals = await ctx.env.HR_DB.prepare(
      `SELECT month, SUM(amount_thb) AS total_thb, COUNT(*) AS dept_count
         FROM workforce_ot_entries GROUP BY month`
    ).all<{ month: string; total_thb: number; dept_count: number }>();
    return Response.json({ ok: true, months: totals.results ?? [] });
  }

  if (!month) return Response.json({ ok: false, error: "ระบุเดือน" }, { status: 400 });

  const rows = await ctx.env.HR_DB.prepare(
    "SELECT dept_name, amount_thb, note, updated_by, updated_at FROM workforce_ot_entries WHERE month = ? ORDER BY dept_name"
  ).bind(month).all<{ dept_name: string; amount_thb: number; note: string; updated_by: string | null; updated_at: string }>();

  return Response.json({ ok: true, month, entries: rows.results ?? [] });
};

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => ({})) as
    { month?: string; dept_name?: string; amount_thb?: number; note?: string };

  const month     = (body.month ?? "").trim();
  const deptName  = (body.dept_name ?? "").trim();
  const amountThb = body.amount_thb;

  if (!month || !deptName) return Response.json({ ok: false, error: "ระบุเดือนและแผนก" }, { status: 400 });
  if (typeof amountThb !== "number" || !Number.isFinite(amountThb) || amountThb < 0) {
    return Response.json({ ok: false, error: "ยอด OT ต้องเป็นตัวเลขบวก" }, { status: 400 });
  }

  const db   = ctx.env.HR_DB;
  const note = typeof body.note === "string" ? body.note : "";

  await db.prepare(`
    INSERT INTO workforce_ot_entries (month, dept_name, amount_thb, note, updated_by)
    VALUES (?,?,?,?,?)
    ON CONFLICT(month, dept_name) DO UPDATE SET
      amount_thb = excluded.amount_thb, note = excluded.note,
      updated_by = excluded.updated_by, updated_at = datetime('now')
  `).bind(month, deptName, Math.round(amountThb), note, user.full_name ?? user.username ?? "").run();

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id,actor_name,module,action,entity_type,entity_id) VALUES (?,?,'manpower','edit_ot_entry','ot_entry',0)"
    ).bind(user.id, user.full_name).run();
  } catch { /* ignore */ }

  return Response.json({ ok: true });
};
