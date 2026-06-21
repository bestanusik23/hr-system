import type { Env } from "../../lib/types";
import { getTokenFromCookie, deleteSession, makeSessionCookie } from "../../lib/auth";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const token = getTokenFromCookie(ctx.request);
  if (token) await deleteSession(ctx.env.HR_DB, token);
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": makeSessionCookie("", 0),
    },
  });
};
