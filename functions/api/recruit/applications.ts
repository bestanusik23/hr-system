import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

async function getGoogleAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payload = btoa(JSON.stringify({
    iss: env.GOOGLE_SA_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  // Import the private key (PEM → CryptoKey)
  const pemKey = env.GOOGLE_SA_PRIVATE_KEY.replace(/\\n/g, "\n");
  const pemBody = pemKey.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const keyDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", keyDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const sigInput = new TextEncoder().encode(`${header}.${payload}`);
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, sigInput);
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${header}.${payload}.${sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json() as { access_token: string };
  return tokenData.access_token;
}

// GET /api/recruit/applications  — read from Google Sheets
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "admin", "deputy", "deputyHR", "head"].includes(user.role)) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const token = await getGoogleAccessToken(ctx.env);
    const sheetId = ctx.env.SHEET_APPLICATIONS;
    const tab = encodeURIComponent("การตอบแบบฟอร์ม 1");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tab}!A:Z`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json() as { values?: string[][] };

    const rows = data.values ?? [];
    if (rows.length <= 1) return Response.json({ ok: true, applications: [], headers: rows[0] ?? [] });

    const headers = rows[0];
    let applications = rows.slice(1).map((row, i) => {
      const obj: Record<string, string> = { _row: String(i + 2) };
      headers.forEach((h, j) => { obj[h] = row[j] ?? ""; });
      return obj;
    });

    // head: always scope to their department — return empty if not set or no match
    let scopedDepartment: string | null = null;
    if (user.role === "head") {
      if (!user.scope_department_id) {
        // head without assigned department sees nothing
        return Response.json({ ok: true, applications: [], headers, scopedDepartment: null, scopedDivision: null });
      }
      const dept = await ctx.env.HR_DB.prepare("SELECT name FROM departments WHERE id = ?")
        .bind(user.scope_department_id).first<{ name: string }>();
      scopedDepartment = dept?.name ?? null;

      const deptColIdx = headers.findIndex(h =>
        h.includes("แผนก") || h.toLowerCase().includes("department")
      );
      if (deptColIdx >= 0 && scopedDepartment) {
        const deptKey = headers[deptColIdx];
        applications = applications.filter(a => a[deptKey] === scopedDepartment);
      } else {
        // column not found in sheet → return empty
        applications = [];
      }
    }

    // deputy/deputyHR: filter by division column if scoped
    let scopedDivision: string | null = null;
    if (["deputy", "deputyHR"].includes(user.role) && user.scope_division_id) {
      const div = await ctx.env.HR_DB.prepare("SELECT name FROM divisions WHERE id = ?")
        .bind(user.scope_division_id).first<{ name: string }>();
      scopedDivision = div?.name ?? null;

      if (scopedDivision) {
        const divColIdx = headers.findIndex(h =>
          h.includes("ฝ่าย") || h.toLowerCase().includes("division")
        );
        if (divColIdx >= 0) {
          const divKey = headers[divColIdx];
          applications = applications.filter(a => a[divKey] === scopedDivision);
        }
      }
    }

    return Response.json({ ok: true, applications, headers, scopedDepartment, scopedDivision });
  } catch (e) {
    return Response.json({ ok: false, error: "ไม่สามารถดึงข้อมูลจาก Google Sheets ได้: " + String(e) }, { status: 500 });
  }
};

// PATCH /api/recruit/applications  — update a cell (e.g. status column)
// Level 3 (hr): can set all statuses except รับเข้างาน
// Level 2 (deputy/deputyHR): can set any status including รับเข้างาน (final hire decision)
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr", "deputy", "deputyHR", "admin", "head"].includes(user.role)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await ctx.request.json() as { row: number; col: string; value: string };
  const { row, col, value } = body;
  if (!row || !col) return Response.json({ ok: false, error: "Missing row/col" }, { status: 400 });

  // head can ONLY set "รอนัดสัมภาษณ์" (flag for HR to call)
  if (user.role === "head") {
    if (value !== "รอนัดสัมภาษณ์") {
      return Response.json({ ok: false, error: "หัวหน้าแผนกสามารถส่งให้สัมภาษณ์เท่านั้น" }, { status: 403 });
    }
    // head allowed through — GET already scoped their rows to their dept
  } else if (!["hr", "deputy", "deputyHR", "admin"].includes(user.role)) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // "รับเข้างาน" requires Level 2 (deputy) approval
  const FINAL_STATUSES = ["รับเข้างาน", "ไม่ผ่าน"];
  if (FINAL_STATUSES.includes(value) && !["deputy", "deputyHR", "admin"].includes(user.role)) {
    return Response.json({ ok: false, error: "สถานะ \"รับเข้างาน\" และ \"ไม่ผ่าน\" ต้องการสิทธิ์รองผู้อำนวยการ" }, { status: 403 });
  }

  try {
    const token = await getGoogleAccessToken(ctx.env);
    const sheetId = ctx.env.SHEET_APPLICATIONS;
    const range = `Sheet1!${col}${row}`;
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ range, majorDimension: "ROWS", values: [[value]] }),
      }
    );
    const d = await res.json() as { updatedCells?: number };
    if (!d.updatedCells) return Response.json({ ok: false, error: "อัปเดตไม่สำเร็จ" }, { status: 500 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
};
