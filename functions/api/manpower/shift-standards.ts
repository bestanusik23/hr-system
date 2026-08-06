import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET    /api/manpower/shift-standards          → มาตรฐานกะทั้งหมด (position '*' = ค่ากลาง)
// PATCH  /api/manpower/shift-standards          → upsert 1 แถว (position + hours) (hr/admin/deputyHR)
// DELETE /api/manpower/shift-standards?position=..&hours=..  → ลบค่าเฉพาะตำแหน่ง (ลบค่ากลาง '*' ไม่ได้)

interface StdRow {
  id: number; position: string; hours: number; bar_value: number;
  note: string; updated_by: string | null; updated_at: string;
}

const canEdit = (role: string) => ["hr", "admin", "deputyHR"].includes(role);

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rows = await ctx.env.HR_DB.prepare(
    `SELECT id, position, hours, bar_value, note, updated_by, updated_at
       FROM shift_standards ORDER BY (position = '*') DESC, position, hours`
  ).all<StdRow>();

  return Response.json({ ok: true, standards: rows.results ?? [] });
};

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!canEdit(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => ({})) as
    { position?: string; hours?: number; bar_value?: number; note?: string };

  const position = (body.position ?? "").trim();
  const hours    = body.hours;
  const barValue = body.bar_value;

  if (!position) return Response.json({ ok: false, error: "ระบุตำแหน่ง" }, { status: 400 });
  if (typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0 || hours > 24)
    return Response.json({ ok: false, error: "ชั่วโมงต้องอยู่ระหว่าง 1–24" }, { status: 400 });
  if (typeof barValue !== "number" || !Number.isFinite(barValue) || barValue <= 0 || barValue > 5)
    return Response.json({ ok: false, error: "ค่า Bar ต้องอยู่ระหว่าง 0–5" }, { status: 400 });

  const db = ctx.env.HR_DB;
  await db.prepare(`
    INSERT INTO shift_standards (position, hours, bar_value, note, updated_by)
    VALUES (?,?,?,?,?)
    ON CONFLICT(position, hours) DO UPDATE SET
      bar_value = excluded.bar_value, note = excluded.note,
      updated_by = excluded.updated_by, updated_at = datetime('now')
  `).bind(position, hours, barValue, typeof body.note === "string" ? body.note : "",
          user.full_name ?? user.username ?? "").run();

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id,actor_name,module,action,entity_type,entity_id) VALUES (?,?,'manpower','edit_shift_standard','shift_standard',0)"
    ).bind(user.id, user.full_name).run();
  } catch { /* ignore */ }

  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!canEdit(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url      = new URL(ctx.request.url);
  const position = (url.searchParams.get("position") ?? "").trim();
  const hours    = Number(url.searchParams.get("hours"));

  if (!position || !Number.isFinite(hours))
    return Response.json({ ok: false, error: "ระบุตำแหน่งและชั่วโมง" }, { status: 400 });
  if (position === "*")
    return Response.json({ ok: false, error: "ลบค่ามาตรฐานกลางไม่ได้ — แก้ไขค่าได้อย่างเดียว" }, { status: 400 });

  await ctx.env.HR_DB.prepare("DELETE FROM shift_standards WHERE position = ? AND hours = ?")
    .bind(position, hours).run();

  return Response.json({ ok: true });
};
