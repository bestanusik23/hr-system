import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET   /api/ot-budget/signoff?year=2569   → สถานะลงนามของปีงบนั้น (สร้างแถวเปล่าให้ถ้ายังไม่มี)
// PATCH /api/ot-budget/signoff             → กดจัดทำ/ตรวจสอบ/อนุมัติ (หรือย้อนกลับเป็น pending)
//   body: { fiscal_year: "2569", step: "preparer"|"reviewer"|"approver", status: "done"|"pending" }
//   ผู้จัดทำ (preparer): hr/admin/deputyHR · ผู้ตรวจสอบ (reviewer): head · ผู้อนุมัติ (approver): deputy
//   admin/deputyHR ได้สิทธิ์เท่ากันทุกขั้น (ตามที่ตกลง)

interface SignoffRow {
  fiscal_year: string;
  preparer_name: string | null; preparer_status: string; preparer_at: string | null;
  reviewer_name: string | null; reviewer_status: string; reviewer_at: string | null;
  approver_name: string | null; approver_status: string; approver_at: string | null;
}

const STEP_ROLE: Record<string, string[]> = {
  preparer: ["hr", "admin", "deputyHR"],
  reviewer: ["head", "admin", "deputyHR"],
  approver: ["deputy", "admin", "deputyHR"],
};

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(ctx.request.url);
  const fiscalYear = (url.searchParams.get("year") ?? "").trim();
  if (!/^\d{4}$/.test(fiscalYear)) return Response.json({ ok: false, error: "ระบุปีงบ (พ.ศ. 4 หลัก)" }, { status: 400 });

  await ctx.env.HR_DB.prepare("INSERT OR IGNORE INTO ot_signoff (fiscal_year) VALUES (?)").bind(fiscalYear).run();
  const row = await ctx.env.HR_DB.prepare(
    "SELECT fiscal_year, preparer_name, preparer_status, preparer_at, reviewer_name, reviewer_status, reviewer_at, approver_name, approver_status, approver_at FROM ot_signoff WHERE fiscal_year = ?"
  ).bind(fiscalYear).first<SignoffRow>();

  return Response.json({ ok: true, signoff: row });
};

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await ctx.request.json().catch(() => ({})) as { fiscal_year?: string; step?: string; status?: string };
  const fiscalYear = (body.fiscal_year ?? "").trim();
  const step = body.step ?? "";
  const status = body.status ?? "";
  if (!/^\d{4}$/.test(fiscalYear)) return Response.json({ ok: false, error: "ระบุปีงบ (พ.ศ. 4 หลัก)" }, { status: 400 });
  if (!["preparer", "reviewer", "approver"].includes(step))
    return Response.json({ ok: false, error: "step ไม่ถูกต้อง" }, { status: 400 });
  if (!["done", "pending"].includes(status))
    return Response.json({ ok: false, error: "status ไม่ถูกต้อง" }, { status: 400 });

  const allowedRoles = STEP_ROLE[step];
  if (!allowedRoles.includes(user.role))
    return Response.json({ ok: false, error: "ไม่มีสิทธิ์ดำเนินการขั้นนี้" }, { status: 403 });

  const db = ctx.env.HR_DB;
  await db.prepare("INSERT OR IGNORE INTO ot_signoff (fiscal_year) VALUES (?)").bind(fiscalYear).run();

  const nameCol = `${step}_name`;
  const statusCol = `${step}_status`;
  const atCol = `${step}_at`;
  const actorName = status === "done" ? (user.full_name ?? user.username ?? "") : null;
  const at = status === "done" ? "datetime('now')" : "NULL";

  await db.prepare(`
    UPDATE ot_signoff SET ${nameCol} = ?, ${statusCol} = ?, ${atCol} = ${at}
    WHERE fiscal_year = ?
  `).bind(actorName, status, fiscalYear).run();

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id,actor_name,module,action,entity_type,entity_id,detail) VALUES (?,?,'ot-budget','signoff','ot_signoff',0,?)"
    ).bind(user.id, user.full_name, `${fiscalYear}:${step}:${status}`).run();
  } catch { /* ignore */ }

  return Response.json({ ok: true });
};
