import type { Env } from "../../../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../../../lib/auth";

interface Overrides {
  name?: string; position?: string; from_dept_name?: string; to_dept_name?: string;
  new_position?: string; reason?: string;
  source_head_name?: string; dest_head_name?: string; deputyhr_name?: string;
}

// POST /api/transfer/requests/:id/print — assigns a running document number on first
// print (own counter, separate from eval/annual-eval numbering), logs the print event,
// returns everything the print template needs. Accepts an optional `overrides` object
// (print-time text corrections only — never written back to the stored request, same
// pattern as the certificate template's editable text) so an approver can fix a typo or
// fill in a name the audit trail is missing before generating the PDF.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "deputyHR", "admin"].includes(user.role)) {
    return Response.json({ ok: false, error: "เฉพาะ HR และ Admin เท่านั้น" }, { status: 403 });
  }

  const id = ctx.params.id as string;
  const db = ctx.env.HR_DB;
  const body = await ctx.request.json().catch(() => ({})) as { overrides?: Overrides };
  const ov = body.overrides ?? {};

  const req = await db.prepare(`
    SELECT tr.*, fd.name AS from_division_name, td.name AS to_division_name
    FROM transfer_requests tr
    LEFT JOIN departments fdept ON fdept.id = tr.from_department_id
    LEFT JOIN divisions fd ON fd.id = fdept.division_id
    LEFT JOIN divisions td ON td.id = tr.to_division_id
    WHERE tr.id = ?
  `).bind(id).first<Record<string, unknown>>();
  if (!req) return Response.json({ ok: false, error: "ไม่พบคำขอนี้" }, { status: 404 });

  let runningNo = req.running_no as string | null;
  let docCode = req.document_code as string | null;

  if (!runningNo) {
    const year = new Date().getFullYear();
    await db.prepare(
      "INSERT INTO transfer_doc_running_no (year, seq) VALUES (?, 1) ON CONFLICT(year) DO UPDATE SET seq = seq + 1"
    ).bind(year).run();
    const seqRow = await db.prepare("SELECT seq FROM transfer_doc_running_no WHERE year = ?").bind(year).first<{ seq: number }>();
    const seq = seqRow?.seq ?? 1;
    runningNo = `TRF-${year}-${String(seq).padStart(6, "0")}`;
    docCode = "FM-HRD-01-10";
    await db.prepare(`
      UPDATE transfer_requests SET document_code = ?, running_no = ?, printed_at = datetime('now'), printed_by = ?, print_count = 1
      WHERE id = ?
    `).bind(docCode, runningNo, user.full_name, id).run();
  } else {
    await db.prepare(
      "UPDATE transfer_requests SET printed_at = datetime('now'), print_count = print_count + 1 WHERE id = ?"
    ).bind(id).run();
  }

  const countRow = await db.prepare("SELECT print_count FROM transfer_requests WHERE id = ?").bind(id).first<{ print_count: number }>();
  const printCount = countRow?.print_count ?? 1;
  const documentNo = `${docCode} / ${runningNo}`;

  const approvalsRes = await db.prepare(`
    SELECT ta.step, ta.status, ta.note, ta.created_at, u.full_name AS approver_name, u.role_title AS approver_title
    FROM transfer_approvals ta LEFT JOIN users u ON u.id = ta.approver_user_id
    WHERE ta.request_id = ? ORDER BY ta.created_at
  `).bind(id).all<{ step: string; status: string; approver_name: string | null }>();
  const approvals = approvalsRes.results ?? [];

  const requester = req.requester_user_id
    ? await db.prepare("SELECT full_name, role_title FROM users WHERE id = ?").bind(req.requester_user_id).first<{ full_name: string; role_title: string | null }>()
    : null;

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'transfer','print','transfer_request',?,?)"
    ).bind(user.id, user.full_name, id, documentNo).run();
  } catch { /* non-critical */ }

  // Merge print-time overrides into the request fields (never persisted).
  const printedReq = {
    ...req,
    name: ov.name ?? req.name,
    position: ov.position ?? req.position,
    from_dept_name: ov.from_dept_name ?? req.from_dept_name,
    to_dept_name: ov.to_dept_name ?? req.to_dept_name,
    new_position: ov.new_position ?? req.new_position,
    reason: ov.reason ?? req.reason,
  };

  // Best-available signer name per role: audit-log approver (most authoritative) → override → blank.
  const destHeadApproved = approvals.find(a => a.step === "dest_head" && a.status === "approved")?.approver_name;
  const deputyHRApproved = approvals.find(a => a.step === "deputyhr" && a.status === "approved")?.approver_name;
  const signers = {
    source_head_name: ov.source_head_name ?? requester?.full_name ?? "",
    dest_head_name: destHeadApproved ?? ov.dest_head_name ?? "",
    deputyhr_name: deputyHRApproved ?? ov.deputyhr_name ?? "",
  };

  return Response.json({
    ok: true, document_no: documentNo, print_count: printCount, is_copy: printCount > 1,
    printed_by_name: user.full_name, request: printedReq, approvals, requester, signers,
  });
};
