import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// ONE-TIME migration: fix division_id for nursing staff based on position keywords.
// Safe patterns only — ambiguous positions like "ผู้ช่วยพยาบาล" are skipped.
// GET  → dry-run preview (list affected employees)
// POST → execute the updates

const DIV8_LIKE = [
  "%ผู้ป่วยใน%", "%ห้องผ่าตัด%", "%ห้องคลอด%", "%ผู้ป่วยหนัก%",
  "%จ่ายกลาง%", "%เครื่องมือแพทย์%", "%IPD%", "%ผู้ป่วยเด็ก%",
  "%พยาบาลเวรตรวจการ%", "%ฝ่ายการบริการส่วนใน%", "%ผู้อำนวยการฝ่ายบริการ%",
];

const DIV9_LIKE = [
  "%ผู้ป่วยนอก%", "%อุบัติเหตุ%", "%ศูนย์สุขภาพ%", "%ตรวจสุขภาพ%",
  "%OPD%", "%Sleep%", "%คลินิค%", "%ขับรถฉุกเฉิน%", "%ฝ่ายการบริการส่วนหน้า%",
];

function likeWhere(patterns: string[], alias = "e"): string {
  return patterns.map(p => `${alias}.position LIKE '${p}'`).join(" OR ");
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const [div8, div9] = await Promise.all([
    ctx.env.HR_DB.prepare(`
      SELECT id, full_name, position, division_id,
             (SELECT name FROM divisions WHERE id = e.division_id) AS div_name
      FROM employees e
      WHERE emp_status != 'resigned'
        AND (division_id IS NULL OR division_id != 8)
        AND (${likeWhere(DIV8_LIKE)})
      ORDER BY position, full_name
    `).all(),
    ctx.env.HR_DB.prepare(`
      SELECT id, full_name, position, division_id,
             (SELECT name FROM divisions WHERE id = e.division_id) AS div_name
      FROM employees e
      WHERE emp_status != 'resigned'
        AND (division_id IS NULL OR division_id != 9)
        AND (${likeWhere(DIV9_LIKE)})
      ORDER BY position, full_name
    `).all(),
  ]);

  return Response.json({
    ok: true,
    preview: true,
    div8: { target_division_id: 8, count: div8.results.length, employees: div8.results },
    div9: { target_division_id: 9, count: div9.results.length, employees: div9.results },
    total: div8.results.length + div9.results.length,
  });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const r8 = await ctx.env.HR_DB.prepare(`
    UPDATE employees SET division_id = 8, updated_at = datetime('now')
    WHERE emp_status != 'resigned'
      AND (division_id IS NULL OR division_id != 8)
      AND (${likeWhere(DIV8_LIKE)})
  `).run();

  const r9 = await ctx.env.HR_DB.prepare(`
    UPDATE employees SET division_id = 9, updated_at = datetime('now')
    WHERE emp_status != 'resigned'
      AND (division_id IS NULL OR division_id != 9)
      AND (${likeWhere(DIV9_LIKE)})
  `).run();

  try {
    await ctx.env.HR_DB.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'admin','migrate_divisions','bulk',0)"
    ).bind(user.id, user.full_name).run();
  } catch { /* non-critical */ }

  return Response.json({
    ok: true,
    updated_div8: r8.meta.changes,
    updated_div9: r9.meta.changes,
    total_updated: (r8.meta.changes ?? 0) + (r9.meta.changes ?? 0),
  });
};
