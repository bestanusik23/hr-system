import type { Env } from "../lib/types";

// GET /api/health — proves the Pages build, Functions runtime, and D1 binding
// are all wired correctly. Returns row counts from a few seeded tables.
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const db = ctx.env.HR_DB;
    const [divisions, departments, topics, roles] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS n FROM divisions").first<{ n: number }>(),
      db.prepare("SELECT COUNT(*) AS n FROM departments").first<{ n: number }>(),
      db.prepare("SELECT COUNT(*) AS n FROM eval_topics").first<{ n: number }>(),
      db.prepare("SELECT COUNT(*) AS n FROM role_module_access").first<{ n: number }>(),
    ]);
    return Response.json({
      ok: true,
      db: "HR_DB",
      counts: {
        divisions: divisions?.n ?? 0,
        departments: departments?.n ?? 0,
        eval_topics: topics?.n ?? 0,
        role_module_access: roles?.n ?? 0,
      },
      time: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
};
