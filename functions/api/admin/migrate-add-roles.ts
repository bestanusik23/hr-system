import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// POST /api/admin/migrate-add-roles
// One-time migration: adds role_2 and role_3 columns to users table
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const results: string[] = [];

  for (const col of ["role_2", "role_3"]) {
    try {
      await ctx.env.HR_DB.prepare(`ALTER TABLE users ADD COLUMN ${col} TEXT`).run();
      results.push(`✅ Added column: ${col}`);
    } catch (e) {
      const msg = String(e);
      if (msg.includes("duplicate column") || msg.includes("already exists")) {
        results.push(`⚠️ Already exists: ${col}`);
      } else {
        results.push(`❌ Error on ${col}: ${msg}`);
      }
    }
  }

  return Response.json({ ok: true, results });
};
