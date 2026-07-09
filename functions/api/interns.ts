import type { Env } from "../lib/types";
import { getTokenFromCookie, getSessionUser } from "../lib/auth";

const ALLOWED_ROLES = ["hr", "admin"];

// Status is always derived from dates (never stored), per spec: upcoming / active /
// ending_soon (<=7 days left) / completed / cancelled.
const STATUS_SQL = `
  CASE
    WHEN i.is_cancelled = 1 THEN 'cancelled'
    WHEN date('now') < i.start_date THEN 'upcoming'
    WHEN date('now') > i.end_date THEN 'completed'
    WHEN julianday(i.end_date) - julianday('now') <= 7 THEN 'ending_soon'
    ELSE 'active'
  END
`;

interface InternRow {
  id: number; intern_code: string; prefix: string | null; first_name: string; last_name: string;
  education_level: string | null; faculty: string | null; major: string | null; year_level: string | null;
  phone: string | null; institution_id: number | null; institution_name: string | null;
  start_date: string; end_date: string; department_id: number | null; department_name: string | null;
  division_id: number | null; division_name: string | null; supervisor_name: string | null;
  training_type: string | null; is_cancelled: number; referral_letter_url: string | null;
  status: string; days_remaining: number;
}

// GET /api/interns — list with computed status, filters, and dashboard summary counts
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const db = ctx.env.HR_DB;
  const url = new URL(ctx.request.url);
  const q            = (url.searchParams.get("q") ?? "").trim();
  const statusFilter = url.searchParams.get("status") ?? "";
  const departmentId = url.searchParams.get("department_id") ?? "";
  const institutionId = url.searchParams.get("institution_id") ?? "";
  const trainingType = url.searchParams.get("training_type") ?? "";

  let sql = `
    SELECT * FROM (
      SELECT i.id, i.intern_code, i.prefix, i.first_name, i.last_name,
             i.education_level, i.faculty, i.major, i.year_level, i.phone,
             i.institution_id, inst.name AS institution_name,
             i.start_date, i.end_date, i.department_id, d.name AS department_name,
             i.division_id, dv.name AS division_name,
             i.supervisor_name, i.training_type, i.is_cancelled, i.referral_letter_url,
             ${STATUS_SQL} AS status,
             CAST(julianday(i.end_date) - julianday('now') AS INTEGER) AS days_remaining
      FROM interns i
      LEFT JOIN intern_institutions inst ON inst.id = i.institution_id
      LEFT JOIN departments d ON d.id = i.department_id
      LEFT JOIN divisions dv ON dv.id = i.division_id
    ) WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (q) {
    sql += ` AND (first_name LIKE ? OR last_name LIKE ? OR intern_code LIKE ? OR institution_name LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (statusFilter) { sql += " AND status = ?"; params.push(statusFilter); }
  if (departmentId) { sql += " AND department_id = ?"; params.push(Number(departmentId)); }
  if (institutionId) { sql += " AND institution_id = ?"; params.push(Number(institutionId)); }
  if (trainingType)  { sql += " AND training_type = ?"; params.push(trainingType); }

  sql += " ORDER BY start_date DESC";

  try {
    const rows = await db.prepare(sql).bind(...params).all<InternRow>();
    const interns = rows.results ?? [];

    // Summary counts — computed from ALL non-filtered interns (cards always reflect the whole set).
    const summaryRows = await db.prepare(`
      SELECT ${STATUS_SQL} AS status, i.institution_id, i.department_id
      FROM interns i WHERE 1=1
    `).all<{ status: string; institution_id: number | null; department_id: number | null }>();
    const all = summaryRows.results ?? [];
    const summary = {
      total: all.length,
      active: all.filter(r => r.status === "active" || r.status === "ending_soon").length,
      upcoming: all.filter(r => r.status === "upcoming").length,
      completed: all.filter(r => r.status === "completed").length,
      institutions: new Set(all.filter(r => r.institution_id != null).map(r => r.institution_id)).size,
      departments: new Set(all.filter(r => r.department_id != null).map(r => r.department_id)).size,
    };

    return Response.json({ ok: true, interns, summary });
  } catch (err) {
    return Response.json({ ok: false, error: `โหลดข้อมูลไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
};

function genInternCode(existingCount: number): string {
  const year = new Date().getFullYear();
  return `INT-${year}-${String(existingCount + 1).padStart(4, "0")}`;
}

// POST /api/interns — create a new intern record
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const b = await ctx.request.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });

  if (!b.first_name || !b.last_name) return Response.json({ ok: false, error: "กรุณากรอกชื่อ-นามสกุล" }, { status: 400 });
  if (!b.start_date || !b.end_date) return Response.json({ ok: false, error: "กรุณากรอกวันที่เริ่มและสิ้นสุดการฝึกงาน" }, { status: 400 });

  const db = ctx.env.HR_DB;
  const year = new Date().getFullYear();

  let id: number | undefined;
  let internCode = "";
  try {
    const countRow = await db.prepare(
      "SELECT COUNT(*) AS n FROM interns WHERE intern_code LIKE ?"
    ).bind(`INT-${year}-%`).first<{ n: number }>();
    internCode = genInternCode(countRow?.n ?? 0);

    const result = await db.prepare(`
      INSERT INTO interns (
        intern_code, prefix, first_name, last_name, education_level, faculty, major, year_level, phone, photo_url,
        institution_id, advisor_name, advisor_phone, advisor_email, referral_letter_url,
        start_date, end_date, department_id, division_id, supervisor_name, supervisor_position,
        training_type, work_hours, note, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      internCode,
      (b.prefix as string) || null, b.first_name as string, b.last_name as string,
      (b.education_level as string) || null, (b.faculty as string) || null, (b.major as string) || null,
      (b.year_level as string) || null, (b.phone as string) || null, (b.photo_url as string) || null,
      (b.institution_id as number) || null, (b.advisor_name as string) || null, (b.advisor_phone as string) || null,
      (b.advisor_email as string) || null, (b.referral_letter_url as string) || null,
      b.start_date as string, b.end_date as string, (b.department_id as number) || null, (b.division_id as number) || null,
      (b.supervisor_name as string) || null, (b.supervisor_position as string) || null,
      (b.training_type as string) || null, (b.work_hours as string) || null, (b.note as string) || null,
      user.full_name ?? user.username ?? "",
    ).run();
    id = result.meta.last_row_id;
  } catch (err) {
    return Response.json({ ok: false, error: `บันทึกไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  try {
    await db.prepare(
      "INSERT INTO activity_log (user_id, actor_name, module, action, entity_type, entity_id) VALUES (?,?,'intern','create','intern',?)"
    ).bind(user.id, user.full_name, id).run();
  } catch { /* non-critical */ }

  return Response.json({ ok: true, id, intern_code: internCode }, { status: 201 });
};
