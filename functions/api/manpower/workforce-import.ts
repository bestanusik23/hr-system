import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET  /api/manpower/workforce-import  → load the last imported payroll dataset (any logged-in user)
// POST /api/manpower/workforce-import  → save a newly imported payroll dataset (hr/admin/deputyHR)

const DATASET_KEY = "payroll";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const row = await ctx.env.HR_DB.prepare(
    "SELECT data, imported_at, imported_by, updated_at FROM workforce_imports WHERE dataset_key = ?"
  ).bind(DATASET_KEY).first<{ data: string; imported_at: string; imported_by: string; updated_at: string }>();

  if (!row) return Response.json({ ok: true, dataset: null });

  return Response.json({
    ok: true,
    dataset: {
      parsed: JSON.parse(row.data),
      importedAt: row.imported_at,
      importedBy: row.imported_by,
      updatedAt: row.updated_at,
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => null) as { parsed?: unknown; importedAt?: string } | null;
  if (!body?.parsed || !body.importedAt)
    return Response.json({ ok: false, error: "Missing parsed/importedAt" }, { status: 400 });

  await ctx.env.HR_DB.prepare(`
    INSERT INTO workforce_imports (dataset_key, data, imported_at, imported_by, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(dataset_key) DO UPDATE SET
      data=excluded.data, imported_at=excluded.imported_at,
      imported_by=excluded.imported_by, updated_at=datetime('now')
  `).bind(DATASET_KEY, JSON.stringify(body.parsed), body.importedAt, user.full_name).run();

  return Response.json({ ok: true });
};
