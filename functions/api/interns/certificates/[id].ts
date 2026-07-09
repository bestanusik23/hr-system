import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../../lib/auth";

const ALLOWED_ROLES = ["hr", "admin"];

// PATCH /api/interns/certificates/:id — toggle issued/revoked status
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;
  const body = await ctx.request.json().catch(() => null) as { status?: string } | null;
  const status = body?.status;
  if (status !== "issued" && status !== "revoked") {
    return Response.json({ ok: false, error: "สถานะไม่ถูกต้อง" }, { status: 400 });
  }

  const db = ctx.env.HR_DB;
  const cert = await db.prepare("SELECT intern_id, cert_id FROM intern_certificates WHERE id = ?")
    .bind(id).first<{ intern_id: number; cert_id: string }>();
  if (!cert) return Response.json({ ok: false, error: "ไม่พบใบรับรองนี้" }, { status: 404 });

  await db.prepare("UPDATE intern_certificates SET status = ? WHERE id = ?").bind(status, id).run();

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'intern',?,'intern',?,?)"
    ).bind(user.id, user.full_name, status === "revoked" ? "revoke_certificate" : "restore_certificate", cert.intern_id, cert.cert_id).run();
  } catch { /* non-critical */ }

  return Response.json({ ok: true });
};

// DELETE /api/interns/certificates/:id — hard delete (e.g. cleaning up an accidental duplicate)
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;
  const db = ctx.env.HR_DB;
  const cert = await db.prepare("SELECT intern_id, cert_id FROM intern_certificates WHERE id = ?")
    .bind(id).first<{ intern_id: number; cert_id: string }>();
  if (!cert) return Response.json({ ok: false, error: "ไม่พบใบรับรองนี้" }, { status: 404 });

  await db.prepare("DELETE FROM intern_certificates WHERE id = ?").bind(id).run();

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'intern','delete_certificate','intern',?,?)"
    ).bind(user.id, user.full_name, cert.intern_id, cert.cert_id).run();
  } catch { /* non-critical */ }

  return Response.json({ ok: true });
};
