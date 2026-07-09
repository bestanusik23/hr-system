import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

const ALLOWED_ROLES = ["hr", "admin"];

const STATUS_SQL = `
  CASE
    WHEN i.is_cancelled = 1 THEN 'cancelled'
    WHEN date('now') < i.start_date THEN 'upcoming'
    WHEN date('now') > i.end_date THEN 'completed'
    WHEN julianday(i.end_date) - julianday('now') <= 7 THEN 'ending_soon'
    ELSE 'active'
  END
`;

// GET /api/interns/:id — full profile: intern + rotations + documents + certificates
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;
  const db = ctx.env.HR_DB;

  const intern = await db.prepare(`
    SELECT i.*, inst.name AS institution_name, inst.type AS institution_type, inst.province AS institution_province,
           d.name AS department_name, dv.name AS division_name,
           ${STATUS_SQL} AS status,
           CAST(julianday(i.end_date) - julianday('now') AS INTEGER) AS days_remaining
    FROM interns i
    LEFT JOIN intern_institutions inst ON inst.id = i.institution_id
    LEFT JOIN departments d ON d.id = i.department_id
    LEFT JOIN divisions dv ON dv.id = i.division_id
    WHERE i.id = ?
  `).bind(id).first();
  if (!intern) return Response.json({ ok: false, error: "ไม่พบข้อมูลนักศึกษาฝึกงาน" }, { status: 404 });

  const [rotations, documents, certificates, activity] = await Promise.all([
    db.prepare(`
      SELECT r.*, d.name AS department_name, dv.name AS division_name
      FROM intern_rotations r
      LEFT JOIN departments d ON d.id = r.department_id
      LEFT JOIN divisions dv ON dv.id = r.division_id
      WHERE r.intern_id = ? ORDER BY r.start_date ASC
    `).bind(id).all(),
    db.prepare("SELECT * FROM intern_documents WHERE intern_id = ? ORDER BY uploaded_at DESC").bind(id).all(),
    db.prepare("SELECT * FROM intern_certificates WHERE intern_id = ? ORDER BY issued_at DESC").bind(id).all(),
    db.prepare(
      "SELECT actor_name, action, detail, created_at FROM activity_log WHERE module='intern' AND entity_id = ? ORDER BY created_at DESC LIMIT 50"
    ).bind(id).all(),
  ]);

  return Response.json({
    ok: true, intern,
    rotations: rotations.results ?? [],
    documents: documents.results ?? [],
    certificates: certificates.results ?? [],
    activity: activity.results ?? [],
  });
};

const SETTABLE_FIELDS = [
  "prefix", "first_name", "last_name", "education_level", "faculty", "major", "year_level", "phone", "photo_url",
  "institution_id", "advisor_name", "advisor_phone", "advisor_email", "referral_letter_url",
  "start_date", "end_date", "department_id", "division_id", "supervisor_name", "supervisor_position",
  "training_type", "work_hours", "note",
];

// PATCH /api/interns/:id — partial update (also handles cancel via is_cancelled + cancel_reason)
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;
  const b = await ctx.request.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const fields: Record<string, unknown> = {};
  for (const key of SETTABLE_FIELDS) if (key in b) fields[key] = b[key] ?? null;
  if ("is_cancelled" in b) {
    fields.is_cancelled = b.is_cancelled ? 1 : 0;
    fields.cancel_reason = (b.cancel_reason as string) ?? null;
  }
  if (Object.keys(fields).length === 0) return Response.json({ ok: false, error: "ไม่มีข้อมูลที่จะอัปเดต" }, { status: 400 });

  const setClause = Object.keys(fields).map(k => `${k}=?`).join(", ");
  await ctx.env.HR_DB.prepare(
    `UPDATE interns SET ${setClause}, updated_at=datetime('now') WHERE id=?`
  ).bind(...Object.values(fields), id).run();

  try {
    const action = "is_cancelled" in b ? (b.is_cancelled ? "cancel" : "restore") : "edit";
    await ctx.env.HR_DB.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'intern',?,'intern',?,?)"
    ).bind(user.id, user.full_name, action, id, (b.cancel_reason as string) ?? null).run();
  } catch { /* non-critical */ }

  return Response.json({ ok: true });
};

// DELETE /api/interns/:id — hard delete (admin only; HR should use cancel instead)
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;
  await ctx.env.HR_DB.prepare("DELETE FROM interns WHERE id=?").bind(id).run();
  return Response.json({ ok: true });
};
