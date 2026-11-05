import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET  /api/recruit/appointments  → per-row extra details (visit date, note, interview result), keyed by row_idx
// POST /api/recruit/appointments  → upsert one row's details (hr/deputyHR/admin)
//   body.action === "refer"        → head/deputy asks HR to contact the applicant (no status change)

interface ApptRow {
  row_idx: number; appointment_date: string; note: string; has_filled_application: number;
  interview_result: string; result_reason: string; result_note: string;
  referred_by: string; referred_at: string;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputy", "deputyHR", "head"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const rows = await ctx.env.HR_DB.prepare(
    `SELECT row_idx, appointment_date, note, has_filled_application,
            interview_result, result_reason, result_note, referred_by, referred_at
       FROM recruit_appointments`
  ).all<ApptRow>();

  return Response.json({ ok: true, appointments: rows.results ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await ctx.request.json().catch(() => null) as {
    action?: string; row_idx?: number; applicant_name?: string;
    appointment_date?: string; note?: string; has_filled_application?: boolean;
    interview_result?: string; result_reason?: string; result_note?: string;
  } | null;
  if (!body?.row_idx) return Response.json({ ok: false, error: "Missing row_idx" }, { status: 400 });
  const actor = user.full_name ?? user.username ?? "";

  // Head / deputy: refer applicant to HR for contact — status in the Sheet stays as is.
  if (body.action === "refer") {
    if (!["head", "deputy", "hr", "deputyHR", "admin"].includes(user.role))
      return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
    try {
      await ctx.env.HR_DB.prepare(`
        INSERT INTO recruit_appointments (row_idx, referred_by, referred_at, updated_by, updated_at)
        VALUES (?, ?, datetime('now','localtime'), ?, datetime('now'))
        ON CONFLICT(row_idx) DO UPDATE SET
          referred_by=excluded.referred_by, referred_at=excluded.referred_at,
          updated_by=excluded.updated_by, updated_at=datetime('now')
      `).bind(body.row_idx, actor, actor).run();
    } catch (err) {
      return Response.json({ ok: false, error: `D1 write failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
    }
    const who = body.applicant_name ? `${body.applicant_name} (แถว ${body.row_idx})` : `แถว ${body.row_idx}`;
    await ctx.env.HR_DB.prepare(
      `INSERT INTO notifications (target_role, icon, text, kind, link, created_at)
       VALUES ('hr', '📋', ?, 'recruit', '/recruit', datetime('now','localtime'))`
    ).bind(`${actor} ขอให้ HR ติดต่อผู้สมัคร ${who}`).run().catch(() => { /* non-fatal */ });
    return Response.json({ ok: true });
  }

  if (!["hr", "deputyHR", "admin"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const result = body.interview_result === "pass" || body.interview_result === "fail" ? body.interview_result : "";

  try {
    await ctx.env.HR_DB.prepare(`
      INSERT INTO recruit_appointments
        (row_idx, appointment_date, note, has_filled_application,
         interview_result, result_reason, result_note, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(row_idx) DO UPDATE SET
        appointment_date=excluded.appointment_date, note=excluded.note,
        has_filled_application=excluded.has_filled_application,
        interview_result=excluded.interview_result, result_reason=excluded.result_reason,
        result_note=excluded.result_note,
        updated_by=excluded.updated_by, updated_at=datetime('now')
    `).bind(
      body.row_idx, body.appointment_date ?? "", body.note ?? "", body.has_filled_application ? 1 : 0,
      result, result ? (body.result_reason ?? "") : "", result ? (body.result_note ?? "") : "",
      actor,
    ).run();
  } catch (err) {
    return Response.json({ ok: false, error: `D1 write failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  return Response.json({ ok: true });
};
