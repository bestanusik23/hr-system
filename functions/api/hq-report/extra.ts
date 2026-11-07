import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// PUT /api/hq-report/extra — save the per-person values the system does not hold
// (age at resignation, sourcing channel of a new hire, resignation reason picked from
// the HQ list). Body: { employee_id, age?, sourcing_channel?, reason? }. Admin only.

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ ok: false, error: "เฉพาะผู้ดูแลระบบเท่านั้น" }, { status: 403 });

  const body = await ctx.request.json().catch(() => ({})) as {
    employee_id?: number; age?: number | null; sourcing_channel?: string | null; reason?: string | null;
  };
  const id = Number(body.employee_id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ ok: false, error: "ระบุ employee_id" }, { status: 400 });

  const age = body.age === null || body.age === undefined || String(body.age) === "" ? null : Math.round(Number(body.age));
  if (age !== null && (!Number.isFinite(age) || age < 15 || age > 90)) {
    return Response.json({ ok: false, error: "อายุต้องอยู่ระหว่าง 15–90 ปี" }, { status: 400 });
  }
  const channel = (body.sourcing_channel ?? "").trim() || null;
  const reason = (body.reason ?? "").trim() || null;

  await ctx.env.HR_DB.prepare(`
    INSERT INTO hq_report_extra (employee_id, age, sourcing_channel, reason, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(employee_id) DO UPDATE SET
      age = excluded.age, sourcing_channel = excluded.sourcing_channel, reason = excluded.reason,
      updated_by = excluded.updated_by, updated_at = excluded.updated_at
  `).bind(id, age, channel, reason, user.full_name).run();

  return Response.json({ ok: true });
};
