// Shared helpers for the annual performance evaluation module (kept separate
// from the probation eval module — see migrations/0025_annual_eval.sql).

export type AnnualEvalStep = "self" | "head" | "deputy" | "quality" | "hr" | "director" | "summary";
export type AnnualEvalStatus =
  | "not_started" | "pending_self" | "pending_head" | "pending_deputy" | "pending_quality"
  | "pending_hr" | "pending_director" | "pending_summary" | "completed" | "returned" | "cancelled";

const STEP_TO_STATUS: Record<AnnualEvalStep, AnnualEvalStatus> = {
  self: "pending_self", head: "pending_head", deputy: "pending_deputy",
  quality: "pending_quality", hr: "pending_hr", director: "pending_director",
  summary: "pending_summary",
};

export function statusForStep(step: AnnualEvalStep): AnnualEvalStatus {
  return STEP_TO_STATUS[step];
}

// Which rater_role submits at a given workflow step (self/head/deputy/quality/hr/director
// map 1:1 to rater_role values used in annual_eval_item_scores; "summary" has no rater).
export function raterRoleForStep(step: AnnualEvalStep): string | null {
  return step === "summary" ? null : step;
}

export function levelGroupForJobLevel(jobLevel: number): "1" | "2-3" | "4" | null {
  if (jobLevel === 1) return "1";
  if (jobLevel === 2 || jobLevel === 3) return "2-3";
  if (jobLevel === 4) return "4";
  return null;
}

// Returns the next step after `current` in the template's workflow, or null if `current`
// is the last step (i.e. the evaluation should move to "completed" instead).
export function nextStep(steps: AnnualEvalStep[], current: AnnualEvalStep): AnnualEvalStep | null {
  const idx = steps.indexOf(current);
  if (idx === -1 || idx === steps.length - 1) return null;
  return steps[idx + 1];
}

export function firstStep(steps: AnnualEvalStep[]): AnnualEvalStep {
  return steps[0];
}

const GRADE_BANDS: { min: number; grade: string }[] = [
  { min: 20, grade: "A" }, { min: 18, grade: "B+" }, { min: 16, grade: "B" },
  { min: 14, grade: "C+" }, { min: 12, grade: "C" }, { min: -Infinity, grade: "D" },
];

// Grade from the final weighted score (out of 20). No rounding — banded on the raw value,
// per spec ("ห้ามใช้การปัดเศษเพื่อเปลี่ยนเกรด").
export function gradeFromScore(score20: number): string {
  for (const b of GRADE_BANDS) if (score20 >= b.min) return b.grade;
  return "D";
}

export interface NotifyTarget { target_user_id?: number; target_role?: string; }

// Resolve who should be notified that it's their turn for a given workflow step, for an
// employee in the given department/division. head/deputy are scoped roles (matches the
// same scope_department_id/scope_division_id routing used by the probation eval module);
// quality/director are resolved via the annual_eval_roles settings table; hr is a broadcast
// to the hr role (matches the existing notifications.target_role pattern).
export async function resolveStepNotifyTargets(
  db: D1Database, step: AnnualEvalStep, departmentId: number | null, divisionId: number | null,
): Promise<NotifyTarget[]> {
  if (step === "head") {
    if (!departmentId) return [];
    const rows = await db.prepare(
      "SELECT id FROM users WHERE is_active = 1 AND scope_department_id = ? AND (role = 'head' OR role_2 = 'head' OR role_3 = 'head')"
    ).bind(departmentId).all<{ id: number }>();
    return (rows.results ?? []).map(r => ({ target_user_id: r.id }));
  }
  if (step === "deputy") {
    if (!divisionId) return [];
    const rows = await db.prepare(
      "SELECT id FROM users WHERE is_active = 1 AND scope_division_id = ? AND (role = 'deputy' OR role_2 = 'deputy' OR role_3 = 'deputy')"
    ).bind(divisionId).all<{ id: number }>();
    return (rows.results ?? []).map(r => ({ target_user_id: r.id }));
  }
  if (step === "quality" || step === "director") {
    const roleKey = step === "quality" ? "quality_head" : "director";
    const row = await db.prepare("SELECT user_id FROM annual_eval_roles WHERE role_key = ?").bind(roleKey).first<{ user_id: number | null }>();
    return row?.user_id ? [{ target_user_id: row.user_id }] : [];
  }
  if (step === "hr" || step === "summary") {
    return [{ target_role: "hr" }];
  }
  return [];
}
