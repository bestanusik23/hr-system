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

  // Also return template topics if this eval uses a template
  let templateTopics = null;
  if ((ev as Record<string, unknown>).template_id) {
    const tmpl = await ctx.env.HR_DB.prepare(
      "SELECT id, owner, text, sort_order FROM eval_topics WHERE template_id = ? ORDER BY sort_order"
    ).bind((ev as Record<string, unknown>).template_id).all();
    templateTopics = tmpl.results;
  }

  const approvals = await ctx.env.HR_DB.prepare(`
    SELECT ea.step, ea.status, ea.note, ea.created_at, u.full_name AS approver_name
    FROM evaluation_approvals ea
    LEFT JOIN users u ON u.id = ea.approver_user_id
    WHERE ea.evaluation_id = ?
    ORDER BY ea.created_at
  `).bind(id).all();

  return Response.json({ ok: true, evaluation: ev, scores: scores.results, approvals: approvals.results, templateTopics });
};

// PUT /api/eval/evaluations/:id
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = ctx.params.id as string;
  const body = await ctx.request.json() as Record<string, unknown>;
  const { action, scores, suggestion, decision, grade } = body as {
    action: "save" | "submit" | "approve" | "reject";
    scores?: Record<number, number>;
    suggestion?: string; decision?: string; grade?: string; note?: string;
  };

  const ev = await ctx.env.HR_DB.prepare(`
    SELECT ev.*, e.division_id, e.department_id FROM evaluations ev
    JOIN employees e ON e.id = ev.employee_id
    WHERE ev.id = ?
  `).bind(id).first<{ status: string; employee_id: number; division_id: number; department_id: number }>();
  if (!ev) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  // Scope check
  if (user.role === "head" && user.scope_department_id && ev.department_id !== user.scope_department_id) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (["deputy", "deputyHR"].includes(user.role) && user.scope_division_id && ev.division_id !== user.scope_division_id) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  if (action === "save" || action === "submit") {
    if (!["hr", "head", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
    const { signer_employee, signer_head, signer_hr, signer_director } = body as {
      signer_employee?: string; signer_head?: string; signer_hr?: string; signer_director?: string;
    };
    if (scores) {
      for (const [topicId, score] of Object.entries(scores)) {
        await ctx.env.HR_DB.prepare(
          "INSERT INTO evaluation_scores (evaluation_id, topic_id, score) VALUES (?,?,?) ON CONFLICT(evaluation_id,topic_id) DO UPDATE SET score=excluded.score"
        ).bind(id, Number(topicId), score).run();
      }
    }
    const total = scores ? Object.values(scores).reduce((a, b) => a + (b as number), 0) : null;
    const newStatus = action === "submit" ? "pending_deputy" : "draft";
    // Track which role filled which part
    const headUserId = ["head", "admin"].includes(user.role) ? user.id : null;
    const hrUserId   = ["hr",   "admin"].includes(user.role) ? user.id : null;
    await ctx.env.HR_DB.prepare(`
      UPDATE evaluations SET status=?, suggestion=?, decision=?, grade=?, total_score=?,
        head_user_id=COALESCE(?,head_user_id), hr_user_id=COALESCE(?,hr_user_id),
        signer_employee=?, signer_head=?, signer_hr=?, signer_director=?,
        updated_at=datetime('now') WHERE id=?
    `).bind(newStatus, suggestion ?? null, decision ?? null, grade ?? null, total,
            headUserId, hrUserId,
            signer_employee ?? null, signer_head ?? null, signer_hr ?? null, signer_director ?? null,
            id).run();
    if (action === "submit") {
      await ctx.env.HR_DB.prepare(
        "INSERT INTO evaluation_approvals (evaluation_id, step, approver_user_id, status) VALUES (?,?,?,?)"
      ).bind(id, "head", user.id, "approved").run();
      await ctx.env.HR_DB.prepare(
        "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'eval','submit_eval','evaluation',?)"
      ).bind(user.id, user.full_name, id).run();
    }
    return Response.json({ ok: true });
  }

  if (action === "approve" || action === "reject") {
    if (!["deputy", "deputyHR", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
    if (ev.status !== "pending_deputy") return Response.json({ ok: false, error: "ไม่อยู่ในสถานะรออนุมัติ" }, { status: 409 });

    const note = (body as { note?: string }).note ?? null;
    const newStatus = action === "approve" ? "approved" : "rejected";
    await ctx.env.HR_DB.prepare("UPDATE evaluations SET status=?, updated_at=datetime('now') WHERE id=?").bind(newStatus, id).run();
    await ctx.env.HR_DB.prepare(
      "INSERT INTO evaluation_approvals (evaluation_id, step, approver_user_id, status, note) VALUES (?,?,?,?,?)"
    ).bind(id, "deputy", user.id, action === "approve" ? "approved" : "rejected", note).run();
    await ctx.env.HR_DB.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'eval',?,?,?,?)"
    ).bind(user.id, user.full_name, `${action}_eval`, "evaluation", id, note).run();
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
};
