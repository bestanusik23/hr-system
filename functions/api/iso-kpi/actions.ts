import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET    /api/iso-kpi/actions?kpi=&year=        → CAR/CQI log entries for that KPI+year
// POST   /api/iso-kpi/actions                   → add an entry (hr/admin/deputyHR)
// PATCH  /api/iso-kpi/actions?id=                → update an entry (e.g. mark completed_date)
// DELETE /api/iso-kpi/actions?id=                → remove an entry (admin only)

const KPI_KEYS = ["license", "orientation", "competency", "training"];

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url    = new URL(ctx.request.url);
  const kpi    = url.searchParams.get("kpi");
  const yearBE = parseInt(url.searchParams.get("year") ?? "", 10);
  if (!kpi || !KPI_KEYS.includes(kpi) || !yearBE) {
    return Response.json({ ok: false, error: "ระบุ kpi และปีให้ถูกต้อง" }, { status: 400 });
  }

  const rows = await ctx.env.HR_DB.prepare(
    `SELECT id, kpi_key, year, month, root_cause, corrective_action, responsible, due_date, completed_date, created_by, created_at
     FROM iso_kpi_actions WHERE kpi_key = ? AND year = ? ORDER BY month, id`
  ).bind(kpi, yearBE).all();

  return Response.json({ ok: true, actions: rows.results ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => ({})) as {
    kpi_key?: string; year?: number; month?: number;
    root_cause?: string; corrective_action?: string; responsible?: string; due_date?: string;
  };

  const kpiKey = body.kpi_key ?? "";
  if (!KPI_KEYS.includes(kpiKey)) return Response.json({ ok: false, error: "kpi_key ไม่ถูกต้อง" }, { status: 400 });
  if (!body.year || !body.month || body.month < 1 || body.month > 12) {
    return Response.json({ ok: false, error: "ระบุปีและเดือนให้ถูกต้อง" }, { status: 400 });
  }

  const db = ctx.env.HR_DB;
  const result = await db.prepare(`
    INSERT INTO iso_kpi_actions (kpi_key, year, month, root_cause, corrective_action, responsible, due_date, created_by)
    VALUES (?,?,?,?,?,?,?,?)
  `).bind(
    kpiKey, body.year, body.month,
    body.root_cause ?? "", body.corrective_action ?? "", body.responsible ?? "", body.due_date ?? null,
    user.full_name ?? user.username ?? "",
  ).run();

  return Response.json({ ok: true, id: result.meta.last_row_id });
};

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url = new URL(ctx.request.url);
  const id  = parseInt(url.searchParams.get("id") ?? "", 10);
  if (!id) return Response.json({ ok: false, error: "ระบุ id" }, { status: 400 });

  const body = await ctx.request.json().catch(() => ({})) as {
    root_cause?: string; corrective_action?: string; responsible?: string; due_date?: string | null; completed_date?: string | null;
  };

  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  if (typeof body.root_cause === "string")        { sets.push("root_cause = ?"); vals.push(body.root_cause); }
  if (typeof body.corrective_action === "string")  { sets.push("corrective_action = ?"); vals.push(body.corrective_action); }
  if (typeof body.responsible === "string")        { sets.push("responsible = ?"); vals.push(body.responsible); }
  if (body.due_date !== undefined)                 { sets.push("due_date = ?"); vals.push(body.due_date); }
  if (body.completed_date !== undefined)           { sets.push("completed_date = ?"); vals.push(body.completed_date); }
  if (sets.length === 0) return Response.json({ ok: false, error: "ไม่มีข้อมูลให้แก้ไข" }, { status: 400 });

  vals.push(id);
  await ctx.env.HR_DB.prepare(`UPDATE iso_kpi_actions SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url = new URL(ctx.request.url);
  const id  = parseInt(url.searchParams.get("id") ?? "", 10);
  if (!id) return Response.json({ ok: false, error: "ระบุ id" }, { status: 400 });

  await ctx.env.HR_DB.prepare("DELETE FROM iso_kpi_actions WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
};
