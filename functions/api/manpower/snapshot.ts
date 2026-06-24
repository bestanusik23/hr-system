import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/manpower/snapshot          → list all saved months [{month, headcount, created_at}]
// GET /api/manpower/snapshot?month=   → load specific month's snapshot
// POST /api/manpower/snapshot         → save current month (hr/admin)
// DELETE /api/manpower/snapshot?month=→ delete a snapshot (admin)

function getPeriodLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const MT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const pDate = new Date(y, m - 1, 26);
  const eDate = new Date(y, m, 25);
  const py = pDate.getFullYear() + 543;
  const ey = eDate.getFullYear() + 543;
  return `26 ${MT[pDate.getMonth()]} ${py} – 25 ${MT[eDate.getMonth()]} ${ey}`;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url   = new URL(ctx.request.url);
  const month = url.searchParams.get("month");

  if (month) {
    // Return specific snapshot
    const row = await ctx.env.HR_DB.prepare(
      "SELECT * FROM manpower_snapshots WHERE snapshot_month = ?"
    ).bind(month).first<Record<string, unknown>>();

    if (!row) return Response.json({ ok: false, error: "ไม่พบข้อมูลเดือนนี้" }, { status: 404 });

    return Response.json({
      ok: true,
      snapshot: {
        ...row,
        by_division: JSON.parse(row.by_division as string ?? "[]"),
        by_type:     JSON.parse(row.by_type as string ?? "[]"),
        by_status:   JSON.parse(row.by_status as string ?? "[]"),
      },
    });
  }

  // Return list of all saved months
  const rows = await ctx.env.HR_DB.prepare(
    "SELECT snapshot_month, headcount, active, turnover_rate, created_by, created_at FROM manpower_snapshots ORDER BY snapshot_month DESC"
  ).all<{ snapshot_month: string; headcount: number; active: number; turnover_rate: number; created_by: string; created_at: string }>();

  return Response.json({ ok: true, months: rows.results });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputyHR"].includes(user.role))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const db = ctx.env.HR_DB;

  // Determine which month to snapshot (default = current month)
  const body = await ctx.request.json().catch(() => ({})) as { month?: string };
  const now   = new Date();
  const month = body.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // ── Cut-off window for this month (26th prev → 25th current) ──
  const [y, m] = month.split("-").map(Number);
  const pStart = new Date(y, m - 2, 26).toISOString().slice(0, 10);
  const pEnd   = new Date(y, m - 1, 25).toISOString().slice(0, 10);

  const headcount = await db.prepare("SELECT COUNT(*) AS n FROM employees WHERE emp_status != 'resigned'").first<{ n: number }>();
  const active    = await db.prepare("SELECT COUNT(*) AS n FROM employees WHERE emp_status IN ('passed','transferred')").first<{ n: number }>();
  const probation = await db.prepare("SELECT COUNT(*) AS n FROM employees WHERE emp_status = 'probation'").first<{ n: number }>();

  const newMon = await db.prepare(
    "SELECT COUNT(*) AS n FROM employees WHERE start_date >= ? AND start_date <= ?"
  ).bind(pStart, pEnd).first<{ n: number }>();

  const resignMon = await db.prepare(
    "SELECT COUNT(*) AS n FROM employees WHERE resign_date >= ? AND resign_date <= ?"
  ).bind(pStart, pEnd).first<{ n: number }>();

  const hc = headcount?.n ?? 0;
  const turnover_rate = hc > 0 ? Math.round(((resignMon?.n ?? 0) / hc) * 1000) / 10 : 0;

  const byDiv = await db.prepare(`
    SELECT COALESCE(dv.name,'ไม่ระบุฝ่าย') AS division, COUNT(*) AS n
    FROM employees e LEFT JOIN divisions dv ON dv.id = e.division_id
    WHERE e.emp_status != 'resigned'
    GROUP BY e.division_id ORDER BY n DESC
  `).all<{ division: string; n: number }>();

  const byType = await db.prepare(`
    SELECT COALESCE(NULLIF(TRIM(e.emp_type),''),'ไม่ระบุประเภท') AS type, COUNT(*) AS n
    FROM employees e WHERE e.emp_status != 'resigned'
    GROUP BY e.emp_type ORDER BY n DESC
  `).all<{ type: string; n: number }>();

  const byStatus = await db.prepare(`
    SELECT CASE e.emp_status
      WHEN 'probation'   THEN 'ทดลองงาน'
      WHEN 'passed'      THEN 'ผ่านทดลองงาน'
      WHEN 'transferred' THEN 'ย้ายแผนก'
      ELSE e.emp_status END AS status, COUNT(*) AS n
    FROM employees e WHERE e.emp_status != 'resigned'
    GROUP BY e.emp_status ORDER BY n DESC
  `).all<{ status: string; n: number }>();

  await db.prepare(`
    INSERT INTO manpower_snapshots
      (snapshot_month, headcount, active, probation,
       new_this_month, resigned_this_month, turnover_rate, period_label,
       by_division, by_type, by_status, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(snapshot_month) DO UPDATE SET
      headcount=excluded.headcount, active=excluded.active, probation=excluded.probation,
      new_this_month=excluded.new_this_month, resigned_this_month=excluded.resigned_this_month,
      turnover_rate=excluded.turnover_rate, period_label=excluded.period_label,
      by_division=excluded.by_division, by_type=excluded.by_type, by_status=excluded.by_status,
      created_by=excluded.created_by, created_at=datetime('now')
  `).bind(
    month, hc, active?.n ?? 0, probation?.n ?? 0,
    newMon?.n ?? 0, resignMon?.n ?? 0, turnover_rate, getPeriodLabel(month),
    JSON.stringify(byDiv.results ?? []),
    JSON.stringify(byType.results ?? []),
    JSON.stringify(byStatus.results ?? []),
    user.full_name,
  ).run();

  await db.prepare(
    "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'manpower','snapshot','month',0)"
  ).bind(user.id, user.full_name).run();

  return Response.json({ ok: true, month, headcount: hc });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url   = new URL(ctx.request.url);
  const month = url.searchParams.get("month");
  if (!month) return Response.json({ ok: false, error: "ระบุเดือน" }, { status: 400 });

  await ctx.env.HR_DB.prepare("DELETE FROM manpower_snapshots WHERE snapshot_month = ?").bind(month).run();
  return Response.json({ ok: true });
};
