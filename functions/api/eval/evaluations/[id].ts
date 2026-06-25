import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../../lib/auth";

// GET /api/eval/evaluations/:id
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = ctx.params.id as string;
  const ev = await ctx.env.HR_DB.prepare(`
    SELECT ev.*, e.full_name, e.position, e.start_date, e.emp_status,
           d.name AS department_name, dv.name AS division_name,
           e.division_id, e.department_id
    FROM evaluations ev
    JOIN employees e ON e.id = ev.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN divisions dv ON dv.id = e.division_id
    WHERE ev.id = ?
  `).bind(id).first<{ division_id: number; department_id: number; status: string; employee_id: number; [key: string]: unknown }>();
  if (!ev) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  // Scope check: head by department, deputy by division
  if (user.role === "head" && user.scope_department_id && ev.department_id !== user.scope_department_id) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (["deputy", "deputyHR"].includes(user.role) && user.scope_division_id && ev.division_id !== user.scope_division_id) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const scores = await ctx.env.HR_DB.prepare(`
    SELECT es.topic_id, es.score, et.text, et.owner, et.sort_order
    FROM evaluation_scores es
    JOIN eval_topics et ON et.id = es.topic_id
    WHERE es.evaluation_id = ?
    ORDER BY et.sort_order
  `).bind(id).all();

  // HR topics: always use global (template_id IS NULL, owner='hr') — same 3 for every position
  const globalHR = await ctx.env.HR_DB.prepare(
    "SELECT id, owner, text, sort_order FROM eval_topics WHERE template_id IS NULL AND owner = 'hr' ORDER BY sort_order"
  ).all();

  // Head topics: template-specific if template set, otherwise global head topics
  let headTopics;
  const templateId = (ev as Record<string, unknown>).template_id;
  if (templateId) {
    const tmpl = await ctx.env.HR_DB.prepare(
      "SELECT id, owner, text, sort_order FROM eval_topics WHERE template_id = ? AND owner = 'head' ORDER BY sort_order"
    ).bind(templateId).all();
    headTopics = tmpl.results;
  } else {
    const global = await ctx.env.HR_DB.prepare(
      "SELECT id, owner, text, sort_order FROM eval_topics WHERE template_id IS NULL AND owner = 'head' ORDER BY sort_order"
    ).all();
    headTopics = global.results;
  }

  // Combine: HR first, then head — frontend splits by owner field
  const templateTopics = [...(globalHR.results as object[]), ...(headTopics as object[])];

  const approvals = await ctx.env.HR_DB.prepare(`
    SELECT ea.step, ea.status, ea.note, ea.created_at, u.full_name AS approver_name
    FROM evaluation_approvals ea
    LEFT JOIN users u ON u.id = ea.approver_user_id
    WHERE ea.evaluation_id = ?
    ORDER BY ea.created_at
  `).bind(id).all();

  return Response.json({ ok: true, evaluation: ev, scores: scores.results, approvals: approvals.results, templateTopics });
};

