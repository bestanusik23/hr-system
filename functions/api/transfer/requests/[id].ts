import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../../lib/auth";

interface TransferRow {
  id: number; name: string; position: string | null; reason: string | null; new_position: string | null;
  from_dept_name: string | null; to_dept_name: string | null; from_department_id: number | null;
  to_division_id: number; to_department_id: number;
  head_status: string; hr_status: string; overall_status: string;
  requester_user_id: number | null; created_at: string;
}

// GET /api/transfer/requests/:id
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = ctx.params.id as string;
  const req = await ctx.env.HR_DB.prepare(`
    SELECT tr.*, fd.name AS from_division_name, td.name AS to_division_name,
           todept.name AS to_dept_name_full
    FROM transfer_requests tr
    LEFT JOIN departments fdept ON fdept.id = tr.from_department_id
    LEFT JOIN divisions fd ON fd.id = fdept.division_id
    LEFT JOIN divisions td ON td.id = tr.to_division_id
    LEFT JOIN departments todept ON todept.id = tr.to_department_id
    WHERE tr.id = ?
  `).bind(id).first();
  if (!req) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  const approvals = await ctx.env.HR_DB.prepare(`
    SELECT ta.step, ta.status, ta.note, ta.created_at, u.full_name AS approver_name
    FROM transfer_approvals ta LEFT JOIN users u ON u.id = ta.approver_user_id
    WHERE ta.request_id = ? ORDER BY ta.created_at
  `).bind(id).all();

  return Response.json({ ok: true, request: req, approvals: approvals.results });
};

// PUT /api/transfer/requests/:id  action: head_approve | head_reject | hr_approve | hr_reject
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = ctx.params.id as string;
  const body = await ctx.request.json() as { action: string; note?: string };
  const { action, note } = body;

  const req = await ctx.env.HR_DB.prepare("SELECT * FROM transfer_requests WHERE id = ?").bind(id).first<TransferRow>();
  if (!req) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  if (action === "head_approve" || action === "head_reject") {
    if (!["head", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
    if (req.overall_status !== "submitted") return Response.json({ ok: false, error: "ไม่อยู่ในสถานะที่อนุมัติได้" }, { status: 409 });
    const approved = action === "head_approve";
    await ctx.env.HR_DB.prepare(
      "UPDATE transfer_requests SET head_status=?, overall_status=?, updated_at=datetime('now') WHERE id=?"
    ).bind(approved ? "approved" : "rejected", approved ? "head_approved" : "rejected", id).run();
    await ctx.env.HR_DB.prepare(
      "INSERT INTO transfer_approvals (request_id, step, approver_user_id, status, note) VALUES (?,?,?,?,?)"
    ).bind(id, "head", user.id, approved ? "approved" : "rejected", note ?? null).run();
  } else if (action === "hr_approve" || action === "hr_reject") {
    if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
    if (req.overall_status !== "head_approved") return Response.json({ ok: false, error: "ยังไม่ผ่านการอนุมัติหัวหน้า" }, { status: 409 });
    const approved = action === "hr_approve";
    await ctx.env.HR_DB.prepare(
      "UPDATE transfer_requests SET hr_status=?, overall_status=?, updated_at=datetime('now') WHERE id=?"
    ).bind(approved ? "approved" : "rejected", approved ? "completed" : "rejected", id).run();
    await ctx.env.HR_DB.prepare(
      "INSERT INTO transfer_approvals (request_id, step, approver_user_id, status, note) VALUES (?,?,?,?,?)"
    ).bind(id, "hr", user.id, approved ? "approved" : "rejected", note ?? null).run();
    if (approved && req.to_department_id) {
      await ctx.env.HR_DB.prepare(
        "UPDATE employees SET department_id=?, division_id=?, emp_status='transferred', updated_at=datetime('now') WHERE full_name=? AND emp_status != 'resigned'"
      ).bind(req.to_department_id, req.to_division_id, req.name).run();
    }
  } else {
    return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }

  await ctx.env.HR_DB.prepare(
    "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'transfer',?,?, ?)"
  ).bind(user.id, user.full_name, action, "transfer_request", id).run();

  return Response.json({ ok: true });
};
