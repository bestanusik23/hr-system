// One-time import: docs/ot-2569.xlsx (sheet "69") → migrations/0041_batches/*.sql
//
// The prototype sheet packs 21 months (ม.ค. 2568 – ก.ย. 2569) into one continuous
// ledger, with Jan–Nov 2568 hidden (still real data, must be imported). Column A's
// dates are unreliable — some rows show a garbled "1968" instead of the Buddhist
// Era year — so month is derived from row POSITION, not from the date value:
// row 4/5 = Jan 2568 (Budget/Actual), row 6/7 = Feb 2568, ... row 44/45 = Sep 2569.
//
// category_id below matches migration 0041_ot_budget.sql's INSERT order 1:1
// (both list RN, Na, On call, SUPERVISOR, ผช., ภก., cash., Reg., X-ray, Lab,
// ภก.(PT), อื่นๆ, ตึกรังสีรักษา, ผ่าตัดกระเพาะ, บัญชี/IT, ออกหน่วย in that order).
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const SRC = path.join(__dirname, "../docs/ot-2569.xlsx");
const OUT_DIR = path.join(__dirname, "../migrations/0041_batches");

// spreadsheet column (1-indexed) → category_id
const COL_TO_CATEGORY = {
  3: 1, 4: 2, 5: 3, 6: 4,      // C-F: RN, Na, On call, SUPERVISOR
  7: 5, 8: 6,                  // G-H: ผช., ภก.
  9: 7, 10: 8,                 // I-J: cash., Reg.
  11: 9, 12: 10,                // K-L: X-ray, Lab
  13: 11, 14: 12, 15: 13, 16: 14, // M-P: ภก.(PT), อื่นๆ, ตึกรังสีรักษา, ผ่าตัดกระเพาะ
  17: 15,                       // Q: บัญชี/IT
  18: 16,                       // R: ออกหน่วย
};

const MONTH_START = { year: 2568, month: 1 }; // row 4/5

function ymAt(k) {
  const totalMonth0 = (MONTH_START.month - 1) + k;
  const year = MONTH_START.year + Math.floor(totalMonth0 / 12);
  const month = (totalMonth0 % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

// "จ่าย31 10 69" → "2569-10-31" (best-effort; null if not parseable)
function parsePaidDate(label) {
  if (typeof label !== "string") return null;
  const m = label.match(/จ่าย\s*(\d{1,2})\s*(\d{1,2})\s*(\d{2,4})/);
  if (!m) return null;
  const [, d, mo, yRaw] = m;
  const y = yRaw.length === 2 ? 2500 + Number(yRaw) : Number(yRaw);
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function sqlStr(v) {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function main() {
  const wb = XLSX.readFile(SRC);
  const ws = wb.Sheets["69"];
  if (!ws) throw new Error('sheet "69" not found in ' + SRC);

  const rows = [];
  const NUM_PAIRS = 21; // Jan 2568 .. Sep 2569
  for (let k = 0; k < NUM_PAIRS; k++) {
    const budgetRow = 4 + 2 * k;
    const actualRow = 5 + 2 * k;
    const yearMonth = ymAt(k);

    const actualLabelCell = ws[`A${actualRow}`];
    const paidDate = parsePaidDate(actualLabelCell ? actualLabelCell.v : null);

    for (const [colStr, categoryId] of Object.entries(COL_TO_CATEGORY)) {
      const col = Number(colStr);
      const colLetter = XLSX.utils.encode_col(col - 1);
      const bCell = ws[`${colLetter}${budgetRow}`];
      const aCell = ws[`${colLetter}${actualRow}`];
      const budget = typeof bCell?.v === "number" ? Math.round(bCell.v) : 0;
      const actual = typeof aCell?.v === "number" ? Math.round(aCell.v) : 0;
      if (budget === 0 && actual === 0) continue; // nothing to import for this cell
      rows.push({ yearMonth, categoryId, budget, actual, paidDate });
    }
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const BATCH = 50;
  let batch = 1;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const stmts = chunk.map(r => `INSERT INTO ot_monthly (year_month,category_id,budget_amount,actual_amount,paid_date,updated_by) ` +
      `VALUES (${sqlStr(r.yearMonth)},${r.categoryId},${r.budget},${r.actual},${sqlStr(r.paidDate)},'import-script') ` +
      `ON CONFLICT(year_month,category_id) DO UPDATE SET budget_amount=excluded.budget_amount, actual_amount=excluded.actual_amount, paid_date=excluded.paid_date, updated_by=excluded.updated_by, updated_at=datetime('now');`);
    const fname = path.join(OUT_DIR, `batch_${String(batch).padStart(2, "0")}.sql`);
    fs.writeFileSync(fname, stmts.join("\n") + "\n", "utf8");
    console.log(`batch_${String(batch).padStart(2, "0")}.sql  (${chunk.length} rows)`);
    batch++;
  }
  console.log(`\nDone — ${rows.length} rows across ${batch - 1} files`);

  // Also print per-month totals for verification against the Excel's own S column.
  const totals = new Map();
  for (const r of rows) {
    const t = totals.get(r.yearMonth) ?? { budget: 0, actual: 0 };
    t.budget += r.budget; t.actual += r.actual;
    totals.set(r.yearMonth, t);
  }
  console.log("\n-- per-month totals (compare against column S in the Excel) --");
  for (const [ym, t] of [...totals.entries()].sort()) {
    console.log(`${ym}  budget=${t.budget}  actual=${t.actual}`);
  }
}

main();
