import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET    /api/ot-budget/categories       → รายการหมวด OT ทั้งหมด (ทุก role ที่เห็นเมนูนี้)
// POST   /api/ot-budget/categories       → เพิ่มหมวดใหม่ (hr/admin/deputyHR)
// PATCH  /api/ot-budget/categories       → แก้ชื่อ/กลุ่ม/ลำดับ/is_active (hr/admin/deputyHR)
// DELETE /api/ot-budget/categories?id=1  → ปิดใช้งานหมวด (soft delete — ไม่ลบข้อมูลย้อนหลัง)

interface CategoryRow {
  id: number; group_name: string; name: string; sort_order: number; is_active: number;
}

const canManage = (role: string) => ["hr", "admin", "deputyHR"].includes(role);

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rows = await ctx.env.HR_DB.prepare(
    "SELECT id, group_name, name, sort_order, is_active FROM ot_categories WHERE is_active = 1 ORDER BY sort_order"
  ).all<CategoryRow>();
  return Response.json({ ok: true, categories: rows.results ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!canManage(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => ({})) as { group_name?: string; name?: string; sort_order?: number };
  const groupName = (body.group_name ?? "").trim();
  const name = (body.name ?? "").trim();
  if (!groupName || !name) return Response.json({ ok: false, error: "ระบุกลุ่มและชื่อหมวด" }, { status: 400 });

  const sortOrder = Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0;
  const result = await ctx.env.HR_DB.prepare(
    "INSERT INTO ot_categories (group_name, name, sort_order) VALUES (?,?,?)"
  ).bind(groupName, name, sortOrder).run();

  try {
    await ctx.env.HR_DB.prepare(
      "INSERT INTO activity_log (user_id,actor_name,module,action,entity_type,entity_id) VALUES (?,?,'ot-budget','create_category','ot_category',?)"
    ).bind(user.id, user.full_name, result.meta.last_row_id).run();
  } catch { /* ignore */ }

  return Response.json({ ok: true, id: result.meta.last_row_id });
};

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!canManage(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => ({})) as {
    id?: number; group_name?: string; name?: string; sort_order?: number; is_active?: number;
  };
  const id = Number(body.id);
  if (!Number.isFinite(id)) return Response.json({ ok: false, error: "ระบุ id" }, { status: 400 });

  const existing = await ctx.env.HR_DB.prepare("SELECT id FROM ot_categories WHERE id = ?").bind(id).first();
  if (!existing) return Response.json({ ok: false, error: "ไม่พบหมวดนี้" }, { status: 404 });

  const groupName = typeof body.group_name === "string" ? body.group_name.trim() : undefined;
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const sortOrder = Number.isFinite(body.sort_order) ? Number(body.sort_order) : undefined;
  const isActive = body.is_active === 0 || body.is_active === 1 ? body.is_active : undefined;

  await ctx.env.HR_DB.prepare(`
    UPDATE ot_categories SET
      group_name = COALESCE(?, group_name),
      name       = COALESCE(?, name),
      sort_order = COALESCE(?, sort_order),
      is_active  = COALESCE(?, is_active)
    WHERE id = ?
  `).bind(groupName ?? null, name ?? null, sortOrder ?? null, isActive ?? null, id).run();

  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!canManage(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url = new URL(ctx.request.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id)) return Response.json({ ok: false, error: "ระบุ id" }, { status: 400 });

  // Soft delete — keeps ot_monthly history intact for months already entered.
  await ctx.env.HR_DB.prepare("UPDATE ot_categories SET is_active = 0 WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
};
