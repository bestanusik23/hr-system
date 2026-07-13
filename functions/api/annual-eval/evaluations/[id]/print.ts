import type { Env } from "../../../../lib/types";
import { getTokenFromCookie, getSessionUser, hasRole } from "../../../../lib/auth";
import { computeFinalScore } from "../../../../lib/annualEval";

const DOC_CODE = "FM-HR-01-28";

// POST /api/annual-eval/evaluations/:id/print — assigns a running document number on first
// print (separate counter from the probation-eval module, per the "keep data separate" spec),
// logs every print event, returns everything the print template needs in one call.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!hasRole(user, "hr", "deputyHR", "admin")) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = Number(ctx.params.id);
  const db = ctx.env.HR_DB;

  const ev = await db.prepare(`
    SELECT ae.*, r.name AS round_name, r.year_be
    FROM annual_evaluations ae JOIN annual_eval_rounds r ON r.id = ae.round_id
    WHERE ae.id = ?
  `).bind(id).first<Record<string, unknown>>();
  if (!ev) return Response.json({ ok: false, error: "ไม่พบใบประเมินนี้" }, { status: 404 });
  if (ev.status !== "completed") {
    return Response.json({ ok: false, error: "พิมพ์ได้เฉพาะใบประเมินที่เสร็จสมบูรณ์แล้ว" }, { status: 400 });
  }

  let runningNo = ev.running_no as string | null;
  let docCode = ev.document_code as string | null;

  if (!runningNo) {
    const year = new Date().getFullYear();
    await db.prepare(
      "INSERT INTO annual_eval_doc_running_no (year, seq) VALUES (?, 1) ON CONFLICT(year) DO UPDATE SET seq = seq + 1"
    ).bind(year).run();
    const seqRow = await db.prepare("SELECT seq FROM annual_eval_doc_running_no WHERE year = ?").bind(year).first<{ seq: number }>();
    const seq = seqRow?.seq ?? 1;
    runningNo = `${year}-${String(seq).padStart(6, "0")}`;
    docCode = DOC_CODE;
    await db.prepare(`
      UPDATE annual_evaluations SET document_code = ?, running_no = ?, printed_at = datetime('now'), printed_by = ?, print_count = 1
      WHERE id = ?
    `).bind(docCode, runningNo, user.full_name, id).run();
  } else {
    await db.prepare(
      "UPDATE annual_evaluations SET printed_at = datetime('now'), print_count = print_count + 1 WHERE id = ?"
    ).bind(id).run();
  }

  const countRow = await db.prepare("SELECT print_count FROM annual_evaluations WHERE id = ?").bind(id).first<{ print_count: number }>();
  const printCount = countRow?.print_count ?? 1;
  const documentNo = `${docCode} / ${runningNo}`;

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'annual_eval','print','annual_evaluation',?,?)"
    ).bind(user.id, user.full_name, id, documentNo).run();
  } catch { /* non-critical */ }

  const [template, categories, items, scores, stats, comments] = await Promise.all([
    db.prepare("SELECT * FROM annual_eval_templates WHERE id = ?").bind(ev.template_id).first(),
    db.prepare("SELECT * FROM annual_eval_categories WHERE template_id = ? ORDER BY sort_order").bind(ev.template_id).all(),
    db.prepare(`SELECT i.* FROM annual_eval_items i JOIN annual_eval_categories c ON c.id = i.category_id
                WHERE c.template_id = ? ORDER BY i.category_id, i.sort_order`).bind(ev.template_id).all(),
    db.prepare("SELECT * FROM annual_eval_item_scores WHERE annual_evaluation_id = ? AND submitted_at IS NOT NULL").bind(id).all(),
    db.prepare("SELECT * FROM annual_eval_stats WHERE annual_evaluation_id = ?").bind(id).first(),
    db.prepare("SELECT * FROM annual_eval_comments WHERE annual_evaluation_id = ? ORDER BY source, item_order").bind(id).all(),
  ]);

  const scoreResult = await computeFinalScore(db, id, ev.template_id as number);

  return Response.json({
    ok: true, document_no: documentNo, running_no: runningNo, document_code: docCode,
    print_count: printCount, is_copy: printCount > 1, printed_by_name: user.full_name,
    evaluation: ev, template, categories: categories.results, items: items.results,
    scores: scores.results, stats, comments: comments.results, score_result: scoreResult,
  });
};
