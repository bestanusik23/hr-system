import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/manpower/license-alerts
// Returns employees whose license_expiry is within 30 days (or already expired)
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rows = await ctx.env.HR_DB.prepare(`
    SELECT e.id, e.full_name, e.position, e.license_number, e.license_expiry,
           dv.name AS division_name,
           CAST(julianday(e.license_expiry) - julianday('now') AS INTEGER) AS days_left
    FROM employees e
    LEFT JOIN divisions dv ON dv.id = e.division_id
    WHERE e.license_expiry IS NOT NULL AND e.license_expiry != ''
      AND e.emp_status != 'resigned'
      AND julianday(e.license_expiry) - julianday('now') <= 30
    ORDER BY e.license_expiry ASC
  `).all();

  return Response.json({ ok: true, alerts: rows.results });
};
