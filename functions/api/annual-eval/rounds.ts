import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser, hasRole } from "../../lib/auth";
import { levelGroupForJobLevel } from "../../lib/annualEval";

interface RoundRow {
  id: number; year_be: number; name: string; start_date: string; end_date: string;
  status: string; scope_division_id: number | null; scope_department_id: number | null;
  created_by: string | null; created_at: string;
}
interface ProgressRow { round_id: number; status: string; n: number; }

// GET /api/annual-eval/rounds — list rounds with per-status progress counts
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const db = ctx.env.HR_DB;
  const [rounds, progress] = await Promise.all([
    db.prepare("SELECT * FROM annual_eval_rounds ORDER BY year_be DESC, id DESC").all<RoundRow>(),
    db.prepare("SELECT round_id, status, COUNT(*) AS n FROM annual_evaluations GROUP BY round_id, status").all<ProgressRow>(),
  ]);

  const progressByRound = new Map<number, Record<string, number>>();
  for (const p of progress.results ?? []) {
    if (!progressByRound.has(p.round_id)) progressByRound.set(p.round_id, {});
    progressByRound.get(p.round_id)![p.status] = p.n;
  }

  const out = (rounds.results ?? []).map(r => ({ ...r, progress: progressByRound.get(r.id) ?? {} }));
  return Response.json({ ok: true, rounds: out });
};

// POST /api/annual-eval/rounds — create a round (draft) + one annual_evaluations row per
// matched employee. Blocks (does not guess) if any matched employee has no job_level set.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!hasRole(user, "hr", "deputyHR", "admin")) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => null) as {
    year_be?: number; name?: string; start_date?: string; end_date?: string;
    scope_division_id?: number | null; scope_department_id?: number | null;
  } | null;
  if (!body?.year_be || !body.name?.trim() || !body.start_date || !body.end_date) {
    return Response.json({ ok: false, error: "กรุณากรอกปี พ.ศ. ชื่อรอบ วันเริ่มต้น และวันสิ้นสุด" }, { status: 400 });
  }

  const db = ctx.env.HR_DB;

  // Resolve target employees: confirmed (passed probation) staff within scope.
  let empSql = `SELECT e.id, e.emp_code, e.full_name, e.position, e.job_level,
                        e.department_id, e.division_id, e.supervisor,
                        d.name AS department_name, dv.name AS division_name, dv.approver_name AS deputy_director
                 FROM employees e
                 LEFT JOIN departments d ON d.id = e.department_id
                 LEFT JOIN divisions dv ON dv.id = e.division_id
                 WHERE e.emp_status = 'passed'`;
  const empParams: (string | number)[] = [];
  if (body.scope_division_id) { empSql += " AND e.division_id = ?"; empParams.push(body.scope_division_id); }
  if (body.scope_department_id) { empSql += " AND e.department_id = ?"; empParams.push(body.scope_department_id); }

  const empRows = await db.prepare(empSql).bind(...empParams).all<{
    id: number; emp_code: string | null; full_name: string; position: string | null; job_level: number | null;
    department_id: number | null; division_id: number | null; supervisor: string | null;
    department_name: string | null; division_name: string | null; deputy_director: string | null;
  }>();
  const employees = empRows.results ?? [];

  if (employees.length === 0) {
    return Response.json({ ok: false, error: "ไม่พบพนักงานที่ตรงเงื่อนไข (สถานะบรรจุแล้ว) ในขอบเขตที่เลือก" }, { status: 400 });
  }

  const missingLevel = employees.filter(e => e.job_level == null);
  if (missingLevel.length > 0) {
    return Response.json({
      ok: false,
      error: `พนักงาน ${missingLevel.length} คนยังไม่ได้ระบุระดับพนักงาน กรุณากำหนดก่อนสร้างรอบประเมิน`,
      missing_level_employees: missingLevel.map(e => ({ id: e.id, full_name: e.full_name, emp_code: e.emp_code })),
    }, { status: 400 });
  }

  // Department heads (role = head, scoped by department) for snapshotting.
  const headRows = await db.prepare(
    "SELECT scope_department_id, full_name FROM users WHERE is_active = 1 AND scope_department_id IS NOT NULL AND (role = 'head' OR role_2 = 'head' OR role_3 = 'head')"
  ).all<{ scope_department_id: number; full_name: string }>();
  const headByDept = new Map<number, string>();
  for (const h of headRows.results ?? []) headByDept.set(h.scope_department_id, h.full_name);

  // Active template per level_group.
  const tmplRows = await db.prepare("SELECT id, level_group FROM annual_eval_templates WHERE is_active = 1")
    .all<{ id: number; level_group: string }>();
  const templateByLevelGroup = new Map<string, number>();
  for (const t of tmplRows.results ?? []) templateByLevelGroup.set(t.level_group, t.id);

  const roundResult = await db.prepare(`
    INSERT INTO annual_eval_rounds (year_be, name, start_date, end_date, status, scope_division_id, scope_department_id, created_by)
    VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)
  `).bind(body.year_be, body.name.trim(), body.start_date, body.end_date,
          body.scope_division_id ?? null, body.scope_department_id ?? null, user.full_name).run();
  const roundId = roundResult.meta.last_row_id as number;

  const statements = [];
  for (const e of employees) {
    const levelGroup = levelGroupForJobLevel(e.job_level!);
    const templateId = levelGroup ? templateByLevelGroup.get(levelGroup) : undefined;
    if (!templateId) continue; // defensive — shouldn't happen, all 3 level_groups are seeded
    statements.push(db.prepare(`
      INSERT INTO annual_evaluations
        (round_id, employee_id, template_id, snap_full_name, snap_emp_code, snap_position,
         snap_department, snap_division, snap_job_level, snap_department_head, snap_deputy_director,
         snap_supervisor, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_started', ?)
    `).bind(
      roundId, e.id, templateId, e.full_name, e.emp_code, e.position,
      e.department_name, e.division_name, e.job_level,
      e.department_id ? (headByDept.get(e.department_id) ?? null) : null,
      e.deputy_director, e.supervisor, user.full_name,
    ));
  }
  // D1 batch caps around ~100 statements safely; chunk defensively for large rounds.
  for (let i = 0; i < statements.length; i += 50) {
    await db.batch(statements.slice(i, i + 50));
  }

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'annual_eval','create_round','annual_eval_round',?,?)"
    ).bind(user.id, user.full_name, roundId, `${body.name.trim()} (${statements.length} คน)`).run();
  } catch { /* non-critical */ }

  return Response.json({ ok: true, id: roundId, employee_count: statements.length }, { status: 201 });
};
