import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/exec/summary  — aggregated KPIs for executive dashboard
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "deputy", "deputyHR", "admin"].includes(user.role)) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const db = ctx.env.HR_DB;

  // Employee stats
  const empTotal    = await db.prepare("SELECT COUNT(*) AS n FROM employees WHERE emp_status != 'resigned'").first<{ n: number }>();
  const empProb     = await db.prepare("SELECT COUNT(*) AS n FROM employees WHERE emp_status = 'probation'").first<{ n: number }>();
  const empPassed   = await db.prepare("SELECT COUNT(*) AS n FROM employees WHERE emp_status = 'passed'").first<{ n: number }>();
  const empResigned = await db.prepare("SELECT COUNT(*) AS n FROM employees WHERE emp_status = 'resigned'").first<{ n: number }>();
  const empDue      = await db.prepare(`
    SELECT COUNT(*) AS n FROM employees e
    WHERE e.emp_status = 'probation'
      AND julianday('now') - julianday(e.start_date) >= 85
      AND NOT EXISTS (SELECT 1 FROM evaluations ev WHERE ev.employee_id = e.id)
  `).first<{ n: number }>();

  // Eval stats
  const evalTotal    = await db.prepare("SELECT COUNT(*) AS n FROM evaluations").first<{ n: number }>();
  const evalPending  = await db.prepare("SELECT COUNT(*) AS n FROM evaluations WHERE status = 'pending_deputy'").first<{ n: number }>();
  const evalApproved = await db.prepare("SELECT COUNT(*) AS n FROM evaluations WHERE status = 'approved'").first<{ n: number }>();
  const evalRejected = await db.prepare("SELECT COUNT(*) AS n FROM evaluations WHERE status = 'rejected'").first<{ n: number }>();
  const grades       = await db.prepare(
    "SELECT grade, COUNT(*) AS n FROM evaluations WHERE status = 'approved' GROUP BY grade ORDER BY grade"
  ).all<{ grade: string; n: number }>();
  const evalByDiv    = await db.prepare(`
    SELECT d.name AS division, ROUND(AVG(ev.total_score), 1) AS avg_score, COUNT(*) AS count
    FROM evaluations ev
    JOIN employees e ON e.id = ev.employee_id
    LEFT JOIN departments dept ON dept.id = e.department_id
    LEFT JOIN divisions d ON d.id = dept.division_id
    WHERE ev.status = 'approved'
    GROUP BY d.id ORDER BY avg_score DESC
  `).all<{ division: string; avg_score: number; count: number }>();

  // Transfer stats
  const transferTotal     = await db.prepare("SELECT COUNT(*) AS n FROM transfer_requests").first<{ n: number }>();
  const transferPending   = await db.prepare("SELECT COUNT(*) AS n FROM transfer_requests WHERE overall_status IN ('submitted','head_approved')").first<{ n: number }>();
  const transferCompleted = await db.prepare("SELECT COUNT(*) AS n FROM transfer_requests WHERE overall_status = 'completed'").first<{ n: number }>();
  const transferRejected  = await db.prepare("SELECT COUNT(*) AS n FROM transfer_requests WHERE overall_status = 'rejected'").first<{ n: number }>();

  // Training stats
  const trainingTotal  = await db.prepare("SELECT COUNT(*) AS n FROM training_courses WHERE COALESCE(is_cancelled,0)=0").first<{ n: number }>();
  const trainingDone   = await db.prepare("SELECT COUNT(*) AS n FROM training_courses WHERE status='done' AND COALESCE(is_cancelled,0)=0").first<{ n: number }>();
  const trainingTarget = await db.prepare("SELECT COALESCE(SUM(target),0) AS n FROM training_courses WHERE COALESCE(is_cancelled,0)=0").first<{ n: number }>();
  const trainingActual = await db.prepare("SELECT COUNT(*) AS n FROM training_attendees WHERE participant_type='attendee'").first<{ n: number }>();
  const trainingCerts  = await db.prepare("SELECT COUNT(*) AS n FROM training_certificates").first<{ n: number }>();

  // Training satisfaction (from survey table)
  const surveyRow = await db.prepare(
    "SELECT ROUND(AVG((q1+q2+q3+q4+q5)*5.0),1) AS avg_pct, COUNT(*) AS total FROM training_surveys"
  ).first<{ avg_pct: number | null; total: number }>();

  // User stats
  const usersTotal    = await db.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  const usersActive   = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_active=1").first<{ n: number }>();
  const usersAdmin    = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").first<{ n: number }>();
  const usersNewMonth = await db.prepare(
    "SELECT COUNT(*) AS n FROM users WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')"
  ).first<{ n: number }>();

  // Recent activity (last 10)
  const activity = await db.prepare(
    "SELECT actor_name, module, action, created_at FROM activity_log ORDER BY created_at DESC LIMIT 10"
  ).all<{ actor_name: string; module: string; action: string; created_at: string }>();

  return Response.json({
    ok: true,
    employees: {
      total: empTotal?.n ?? 0, probation: empProb?.n ?? 0,
      passed: empPassed?.n ?? 0, resigned: empResigned?.n ?? 0,
      due_eval: empDue?.n ?? 0,
    },
    evaluations: {
      total: evalTotal?.n ?? 0, pending: evalPending?.n ?? 0,
      approved: evalApproved?.n ?? 0, rejected: evalRejected?.n ?? 0,
      grades: grades.results, by_division: evalByDiv.results,
    },
    transfers: {
      total: transferTotal?.n ?? 0, pending: transferPending?.n ?? 0,
      completed: transferCompleted?.n ?? 0, rejected: transferRejected?.n ?? 0,
    },
    training: {
      total: trainingTotal?.n ?? 0, done: trainingDone?.n ?? 0,
      target: trainingTarget?.n ?? 0, actual: trainingActual?.n ?? 0,
      cert_count: trainingCerts?.n ?? 0,
      satisfaction_avg: surveyRow?.avg_pct ?? null,
      total_responses: surveyRow?.total ?? 0,
    },
    users: {
      total: usersTotal?.n ?? 0,
      active: usersActive?.n ?? 0,
      inactive: (usersTotal?.n ?? 0) - (usersActive?.n ?? 0),
      admin_count: usersAdmin?.n ?? 0,
      new_this_month: usersNewMonth?.n ?? 0,
    },
    recent_activity: activity.results,
  });
};
