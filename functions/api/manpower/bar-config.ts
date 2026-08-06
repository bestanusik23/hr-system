import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET    /api/manpower/bar-config            → Approved Bar + ประเภทงาน ของทุกแผนก
// PATCH  /api/manpower/bar-config            → upsert ทีละแผนก (hr/admin/deputyHR)
// สิทธิ์แก้ไขเดียวกับ plan.ts / ot-entries.ts

const TYPES = ["Service", "Support", "Back Office"];

interface BarConfigRow {
  dept_name: string;
  approved_bar: number;
  dept_type: string;
  active: number;
  note: string;
  updated_by: string | null;
  updated_at: string;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rows = await ctx.env.HR_DB.prepare(
    `SELECT dept_name, approved_bar, dept_type, active, note, updated_by, updated_at
       FROM dept_bar_config ORDER BY dept_name`
  ).all<BarConfigRow>();

  return Response.json({ ok: true, config: rows.results ?? [] });
};

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => ({})) as {
    dept_name?: string; approved_bar?: number; dept_type?: string; active?: number; note?: string;
  };

  const deptName = (body.dept_name ?? "").trim();
  if (!deptName) return Response.json({ ok: false, error: "ระบุแผนก" }, { status: 400 });

  const approvedBar = body.approved_bar;
  if (typeof approvedBar !== "number" || !Number.isFinite(approvedBar) || approvedBar < 0)
    return Response.json({ ok: false, error: "Approved Bar ต้องเป็นตัวเลขไม่ติดลบ" }, { status: 400 });

  const deptType = (body.dept_type ?? "Service").trim();
  if (!TYPES.includes(deptType))
    return Response.json({ ok: false, error: "ประเภทงานต้องเป็น Service / Support / Back Office" }, { status: 400 });

  const active = body.active === 0 ? 0 : 1;
  const note   = typeof body.note === "string" ? body.note : "";
  const db     = ctx.env.HR_DB;

  await db.prepare(`
    INSERT INTO dept_bar_config (dept_name, approved_bar, dept_type, active, note, updated_by)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(dept_name) DO UPDATE SET
      approved_bar = excluded.approved_bar, dept_type = excluded.dept_type,
      active = excluded.active, note = excluded.note,
      updated_by = excluded.updated_by, updated_at = datetime('now')
  `).bind(deptName, approvedBar, deptType, active, note, user.full_name ?? user.username ?? "").run();

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id,actor_name,module,action,entity_type,entity_id) VALUES (?,?,'manpower','edit_bar_config','bar_config',0)"
    ).bind(user.id, user.full_name).run();
  } catch { /* ignore */ }

  return Response.json({ ok: true });
};
