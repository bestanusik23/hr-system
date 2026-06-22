import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/training/courses
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url    = new URL(ctx.request.url);
  const month  = url.searchParams.get("month")  ?? "";
  const status = url.searchParams.get("status") ?? "";
  const type   = url.searchParams.get("type")   ?? "";
  const year   = url.searchParams.get("year")   ?? "";

  const showCancelled = url.searchParams.get("cancelled") === "1";

  let sql = `
    SELECT tc.id, tc.course_code, tc.course, tc.course_type, tc.organizing_dept,
           tc.project_owner, tc.trainer, tc.course_date, tc.start_time, tc.end_time,
           tc.location, tc.month_label, tc.target, tc.budget, tc.objectives,
           tc.attachment_url, tc.status, tc.reg_open, tc.qr_token,
           COALESCE(tc.is_cancelled, 0) AS is_cancelled, tc.cancel_reason,
           COUNT(ta.id) AS actual
    FROM training_courses tc
    LEFT JOIN training_attendees ta ON ta.course_id = tc.id
    WHERE 1=1`;
  const params: (string | number)[] = [];

  if (!showCancelled) { sql += " AND COALESCE(tc.is_cancelled, 0) = 0"; }
  else                { sql += " AND COALESCE(tc.is_cancelled, 0) = 1"; }
  if (month)  { sql += " AND tc.month_label = ?"; params.push(month); }
  if (status) { sql += " AND tc.status = ?";      params.push(status); }
  if (type)   { sql += " AND tc.course_type = ?"; params.push(type); }
  if (year)   { sql += " AND tc.course_date LIKE ?"; params.push(`${year}%`); }

  sql += " GROUP BY tc.id ORDER BY tc.course_date DESC, tc.id DESC";

  const rows = await ctx.env.HR_DB.prepare(sql).bind(...params).all();
  return Response.json({ ok: true, courses: rows.results });
};

// POST /api/training/courses  (hr/admin)
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json() as Record<string, unknown>;
  const { course, course_type, organizing_dept, project_owner, trainer,
          course_date, start_time, end_time, location, month_label,
          target, budget, objectives, attachment_url, status } = body;

  if (!course) return Response.json({ ok: false, error: "กรุณากรอกชื่อหลักสูตร" }, { status: 400 });

  // Auto-generate course_code: TR-YYYY-RRRR
  const year  = course_date ? String(course_date).slice(0, 4) : new Date().getFullYear().toString();
  const count = await ctx.env.HR_DB.prepare(
    "SELECT COUNT(*) AS n FROM training_courses WHERE course_date LIKE ?"
  ).bind(`${year}%`).first<{ n: number }>();
  const seq        = String((count?.n ?? 0) + 1).padStart(4, "0");
  const course_code = `TR-${year}-${seq}`;

  // Auto-generate QR token
  const qr_token = crypto.randomUUID();

  const result = await ctx.env.HR_DB.prepare(`
    INSERT INTO training_courses
      (course_code, course, course_type, organizing_dept, project_owner, trainer,
       course_date, start_time, end_time, location, month_label,
       target, budget, objectives, attachment_url, status, qr_token)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    course_code,
    course,
    course_type  ?? "Internal",
    organizing_dept  ?? null,
    project_owner    ?? null,
    trainer          ?? null,
    course_date      ?? null,
    start_time       ?? null,
    end_time         ?? null,
    location         ?? null,
    month_label      ?? null,
    Number(target)   || 0,
    Number(budget)   || 0,
    objectives       ?? null,
    attachment_url   ?? null,
    status           ?? "planned",
    qr_token,
  ).run();

  return Response.json({ ok: true, id: result.meta.last_row_id, course_code, qr_token }, { status: 201 });
};
