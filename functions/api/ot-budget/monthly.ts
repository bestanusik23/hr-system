import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";
import { canAccessOtBudget } from "../../lib/otBudgetAccess";

// GET   /api/ot-budget/monthly?year=2569         → ทุกหมวด x 12 เดือนของปีงบนั้น (เติม 0 ถ้ายังไม่กรอก)
// PATCH /api/ot-budget/monthly                    → บันทึก budget/actual ทั้งชุดของ 1 เดือน (hr/admin/deputyHR)
//   body: { year_month: "2569-07", paid_date?: string, entries: [{ category_id, budget_amount, actual_amount }] }

interface MonthlyRow {
  year_month: string; category_id: number; budget_amount: number; actual_amount: number;
  paid_date: string | null; updated_by: string | null; updated_at: string;
}

const canEdit = (role: string) => ["hr", "admin", "deputyHR"].includes(role);

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!canAccessOtBudget(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url = new URL(ctx.request.url);
  const year = (url.searchParams.get("year") ?? "").trim();
  if (!/^\d{4}$/.test(year)) return Response.json({ ok: false, error: "ระบุปีงบ (พ.ศ. 4 หลัก)" }, { status: 400 });

  const rows = await ctx.env.HR_DB.prepare(
    `SELECT year_month, category_id, budget_amount, actual_amount, paid_date, updated_by, updated_at
     FROM ot_monthly WHERE year_month LIKE ? ORDER BY year_month, category_id`
  ).bind(`${year}-%`).all<MonthlyRow>();

  return Response.json({ ok: true, year, entries: rows.results ?? [] });
};

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!canEdit(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => ({})) as {
    year_month?: string; paid_date?: string | null;
    entries?: { category_id?: number; budget_amount?: number; actual_amount?: number }[];
  };

  const yearMonth = (body.year_month ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return Response.json({ ok: false, error: "ระบุเดือนรูปแบบ YYYY-MM (พ.ศ.)" }, { status: 400 });
  if (!Array.isArray(body.entries) || body.entries.length === 0)
    return Response.json({ ok: false, error: "ไม่มีรายการที่จะบันทึก" }, { status: 400 });

  for (const e of body.entries) {
    if (!Number.isFinite(e.category_id))
      return Response.json({ ok: false, error: "รายการมีหมวดไม่ถูกต้อง" }, { status: 400 });
    for (const v of [e.budget_amount, e.actual_amount]) {
      if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v) || v < 0))
        return Response.json({ ok: false, error: "ยอดเงินต้องเป็นตัวเลขไม่ติดลบ" }, { status: 400 });
    }
  }

  const db = ctx.env.HR_DB;
  const actor = user.full_name ?? user.username ?? "";
  const paidDate = typeof body.paid_date === "string" && body.paid_date.trim() ? body.paid_date.trim() : null;

  // If this month's fiscal-year signoff has moved past "pending", log any actual_amount change
  // (spec: "ถ้าแก้ Actual หลังอนุมัติแล้ว ต้องเก็บ log ว่าใครแก้ เมื่อไร").
  const fiscalYear = yearMonth.slice(0, 4);
  const signoff = await db.prepare(
    "SELECT preparer_status, reviewer_status, approver_status FROM ot_signoff WHERE fiscal_year = ?"
  ).bind(fiscalYear).first<{ preparer_status: string; reviewer_status: string; approver_status: string }>();
  const isLocked = !!signoff && [signoff.preparer_status, signoff.reviewer_status, signoff.approver_status].some(s => s !== "pending");

  const statements = [];
  for (const e of body.entries) {
    const categoryId = Number(e.category_id);
    const budget = e.budget_amount ?? 0;
    const actual = e.actual_amount ?? 0;

    if (isLocked) {
      const existing = await db.prepare(
        "SELECT actual_amount FROM ot_monthly WHERE year_month = ? AND category_id = ?"
      ).bind(yearMonth, categoryId).first<{ actual_amount: number }>();
      if (existing && existing.actual_amount !== actual) {
        statements.push(db.prepare(
          "INSERT INTO ot_monthly_audit (year_month, category_id, old_actual, new_actual, changed_by) VALUES (?,?,?,?,?)"
        ).bind(yearMonth, categoryId, existing.actual_amount, actual, actor));
      }
    }

    statements.push(db.prepare(`
      INSERT INTO ot_monthly (year_month, category_id, budget_amount, actual_amount, paid_date, updated_by)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(year_month, category_id) DO UPDATE SET
        budget_amount = excluded.budget_amount,
        actual_amount = excluded.actual_amount,
        paid_date     = excluded.paid_date,
        updated_by    = excluded.updated_by,
        updated_at    = datetime('now')
    `).bind(yearMonth, categoryId, budget, actual, paidDate, actor));
  }

  await db.batch(statements);

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id,actor_name,module,action,entity_type,entity_id,detail) VALUES (?,?,'ot-budget','save_monthly','ot_monthly',0,?)"
    ).bind(user.id, user.full_name, yearMonth).run();
  } catch { /* ignore */ }

  return Response.json({ ok: true });
};
