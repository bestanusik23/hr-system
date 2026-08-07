import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/manpower/plan — full plan rows ordered by sort_order
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rows = await ctx.env.HR_DB.prepare(
    `SELECT id, row_idx, type, name, pos, div_id, plan_qty, note, sort_order, is_active
     FROM manpower_plan WHERE is_active = 1 ORDER BY sort_order`
  ).all();

  return Response.json({ ok: true, plan: rows.results });
};

// POST /api/manpower/plan — add a new slot row under an existing section/subdept,
// so an ad-hoc position (an employee whose ตำแหน่ง isn't in the plan yet — shown
// as "ไม่มีในแผน" in ManpowerTable) can get a proper อัตรา (plan_qty) that then
// flows into Bar Management's Approved Bar via planMap.ts.
//
// sumPlanBySection() in planMap.ts attributes a slot's plan_qty to whichever
// section/subdept header row precedes it in sort_order — so the new row MUST be
// inserted right after the chosen section's last row (and before the next
// section/subdept/division header), not just appended at the end of the table.
// row_idx doubles as the array index the frontend uses to address rows (see
// ManpowerTable.tsx's _rowIdx), so every insert renumbers row_idx to match the
// post-insert sort_order sequence — done via a negative-scratch-space two-pass
// UPDATE so the UNIQUE(row_idx) constraint never collides mid-statement.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => ({})) as
    { pos?: string; div_id?: number; section_name?: string; plan_qty?: number; note?: string };

  const pos         = (body.pos ?? "").trim();
  const divId       = body.div_id;
  const sectionName = (body.section_name ?? "").trim();
  const planQty     = body.plan_qty;

  if (!pos) return Response.json({ ok: false, error: "ระบุตำแหน่ง" }, { status: 400 });
  if (typeof divId !== "number") return Response.json({ ok: false, error: "ระบุฝ่าย" }, { status: 400 });
  if (!sectionName) return Response.json({ ok: false, error: "ระบุแผนก/หมวดที่จะสังกัด" }, { status: 400 });
  if (typeof planQty !== "number" || !Number.isFinite(planQty) || planQty < 0)
    return Response.json({ ok: false, error: "อัตราต้องเป็นตัวเลขไม่ติดลบ" }, { status: 400 });

  const db = ctx.env.HR_DB;

  const header = await db.prepare(
    `SELECT sort_order FROM manpower_plan
     WHERE is_active = 1 AND div_id = ? AND name = ? AND type IN ('section','subdept') LIMIT 1`
  ).bind(divId, sectionName).first<{ sort_order: number }>();
  if (!header) return Response.json({ ok: false, error: "ไม่พบหมวดที่เลือกในฝ่ายนี้" }, { status: 404 });

  const nextHeader = await db.prepare(
    `SELECT MIN(sort_order) AS so FROM manpower_plan
     WHERE is_active = 1 AND sort_order > ? AND type IN ('division','subdept','section')`
  ).bind(header.sort_order).first<{ so: number | null }>();

  let insertSort = nextHeader?.so;
  if (insertSort == null) {
    const tail = await db.prepare(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS so FROM manpower_plan WHERE is_active = 1`
    ).first<{ so: number }>();
    insertSort = tail!.so;
  }

  await db.prepare(
    `UPDATE manpower_plan SET sort_order = sort_order + 1 WHERE is_active = 1 AND sort_order >= ?`
  ).bind(insertSort).run();

  const note = typeof body.note === "string" ? body.note : "";
  const actor = user.full_name ?? user.username ?? "";
  await db.prepare(`
    INSERT INTO manpower_plan (row_idx, type, name, pos, div_id, plan_qty, note, sort_order, is_active, updated_by)
    VALUES (-999999, 'slot', ?, ?, ?, ?, ?, ?, 1, ?)
  `).bind(pos, pos, divId, Math.round(planQty), note, insertSort, actor).run();

  // Renumber row_idx to match the new sort_order sequence (two-pass to dodge UNIQUE collisions)
  await db.prepare(`UPDATE manpower_plan SET row_idx = -1 - row_idx WHERE is_active = 1`).run();
  await db.prepare(`
    UPDATE manpower_plan SET row_idx = (
      SELECT COUNT(*) FROM manpower_plan m2
      WHERE m2.is_active = 1
        AND (m2.sort_order < manpower_plan.sort_order
             OR (m2.sort_order = manpower_plan.sort_order AND m2.id < manpower_plan.id))
    ) WHERE is_active = 1
  `).run();

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id,actor_name,module,action,entity_type,entity_id) VALUES (?,?,'manpower','add_plan_row','plan_row',0)"
    ).bind(user.id, user.full_name).run();
  } catch { /* ignore */ }

  return Response.json({ ok: true });
};

// PATCH /api/manpower/plan/:rowIdx — update plan_qty and/or note for one row
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url = new URL(ctx.request.url);
  const rowIdx = parseInt(url.searchParams.get("row_idx") ?? "");
  if (isNaN(rowIdx)) return Response.json({ ok: false, error: "row_idx required" }, { status: 400 });

  const body = await ctx.request.json() as { plan_qty?: number; note?: string; name?: string; pos?: string };

  const sets: string[] = ["updated_at = datetime('now')", "updated_by = ?"];
  const vals: (string | number)[] = [user.full_name ?? user.username ?? ""];

  if (typeof body.plan_qty === "number") { sets.push("plan_qty = ?"); vals.push(Math.max(0, body.plan_qty)); }
  if (typeof body.note   === "string")  { sets.push("note = ?");     vals.push(body.note); }
  if (typeof body.name   === "string")  { sets.push("name = ?");     vals.push(body.name); }
  if (typeof body.pos    === "string" && body.pos.trim()) { sets.push("pos = ?"); vals.push(body.pos.trim()); }

  if (sets.length === 2) return Response.json({ ok: false, error: "Nothing to update" }, { status: 400 });

  vals.push(rowIdx);
  await ctx.env.HR_DB.prepare(
    `UPDATE manpower_plan SET ${sets.join(", ")} WHERE row_idx = ?`
  ).bind(...vals).run();

  try {
    await ctx.env.HR_DB.prepare(
      "INSERT INTO activity_log (user_id,actor_name,module,action,entity_type,entity_id) VALUES (?,?,'manpower','edit_plan','plan_row',?)"
    ).bind(user.id, user.full_name, rowIdx).run();
  } catch { /* ignore */ }

  return Response.json({ ok: true });
};
