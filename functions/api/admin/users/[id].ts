import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser, hashPassword } from "../../../lib/auth";

// PUT /api/admin/users/:id — update role / active / password / scope
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  try {
    const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
    if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const id = ctx.params.id as string;
    if (String(user.id) === id) return Response.json({ ok: false, error: "ไม่สามารถแก้ไข account ตัวเองได้" }, { status: 400 });

    const body = await ctx.request.json() as Record<string, unknown>;
    const { role, role_title, is_active, scope_division_id, scope_department_id, full_name, new_password } = body;

    // head → scope by department; deputy/deputyHR → scope by division
    const divId  = (role === "head") ? null : (scope_division_id ?? null);
    const deptId = (role === "head") ? (scope_department_id ?? null) : null;

    await ctx.env.HR_DB.prepare(
      "UPDATE users SET role=?, role_title=?, is_active=?, scope_division_id=?, scope_department_id=?, full_name=?, updated_at=datetime('now') WHERE id=?"
    ).bind(role, role_title ?? null, is_active ? 1 : 0, divId, deptId, full_name, id).run();

    if (new_password && String(new_password).length >= 6) {
      const { hash, salt } = await hashPassword(new_password as string);
      await ctx.env.HR_DB.prepare(
        "UPDATE users SET password_hash=?, password_salt=?, updated_at=datetime('now') WHERE id=?"
      ).bind(hash, salt, id).run();
    }

    try {
      await ctx.env.HR_DB.prepare(
        "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'admin','update_user','user',?)"
      ).bind(user.id, user.full_name, id).run();
    } catch { /* ignore */ }

    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
};

// DELETE /api/admin/users/:id — delete user
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  try {
    const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
    if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const id = ctx.params.id as string;
    if (String(user.id) === id)
      return Response.json({ ok: false, error: "ไม่สามารถลบ account ตัวเองได้" }, { status: 400 });

    // Guard: must keep at least one admin
    const target = await ctx.env.HR_DB.prepare("SELECT role FROM users WHERE id=?").bind(id).first<{ role: string }>();
    if (!target) return Response.json({ ok: false, error: "ไม่พบผู้ใช้" }, { status: 404 });
    if (target.role === "admin") {
      const adminCount = await ctx.env.HR_DB.prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin' AND is_active=1").first<{ c: number }>();
      if ((adminCount?.c ?? 0) <= 1)
        return Response.json({ ok: false, error: "ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน" }, { status: 400 });
    }

    // Remove FK-dependent rows first so D1 foreign key constraint doesn't block
    try { await ctx.env.HR_DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id).run(); } catch { /* table may not exist */ }
    try { await ctx.env.HR_DB.prepare("DELETE FROM activity_log WHERE user_id=?").bind(id).run(); } catch { /* ignore */ }

    await ctx.env.HR_DB.prepare("DELETE FROM users WHERE id=?").bind(id).run();

    // Log the deletion (use admin's own user_id, not the deleted one)
    try {
      await ctx.env.HR_DB.prepare(
        "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'admin','delete_user','user',?)"
      ).bind(user.id, user.full_name, id).run();
    } catch { /* ignore */ }

    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
};
