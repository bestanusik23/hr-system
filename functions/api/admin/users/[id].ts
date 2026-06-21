import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser, hashPassword } from "../../../lib/auth";

// PUT /api/admin/users/:id — update role / active / password
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;
  if (String(user.id) === id) return Response.json({ ok: false, error: "ไม่สามารถแก้ไข account ตัวเองได้" }, { status: 400 });

  const body = await ctx.request.json() as Record<string, unknown>;
  const { role, is_active, scope_division_id, full_name, new_password } = body;

  await ctx.env.HR_DB.prepare(
    "UPDATE users SET role=?, is_active=?, scope_division_id=?, full_name=?, updated_at=datetime('now') WHERE id=?"
  ).bind(role, is_active ? 1 : 0, scope_division_id ?? null, full_name, id).run();

  if (new_password && String(new_password).length >= 6) {
    const hash = await hashPassword(new_password as string);
    await ctx.env.HR_DB.prepare("UPDATE users SET password_hash=? WHERE id=?").bind(hash, id).run();
  }

  await ctx.env.HR_DB.prepare(
    "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'admin','update_user','user',?)"
  ).bind(user.id, user.full_name, id).run();

  return Response.json({ ok: true });
};
