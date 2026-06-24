import type { Env } from "../../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../../lib/auth";

const DOC_CODE = "FM-HRD-01-04 Rev 02";

// POST /api/eval/print/:id
// — Assigns running number on first print, logs every print event
// — Returns full evaluation data for PDF generation
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
    if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["hr", "admin", "deputyHR"].includes(user.role))
      return Response.json({ ok: false, error: "เฉพาะ HR และ Admin เท่านั้น" }, { status: 403 });

    const id = ctx.params.id as string;
    const db = ctx.env.HR_DB;

    const ev = await db.prepare(`
      SELECT ev.*,
             e.full_name, e.emp_code, e.position, e.start_date,
             d.name AS department_name, dv.name AS division_name,
             e.division_id, e.department_id, e.id AS employee_id_num
      FROM evaluations ev
      JOIN employees e ON e.id = ev.employee_id
      LEFT JOIN departments d  ON d.id  = e.department_id
      LEFT JOIN divisions   dv ON dv.id = e.division_id
      WHERE ev.id = ?
    `).bind(id).first<Record<string, unknown>>();

    if (!ev)
      return Response.json({ ok: false, error: "ไม่พบใบประเมิน" }, { status: 404 });
    if (ev.status !== "approved")
      return Response.json({ ok: false, error: "ใบประเมินยังไม่ได้รับการอนุมัติ" }, { status: 400 });

    let runningNo = ev.running_no as string | null;
    let docCode   = ev.document_code as string | null;

    // ── Assign running number on first print only ─────────────────────
    if (!runningNo) {
      const year = new Date().getFullYear();

      await db.prepare(
        "INSERT INTO doc_running_no (year, seq) VALUES (?,1) ON CONFLICT(year) DO UPDATE SET seq=seq+1"
      ).bind(year).run();

      const seqRow = await db.prepare(
        "SELECT seq FROM doc_running_no WHERE year=?"
      ).bind(year).first<{ seq: number }>();

      const seq = seqRow?.seq ?? 1;
      runningNo  = `${year}-${String(seq).padStart(6, "0")}`;
      docCode    = DOC_CODE;

      await db.prepare(`
        UPDATE evaluations
        SET document_code=?, running_no=?, printed_at=datetime('now'),
            printed_by=?, print_count=1
        WHERE id=?
      `).bind(docCode, runningNo, user.id, id).run();
    } else {
      await db.prepare(`
        UPDATE evaluations
        SET printed_at=datetime('now'),
            print_count=COALESCE(print_count,0)+1
        WHERE id=?
      `).bind(id).run();
    }

    const updatedEv = await db.prepare(
      "SELECT print_count FROM evaluations WHERE id=?"
    ).bind(id).first<{ print_count: number }>();
    const printCount = updatedEv?.print_count ?? 1;

    // ── Log every print event ─────────────────────────────────────────
    const docNumber = `${docCode} / ${runningNo}`;
    try {
      await db.prepare(`
        INSERT INTO eval_print_log
          (evaluation_id, document_no, employee_id, printed_by, printer_name, print_count)
        VALUES (?,?,?,?,?,?)
      `).bind(id, docNumber, ev.employee_id_num, user.id, user.full_name, printCount).run();
    } catch { /* ignore if table missing */ }

    try {
      await db.prepare(
        "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'eval','print_eval','evaluation',?,?)"
      ).bind(user.id, user.full_name, id, docNumber).run();
    } catch { /* ignore */ }

    // ── Scores ───────────────────────────────────────────────────────
    const scores = await db.prepare(`
      SELECT es.topic_id, es.score, et.text, et.owner, et.sort_order
      FROM evaluation_scores es
      JOIN eval_topics et ON et.id = es.topic_id
      WHERE es.evaluation_id = ?
      ORDER BY et.sort_order
    `).bind(id).all<{ topic_id: number; score: number; text: string; owner: string; sort_order: number }>();

    // ── Training summary for this employee ────────────────────────────
    let training = { course_count: 0, passed_courses: 0 };
    try {
      const tr = await db.prepare(`
        SELECT COUNT(*) AS course_count,
               SUM(CASE WHEN ta.result='ผ่าน' THEN 1 ELSE 0 END) AS passed_courses
        FROM training_attendees ta
        WHERE ta.employee_id = ?
      `).bind(ev.employee_id_num).first<{ course_count: number; passed_courses: number }>();
      if (tr) training = { course_count: tr.course_count ?? 0, passed_courses: tr.passed_courses ?? 0 };
    } catch { /* ignore */ }

    // ── Approvals ─────────────────────────────────────────────────────
    const approvals = await db.prepare(`
      SELECT ea.step, ea.status, ea.note, ea.created_at, u.full_name AS approver_name
      FROM evaluation_approvals ea
      LEFT JOIN users u ON u.id = ea.approver_user_id
      WHERE ea.evaluation_id = ?
      ORDER BY ea.created_at
    `).bind(id).all();

    return Response.json({
      ok: true,
      document_no: docNumber,
      running_no: runningNo,
      document_code: docCode,
      print_count: printCount,
      is_copy: printCount > 1,
      printed_by_name: user.full_name,
      evaluation: ev,
      scores: scores.results,
      approvals: approvals.results,
      training,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
};
