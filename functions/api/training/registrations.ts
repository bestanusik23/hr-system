import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/training/registrations?course_id=X
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url       = new URL(ctx.request.url);
  const course_id = url.searchParams.get("course_id") ?? "";
  if (!course_id) return Response.json({ ok: false, error: "Missing course_id" }, { status: 400 });

  const rows = await ctx.env.HR_DB.prepare(
    `SELECT ta.*,
       COALESCE(ta.emp_code,
         (SELECT e.emp_code FROM employees e
          WHERE TRIM(e.full_name) = TRIM(ta.name)
            AND e.emp_status NOT IN ('resigned','terminated')
          LIMIT 1)
       ) AS emp_code,
       COALESCE(
         ta.department,
         -- 1st priority: match by emp_code (accurate, handles name prefix variations)
         (SELECT COALESCE(d.name, dv.name)
          FROM employees e
          LEFT JOIN departments d  ON d.id  = e.department_id
          LEFT JOIN divisions  dv ON dv.id = e.division_id
          WHERE e.emp_code = ta.emp_code
            AND ta.emp_code IS NOT NULL
            AND e.emp_status NOT IN ('resigned','terminated')
          LIMIT 1),
         -- 2nd priority: match by name (for QR walk-ins without emp_code)
         (SELECT COALESCE(d.name, dv.name)
          FROM employees e
          LEFT JOIN departments d  ON d.id  = e.department_id
          LEFT JOIN divisions  dv ON dv.id = e.division_id
          WHERE TRIM(e.full_name) = TRIM(ta.name)
            AND e.emp_status NOT IN ('resigned','terminated')
          LIMIT 1)
       ) AS department
     FROM training_attendees ta
     WHERE ta.course_id = ?
     ORDER BY
       CASE ta.attendance_status WHEN 'checked_in' THEN 0 WHEN 'completed' THEN 1
         WHEN 'late' THEN 2 WHEN 'registered' THEN 3 WHEN 'absent' THEN 4 ELSE 5 END,
       ta.id`
  ).bind(course_id).all();

  return Response.json({ ok: true, registrations: rows.results });
};

// POST /api/training/registrations  — register attendee (hr/admin/head/deputy can register)
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "head", "deputy", "deputyHR"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json() as Record<string, unknown>;
  const { course_id, emp_code, name, department, position, phone } = body;

  if (!course_id || !name) return Response.json({ ok: false, error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });

  // Check reg_open
  const course = await ctx.env.HR_DB.prepare("SELECT reg_open FROM training_courses WHERE id = ?")
    .bind(course_id).first<{ reg_open: number }>();
  if (!course) return Response.json({ ok: false, error: "ไม่พบหลักสูตร" }, { status: 404 });
  if (!course.reg_open) return Response.json({ ok: false, error: "หลักสูตรนี้ปิดรับสมัครแล้ว" }, { status: 400 });

  const result = await ctx.env.HR_DB.prepare(`
    INSERT INTO training_attendees
      (course_id, emp_code, name, department, position, phone, reg_method, attendance_status)
    VALUES (?, ?, ?, ?, ?, ?, 'manual', 'registered')
  `).bind(course_id, emp_code ?? null, name, department ?? null, position ?? null, phone ?? null).run();

  return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
};
