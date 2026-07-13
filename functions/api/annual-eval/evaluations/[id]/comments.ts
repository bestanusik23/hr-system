import type { Env } from "../../../../lib/types";
import { getTokenFromCookie, getSessionUser, hasRole } from "../../../../lib/auth";
import { canActOnStep, type AnnualEvalStep } from "../../../../lib/annualEval";

const VALID_SOURCES = [
  "head_strength", "head_development", "deputy_strength", "deputy_development",
  "director_comment", "hr_comment", "next_year_kpi", "dev_plan", "training_recommend",
] as const;
type Source = typeof VALID_SOURCES[number];

// Which workflow step is allowed to write each comment source (hr/deputyHR/admin can always
// override — matches their broad edit rights elsewhere in the workflow).
const SOURCE_STEP: Record<Source, AnnualEvalStep> = {
  head_strength: "head", head_development: "head",
  deputy_strength: "deputy", deputy_development: "deputy",
  director_comment: "director",
  hr_comment: "hr", next_year_kpi: "hr", dev_plan: "hr", training_recommend: "hr",
};

// PUT /api/annual-eval/evaluations/:id/comments — replace all items for one source
// (จุดแข็ง / สิ่งที่ต้องพัฒนา / แผนพัฒนา / ตัวชี้วัดปีถัดไป / ความเห็น HR — each supports
// multiple items, per spec "รองรับการเพิ่มรายการมากกว่า 3 ข้อได้").
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = Number(ctx.params.id);
  const db = ctx.env.HR_DB;
  const body = await ctx.request.json().catch(() => null) as { source?: string; items?: string[] } | null;
  const source = body?.source as Source | undefined;
  if (!source || !VALID_SOURCES.includes(source)) {
    return Response.json({ ok: false, error: "source ไม่ถูกต้อง" }, { status: 400 });
  }
  const items = (body?.items ?? []).map(t => t.trim()).filter(Boolean);

  const ev = await db.prepare(`
    SELECT ae.id, ae.status, e.department_id, e.division_id FROM annual_evaluations ae
    JOIN employees e ON e.id = ae.employee_id WHERE ae.id = ?
  `).bind(id).first<{ id: number; status: string; department_id: number | null; division_id: number | null }>();
  if (!ev) return Response.json({ ok: false, error: "ไม่พบใบประเมินนี้" }, { status: 404 });
  if (["completed", "cancelled"].includes(ev.status)) {
    return Response.json({ ok: false, error: "ใบประเมินนี้ปิดแล้ว ไม่สามารถแก้ไขได้" }, { status: 400 });
  }

  const requiredStep = SOURCE_STEP[source];
  const allowed = hasRole(user, "hr", "deputyHR", "admin") || (await canActOnStep(db, user, requiredStep, ev.department_id, ev.division_id));
  if (!allowed) return Response.json({ ok: false, error: "คุณไม่มีสิทธิ์แก้ไขความเห็นนี้" }, { status: 403 });

  const statements = [db.prepare("DELETE FROM annual_eval_comments WHERE annual_evaluation_id = ? AND source = ?").bind(id, source)];
  items.forEach((text, i) => {
    statements.push(db.prepare(
      "INSERT INTO annual_eval_comments (annual_evaluation_id, source, item_order, text, updated_by) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, source, i + 1, text, user.full_name));
  });
  await db.batch(statements);

  return Response.json({ ok: true });
};
