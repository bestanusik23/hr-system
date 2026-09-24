import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";
import { canAccessOtBudget } from "../../lib/otBudgetAccess";

// GET    /api/ot-budget/factors?year=2569        → ปัจจัยทุกเดือนของปีงบนั้น
// POST   /api/ot-budget/factors                  → เพิ่มปัจจัย 1 ข้อ (hr/admin/deputyHR)
// DELETE /api/ot-budget/factors?id=1              → ลบปัจจัย (hr/admin/deputyHR)

interface FactorRow {
  id: number; year_month: string; factor_text: string; sort_order: number; created_by: string | null;
}

const canManage = (role: string) => ["hr", "admin", "deputyHR"].includes(role);

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!canAccessOtBudget(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url = new URL(ctx.request.url);
  const year = (url.searchParams.get("year") ?? "").trim();
  if (!/^\d{4}$/.test(year)) return Response.json({ ok: false, error: "ระบุปีงบ (พ.ศ. 4 หลัก)" }, { status: 400 });

  const rows = await ctx.env.HR_DB.prepare(
    "SELECT id, year_month, factor_text, sort_order, created_by FROM ot_factors WHERE year_month LIKE ? ORDER BY year_month, sort_order"
  ).bind(`${year}-%`).all<FactorRow>();

  return Response.json({ ok: true, factors: rows.results ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!canManage(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => ({})) as { year_month?: string; factor_text?: string; sort_order?: number };
  const yearMonth = (body.year_month ?? "").trim();
  const text = (body.factor_text ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return Response.json({ ok: false, error: "ระบุเดือนรูปแบบ YYYY-MM (พ.ศ.)" }, { status: 400 });
  if (!text) return Response.json({ ok: false, error: "ระบุข้อความปัจจัย" }, { status: 400 });

  const sortOrder = Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0;
  const result = await ctx.env.HR_DB.prepare(
    "INSERT INTO ot_factors (year_month, factor_text, sort_order, created_by) VALUES (?,?,?,?)"
  ).bind(yearMonth, text, sortOrder, user.full_name ?? user.username ?? "").run();

  return Response.json({ ok: true, id: result.meta.last_row_id });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!canManage(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url = new URL(ctx.request.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id)) return Response.json({ ok: false, error: "ระบุ id" }, { status: 400 });

  await ctx.env.HR_DB.prepare("DELETE FROM ot_factors WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
};
