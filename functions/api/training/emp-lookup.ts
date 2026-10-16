import type { Env } from "../../lib/types";
import { normalizeName } from "../../lib/trainingSessions";

interface EmpRow { emp_code: string | null; full_name: string; position: string | null; department_name: string | null; division_name?: string | null }

// GET /api/training/emp-lookup?token=xxx&q=yyy
// Public endpoint gated by valid QR token — returns matching employees for checkin autocomplete.
// หน้าเช็คชื่อบังคับเลือกชื่อจากรายการนี้เท่านั้น จึงรวมผู้ที่ลงทะเบียนหลักสูตรนี้ไว้แล้วแต่ไม่อยู่ในระบบพนักงานด้วย
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url   = new URL(ctx.request.url);
  const token = url.searchParams.get("token") ?? "";
  const q     = url.searchParams.get("q")?.trim() ?? "";

  if (!token) return Response.json({ ok: false, error: "Missing token" }, { status: 400 });
  if (q.length < 2) return Response.json({ ok: true, employees: [] });

  // Validate QR token
  const course = await ctx.env.HR_DB.prepare(
    "SELECT id FROM training_courses WHERE qr_token = ? AND COALESCE(is_cancelled,0) = 0"
  ).bind(token).first<{ id: number }>();
  if (!course) return Response.json({ ok: false, error: "Invalid token" }, { status: 403 });

  const rows = (await ctx.env.HR_DB.prepare(`
    SELECT e.emp_code, e.full_name, e.position,
           d.name AS department_name, dv.name AS division_name
    FROM employees e
    LEFT JOIN departments d  ON d.id  = e.department_id
    LEFT JOIN divisions  dv ON dv.id = e.division_id
    WHERE (e.full_name LIKE ? OR e.emp_code LIKE ?)
      AND e.emp_status NOT IN ('resigned','terminated')
    ORDER BY e.full_name
    LIMIT 10
  `).bind(`%${q}%`, `%${q}%`).all<EmpRow>()).results ?? [];

  const registered = (await ctx.env.HR_DB.prepare(`
    SELECT emp_code, name AS full_name, position, department AS department_name
    FROM training_attendees
    WHERE course_id = ? AND (name LIKE ? OR emp_code LIKE ?)
    ORDER BY name
    LIMIT 10
  `).bind(course.id, `%${q}%`, `%${q}%`).all<EmpRow>()).results ?? [];

  const codes = new Set(rows.map(r => r.emp_code).filter(Boolean));
  const names = new Set(rows.map(r => normalizeName(r.full_name)));
  for (const r of registered) {
    if ((r.emp_code && codes.has(r.emp_code)) || names.has(normalizeName(r.full_name))) continue;
    rows.push(r);
    names.add(normalizeName(r.full_name));
  }

  return Response.json({ ok: true, employees: rows.slice(0, 12) });
};
