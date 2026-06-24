import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/eval/org — divisions + departments for dropdowns
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const [divs, depts, pos] = await Promise.all([
    ctx.env.HR_DB.prepare("SELECT id, name FROM divisions ORDER BY sort_order").all(),
    ctx.env.HR_DB.prepare("SELECT id, division_id, name FROM departments ORDER BY name").all(),
    ctx.env.HR_DB.prepare(
      "SELECT DISTINCT position, division_id, department_id FROM employees WHERE position IS NOT NULL AND position != '' ORDER BY position"
    ).all(),
  ]);
  return Response.json({ ok: true, divisions: divs.results, departments: depts.results, positions: pos.results });
};
