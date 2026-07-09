import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// Every table in the system except `sessions` (ephemeral login tokens — meaningless to
// back up and would leak active session secrets into the export file).
const BACKUP_TABLES = [
  "divisions", "departments", "employee_department_assignment",
  "users", "role_module_access",
  "employees",
  "eval_topics", "eval_templates", "evaluations", "evaluation_scores", "evaluation_approvals",
  "training_courses", "training_attendees", "training_surveys", "training_certificates", "training_photos",
  "transfer_requests", "transfer_approvals",
  "recruit_appointments",
  "manpower_plan", "manpower_plan_overrides", "workforce_imports",
  "duty_orders",
  "notifications",
  "activity_log",
];

// GET /api/admin/backup — full-system JSON export (admin only)
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (user.username !== "admin") return Response.json({ ok: false, error: "เฉพาะบัญชี admin เท่านั้น" }, { status: 403 });

  const tables: Record<string, unknown[]> = {};
  const tableErrors: Record<string, string> = {};

  for (const table of BACKUP_TABLES) {
    try {
      const rows = await ctx.env.HR_DB.prepare(`SELECT * FROM ${table}`).all();
      tables[table] = rows.results ?? [];
    } catch (e) {
      tableErrors[table] = e instanceof Error ? e.message : String(e);
    }
  }

  try {
    await ctx.env.HR_DB.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type) VALUES (?,?,'admin','backup_export','database')"
    ).bind(user.id, user.full_name).run();
  } catch { /* non-critical */ }

  return Response.json({
    ok: true,
    exported_at: new Date().toISOString(),
    exported_by: user.full_name ?? user.username,
    version: 1,
    tables,
    ...(Object.keys(tableErrors).length > 0 ? { table_errors: tableErrors } : {}),
  });
};
