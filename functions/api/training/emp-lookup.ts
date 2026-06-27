import type { Env } from "../../lib/types";

// GET /api/training/emp-lookup?token=xxx&q=yyy
// Public endpoint gated by valid QR token — returns matching employees for checkin autocomplete
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

  const rows = await ctx.env.HR_DB.prepare(`
    SELECT e.emp_code, e.full_name, e.position,
           d.name AS department_name, dv.name AS division_name
    FROM employees e
    LEFT JOIN departments d  ON d.id  = e.department_id
    LEFT JOIN divisions  dv ON dv.id = e.division_id
    WHERE (e.full_name LIKE ? OR e.emp_code LIKE ?)
      AND e.emp_status NOT IN ('resigned','terminated')
    ORDER BY e.full_name
    LIMIT 10
  `).bind(`%${q}%`, `%${q}%`).all();

  return Response.json({ ok: true, employees: rows.results });
};
