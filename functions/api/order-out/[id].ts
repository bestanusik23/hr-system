import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

const ALLOWED_ROLES = ["hr", "deputyHR", "admin"];

// GET /api/order-out/:id — fetch one saved duty order (for viewing/reprinting)
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = ctx.params.id as string;
  const row = await ctx.env.HR_DB.prepare(
    "SELECT * FROM duty_orders WHERE id = ?"
  ).bind(id).first<{
    id: number; order_no: string; activity: string; place_name: string; address: string;
    event_date: string | null; order_date: string | null; staff_json: string;
    signer_name: string; signer_title: string; signer_dept: string;
    created_by: string; created_at: string;
  }>();
  if (!row) return Response.json({ ok: false, error: "ไม่พบคำสั่งนี้" }, { status: 404 });

  let staff: { name: string; position: string }[] = [];
  try { staff = JSON.parse(row.staff_json); } catch { /* keep empty */ }

  return Response.json({
    ok: true,
    order: {
      id: row.id, orderNo: row.order_no, activity: row.activity,
      placeName: row.place_name, address: row.address,
      eventDate: row.event_date ?? "", orderDate: row.order_date ?? "",
      staff,
      signerName: row.signer_name ?? "", signerTitle: row.signer_title ?? "", signerDept: row.signer_dept ?? "",
      createdBy: row.created_by, createdAt: row.created_at,
    },
  });
};
