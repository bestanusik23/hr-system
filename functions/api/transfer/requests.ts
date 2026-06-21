import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/transfer/requests
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(ctx.request.url);
  const status = url.searchParams.get("status") ?? "";

  let sql = `
    SELECT tr.id, tr.name, tr.position, tr.reason, tr.new_position,
           tr.from_dept_name, tr.to_dept_name,
           tr.head_status, tr.hr_status, tr.overall_status,
           tr.created_at, tr.updated_at,
           fd.name AS from_division_name, td.name AS to_division_name
    FROM transfer_requests tr
    LEFT JOIN departments fdept ON fdept.id = tr.from_department_id
    LEFT JOIN divisions fd ON fd.id = fdept.division_id
    LEFT JOIN divisions td ON td.id = tr.to_division_id
    WHERE 1=1`;
  const params: (string | number)[] = [];

  if (status) { sql += " AND tr.overall_status = ?"; params.push(status); }
  if (user.role === "head" && user.scope_division_id) {
    sql += " AND fdept.division_id = ?"; params.push(user.scope_division_id);
  }
  sql += " ORDER BY tr.updated_at DESC";

  const rows = await ctx.env.HR_DB.prepare(sql).bind(...params).all();
  return Response.json({ ok: true, requests: rows.results });
};

// POST /api/transfer/requests — submit a transfer request
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await ctx.request.json() as Record<string, unknown>;
  const { name, position, from_department_id, to_division_id, to_department_id, new_position, reason } = body;

  if (!name || !to_division_id || !to_department_id) {
    return Response.json({ ok: false, error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
  }

  // snapshot dept names
  const fromDept = from_department_id
    ? await ctx.env.HR_DB.prepare("SELECT name FROM departments WHERE id = ?").bind(from_department_id).first<{ name: string }>()
    : null;
  const toDept = await ctx.env.HR_DB.prepare("SELECT name FROM departments WHERE id = ?").bind(to_department_id).first<{ name: string }>();

  const result = await ctx.env.HR_DB.prepare(`
    INSERT INTO transfer_requests
      (name, position, from_department_id, from_dept_name, to_division_id, to_department_id, to_dept_name, new_position, reason, requester_user_id)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).bind(name, position ?? null, from_department_id ?? null, fromDept?.name ?? null,
    to_division_id, to_department_id, toDept?.name ?? null, new_position ?? null, reason ?? null, user.id).run();

  await ctx.env.HR_DB.prepare(
    "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'transfer','submit_transfer','transfer_request',?)"
  ).bind(user.id, user.full_name, result.meta.last_row_id).run();

  return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
};
