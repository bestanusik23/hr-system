import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/training/courses
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(ctx.request.url);
  const month = url.searchParams.get("month") ?? "";
  const status = url.searchParams.get("status") ?? "";

  let sql = `
    SELECT tc.id, tc.course, tc.trainer, tc.course_date, tc.month_label,
           tc.target, tc.status,
           COUNT(ta.id) AS actual
    FROM training_courses tc
    LEFT JOIN training_attendees ta ON ta.course_id = tc.id
    WHERE 1=1`;
  const params: (string | number)[] = [];
  if (month)  { sql += " AND tc.month_label = ?"; params.push(month); }
  if (status) { sql += " AND tc.status = ?"; params.push(status); }
  sql += " GROUP BY tc.id ORDER BY tc.course_date DESC";

  const rows = await ctx.env.HR_DB.prepare(sql).bind(...params).all();
  return Response.json({ ok: true, courses: rows.results });
};

// POST /api/training/courses  (hr/admin)
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json() as Record<string, unknown>;
  const { course, trainer, course_date, month_label, target, status } = body;
  if (!course) return Response.json({ ok: false, error: "กรุณากรอกชื่อหลักสูตร" }, { status: 400 });

  const result = await ctx.env.HR_DB.prepare(
    "INSERT INTO training_courses (course, trainer, course_date, month_label, target, status) VALUES (?,?,?,?,?,?)"
  ).bind(course, trainer ?? null, course_date ?? null, month_label ?? null, target ?? 0, status ?? "planned").run();

  return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
};
