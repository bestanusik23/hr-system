import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser, hasRole } from "../../../lib/auth";
import {
  stepForStatus, statusForStep, nextStep, canActOnStep, resolveStepNotifyTargets, raterRoleForStep,
  loadTemplateCategoriesForScoring, computeFinalScore, type AnnualEvalStep,
} from "../../../lib/annualEval";

interface EvalRow {
  id: number; round_id: number; employee_id: number; template_id: number;
  snap_full_name: string; snap_emp_code: string | null; snap_position: string | null;
  snap_department: string | null; snap_division: string | null; snap_job_level: number;
  snap_department_head: string | null; snap_deputy_director: string | null; snap_supervisor: string | null;
  status: string; returned_reason: string | null; cancel_reason: string | null;
  total_raw_score: number | null; total_weighted_score: number | null; total_percent: number | null; grade: string | null;
  department_id: number | null; division_id: number | null;
  round_name: string; round_status: string;
}

async function loadEval(db: D1Database, id: number): Promise<EvalRow | null> {
  return db.prepare(`
    SELECT ae.*, e.department_id, e.division_id, r.name AS round_name, r.status AS round_status
    FROM annual_evaluations ae
    JOIN employees e ON e.id = ae.employee_id
    JOIN annual_eval_rounds r ON r.id = ae.round_id
    WHERE ae.id = ?
  `).bind(id).first<EvalRow>();
}

// GET /api/annual-eval/evaluations/:id — full detail: template/categories/items, all
// submitted item scores (raters only see scores from steps that already happened —
// enforced by only ever writing submitted_at once a step is done), stats, comments, history.
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = Number(ctx.params.id);
  const db = ctx.env.HR_DB;
  const ev = await loadEval(db, id);
  if (!ev) return Response.json({ ok: false, error: "ไม่พบใบประเมินนี้" }, { status: 404 });

  const [template, categories, items, scores, stats, comments, history] = await Promise.all([
    db.prepare("SELECT * FROM annual_eval_templates WHERE id = ?").bind(ev.template_id).first(),
    db.prepare("SELECT * FROM annual_eval_categories WHERE template_id = ? ORDER BY sort_order").bind(ev.template_id).all(),
    db.prepare(`SELECT i.* FROM annual_eval_items i JOIN annual_eval_categories c ON c.id = i.category_id
                WHERE c.template_id = ? ORDER BY i.category_id, i.sort_order`).bind(ev.template_id).all(),
    db.prepare("SELECT * FROM annual_eval_item_scores WHERE annual_evaluation_id = ? AND submitted_at IS NOT NULL")
      .bind(id).all(),
    db.prepare("SELECT * FROM annual_eval_stats WHERE annual_evaluation_id = ?").bind(id).first(),
    db.prepare("SELECT * FROM annual_eval_comments WHERE annual_evaluation_id = ? ORDER BY source, item_order").bind(id).all(),
    db.prepare("SELECT * FROM annual_eval_score_history WHERE annual_evaluation_id = ? ORDER BY changed_at DESC").bind(id).all(),
  ]);

  const currentStep = stepForStatus(ev.status as Parameters<typeof stepForStatus>[0]);
  const canAct = currentStep ? await canActOnStep(db, user, currentStep, ev.department_id, ev.division_id) : false;
  const canManage = hasRole(user, "hr", "deputyHR", "admin");

  return Response.json({
    ok: true, evaluation: ev, template, categories: categories.results, items: items.results,
    scores: scores.results, stats, comments: comments.results, history: history.results,
    current_step: currentStep, can_act: canAct, can_manage: canManage,
  });
};

// PUT /api/annual-eval/evaluations/:id — action-dispatch, mirrors the probation eval module's convention.
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = Number(ctx.params.id);
  const db = ctx.env.HR_DB;
  const body = await ctx.request.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action as string | undefined;
  if (!action) return Response.json({ ok: false, error: "action ไม่ถูกต้อง" }, { status: 400 });

  const ev = await loadEval(db, id);
  if (!ev) return Response.json({ ok: false, error: "ไม่พบใบประเมินนี้" }, { status: 404 });

  if (action === "submit_scores") return handleSubmitScores(db, user, ev, body!);
  if (action === "return") return handleReturn(db, user, ev, body!);
  if (action === "finalize") return handleFinalize(db, user, ev);
  if (action === "cancel") return handleCancel(db, user, ev, body!);
  return Response.json({ ok: false, error: `ไม่รู้จัก action: ${action}` }, { status: 400 });
};

