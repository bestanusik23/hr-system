import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../../lib/auth";

// GET /api/eval/employees/:id
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = ctx.params.id as string;
  const emp = await ctx.env.HR_DB.prepare(`
    SELECT e.*, d.name AS department_name, dv.name AS division_name
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN divisions dv ON dv.id = e.division_id
    WHERE e.id = ?
  `).bind(id).first();
  if (!emp) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  return Response.json({ ok: true, employee: emp });
};

// PUT /api/eval/employees/:id
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;
  const body = await ctx.request.json() as Record<string, unknown>;
  const { full_name, position, department_id, division_id, start_date, emp_status, color, initial } = body;

  await ctx.env.HR_DB.prepare(`
    UPDATE employees SET full_name=?, position=?, department_id=?, division_id=?, start_date=?,
      emp_status=?, color=?, initial=?, updated_at=datetime('now')
    WHERE id=?
  `).bind(full_name, position ?? null, department_id ?? null, division_id ?? null,
    start_date ?? null, emp_status ?? "probation", color ?? null, initial ?? null, id).run();

  return Response.json({ ok: true });
};
