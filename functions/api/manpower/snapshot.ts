import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

// GET /api/manpower/snapshot          → list all saved months [{month, headcount, created_at}]
// GET /api/manpower/snapshot?month=   → load specific month's snapshot
// POST /api/manpower/snapshot         → save current month (hr/admin)
// DELETE /api/manpower/snapshot?month=→ delete a snapshot (admin)

function getPeriodLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const MT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const pDate = new Date(y, m - 2, 26); // 26th of previous month
  const eDate = new Date(y, m - 1, 25); // 25th of current month
  const py = pDate.getFullYear() + 543;
  const ey = eDate.getFullYear() + 543;
  return `26 ${MT[pDate.getMonth()]} ${py} – 25 ${MT[eDate.getMonth()]} ${ey}`;
}

// Currently-active payroll period, matching the 26th cut-off in /api/manpower/summary.
function activePeriodMonth(): string {
  const now = new Date();
  const eff = now.getDate() >= 26 ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : now;
  return `${eff.getFullYear()}-${String(eff.getMonth() + 1).padStart(2, "0")}`;
}

interface ComputedSnapshot {
  snapshot_month: string; headcount: number; active: number; probation: number;
  new_this_month: number; resigned_this_month: number; turnover_rate: number; period_label: string;
  by_division: { division: string; n: number }[];
  by_type: { type: string; n: number }[];
  by_status: { status: string; n: number }[];
}

// Computes the figures for a given month key without writing anything.
// Headcount/active/probation/by_* reflect employees' CURRENT status (there's no
// point-in-time history), while new/resigned counts use that month's real 26–25 window.
async function computeSnapshot(db: D1Database, month: string): Promise<ComputedSnapshot> {
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

  return {
    snapshot_month: month, headcount: hc, active: active?.n ?? 0, probation: probation?.n ?? 0,
    new_this_month: newMon?.n ?? 0, resigned_this_month: resignMon?.n ?? 0, turnover_rate,
    period_label: getPeriodLabel(month),
    by_division: byDiv.results ?? [], by_type: byType.results ?? [], by_status: byStatus.results ?? [],
  };
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const db    = ctx.env.HR_DB;
  const url   = new URL(ctx.request.url);
  const month = url.searchParams.get("month");

  if (month) {
    const row = await db.prepare(
      "SELECT * FROM manpower_snapshots WHERE snapshot_month = ?"
    ).bind(month).first<Record<string, unknown>>();

    if (row) {
      return Response.json({
        ok: true,
        snapshot: {
          ...row, saved: true,
          by_division: JSON.parse(row.by_division as string ?? "[]"),
          by_type:     JSON.parse(row.by_type as string ?? "[]"),
          by_status:   JSON.parse(row.by_status as string ?? "[]"),
        },
      });
    }

    // No saved snapshot for this month yet — only compute on demand for months
    // that have already closed (26th cut-off passed); the still-open active
    // period is covered by the "Real-time" view instead.
    if (month >= activePeriodMonth()) {
      return Response.json({ ok: false, error: "ไม่พบข้อมูลเดือนนี้" }, { status: 404 });
    }
    const computed = await computeSnapshot(db, month);
    return Response.json({ ok: true, snapshot: { ...computed, saved: false, created_by: null, created_at: null } });
  }

  // Return list of all saved months
  const rows = await db.prepare(
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

  // Determine which month to snapshot (default = currently-active payroll period).
  const body  = await ctx.request.json().catch(() => ({})) as { month?: string };
  const month = body.month ?? activePeriodMonth();

  const computed = await computeSnapshot(db, month);

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
    month, computed.headcount, computed.active, computed.probation,
    computed.new_this_month, computed.resigned_this_month, computed.turnover_rate, computed.period_label,
    JSON.stringify(computed.by_division),
    JSON.stringify(computed.by_type),
    JSON.stringify(computed.by_status),
    user.full_name,
  ).run();

  await db.prepare(
    "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'manpower','snapshot','month',0)"
  ).bind(user.id, user.full_name).run();

  return Response.json({ ok: true, month, headcount: computed.headcount });
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
