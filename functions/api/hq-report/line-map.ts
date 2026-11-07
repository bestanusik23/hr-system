import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// PUT    /api/hq-report/line-map  { division_name, position, line } → upsert one mapping
// DELETE /api/hq-report/line-map?division_name=..&position=..     → remove one mapping
// Maps ฝ่าย + ตำแหน่ง to the HQ สายงาน (or "ไม่นับ" to leave the position out). Admin only.

const LINES = ["สายการพยาบาล", "สายบัญชีและการเงิน", "สายสนับสนุนบริการ", "สายสำนักงาน", "สนับสนุนทางการแพทย์", "ไม่นับ"];

async function requireAdmin(ctx: EventContext<Env, string, unknown>) {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return { error: Response.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "admin") return { error: Response.json({ ok: false, error: "เฉพาะผู้ดูแลระบบเท่านั้น" }, { status: 403 }) };
  return { user };
}

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;

  const body = await ctx.request.json().catch(() => ({})) as { division_name?: string; position?: string; line?: string };
  const div = (body.division_name ?? "").trim();
  const pos = (body.position ?? "").trim();
  const line = (body.line ?? "").trim();
  if (!pos) return Response.json({ ok: false, error: "ระบุตำแหน่ง" }, { status: 400 });
  if (!LINES.includes(line)) return Response.json({ ok: false, error: "สายงานไม่ถูกต้อง" }, { status: 400 });

  await ctx.env.HR_DB.prepare(`
    INSERT INTO hq_line_map (division_name, position, line, updated_by, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(division_name, position) DO UPDATE SET
      line = excluded.line, updated_by = excluded.updated_by, updated_at = excluded.updated_at
  `).bind(div, pos, line, auth.user.full_name).run();
  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const url = new URL(ctx.request.url);
  const div = (url.searchParams.get("division_name") ?? "").trim();
  const pos = (url.searchParams.get("position") ?? "").trim();
  await ctx.env.HR_DB.prepare("DELETE FROM hq_line_map WHERE division_name = ? AND position = ?").bind(div, pos).run();
  return Response.json({ ok: true });
};
