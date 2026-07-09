import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

const ALLOWED_ROLES = ["hr", "admin"];

// GET /api/interns/certificates?intern_id=X
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const internId = new URL(ctx.request.url).searchParams.get("intern_id") ?? "";
  let sql = "SELECT * FROM intern_certificates WHERE 1=1";
  const params: string[] = [];
  if (internId) { sql += " AND intern_id = ?"; params.push(internId); }
  sql += " ORDER BY issued_at DESC";

  const rows = await ctx.env.HR_DB.prepare(sql).bind(...params).all();
  return Response.json({ ok: true, certificates: rows.results ?? [] });
};

// POST /api/interns/certificates — issue a completion certificate for one intern
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => null) as { intern_id?: number } | null;
  if (!body?.intern_id) return Response.json({ ok: false, error: "Missing intern_id" }, { status: 400 });

  const db = ctx.env.HR_DB;
  const intern = await db.prepare(`
    SELECT i.first_name, i.last_name, i.prefix, i.faculty, i.major, i.start_date, i.end_date,
           inst.name AS institution_name, d.name AS department_name
    FROM interns i
    LEFT JOIN intern_institutions inst ON inst.id = i.institution_id
    LEFT JOIN departments d ON d.id = i.department_id
    WHERE i.id = ?
  `).bind(body.intern_id).first<{
    first_name: string; last_name: string; prefix: string | null; faculty: string | null; major: string | null;
    start_date: string; end_date: string; institution_name: string | null; department_name: string | null;
  }>();
  if (!intern) return Response.json({ ok: false, error: "ไม่พบข้อมูลนักศึกษาฝึกงาน" }, { status: 404 });

  const fullName = `${intern.prefix ?? ""}${intern.first_name} ${intern.last_name}`.trim();

  const year = new Date().getFullYear();
  const countRow = await db.prepare(
    "SELECT COUNT(*) AS n FROM intern_certificates WHERE cert_id LIKE ?"
  ).bind(`INTCERT-${year}-%`).first<{ n: number }>();
  const certId  = `INTCERT-${year}-${String((countRow?.n ?? 0) + 1).padStart(4, "0")}`;
  const qrToken = crypto.randomUUID();

  await db.prepare(`
    INSERT INTO intern_certificates
      (cert_id, intern_id, full_name, institution_name, faculty, major, department_name, start_date, end_date, issued_by, qr_token)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    certId, body.intern_id, fullName, intern.institution_name, intern.faculty, intern.major,
    intern.department_name, intern.start_date, intern.end_date, user.full_name ?? user.username ?? "", qrToken,
  ).run();

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'intern','issue_certificate','intern',?,?)"
    ).bind(user.id, user.full_name, body.intern_id, certId).run();
  } catch { /* non-critical */ }

  return Response.json({ ok: true, cert_id: certId, qr_token: qrToken }, { status: 201 });
};