// PUT /api/eval/evaluations/:id — 4-step workflow
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  try {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = ctx.params.id as string;
  const body = await ctx.request.json() as Record<string, unknown>;
  const action = body.action as string;

  const ev = await ctx.env.HR_DB.prepare(`
    SELECT ev.*, e.division_id, e.department_id FROM evaluations ev
    JOIN employees e ON e.id = ev.employee_id
    WHERE ev.id = ?
  `).bind(id).first<{ status: string; employee_id: number; division_id: number; department_id: number; round: number }>();
  if (!ev) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  if (user.role === "head" && user.scope_department_id && ev.department_id !== user.scope_department_id)
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (["deputy", "deputyHR"].includes(user.role) && user.scope_division_id && ev.division_id !== user.scope_division_id)
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const scores     = body.scores as Record<string, number> | undefined;
  const suggestion = body.suggestion as string | undefined;
  const decision   = body.decision as string | undefined;
  const grade      = body.grade as string | undefined;
  const note       = body.note as string | undefined;
  const signerEmp  = body.signer_employee as string | undefined;
  const signerHead = body.signer_head as string | undefined;
  const signerHR   = body.signer_hr as string | undefined;
  const signerDir  = body.signer_director as string | undefined;

  const forbidden = Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const conflict  = (msg: string) => Response.json({ ok: false, error: msg }, { status: 409 });

  async function saveScores() {
    if (!scores) return;
    for (const [topicId, score] of Object.entries(scores)) {
      await ctx.env.HR_DB.prepare(
        "INSERT INTO evaluation_scores (evaluation_id, topic_id, score) VALUES (?,?,?) ON CONFLICT(evaluation_id,topic_id) DO UPDATE SET score=excluded.score"
      ).bind(id, Number(topicId), score).run();
    }
  }

  async function totalFromDB(): Promise<number> {
    const r = await ctx.env.HR_DB.prepare(
      "SELECT COALESCE(SUM(score),0) AS t FROM evaluation_scores WHERE evaluation_id=?"
    ).bind(id).first<{ t: number }>();
    return r?.t ?? 0;
  }

  // ── STEP 0: HR sends to head → pending_head ────────────────────
  if (action === "send_to_head") {
    if (!["hr", "admin"].includes(user.role)) return forbidden;
    if (ev.status !== "draft") return conflict("ไม่อยู่ในสถานะร่าง");

    await ctx.env.HR_DB.prepare(
      "UPDATE evaluations SET status='pending_head', updated_at=datetime('now') WHERE id=?"
    ).bind(id).run();
    try {
      await ctx.env.HR_DB.prepare(
        "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'eval','send_to_head','evaluation',?)"
      ).bind(user.id, user.full_name, id).run();
    } catch { /* non-critical */ }
    return Response.json({ ok: true });
  }

  // ── SAVE draft (head in pending_head / hr in pending_hr) ────────
  if (action === "save") {
    const canSave =
      (["head", "admin"].includes(user.role) && ev.status === "pending_head") ||
      (["hr",   "admin"].includes(user.role) && ev.status === "pending_hr");
    if (!canSave) return forbidden;

    await saveScores();
    const total = scores ? Object.values(scores).reduce((a, b) => a + b, 0) : null;

    if (ev.status === "pending_head") {
      await ctx.env.HR_DB.prepare(`
        UPDATE evaluations SET suggestion=?, decision=?, grade=?,
          total_score=COALESCE(?,total_score),
          signer_employee=COALESCE(?,signer_employee),
          signer_head=COALESCE(?,signer_head),
          updated_at=datetime('now') WHERE id=?
      `).bind(suggestion ?? null, decision ?? null, grade ?? null, total,
               signerEmp ?? null, signerHead ?? null, id).run();
    } else {
      await ctx.env.HR_DB.prepare(`
        UPDATE evaluations SET signer_hr=COALESCE(?,signer_hr),
          updated_at=datetime('now') WHERE id=?
      `).bind(signerHR ?? null, id).run();
    }
    return Response.json({ ok: true });
  }

  // ── STEP 1: Head submits → pending_deputy ───────────────────────
  if (action === "submit") {
    if (!["head", "admin"].includes(user.role)) return forbidden;
    if (ev.status !== "pending_head") return conflict("ไม่อยู่ในสถานะรอหัวหน้าแผนก");

    await saveScores();
    const total = await totalFromDB();

    await ctx.env.HR_DB.prepare(`
      UPDATE evaluations SET status='pending_deputy', suggestion=?, decision=?, grade=?,
        total_score=?, head_user_id=?,
        signer_employee=COALESCE(?,signer_employee),
        signer_head=COALESCE(?,signer_head),
        updated_at=datetime('now') WHERE id=?
    `).bind(suggestion ?? null, decision ?? null, grade ?? null, total, user.id,
             signerEmp ?? null, signerHead ?? null, id).run();

    await ctx.env.HR_DB.prepare(
      "INSERT INTO evaluation_approvals (evaluation_id, step, approver_user_id, status) VALUES (?,?,?,?)"
    ).bind(id, "head", user.id, "approved").run();
    await ctx.env.HR_DB.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'eval','submit_eval','evaluation',?)"
    ).bind(user.id, user.full_name, id).run();

    return Response.json({ ok: true });
  }

  // ── STEP 2a: Deputy approves → pending_hr ──────────────────────
  if (action === "deputy_approve") {
    if (!["deputy", "admin"].includes(user.role)) return forbidden;
    if (ev.status !== "pending_deputy") return conflict("ไม่อยู่ในสถานะรอรองผู้อำนวยการ");

    await ctx.env.HR_DB.prepare(
      "UPDATE evaluations SET status='pending_hr', updated_at=datetime('now') WHERE id=?"
    ).bind(id).run();
    await ctx.env.HR_DB.prepare(
      "INSERT INTO evaluation_approvals (evaluation_id, step, approver_user_id, status, note) VALUES (?,?,?,?,?)"
    ).bind(id, "deputy", user.id, "approved", note ?? null).run();
    await ctx.env.HR_DB.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'eval','deputy_approve','evaluation',?)"
    ).bind(user.id, user.full_name, id).run();

    return Response.json({ ok: true });
  }

  // ── STEP 2b: Deputy rejects → rejected ─────────────────────────
  if (action === "deputy_reject") {
    if (!["deputy", "admin"].includes(user.role)) return forbidden;
    if (ev.status !== "pending_deputy") return conflict("ไม่อยู่ในสถานะรอรองผู้อำนวยการ");

    await ctx.env.HR_DB.prepare(
      "UPDATE evaluations SET status='rejected', updated_at=datetime('now') WHERE id=?"
    ).bind(id).run();
    await ctx.env.HR_DB.prepare(
      "INSERT INTO evaluation_approvals (evaluation_id, step, approver_user_id, status, note) VALUES (?,?,?,?,?)"
    ).bind(id, "deputy", user.id, "rejected", note ?? null).run();
    await ctx.env.HR_DB.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'eval','deputy_reject','evaluation',?,?)"
    ).bind(user.id, user.full_name, id, note ?? null).run();

    return Response.json({ ok: true });
  }

  // ── STEP 3: HR acknowledges → pending_final ─────────────────────
  if (action === "hr_acknowledge") {
    if (!["hr", "admin"].includes(user.role)) return forbidden;
    if (ev.status !== "pending_hr") return conflict("ไม่อยู่ในสถานะรอ HR");

    await saveScores();
    const total = await totalFromDB();

    await ctx.env.HR_DB.prepare(`
      UPDATE evaluations SET status='pending_final', hr_user_id=?,
        signer_hr=COALESCE(?,signer_hr), total_score=?,
        updated_at=datetime('now') WHERE id=?
    `).bind(user.id, signerHR ?? null, total, id).run();
    await ctx.env.HR_DB.prepare(
      "INSERT INTO evaluation_approvals (evaluation_id, step, approver_user_id, status, note) VALUES (?,?,?,?,?)"
    ).bind(id, "hr", user.id, "approved", note ?? null).run();

    return Response.json({ ok: true });
  }

  // ── STEP 4a: Final deputy approves → approved ───────────────────
  if (action === "final_approve") {
    if (!["deputyHR", "admin"].includes(user.role)) return forbidden;
    if (ev.status !== "pending_final") return conflict("ไม่อยู่ในสถานะรออนุมัติขั้นสุดท้าย");

    await ctx.env.HR_DB.prepare(`
      UPDATE evaluations SET status='approved',
        signer_director=COALESCE(?,signer_director),
        updated_at=datetime('now') WHERE id=?
    `).bind(signerDir ?? null, id).run();
    await ctx.env.HR_DB.prepare(
      "INSERT INTO evaluation_approvals (evaluation_id, step, approver_user_id, status, note) VALUES (?,?,?,?,?)"
    ).bind(id, "final", user.id, "approved", note ?? null).run();
    await ctx.env.HR_DB.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'eval','final_approve','evaluation',?)"
    ).bind(user.id, user.full_name, id).run();

    return Response.json({ ok: true });
  }

  // ── STEP 4b: Final deputy rejects → rejected ────────────────────
  if (action === "final_reject") {
    if (!["deputyHR", "admin"].includes(user.role)) return forbidden;
    if (ev.status !== "pending_final") return conflict("ไม่อยู่ในสถานะรออนุมัติขั้นสุดท้าย");

    await ctx.env.HR_DB.prepare(
      "UPDATE evaluations SET status='rejected', updated_at=datetime('now') WHERE id=?"
    ).bind(id).run();
    await ctx.env.HR_DB.prepare(
      "INSERT INTO evaluation_approvals (evaluation_id, step, approver_user_id, status, note) VALUES (?,?,?,?,?)"
    ).bind(id, "final", user.id, "rejected", note ?? null).run();
    await ctx.env.HR_DB.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'eval','final_reject','evaluation',?,?)"
    ).bind(user.id, user.full_name, id, note ?? null).run();

    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
};

// DELETE /api/eval/evaluations/:id — only draft evaluations can be deleted
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "head"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;
  const ev = await ctx.env.HR_DB.prepare(`
    SELECT ev.status, e.department_id FROM evaluations ev
    JOIN employees e ON e.id = ev.employee_id WHERE ev.id = ?
  `).bind(id).first<{ status: string; department_id: number }>();

  if (!ev) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  if (!["draft", "pending_head"].includes(ev.status))
    return Response.json({ ok: false, error: "ลบได้เฉพาะใบประเมินที่ยังไม่ได้ส่งหัวหน้าประเมิน" }, { status: 409 });

  // head: scope check
  if (user.role === "head" && user.scope_department_id && ev.department_id !== user.scope_department_id)
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  await ctx.env.HR_DB.prepare("DELETE FROM evaluation_scores WHERE evaluation_id = ?").bind(id).run();
  await ctx.env.HR_DB.prepare("DELETE FROM evaluation_approvals WHERE evaluation_id = ?").bind(id).run();
  await ctx.env.HR_DB.prepare("DELETE FROM evaluations WHERE id = ?").bind(id).run();

  return Response.json({ ok: true });
};
