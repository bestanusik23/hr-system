import type { Env } from "../../lib/types";
import { getTokenFromCookie, getSessionUser } from "../../lib/auth";

async function getGoogleAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header  = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const payload = btoa(JSON.stringify({ iss: env.GOOGLE_SA_EMAIL, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const pemBody = env.GOOGLE_SA_PRIVATE_KEY.replace(/\\n/g,"\n").replace(/-----BEGIN PRIVATE KEY-----/,"").replace(/-----END PRIVATE KEY-----/,"").replace(/\s/g,"");
  const keyDer  = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("pkcs8", keyDer.buffer, { name:"RSASSA-PKCS1-v1_5", hash:"SHA-256" }, false, ["sign"]);
  const sigBuf  = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(`${header}.${payload}`));
  const sig     = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const res     = await fetch("https://oauth2.googleapis.com/token", { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${header}.${payload}.${sig}` });
  return ((await res.json()) as { access_token: string }).access_token;
}

// GET /api/recruit/manpower?tab=เดือนมิถุนายน+2569
// returns available tabs + data for selected tab (defaults to last tab)
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const user = await getSessionUser(ctx.env.HR_DB, getTokenFromCookie(ctx.request));
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!["hr","admin","deputy","deputyHR","head"].includes(user.role)) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // Get division name for head scoping
  let scopeDivisionName: string | null = null;
  if (user.role === "head" && user.scope_division_id) {
    const div = await ctx.env.HR_DB.prepare("SELECT name FROM divisions WHERE id = ?")
      .bind(user.scope_division_id).first<{ name: string }>();
    scopeDivisionName = div?.name ?? null;
  }

  try {
    const token   = await getGoogleAccessToken(ctx.env);
    const sheetId = ctx.env.SHEET_MANPOWER;

    // 1. Fetch spreadsheet metadata to get all tab names
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const meta = await metaRes.json() as { sheets: { properties: { title: string } }[] };
    const allTabs = (meta.sheets ?? []).map(s => s.properties.title);

    if (allTabs.length === 0) return Response.json({ ok: true, records: [], headers: [], allTabs: [], currentTab: "", scopedDivision: scopeDivisionName });

    // 2. Use requested tab or default to last tab (most recent month)
    const requestedTab = new URL(ctx.request.url).searchParams.get("tab") ?? "";
    const currentTab   = allTabs.includes(requestedTab) ? requestedTab : allTabs[allTabs.length - 1];

    // 3. Fetch data from selected tab
    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(currentTab)}!A:Z`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data  = await dataRes.json() as { values?: string[][] };
    const rows  = data.values ?? [];

    if (rows.length <= 1) return Response.json({ ok: true, records: [], headers: rows[0] ?? [], allTabs, currentTab, scopedDivision: scopeDivisionName });

    const headers = rows[0];
    const divColIdx = headers.findIndex(h => h.includes("ฝ่าย") || h.toLowerCase().includes("division"));

    let records = rows.slice(1).map(row => {
      const obj: Record<string,string> = {};
      headers.forEach((h,j) => { obj[h] = row[j] ?? ""; });
      return obj;
    });

    // Filter for head role
    if (scopeDivisionName && divColIdx >= 0) {
      const divKey = headers[divColIdx];
      records = records.filter(r => r[divKey] === scopeDivisionName);
    }

    return Response.json({ ok: true, records, headers, allTabs, currentTab, scopedDivision: scopeDivisionName });
  } catch(e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
};
