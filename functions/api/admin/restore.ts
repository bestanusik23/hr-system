import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// Parent-to-child order. INSERT follows this order (so foreign-key targets always exist
// before being referenced); DELETE uses the reverse (children cleared before parents).
// This makes the wipe-and-reload safe regardless of whether FK enforcement is active.
const RESTORE_ORDER = [
  "divisions", "eval_templates", "training_courses", "role_module_access",
  "recruit_appointments", "manpower_plan_overrides", "workforce_imports", "duty_orders",
  "departments", "manpower_plan", "eval_topics",
  "users",
  "employees",
  "employee_department_assignment", "evaluations", "transfer_requests",
  "training_attendees", "notifications", "activity_log",
  "evaluation_scores", "evaluation_approvals", "transfer_approvals",
  "training_surveys", "training_certificates", "training_photos",
];

const CHUNK_SIZE = 50;

// POST /api/admin/restore — full-system wipe-and-reload from a previously downloaded backup file.
// Restricted to the single "admin" account. This overwrites the entire database to match the
// uploaded file exactly — anything created after the backup's export time is permanently lost.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (user.username !== "admin") return Response.json({ ok: false, error: "เฉพาะบัญชี admin เท่านั้น" }, { status: 403 });

  const body = await ctx.request.json().catch(() => null) as { tables?: Record<string, Record<string, unknown>[]> } | null;
  if (!body?.tables) return Response.json({ ok: false, error: "ไฟล์สำรองไม่ถูกต้อง" }, { status: 400 });

  const db = ctx.env.HR_DB;
  const restored: Record<string, number> = {};
  const errors: Record<string, string> = {};

  // 1) Wipe all known tables (reverse dependency order) as one transaction.
  try {
    const deletes = [...RESTORE_ORDER].reverse().map(t => db.prepare(`DELETE FROM ${t}`));
    await db.batch(deletes);
  } catch (e) {
    return Response.json({ ok: false, error: `ล้างข้อมูลเดิมไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }

  // 2) Re-insert from the backup file, parent tables first, chunked per table.
  for (const table of RESTORE_ORDER) {
    const rows = body.tables[table];
    if (!rows || rows.length === 0) { restored[table] = 0; continue; }
    let count = 0;
    try {
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const stmts = chunk.map(row => {
          const cols = Object.keys(row);
          const placeholders = cols.map(() => "?").join(",");
          return db.prepare(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`)
            .bind(...cols.map(c => row[c] as string | number | null));
        });
        await db.batch(stmts);
        count += chunk.length;
      }
      restored[table] = count;
    } catch (e) {
      errors[table] = e instanceof Error ? e.message : String(e);
      restored[table] = count;
    }
  }

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type) VALUES (?,?,'admin','backup_restore','database')"
    ).bind(user.id, user.full_name).run();
  } catch { /* non-critical */ }

  return Response.json({
    ok: Object.keys(errors).length === 0,
    restored,
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  });
};
