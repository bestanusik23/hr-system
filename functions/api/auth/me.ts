import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const token = getTokenFromCookie(ctx.request);
  const user = await getSessionUser(ctx.env.HR_DB, token);
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return Response.json({ ok: true, user });
};
