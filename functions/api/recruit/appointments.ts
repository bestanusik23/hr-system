import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET  /api/recruit/appointments  → all appointment dates/notes, keyed by row_idx (any recruit-visible role)
// POST /api/recruit/appointments  → upsert one row's appointment date/note (hr/deputyHR/admin)

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputy", "deputyHR", "head"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const rows = await ctx.env.HR_DB.prepare(
    "SELECT row_idx, appointment_date, note FROM recruit_appointments"
  ).all<{ row_idx: number; appointment_date: string; note: string }>();

  return Response.json({ ok: true, appointments: rows.results ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "deputyHR", "admin"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => null) as { row_idx?: number; appointment_date?: string; note?: string } | null;
  if (!body?.row_idx) return Response.json({ ok: false, error: "Missing row_idx" }, { status: 400 });

  try {
    await ctx.env.HR_DB.prepare(`
      INSERT INTO recruit_appointments (row_idx, appointment_date, note, updated_by, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(row_idx) DO UPDATE SET
        appointment_date=excluded.appointment_date, note=excluded.note,
        updated_by=excluded.updated_by, updated_at=datetime('now')
    `).bind(body.row_idx, body.appointment_date ?? "", body.note ?? "", user.full_name ?? user.username ?? "").run();
  } catch (err) {
    return Response.json({ ok: false, error: `D1 write failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  return Response.json({ ok: true });
};
