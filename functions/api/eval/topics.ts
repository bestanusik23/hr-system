import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/eval/topics
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const rows = await ctx.env.HR_DB.prepare("SELECT * FROM eval_topics ORDER BY sort_order").all();
  return Response.json({ ok: true, topics: rows.results });
};
