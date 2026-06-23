import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

const PALETTE = ["#0038C6", "#16a34a", "#0891b2", "#7c3aed", "#d97706", "#db2777", "#0d9488", "#dc2626"];

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const b = await ctx.request.json() as Record<string, unknown>;
  const {
    full_name, start_date, department_id, division_id, position,
    emp_type, probation_days,
    license_number, license_expiry,
    car_plate_1, car_plate_2, moto_plate_1, moto_plate_2,
  } = b;

  if (!full_name || !String(full_name).trim())
    return Response.json({ ok: false, error: "กรุณากรอกชื่อพนักงาน" }, { status: 400 });
  if (!start_date)
    return Response.json({ ok: false, error: "กรุณาระบุวันที่เริ่มงาน" }, { status: 400 });

  const days = Number(probation_days) > 0 ? Number(probation_days) : 119;
  const probEndRow = await ctx.env.HR_DB.prepare("SELECT date(?, '+' || ? || ' days') AS d")
    .bind(start_date, days).first<{ d: string }>();
  const probEnd = probEndRow?.d ?? null;

  const name    = String(full_name).trim();
  const initial = name.charAt(0);
  const color   = PALETTE[Math.floor(Math.random() * PALETTE.length)];

  const result = await ctx.env.HR_DB.prepare(`
    INSERT INTO employees
      (full_name, position, department_id, division_id, start_date,
       emp_status, emp_type, probation_days, probation_end_date, color, initial,
       license_number, license_expiry, car_plate_1, car_plate_2, moto_plate_1, moto_plate_2)
    VALUES (?,?,?,?,?, 'probation', ?,?,?, ?,?,?,?,?,?,?,?)
  `).bind(
    name, position ?? null, department_id ?? null, division_id ?? null, start_date,
    emp_type ?? null, days, probEnd, color, initial,
    license_number || null, license_expiry || null,
    car_plate_1 || null, car_plate_2 || null,
    moto_plate_1 || null, moto_plate_2 || null,
  ).run();

  const newId = result.meta.last_row_id as number;

  await ctx.env.HR_DB.prepare(
    "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'manpower','new_hire','employee',?)"
  ).bind(user.id, user.full_name, newId).run();

  return Response.json({ ok: true, id: newId, probation_end_date: probEnd }, { status: 201 });
};
