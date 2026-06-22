import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/eval/timeline — activity log for eval module, scoped by role
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let sql = `
    SELECT al.id, al.actor_name, al.action, al.entity_id, al.detail, al.created_at,
           ev.round, ev.status AS eval_status, ev.grade, ev.total_score,
           e.full_name, e.department_id, e.division_id,
           d.name AS department_name, dv.name AS division_name
    FROM activity_log al
    LEFT JOIN evaluations ev ON ev.id = al.entity_id AND al.entity_type = 'evaluation'
    LEFT JOIN employees e ON e.id = ev.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN divisions dv ON dv.id = e.division_id
    WHERE al.module = 'eval'
  `;
  const params: (string | number)[] = [];

  if (user.role === "head" && user.scope_department_id) {
    sql += " AND e.department_id = ?"; params.push(user.scope_department_id);
  } else if (["deputy", "deputyHR"].includes(user.role) && user.scope_division_id) {
    sql += " AND e.division_id = ?"; params.push(user.scope_division_id);
  }

  sql += " ORDER BY al.created_at DESC LIMIT 80";

  const rows = await ctx.env.HR_DB.prepare(sql).bind(...params).all();
  return Response.json({ ok: true, events: rows.results });
};
