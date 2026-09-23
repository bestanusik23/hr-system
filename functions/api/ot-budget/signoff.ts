import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET   /api/ot-budget/signoff?year=2569   → สถานะลงนามของปีงบนั้น + ตัวเลือกผู้อนุมัติ 2 คน
//                                             (สร้างแถวเปล่าให้ถ้ายังไม่มี พร้อม seed ชื่อ/ตำแหน่งจาก ot_signer_defaults)
// PATCH /api/ot-budget/signoff             → สองโหมด:
//   1) แก้ชื่อ/ตำแหน่งผู้ลงนาม (hr/admin/deputyHR เท่านั้น ไม่ผูกกับ login จริง — ตามที่ HR ยืนยันว่า
//      ผู้จัดทำ/ตรวจสอบ/อนุมัติจริงไม่ได้เป็นคนกดปุ่มในระบบเอง):
//      body: { fiscal_year, step, name, title }
//   2) กดจัดทำ/ตรวจสอบ/อนุมัติ (หรือย้อนกลับเป็น pending) — ยังคงเช็คสิทธิ์ตาม role ต่อขั้นเหมือนเดิม:
//      body: { fiscal_year, step, status: "done"|"pending" }
//   ผู้จัดทำ (preparer): hr/admin/deputyHR · ผู้ตรวจสอบ (reviewer): head · ผู้อนุมัติ (approver): deputy
//   admin/deputyHR ได้สิทธิ์เท่ากันทุกขั้น (ตามที่ตกลง)

interface SignoffRow {
  fiscal_year: string;
  preparer_name: string | null; preparer_title: string | null; preparer_status: string; preparer_at: string | null;
  reviewer_name: string | null; reviewer_title: string | null; reviewer_status: string; reviewer_at: string | null;
  approver_name: string | null; approver_title: string | null; approver_status: string; approver_at: string | null;
}

interface SignerDefaults {
  preparer_name: string; preparer_title: string;
  reviewer_name: string; reviewer_title: string;
  approver1_name: string; approver1_title: string;
  approver2_name: string; approver2_title: string;
}

const STEP_ROLE: Record<string, string[]> = {
  preparer: ["hr", "admin", "deputyHR"],
  reviewer: ["head", "admin", "deputyHR"],
  approver: ["deputy", "admin", "deputyHR"],
};
const canManage = (role: string) => ["hr", "admin", "deputyHR"].includes(role);

async function getDefaults(db: D1Database): Promise<SignerDefaults> {
  await db.prepare("INSERT OR IGNORE INTO ot_signer_defaults (id) VALUES (1)").run();
  const row = await db.prepare(
    `SELECT preparer_name, preparer_title, reviewer_name, reviewer_title,
            approver1_name, approver1_title, approver2_name, approver2_title
     FROM ot_signer_defaults WHERE id = 1`
  ).first<SignerDefaults>();
  return row!;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(ctx.request.url);
  const fiscalYear = (url.searchParams.get("year") ?? "").trim();
  if (!/^\d{4}$/.test(fiscalYear)) return Response.json({ ok: false, error: "ระบุปีงบ (พ.ศ. 4 หลัก)" }, { status: 400 });

  const db = ctx.env.HR_DB;
  const defaults = await getDefaults(db);

  await db.prepare(`
    INSERT INTO ot_signoff (fiscal_year, preparer_name, preparer_title, reviewer_name, reviewer_title)
    VALUES (?,?,?,?,?)
    ON CONFLICT(fiscal_year) DO NOTHING
  `).bind(fiscalYear, defaults.preparer_name, defaults.preparer_title, defaults.reviewer_name, defaults.reviewer_title).run();

  const row = await db.prepare(
    `SELECT fiscal_year, preparer_name, preparer_title, preparer_status, preparer_at,
            reviewer_name, reviewer_title, reviewer_status, reviewer_at,
            approver_name, approver_title, approver_status, approver_at
     FROM ot_signoff WHERE fiscal_year = ?`
  ).bind(fiscalYear).first<SignoffRow>();

  return Response.json({
    ok: true, signoff: row,
    approverOptions: [
      { name: defaults.approver1_name, title: defaults.approver1_title },
      { name: defaults.approver2_name, title: defaults.approver2_title },
    ].filter(o => o.name),
  });
};

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await ctx.request.json().catch(() => ({})) as {
    fiscal_year?: string; step?: string; status?: string; name?: string; title?: string;
  };
  const fiscalYear = (body.fiscal_year ?? "").trim();
  const step = body.step ?? "";
  if (!/^\d{4}$/.test(fiscalYear)) return Response.json({ ok: false, error: "ระบุปีงบ (พ.ศ. 4 หลัก)" }, { status: 400 });
  if (!["preparer", "reviewer", "approver"].includes(step))
    return Response.json({ ok: false, error: "step ไม่ถูกต้อง" }, { status: 400 });

  const db = ctx.env.HR_DB;
  await db.prepare("INSERT OR IGNORE INTO ot_signoff (fiscal_year) VALUES (?)").bind(fiscalYear).run();

  // ── โหมดแก้ชื่อ/ตำแหน่งผู้ลงนาม (ไม่ผูกกับสถานะ done/pending) ──
  if (typeof body.name === "string") {
    if (!canManage(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
    const name = body.name.trim();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!name) return Response.json({ ok: false, error: "ระบุชื่อผู้ลงนาม" }, { status: 400 });

    const nameCol = `${step}_name`;
    const titleCol = `${step}_title`;
    await db.prepare(`UPDATE ot_signoff SET ${nameCol} = ?, ${titleCol} = ? WHERE fiscal_year = ?`)
      .bind(name, title, fiscalYear).run();
    return Response.json({ ok: true });
  }

  // ── โหมดกดจัดทำ/ตรวจสอบ/อนุมัติ (หรือย้อนกลับ) ──
  const status = body.status ?? "";
  if (!["done", "pending"].includes(status))
    return Response.json({ ok: false, error: "status ไม่ถูกต้อง" }, { status: 400 });

  const allowedRoles = STEP_ROLE[step];
  if (!allowedRoles.includes(user.role))
    return Response.json({ ok: false, error: "ไม่มีสิทธิ์ดำเนินการขั้นนี้" }, { status: 403 });

  const statusCol = `${step}_status`;
  const atCol = `${step}_at`;
  const at = status === "done" ? "datetime('now')" : "NULL";

  await db.prepare(`UPDATE ot_signoff SET ${statusCol} = ?, ${atCol} = ${at} WHERE fiscal_year = ?`)
    .bind(status, fiscalYear).run();

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id,actor_name,module,action,entity_type,entity_id,detail) VALUES (?,?,'ot-budget','signoff','ot_signoff',0,?)"
    ).bind(user.id, user.full_name, `${fiscalYear}:${step}:${status}`).run();
  } catch { /* ignore */ }

  return Response.json({ ok: true });
};
