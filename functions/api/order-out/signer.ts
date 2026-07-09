import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

const ALLOWED_ROLES = ["hr", "deputyHR", "admin"];

interface SignerRow {
  signer_name: string;
  signer_title: string;
  signer_dept: string;
}

// GET /api/order-out/signer — last-used ผู้มีอำนาจลงนาม, so new orders don't reset to the hardcoded default
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const row = await ctx.env.HR_DB.prepare(
    "SELECT signer_name, signer_title, signer_dept FROM duty_order_signer_default WHERE id = 1"
  ).first<SignerRow>();

  return Response.json({
    ok: true,
    signer: row && row.signer_name.trim()
      ? { signerName: row.signer_name, signerTitle: row.signer_title, signerDept: row.signer_dept }
      : null,
  });
};

// PUT /api/order-out/signer — remember the signer info as the default for the next new order
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json().catch(() => null) as {
    signerName?: string; signerTitle?: string; signerDept?: string;
  } | null;
  if (!body || !(body.signerName ?? "").trim()) {
    return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const actor = user.full_name ?? user.username ?? "";
  await ctx.env.HR_DB.prepare(`
    INSERT INTO duty_order_signer_default (id, signer_name, signer_title, signer_dept, updated_by, updated_at)
    VALUES (1, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      signer_name = excluded.signer_name,
      signer_title = excluded.signer_title,
      signer_dept = excluded.signer_dept,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `).bind(body.signerName?.trim() ?? "", body.signerTitle?.trim() ?? "", body.signerDept?.trim() ?? "", actor).run();

  return Response.json({ ok: true });
};
