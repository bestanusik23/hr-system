import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser, hasRole } from "../../lib/auth";

interface CategoryRow {
  id: number; template_id: number; name: string; weight_points: number;
  rater_roles_json: string; sort_order: number;
}
interface ItemRow { id: number; category_id: number; text: string; sort_order: number; }
interface TemplateRow {
  id: number; level_group: string; version: number; label: string;
  workflow_steps_json: string; is_active: number; created_by: string | null; created_at: string;
}

// GET /api/annual-eval/templates — active templates (or ?all=1 for every version, admin only), with categories+items nested
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(ctx.request.url);
  const wantAll = url.searchParams.get("all") === "1";
  if (wantAll && !hasRole(user, "hr", "deputyHR", "admin")) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const db = ctx.env.HR_DB;
  const templates = await db.prepare(
    wantAll
      ? "SELECT * FROM annual_eval_templates ORDER BY level_group, version DESC"
      : "SELECT * FROM annual_eval_templates WHERE is_active = 1 ORDER BY level_group"
  ).all<TemplateRow>();

  const [categories, items] = await Promise.all([
    db.prepare("SELECT * FROM annual_eval_categories ORDER BY template_id, sort_order").all<CategoryRow>(),
    db.prepare(`SELECT i.* FROM annual_eval_items i
                JOIN annual_eval_categories c ON c.id = i.category_id
                ORDER BY i.category_id, i.sort_order`).all<ItemRow>(),
  ]);

  const itemsByCat = new Map<number, ItemRow[]>();
  for (const it of items.results ?? []) {
    if (!itemsByCat.has(it.category_id)) itemsByCat.set(it.category_id, []);
    itemsByCat.get(it.category_id)!.push(it);
  }
  const catsByTemplate = new Map<number, (CategoryRow & { rater_roles: string[]; items: ItemRow[] })[]>();
  for (const c of categories.results ?? []) {
    if (!catsByTemplate.has(c.template_id)) catsByTemplate.set(c.template_id, []);
    catsByTemplate.get(c.template_id)!.push({
      ...c, rater_roles: JSON.parse(c.rater_roles_json) as string[], items: itemsByCat.get(c.id) ?? [],
    });
  }

  const out = (templates.results ?? []).map(t => ({
    ...t, workflow_steps: JSON.parse(t.workflow_steps_json) as string[],
    categories: catsByTemplate.get(t.id) ?? [],
  }));

  return Response.json({ ok: true, templates: out });
};

// POST /api/annual-eval/templates — create a new version for a level_group, deactivating the previous one.
// Categories/items must be created afresh under the new version (no in-place edits to an
// already-used template — versioning per the spec so open rounds keep their original criteria).
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!hasRole(user, "hr", "deputyHR", "admin")) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => null) as {
    level_group?: string; label?: string; workflow_steps?: string[];
    categories?: { name: string; weight_points: number; rater_roles: string[]; sort_order: number;
                    items: { text: string; sort_order: number }[] }[];
  } | null;

  if (!body?.level_group || !["1", "2-3", "4"].includes(body.level_group)) {
    return Response.json({ ok: false, error: "level_group ไม่ถูกต้อง" }, { status: 400 });
  }
  if (!body.label?.trim() || !Array.isArray(body.workflow_steps) || body.workflow_steps.length === 0) {
    return Response.json({ ok: false, error: "กรุณาระบุชื่อแบบประเมินและลำดับ workflow" }, { status: 400 });
  }
  if (!Array.isArray(body.categories) || body.categories.length === 0) {
    return Response.json({ ok: false, error: "กรุณาระบุหมวดการประเมินอย่างน้อย 1 หมวด" }, { status: 400 });
  }
  const totalWeight = body.categories.reduce((s, c) => s + Number(c.weight_points || 0), 0);
  if (Math.abs(totalWeight - 100) > 0.01) {
    return Response.json({ ok: false, error: `น้ำหนักรวมต้องเท่ากับ 100 (ปัจจุบัน ${totalWeight})` }, { status: 400 });
  }

  const db = ctx.env.HR_DB;
  const prevVersion = await db.prepare(
    "SELECT MAX(version) AS v FROM annual_eval_templates WHERE level_group = ?"
  ).bind(body.level_group).first<{ v: number | null }>();
  const nextVersion = (prevVersion?.v ?? 0) + 1;

  await db.prepare("UPDATE annual_eval_templates SET is_active = 0 WHERE level_group = ? AND is_active = 1")
    .bind(body.level_group).run();

  const tmplResult = await db.prepare(
    "INSERT INTO annual_eval_templates (level_group, version, label, workflow_steps_json, is_active, created_by) VALUES (?, ?, ?, ?, 1, ?)"
  ).bind(body.level_group, nextVersion, body.label.trim(), JSON.stringify(body.workflow_steps), user.full_name).run();
  const templateId = tmplResult.meta.last_row_id as number;

  for (const cat of body.categories) {
    const catResult = await db.prepare(
      "INSERT INTO annual_eval_categories (template_id, name, weight_points, rater_roles_json, sort_order) VALUES (?, ?, ?, ?, ?)"
    ).bind(templateId, cat.name, cat.weight_points, JSON.stringify(cat.rater_roles ?? []), cat.sort_order).run();
    const categoryId = catResult.meta.last_row_id as number;
    for (const item of cat.items ?? []) {
      await db.prepare("INSERT INTO annual_eval_items (category_id, text, sort_order) VALUES (?, ?, ?)")
        .bind(categoryId, item.text, item.sort_order).run();
    }
  }

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id, detail) VALUES (?,?,'annual_eval','create_template','annual_eval_template',?,?)"
    ).bind(user.id, user.full_name, templateId, `${body.level_group} v${nextVersion}`).run();
  } catch { /* non-critical */ }

  return Response.json({ ok: true, id: templateId, version: nextVersion }, { status: 201 });
};
