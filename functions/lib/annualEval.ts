// Shared helpers for the annual performance evaluation module (kept separate
// from the probation eval module — see migrations/0025_annual_eval.sql).
import type { SessionUser } from "./auth";
import { hasRole } from "./auth";

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

// Reverse of statusForStep — null for statuses that aren't "waiting on a step" (not_started,
// completed, cancelled). "returned" is intentionally not reversible this way — the caller must
// track which step a return targets via the evaluation's own status (we reuse pending_X for that).
export function stepForStatus(status: AnnualEvalStatus): AnnualEvalStep | null {
  const entry = (Object.entries(STEP_TO_STATUS) as [AnnualEvalStep, AnnualEvalStatus][])
    .find(([, s]) => s === status);
  return entry ? entry[0] : null;
}

// Maps a workflow step to the rater_role value used in annual_eval_item_scores /
// annual_eval_categories.rater_roles_json / annual_eval_roles.role_key. Most steps map
// 1:1 by name, but "quality" (the step/status name — matches the DB's pending_quality
// status) corresponds to rater_role "quality_head" (matches annual_eval_roles.role_key).
// "summary" has no rater — it's a computed rollup, not a scored step.
const STEP_TO_RATER_ROLE: Partial<Record<AnnualEvalStep, string>> = {
  head: "head", deputy: "deputy", quality: "quality_head", hr: "hr", director: "director",
};

export function raterRoleForStep(step: AnnualEvalStep): string | null {
  return STEP_TO_RATER_ROLE[step] ?? null;
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

// Can this user act as the rater for `step`, for an employee in the given department/division?
// admin always can (break-glass). hr/deputyHR act for the "hr" step (and can always finalize/
// return/cancel — that's checked separately by each route, not here).
export async function canActOnStep(
  db: D1Database, user: SessionUser, step: AnnualEvalStep, departmentId: number | null, divisionId: number | null,
): Promise<boolean> {
  if (hasRole(user, "admin")) return true;
  if (step === "head") return hasRole(user, "head") && user.scope_department_id === departmentId;
  if (step === "deputy") {
    if (!hasRole(user, "deputy")) return false;
    const divIds = [user.scope_division_id, user.scope_division_id_2, user.scope_division_id_3].filter(Boolean);
    return divIds.includes(divisionId);
  }
  if (step === "hr") return hasRole(user, "hr", "deputyHR");
  if (step === "quality" || step === "director") {
    const roleKey = step === "quality" ? "quality_head" : "director";
    const row = await db.prepare("SELECT user_id FROM annual_eval_roles WHERE role_key = ?").bind(roleKey).first<{ user_id: number | null }>();
    return row?.user_id === user.id;
  }
  return false;
}

interface CategoryForScoring {
  id: number; weight_points: number; rater_roles: string[]; item_ids: number[];
}

// Load the template's categories with their item ids and parsed rater_roles, for scoring.
export async function loadTemplateCategoriesForScoring(db: D1Database, templateId: number): Promise<CategoryForScoring[]> {
  const cats = await db.prepare(
    "SELECT id, weight_points, rater_roles_json FROM annual_eval_categories WHERE template_id = ?"
  ).bind(templateId).all<{ id: number; weight_points: number; rater_roles_json: string }>();
  const items = await db.prepare(`
    SELECT i.id, i.category_id FROM annual_eval_items i
    JOIN annual_eval_categories c ON c.id = i.category_id
    WHERE c.template_id = ?
  `).bind(templateId).all<{ id: number; category_id: number }>();

  const itemsByCategory = new Map<number, number[]>();
  for (const it of items.results ?? []) {
    if (!itemsByCategory.has(it.category_id)) itemsByCategory.set(it.category_id, []);
    itemsByCategory.get(it.category_id)!.push(it.id);
  }

  return (cats.results ?? []).map(c => ({
    id: c.id, weight_points: c.weight_points,
    rater_roles: JSON.parse(c.rater_roles_json) as string[],
    item_ids: itemsByCategory.get(c.id) ?? [],
  }));
}

export interface FinalScoreResult {
  total_raw_score: number; total_weighted_score: number; total_percent: number; grade: string;
  category_breakdown: { category_id: number; raw_by_rater: Record<string, number>; category_raw: number; category_weighted: number }[];
}

// Official final score — matches the original FM-HR-01-28 spreadsheet's exact formula:
// per category, average the RAW item-score sums of each assigned rater (no per-item
// normalization), then categoryWeighted = (categoryRaw * weight_points) / 100. The template's
// item counts are chosen so these sum to exactly 20 across all categories (verified against
// the source spreadsheet's actual cell formulas, not just its cached values).
export async function computeFinalScore(db: D1Database, evaluationId: number, templateId: number): Promise<FinalScoreResult> {
  const categories = await loadTemplateCategoriesForScoring(db, templateId);
  const scoreRows = await db.prepare(
    "SELECT item_id, rater_role, score FROM annual_eval_item_scores WHERE annual_evaluation_id = ? AND rater_role != 'self'"
  ).bind(evaluationId).all<{ item_id: number; rater_role: string; score: number | null }>();

  const scoreByItemRater = new Map<string, number>();
  for (const r of scoreRows.results ?? []) {
    if (r.score != null) scoreByItemRater.set(`${r.item_id}:${r.rater_role}`, r.score);
  }

  let totalRaw = 0;
  let totalWeighted = 0;
  const breakdown: FinalScoreResult["category_breakdown"] = [];

  for (const cat of categories) {
    const rawByRater: Record<string, number> = {};
    for (const role of cat.rater_roles) {
      let sum = 0;
      for (const itemId of cat.item_ids) sum += scoreByItemRater.get(`${itemId}:${role}`) ?? 0;
      rawByRater[role] = sum;
    }
    const raterValues = Object.values(rawByRater);
    const categoryRaw = raterValues.length > 0 ? raterValues.reduce((a, b) => a + b, 0) / raterValues.length : 0;
    const categoryWeighted = (categoryRaw * cat.weight_points) / 100;
    totalRaw += categoryRaw;
    totalWeighted += categoryWeighted;
    breakdown.push({ category_id: cat.id, raw_by_rater: rawByRater, category_raw: categoryRaw, category_weighted: categoryWeighted });
  }

  const total_weighted_score = Math.round(totalWeighted * 100) / 100;
  return {
    total_raw_score: Math.round(totalRaw * 100) / 100,
    total_weighted_score,
    total_percent: Math.round((total_weighted_score / 20) * 100 * 100) / 100,
    grade: gradeFromScore(total_weighted_score),
    category_breakdown: breakdown,
  };
}
