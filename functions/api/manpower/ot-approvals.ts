import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET   /api/manpower/ot-approvals?month=07/2569  → คำขออนุมัติ OT ของเดือนนั้น
// GET   /api/manpower/ot-approvals?status=pending → คำขอที่ยังรออนุมัติทุกเดือน
// PATCH /api/manpower/ot-approvals                → ยื่น/แก้คำขอ (hr/deputyHR/admin)
//                                                   หรือ อนุมัติ/ไม่อนุมัติ (deputy/deputyHR/admin)
//
// ยอดเงิน OT ยังอยู่ที่ workforce_ot_entries เหมือนเดิม (ไม่ย้าย ไม่แก้โครงสร้าง) —
// ตารางนี้เก็บเฉพาะ "ชั่วโมง + เหตุผล + สถานะการอนุมัติ" ที่ของเดิมไม่มี

interface ApprovalRow {
  month: string; dept_name: string; ot_hours: number; over_bar: number;
  reason: string; status: string; requested_by: string | null;
  decided_by: string | null; decided_at: string | null; decision_note: string; updated_at: string;
}

const canRequest = (role: string) => ["hr", "admin", "deputyHR"].includes(role);
const canDecide  = (role: string) => ["deputy", "deputyHR", "admin"].includes(role);

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url    = new URL(ctx.request.url);
  const month  = url.searchParams.get("month");
  const status = url.searchParams.get("status");

  const cols = `month, dept_name, ot_hours, over_bar, reason, status,
                requested_by, decided_by, decided_at, decision_note, updated_at`;

  const rows = month
    ? await ctx.env.HR_DB.prepare(
        `SELECT ${cols} FROM ot_approvals WHERE month = ? ORDER BY dept_name`
      ).bind(month).all<ApprovalRow>()
    : status
      ? await ctx.env.HR_DB.prepare(
          `SELECT ${cols} FROM ot_approvals WHERE status = ? ORDER BY month DESC, dept_name`
        ).bind(status).all<ApprovalRow>()
      : await ctx.env.HR_DB.prepare(
          `SELECT ${cols} FROM ot_approvals ORDER BY month DESC, dept_name`
        ).all<ApprovalRow>();

  return Response.json({ ok: true, approvals: rows.results ?? [] });
};

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await ctx.request.json().catch(() => ({})) as {
    month?: string; dept_name?: string; ot_hours?: number; over_bar?: number;
    reason?: string; status?: string; decision_note?: string;
  };

  const month    = (body.month ?? "").trim();
  const deptName = (body.dept_name ?? "").trim();
  if (!month || !deptName) return Response.json({ ok: false, error: "ระบุเดือนและแผนก" }, { status: 400 });

  const db = ctx.env.HR_DB;
  const actor = user.full_name ?? user.username ?? "";

  // ── โหมดตัดสินใจ: ส่ง status มาด้วย = อนุมัติ / ไม่อนุมัติ ───────────────────
  if (body.status) {
    if (!canDecide(user.role))
      return Response.json({ ok: false, error: "เฉพาะผู้บริหาร (deputy/deputyHR/admin) เท่านั้นที่อนุมัติ OT ได้" }, { status: 403 });
    if (!["pending", "approved", "rejected"].includes(body.status))
      return Response.json({ ok: false, error: "สถานะไม่ถูกต้อง" }, { status: 400 });

    const existing = await db.prepare("SELECT id FROM ot_approvals WHERE month = ? AND dept_name = ?")
      .bind(month, deptName).first<{ id: number }>();
    if (!existing) return Response.json({ ok: false, error: "ยังไม่มีคำขอ OT ของแผนกนี้ในเดือนที่เลือก" }, { status: 404 });

    await db.prepare(`
      UPDATE ot_approvals
         SET status = ?, decided_by = ?, decided_at = datetime('now'),
             decision_note = ?, updated_at = datetime('now')
       WHERE month = ? AND dept_name = ?
    `).bind(body.status, actor, typeof body.decision_note === "string" ? body.decision_note : "",
            month, deptName).run();

    try {
      await db.prepare(
        "INSERT INTO activity_log (user_id,actor_name,module,action,entity_type,entity_id) VALUES (?,?,'manpower','decide_ot_approval','ot_approval',?)"
      ).bind(user.id, user.full_name, existing.id).run();
    } catch { /* ignore */ }

    return Response.json({ ok: true });
  }

  // ── โหมดยื่น/แก้คำขอ ────────────────────────────────────────────────────────
  if (!canRequest(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const otHours = body.ot_hours ?? 0;
  const overBar = body.over_bar ?? 0;
  if (typeof otHours !== "number" || !Number.isFinite(otHours) || otHours < 0)
    return Response.json({ ok: false, error: "ชั่วโมง OT ต้องเป็นตัวเลขไม่ติดลบ" }, { status: 400 });

  const reason = (body.reason ?? "").trim();
  // Business Rule: ใช้ Bar เกินแผน ต้องระบุเหตุผล OT
  if (overBar > 0 && !reason)
    return Response.json({ ok: false, error: "แผนกที่ใช้ Bar เกินแผน ต้องระบุเหตุผล OT" }, { status: 400 });

  await db.prepare(`
    INSERT INTO ot_approvals (month, dept_name, ot_hours, over_bar, reason, status, requested_by)
    VALUES (?,?,?,?,?,'pending',?)
    ON CONFLICT(month, dept_name) DO UPDATE SET
      ot_hours = excluded.ot_hours, over_bar = excluded.over_bar, reason = excluded.reason,
      status = 'pending', requested_by = excluded.requested_by,
      decided_by = NULL, decided_at = NULL, decision_note = '',
      updated_at = datetime('now')
  `).bind(month, deptName, otHours, overBar, reason, actor).run();

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id,actor_name,module,action,entity_type,entity_id) VALUES (?,?,'manpower','request_ot_approval','ot_approval',0)"
    ).bind(user.id, user.full_name).run();
  } catch { /* ignore */ }

  return Response.json({ ok: true });
};
