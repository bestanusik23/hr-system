import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/eval/topics?template_id=X  (omit for global 10 topics)
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const templateId = new URL(ctx.request.url).searchParams.get("template_id");
  let rows;
  if (templateId) {
    rows = await ctx.env.HR_DB.prepare(
      "SELECT * FROM eval_topics WHERE template_id = ? ORDER BY sort_order"
    ).bind(Number(templateId)).all();
  } else {
    rows = await ctx.env.HR_DB.prepare(
      "SELECT * FROM eval_topics WHERE template_id IS NULL ORDER BY sort_order"
    ).all();
  }
  return Response.json({ ok: true, topics: rows.results });
};
