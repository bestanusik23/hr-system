import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

const ONBOARDING_ITEMS = [
  { key: "fingerprint",    label: "บันทึกลายนิ้วมือ (ระบบสแกนนิ้ว)" },
  { key: "bank_account",   label: "เปิดบัญชีธนาคาร" },
  { key: "payroll_system", label: "เพิ่มข้อมูลในระบบเงินเดือน" },
  { key: "social_security", label: "ขึ้นทะเบียนประกันสังคม (สปส.1-03)" },
];

// GET /api/manpower/checklist?employee_id=X
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(ctx.request.url);
  const empId = Number(url.searchParams.get("employee_id") ?? 0);
  if (!empId) return Response.json({ ok: false, error: "employee_id required" }, { status: 400 });

  try {
    const rows = await ctx.env.HR_DB.prepare(
      "SELECT item_key, item_label, completed, completed_at, note FROM onboarding_checklist WHERE employee_id = ?"
    ).bind(empId).all<{ item_key: string; item_label: string; completed: number; completed_at: string | null; note: string | null }>();

    // Merge DB rows with default items so all 4 are always returned
    const byKey = new Map(rows.results.map(r => [r.item_key, r]));
    const items = ONBOARDING_ITEMS.map(def => {
      const row = byKey.get(def.key);
      return {
        key: def.key,
        label: def.label,
        completed: row ? !!row.completed : false,
        completed_at: row?.completed_at ?? null,
        note: row?.note ?? null,
      };
    });

    return Response.json({ ok: true, items });
  } catch {
    // Table may not exist yet
    const items = ONBOARDING_ITEMS.map(def => ({
      key: def.key, label: def.label, completed: false, completed_at: null, note: null,
    }));
    return Response.json({ ok: true, items, _noTable: true });
  }
};

// PATCH /api/manpower/checklist  { employee_id, key, completed, note? }
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const b = await ctx.request.json() as { employee_id: number; key: string; completed: boolean; note?: string };
  const { employee_id, key, completed, note } = b;
  if (!employee_id || !key) return Response.json({ ok: false, error: "employee_id and key required" }, { status: 400 });

  const defaultItem = ONBOARDING_ITEMS.find(i => i.key === key);
  if (!defaultItem) return Response.json({ ok: false, error: "Unknown checklist item" }, { status: 400 });

  try {
    await ctx.env.HR_DB.prepare(`
      INSERT INTO onboarding_checklist (employee_id, item_key, item_label, completed, completed_at, note, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(employee_id, item_key) DO UPDATE SET
        completed = excluded.completed,
        completed_at = CASE WHEN excluded.completed = 1 AND completed = 0 THEN datetime('now') WHEN excluded.completed = 0 THEN NULL ELSE completed_at END,
        note = excluded.note,
        updated_at = datetime('now')
    `).bind(employee_id, key, defaultItem.label, completed ? 1 : 0, completed ? new Date().toISOString() : null, note ?? null).run();

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
};
