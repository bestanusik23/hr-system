import type { Env } from "../../../lib/types";

// GET /api/interns/verify/:token — public intern certificate verification (no auth)
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const token = ctx.params.token as string;

  const cert = await ctx.env.HR_DB.prepare(
    "SELECT * FROM intern_certificates WHERE qr_token = ?"
  ).bind(token).first();

  if (!cert) return Response.json({ ok: false, error: "ไม่พบใบประกาศ" }, { status: 404 });
  return Response.json({ ok: true, certificate: cert });
};