async function handleSubmitScores(
  db: D1Database, user: Awaited<ReturnType<typeof getSessionUser>> & object, ev: EvalRow, body: Record<string, unknown>,
) {
  const step = stepForStatus(ev.status as Parameters<typeof stepForStatus>[0]);
  if (!step) return Response.json({ ok: false, error: "ใบประเมินนี้ไม่ได้อยู่ในสถานะที่รอการให้คะแนน" }, { status: 400 });
  if (!(await canActOnStep(db, user, step, ev.department_id, ev.division_id))) {
    return Response.json({ ok: false, error: "คุณไม่มีสิทธิ์ให้คะแนนขั้นตอนนี้" }, { status: 403 });
  }

  const raterRole = raterRoleForStep(step);
  if (!raterRole) return Response.json({ ok: false, error: "ขั้นตอนนี้ไม่มีผู้ประเมิน" }, { status: 400 });
  const itemScores = body.item_scores as { item_id: number; score: number; reason?: string }[] | undefined;
  const isDraft = body.draft === true;
  if (!Array.isArray(itemScores) || itemScores.length === 0) {
    return Response.json({ ok: false, error: "กรุณาระบุคะแนนอย่างน้อย 1 หัวข้อ" }, { status: 400 });
  }

  // Validate every submitted item belongs to a category this rater is actually responsible for.
  const categories = await loadTemplateCategoriesForScoring(db, ev.template_id);
  const myCategories = categories.filter(c => c.rater_roles.includes(raterRole));
  const myItemIds = new Set(myCategories.flatMap(c => c.item_ids));
  for (const s of itemScores) {
    if (!myItemIds.has(s.item_id)) {
      return Response.json({ ok: false, error: `หัวข้อ #${s.item_id} ไม่ได้อยู่ในความรับผิดชอบของขั้นตอนนี้` }, { status: 400 });
    }
    if (typeof s.score !== "number" || s.score < 0 || s.score > 5 || !Number.isInteger(s.score)) {
      return Response.json({ ok: false, error: "คะแนนต้องเป็นจำนวนเต็ม 0-5" }, { status: 400 });
    }
    if ([1, 2, 5].includes(s.score) && !s.reason?.trim()) {
      return Response.json({ ok: false, error: "กรุณาระบุเหตุผลเมื่อให้คะแนน 1, 2 หรือ 5" }, { status: 400 });
    }
  }

  // Existing rows (for history diff on resubmit-after-return) + already-locked check.
  const existing = await db.prepare(
    "SELECT item_id, score, reason, submitted_at FROM annual_eval_item_scores WHERE annual_evaluation_id = ? AND rater_role = ?"
  ).bind(ev.id, raterRole).all<{ item_id: number; score: number | null; reason: string | null; submitted_at: string | null }>();
  const existingByItem = new Map((existing.results ?? []).map(r => [r.item_id, r]));

  if (!isDraft) {
    for (const row of existing.results ?? []) {
      if (row.submitted_at) {
        return Response.json({ ok: false, error: "ขั้นตอนนี้ถูกส่งไปแล้ว กรุณาให้ HR ส่งกลับก่อนแก้ไข" }, { status: 400 });
      }
    }
  }

  // submitted_at is a SQL-side literal (NULL or datetime('now')), not a bound parameter —
  // derived purely from the isDraft boolean, never from user input.
  const submittedAtSql = isDraft ? "NULL" : "datetime('now')";
  const statements = [];
  const historyStatements = [];
  for (const s of itemScores) {
    const prior = existingByItem.get(s.item_id);
    if (prior && (prior.score !== s.score || prior.reason !== (s.reason ?? null))) {
      historyStatements.push(db.prepare(`
        INSERT INTO annual_eval_score_history (annual_evaluation_id, item_id, rater_role, old_score, new_score, old_reason, new_reason, changed_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(ev.id, s.item_id, raterRole, prior.score, s.score, prior.reason, s.reason ?? null, user.full_name));
    }
    statements.push(db.prepare(`
      INSERT INTO annual_eval_item_scores (annual_evaluation_id, item_id, rater_role, score, reason, submitted_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ${submittedAtSql}, ?, ?)
      ON CONFLICT(annual_evaluation_id, item_id, rater_role) DO UPDATE SET
        score = excluded.score, reason = excluded.reason, submitted_at = ${submittedAtSql},
        updated_by = excluded.updated_by, updated_at = datetime('now')
    `).bind(ev.id, s.item_id, raterRole, s.score, s.reason ?? null, user.full_name, user.full_name));
  }
  for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50));
  for (let i = 0; i < historyStatements.length; i += 50) await db.batch(historyStatements.slice(i, i + 50));

  if (isDraft) return Response.json({ ok: true, draft: true });

  // Final submit: require ALL of this rater's items to be scored before advancing.
  const finalCheck = await db.prepare(
    "SELECT COUNT(*) AS n FROM annual_eval_item_scores WHERE annual_evaluation_id = ? AND rater_role = ? AND submitted_at IS NOT NULL"
  ).bind(ev.id, raterRole).first<{ n: number }>();
  if ((finalCheck?.n ?? 0) < myItemIds.size) {
    return Response.json({ ok: false, error: "กรุณาให้คะแนนครบทุกหัวข้อในความรับผิดชอบก่อนส่ง" }, { status: 400 });
  }

  const templateRow = await db.prepare("SELECT workflow_steps_json FROM annual_eval_templates WHERE id = ?")
    .bind(ev.template_id).first<{ workflow_steps_json: string }>();
  const steps = JSON.parse(templateRow!.workflow_steps_json) as AnnualEvalStep[];
  const upcoming = nextStep(steps, step);
  const newStatus = upcoming ? statusForStep(upcoming) : statusForStep("summary");
  const submittedAtCol = `${step}_submitted_at`;

  await db.prepare(
    `UPDATE annual_evaluations SET status = ?, ${submittedAtCol} = datetime('now'), returned_reason = NULL, updated_at = datetime('now') WHERE id = ?`
  ).bind(newStatus, ev.id).run();

  if (upcoming) {
    const targets = await resolveStepNotifyTargets(db, upcoming, ev.department_id, ev.division_id);
    const notifStatements = targets.map(t => db.prepare(
      "INSERT INTO notifications (target_user_id, target_role, icon, text, kind, link) VALUES (?, ?, '📋', ?, 'annual_eval', ?)"
    ).bind(t.target_user_id ?? null, t.target_role ?? null,
           `ถึงคิวประเมิน ${ev.snap_full_name} (รอบ "${ev.round_name}")`, `/annual-eval/${ev.id}`));
    if (notifStatements.length > 0) await db.batch(notifStatements);
  }

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'annual_eval','submit_scores','annual_evaluation',?,?)"
    ).bind(user.id, user.full_name, ev.id, `${step} → ${ev.snap_full_name}`).run();
  } catch { /* non-critical */ }

  return Response.json({ ok: true, status: newStatus });
}

async function handleReturn(
  db: D1Database, user: Awaited<ReturnType<typeof getSessionUser>> & object, ev: EvalRow, body: Record<string, unknown>,
) {
  if (!hasRole(user, "hr", "deputyHR", "admin")) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const targetStep = body.target_step as AnnualEvalStep | undefined;
  const reason = (body.reason as string | undefined)?.trim();
  if (!targetStep || !reason) return Response.json({ ok: false, error: "กรุณาระบุขั้นตอนที่ต้องการส่งกลับและเหตุผล" }, { status: 400 });

  const templateRow = await db.prepare("SELECT workflow_steps_json FROM annual_eval_templates WHERE id = ?")
    .bind(ev.template_id).first<{ workflow_steps_json: string }>();
  const steps = JSON.parse(templateRow!.workflow_steps_json) as AnnualEvalStep[];
  const targetIdx = steps.indexOf(targetStep);
  const currentStep = stepForStatus(ev.status as Parameters<typeof stepForStatus>[0]);
  const currentIdx = currentStep ? steps.indexOf(currentStep) : steps.length; // completed/pending_summary → treat as past the end
  if (targetIdx === -1 || (ev.status !== "pending_summary" && ev.status !== "completed" && targetIdx > currentIdx)) {
    return Response.json({ ok: false, error: "ไม่สามารถส่งกลับไปยังขั้นตอนที่ยังไม่ถึงได้" }, { status: 400 });
  }

  const oldScores = await db.prepare(
    "SELECT item_id, score, reason FROM annual_eval_item_scores WHERE annual_evaluation_id = ? AND rater_role = ?"
  ).bind(ev.id, targetStep).all<{ item_id: number; score: number | null; reason: string | null }>();

  const statements = (oldScores.results ?? []).map(r => db.prepare(
    "INSERT INTO annual_eval_score_history (annual_evaluation_id, item_id, rater_role, old_score, new_score, old_reason, new_reason, changed_by) VALUES (?, ?, ?, ?, NULL, ?, NULL, ?)"
  ).bind(ev.id, r.item_id, targetStep, r.score, r.reason, user.full_name));
  statements.push(db.prepare("DELETE FROM annual_eval_item_scores WHERE annual_evaluation_id = ? AND rater_role = ?").bind(ev.id, targetStep));
  statements.push(db.prepare(
    "UPDATE annual_evaluations SET status = ?, returned_reason = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(statusForStep(targetStep), reason, ev.id));
  await db.batch(statements);

  const targets = await resolveStepNotifyTargets(db, targetStep, ev.department_id, ev.division_id);
  const notifStatements = targets.map(t => db.prepare(
    "INSERT INTO notifications (target_user_id, target_role, icon, text, kind, link) VALUES (?, ?, '↩️', ?, 'annual_eval', ?)"
  ).bind(t.target_user_id ?? null, t.target_role ?? null,
         `ใบประเมิน ${ev.snap_full_name} ถูกส่งกลับแก้ไข: ${reason}`, `/annual-eval/${ev.id}`));
  if (notifStatements.length > 0) await db.batch(notifStatements);

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'annual_eval','return','annual_evaluation',?,?)"
    ).bind(user.id, user.full_name, ev.id, `${ev.snap_full_name} → ${targetStep}: ${reason}`).run();
  } catch { /* non-critical */ }

  return Response.json({ ok: true });
}

async function handleFinalize(db: D1Database, user: Awaited<ReturnType<typeof getSessionUser>> & object, ev: EvalRow) {
  if (!hasRole(user, "hr", "deputyHR", "admin")) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (ev.status !== "pending_summary") {
    return Response.json({ ok: false, error: "สรุปผลได้เฉพาะใบประเมินที่อยู่ในสถานะรอสรุปผลเท่านั้น" }, { status: 400 });
  }

  const result = await computeFinalScore(db, ev.id, ev.template_id);
  await db.prepare(`
    UPDATE annual_evaluations
    SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now'),
        total_raw_score = ?, total_weighted_score = ?, total_percent = ?, grade = ?
    WHERE id = ?
  `).bind(result.total_raw_score, result.total_weighted_score, result.total_percent, result.grade, ev.id).run();

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'annual_eval','finalize','annual_evaluation',?,?)"
    ).bind(user.id, user.full_name, ev.id, `${ev.snap_full_name}: ${result.total_weighted_score}/20 (${result.grade})`).run();
  } catch { /* non-critical */ }

  return Response.json({ ok: true, result });
}

async function handleCancel(
  db: D1Database, user: Awaited<ReturnType<typeof getSessionUser>> & object, ev: EvalRow, body: Record<string, unknown>,
) {
  if (!hasRole(user, "hr", "deputyHR", "admin")) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const reason = (body.reason as string | undefined)?.trim();
  if (!reason) return Response.json({ ok: false, error: "กรุณาระบุเหตุผลการยกเลิก" }, { status: 400 });

  await db.prepare(
    "UPDATE annual_evaluations SET status = 'cancelled', cancel_reason = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(reason, ev.id).run();

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'annual_eval','cancel','annual_evaluation',?,?)"
    ).bind(user.id, user.full_name, ev.id, `${ev.snap_full_name}: ${reason}`).run();
  } catch { /* non-critical */ }

  return Response.json({ ok: true });
}
