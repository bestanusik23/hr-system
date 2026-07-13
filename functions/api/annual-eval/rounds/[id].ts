import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser, hasRole } from "../../../lib/auth";
import { firstStep, statusForStep, resolveStepNotifyTargets, type AnnualEvalStep } from "../../../lib/annualEval";

interface RoundRow {
  id: number; year_be: number; name: string; start_date: string; end_date: string;
  status: string; scope_division_id: number | null; scope_department_id: number | null;
}
interface EvalRow {
  id: number; employee_id: number; template_id: number;
  snap_full_name: string; snap_emp_code: string | null; snap_position: string | null;
  snap_department: string | null; snap_division: string | null; snap_job_level: number;
  status: string; total_weighted_score: number | null; grade: string | null;
}

// GET /api/annual-eval/rounds/:id — round detail + employee evaluation list
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = Number(ctx.params.id);
  const db = ctx.env.HR_DB;
  const round = await db.prepare("SELECT * FROM annual_eval_rounds WHERE id = ?").bind(id).first<RoundRow>();
  if (!round) return Response.json({ ok: false, error: "ไม่พบรอบประเมินนี้" }, { status: 404 });

  const evals = await db.prepare(`
    SELECT id, employee_id, template_id, snap_full_name, snap_emp_code, snap_position,
           snap_department, snap_division, snap_job_level, status, total_weighted_score, grade
    FROM annual_evaluations WHERE round_id = ? ORDER BY snap_full_name
  `).bind(id).all<EvalRow>();

  return Response.json({ ok: true, round, evaluations: evals.results ?? [] });
};

// PATCH /api/annual-eval/rounds/:id — { action: "open" | "close" | "cancel" }
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!hasRole(user, "hr", "deputyHR", "admin")) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = Number(ctx.params.id);
  const body = await ctx.request.json().catch(() => null) as { action?: string } | null;
  const action = body?.action;
  if (!action || !["open", "close", "cancel"].includes(action)) {
    return Response.json({ ok: false, error: "action ไม่ถูกต้อง" }, { status: 400 });
  }

  const db = ctx.env.HR_DB;
  const round = await db.prepare("SELECT * FROM annual_eval_rounds WHERE id = ?").bind(id).first<RoundRow>();
  if (!round) return Response.json({ ok: false, error: "ไม่พบรอบประเมินนี้" }, { status: 404 });

  if (action === "open") {
    if (round.status !== "draft") return Response.json({ ok: false, error: "เปิดรอบได้เฉพาะรอบที่ยังเป็นแบบร่างเท่านั้น" }, { status: 400 });

    const evals = await db.prepare(`
      SELECT ae.id, ae.employee_id, ae.snap_full_name, e.department_id, e.division_id, t.workflow_steps_json
      FROM annual_evaluations ae
      JOIN annual_eval_templates t ON t.id = ae.template_id
      JOIN employees e ON e.id = ae.employee_id
      WHERE ae.round_id = ?
    `).bind(id).all<{
      id: number; employee_id: number; snap_full_name: string;
      department_id: number | null; division_id: number | null; workflow_steps_json: string;
    }>();

    const statements = [db.prepare("UPDATE annual_eval_rounds SET status = 'open', updated_at = datetime('now') WHERE id = ?").bind(id)];
    const notifStatements = [];
    for (const e of evals.results ?? []) {
      const steps = JSON.parse(e.workflow_steps_json) as AnnualEvalStep[];
      const step = firstStep(steps);
      const initialStatus = statusForStep(step);
      statements.push(db.prepare(
        "UPDATE annual_evaluations SET status = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(initialStatus, e.id));

      const targets = await resolveStepNotifyTargets(db, step, e.department_id, e.division_id);
      const text = `รอบประเมินประจำปี "${round.name}" — ถึงคิวประเมิน ${e.snap_full_name}`;
      for (const t of targets) {
        notifStatements.push(db.prepare(
          "INSERT INTO notifications (target_user_id, target_role, icon, text, kind, link) VALUES (?, ?, '📋', ?, 'annual_eval', ?)"
        ).bind(t.target_user_id ?? null, t.target_role ?? null, text, `/annual-eval/${e.id}`));
      }
    }
    for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50));
    for (let i = 0; i < notifStatements.length; i += 50) await db.batch(notifStatements.slice(i, i + 50));

  } else if (action === "close") {
    await db.prepare("UPDATE annual_eval_rounds SET status = 'closed', updated_at = datetime('now') WHERE id = ?").bind(id).run();
  } else {
    await db.prepare("UPDATE annual_eval_rounds SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").bind(id).run();
    await db.prepare(
      "UPDATE annual_evaluations SET status = 'cancelled', cancel_reason = 'ยกเลิกทั้งรอบ', updated_at = datetime('now') WHERE round_id = ? AND status NOT IN ('completed','cancelled')"
    ).bind(id).run();
  }

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'annual_eval',?,'annual_eval_round',?,?)"
    ).bind(user.id, user.full_name, `round_${action}`, id, round.name).run();
  } catch { /* non-critical */ }

  return Response.json({ ok: true });
};
