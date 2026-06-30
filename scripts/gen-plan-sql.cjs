// Converts src/data/manpowerPlan.ts → SQL INSERT statements for manpower_plan table
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '../src/data/manpowerPlan.ts'), 'utf8'
);

// Strip TypeScript type annotations and extract array literal
const arrayMatch = src.match(/=\s*(\[[\s\S]*\]);?\s*$/);
if (!arrayMatch) { console.error('Cannot find array'); process.exit(1); }

// Safely evaluate the array (pure JS object syntax after stripping TS)
const arrayStr = arrayMatch[1];
const rows = eval(arrayStr);  // Safe: local file, no user input

const esc = s => String(s ?? '').replace(/'/g, "''");

// Clear all notes — users will add their own via inline editing
const lines = rows.map((r, i) =>
  `(${i},'${esc(r.type)}','${esc(r.name)}','${esc(r.pos)}',${r.divId},${r.plan},'',${i})`
);

const sql = `-- Manpower plan data — auto-generated from manpowerPlan.ts (${new Date().toISOString().slice(0,10)})
-- ${rows.length} rows
INSERT OR IGNORE INTO manpower_plan (row_idx,type,name,pos,div_id,plan_qty,note,sort_order) VALUES
${lines.join(',\n')};

-- Fold in any existing plan_overrides deltas
UPDATE manpower_plan SET
  plan_qty = plan_qty + (SELECT delta FROM manpower_plan_overrides o WHERE o.row_idx = manpower_plan.row_idx),
  updated_at = datetime('now')
WHERE EXISTS (SELECT 1 FROM manpower_plan_overrides o WHERE o.row_idx = manpower_plan.row_idx);
`;

const out = path.join(__dirname, '../migrations/0017_manpower_plan_data.sql');
fs.writeFileSync(out, sql, 'utf8');
console.log(`Written: ${out}  (${rows.length} rows)`);
