import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

interface EmpRow {
  emp_code: string | null;
  full_name: string;
  name_en: string | null;
  position: string | null;
  division_name: string | null;
  department_name: string | null;
  license_number: string | null;
}

// GET /api/manpower/export-cards
// Returns CSV ready for Canva Bulk Create
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url    = new URL(ctx.request.url);
  const status = url.searchParams.get("status") ?? "active";

  let sql = `
    SELECT e.emp_code, e.full_name, e.name_en, e.position,
           dv.name AS division_name, d.name AS department_name,
           e.license_number
    FROM employees e
    LEFT JOIN departments d  ON d.id  = e.department_id
    LEFT JOIN divisions  dv ON dv.id = e.division_id
    WHERE e.emp_status != 'resigned'
  `;
  if (status === "active") sql += " AND e.emp_status IN ('passed','transferred','probation')";

  sql += " ORDER BY dv.name, e.full_name";

  const rows = await ctx.env.HR_DB.prepare(sql).all<EmpRow>();

  const esc = (v: string | null) => {
    if (!v) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const header = "employee_code,name_th,name_en,position,division,department,license_number";
  const lines  = (rows.results ?? []).map(r =>
    [r.emp_code, r.full_name, r.name_en, r.position,
     r.division_name, r.department_name, r.license_number]
      .map(esc).join(",")
  );

  // UTF-8 BOM so Excel/Canva reads Thai correctly
  const csv = "﻿" + [header, ...lines].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="employees_canva.csv"',
      "Cache-Control": "no-cache",
    },
  });
};
