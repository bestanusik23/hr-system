import type { Env } from "../../../lib/types";

// GET /api/training/verify/:token  — public certificate verification (no auth)
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const token = ctx.params.token as string;

  const cert = await ctx.env.HR_DB.prepare(`
    SELECT tc.cert_id, tc.full_name, tc.position, tc.department, tc.hours,
           tc.course_date, tc.issued_at, tc.status, tc.qr_token,
           c.course AS course_name, c.course_code, c.trainer,
           c.location, c.start_time, c.end_time
    FROM training_certificates tc
    JOIN training_courses c ON c.id = tc.course_id
    WHERE tc.qr_token = ?
  `).bind(token).first();

  if (!cert) return Response.json({ ok: false, error: "ไม่พบใบประกาศ" }, { status: 404 });
  return Response.json({ ok: true, certificate: cert });
};
