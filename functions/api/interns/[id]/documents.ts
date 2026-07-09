import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../../lib/auth";

const ALLOWED_ROLES = ["hr", "admin"];

// POST /api/interns/:id/documents — add one document (base64 data URL, matches training_photos pattern)
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const internId = ctx.params.id as string;
  const body = await ctx.request.json().catch(() => null) as { doc_type?: string; file_name?: string; url?: string } | null;
  if (!body?.url) return Response.json({ ok: false, error: "Missing url" }, { status: 400 });

  const result = await ctx.env.HR_DB.prepare(
    "INSERT INTO intern_documents (intern_id, doc_type, file_name, url) VALUES (?,?,?,?)"
  ).bind(internId, body.doc_type ?? null, body.file_name ?? null, body.url).run();

  try {
    await ctx.env.HR_DB.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'intern','upload_document','intern',?,?)"
    ).bind(user.id, user.full_name, internId, body.file_name ?? body.doc_type ?? null).run();
  } catch { /* non-critical */ }

  return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
};

// DELETE /api/interns/:id/documents?doc_id=X
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url = new URL(ctx.request.url);
  const docId = url.searchParams.get("doc_id");
  if (!docId) return Response.json({ ok: false, error: "Missing doc_id" }, { status: 400 });

  await ctx.env.HR_DB.prepare("DELETE FROM intern_documents WHERE id = ? AND intern_id = ?")
    .bind(docId, ctx.params.id as string).run();
  return Response.json({ ok: true });
};
