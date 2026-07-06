import type { Env } from "../lib/types";
import { getTokenFromCookie, getSessionUser } from "../lib/auth";

const ALLOWED_ROLES = ["hr", "deputyHR", "admin"];

// GET /api/order-out — list saved duty orders (history), newest first
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url = new URL(ctx.request.url);
  const q   = (url.searchParams.get("q") ?? "").trim();

  let sql = `SELECT id, order_no, activity, place_name, address, event_date, order_date, created_by, created_at
             FROM duty_orders`;
  const params: string[] = [];
  if (q) {
    sql += " WHERE order_no LIKE ? OR activity LIKE ? OR place_name LIKE ?";
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += " ORDER BY COALESCE(event_date, created_at) DESC, id DESC";

  const rows = await ctx.env.HR_DB.prepare(sql).bind(...params).all();
  return Response.json({ ok: true, orders: rows.results ?? [] });
};

// POST /api/order-out — save a new duty order (called when generating/printing)
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => null) as {
    orderNo?: string; activity?: string; placeName?: string; address?: string;
    eventDate?: string; orderDate?: string; staff?: { name: string; position: string }[];
  } | null;
  if (!body) return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const staffJson = JSON.stringify(body.staff ?? []);
  const result = await ctx.env.HR_DB.prepare(`
    INSERT INTO duty_orders (order_no, activity, place_name, address, event_date, order_date, staff_json, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.orderNo ?? "", body.activity ?? "", body.placeName ?? "", body.address ?? "",
    body.eventDate || null, body.orderDate || null, staffJson,
    user.full_name ?? user.username ?? "",
  ).run();

  return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
};
