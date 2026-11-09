import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// PUT /api/hq-report/labor-cost  { months: [{ pay_month, rows: [{ line, regular, ot_shift, headcount }] }] }
// Replaces the per-สายงาน totals of each pay month. Per-person pay never reaches the server:
// the payroll file is read in the browser and only these totals are sent. Admin only.
//
// PUT /api/hq-report/labor-cost?dept=1  { dept_name, line } → upsert one payroll department mapping.

const LINES = ["สายการพยาบาล", "สายบัญชีและการเงิน", "สายสนับสนุนบริการ", "สายสำนักงาน", "สนับสนุนทางการแพทย์"];
const EXCLUDED = "ไม่นับ";

interface Row { line?: string; regular?: number; ot_shift?: number; headcount?: number }
interface Body { months?: { pay_month?: string; rows?: Row[] }[]; dept_name?: string; line?: string }

const migrationError = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  return Response.json({ ok: false, error: msg.includes("no such table") ? "ยังไม่ได้รัน migration 0049_hq_labor_cost.sql ใน D1 Console" : msg }, { status: 500 });
};

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ ok: false, error: "เฉพาะผู้ดูแลระบบเท่านั้น" }, { status: 403 });

  const db = ctx.env.HR_DB;
  const body = await ctx.request.json().catch(() => ({})) as Body;

  if (new URL(ctx.request.url).searchParams.get("dept")) {
    const dept = (body.dept_name ?? "").trim();
    const line = (body.line ?? "").trim();
    if (!dept) return Response.json({ ok: false, error: "ระบุชื่อแผนก" }, { status: 400 });
    if (![...LINES, EXCLUDED].includes(line)) return Response.json({ ok: false, error: "สายงานไม่ถูกต้อง" }, { status: 400 });
    try {
      await db.prepare(`
        INSERT INTO hq_payroll_dept_map (dept_name, line, updated_by, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(dept_name) DO UPDATE SET
          line = excluded.line, updated_by = excluded.updated_by, updated_at = excluded.updated_at
      `).bind(dept, line, user.full_name).run();
      return Response.json({ ok: true });
    } catch (e) { return migrationError(e); }
  }

  const months = body.months ?? [];
  if (!months.length) return Response.json({ ok: false, error: "ไม่มีข้อมูลที่จะบันทึก" }, { status: 400 });

  const stmts: D1PreparedStatement[] = [];
  for (const m of months) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m.pay_month ?? "")) return Response.json({ ok: false, error: "งวดเงินเดือนไม่ถูกต้อง" }, { status: 400 });
    stmts.push(db.prepare("DELETE FROM hq_labor_cost WHERE pay_month = ?").bind(m.pay_month));
    for (const r of m.rows ?? []) {
      const valid = LINES.includes(r.line ?? "") && [r.regular, r.ot_shift, r.headcount].every(v => typeof v === "number" && Number.isFinite(v));
      if (!valid) return Response.json({ ok: false, error: "ข้อมูลเงินเดือนไม่ถูกต้อง" }, { status: 400 });
      stmts.push(db.prepare(`
        INSERT INTO hq_labor_cost (pay_month, line, regular, ot_shift, headcount, updated_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(m.pay_month, r.line, r.regular, r.ot_shift, r.headcount, user.full_name));
    }
  }
  try {
    await db.batch(stmts);
    return Response.json({ ok: true });
  } catch (e) { return migrationError(e); }
};
