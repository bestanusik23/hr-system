/// <reference types="@cloudflare/workers-types" />

// Environment bindings available to every Pages Function.
// Configure these in the Cloudflare Pages dashboard (or wrangler.toml for local).
export interface Env {
  // D1 database (System: eval, training, transfer, exec). Binding name = HR_DB.
  HR_DB: D1Database;

  // Secret used to sign/verify session cookies (wrangler secret / dashboard).
  SESSION_SECRET?: string;

  // Google Sheets service account (recruit system — set as secrets, not committed).
  GOOGLE_SA_EMAIL?: string;
  GOOGLE_SA_PRIVATE_KEY?: string;
  // Spreadsheet IDs (not secret — can be plain vars).
  SHEET_APPLICATIONS?: string;
  SHEET_MANPOWER?: string;
}
