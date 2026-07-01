/**
 * positionMap.ts
 * Looks up an employee's job title ("ตำแหน่ง") by cross-referencing their name
 * against the hospital's manpower plan roster (src/data/manpowerPlan.ts), since
 * the payroll shift export has no position column at all.
 *
 * Name matching is fuzzy (honorific + whitespace normalized) because the two
 * spreadsheets are maintained independently and don't always agree on
 * "น.ส." vs "นางสาว" or spacing. Verified 2026-07-01 against the real payroll
 * file: ~79% of employees resolve to a position this way — the rest return
 * null and should render as "-" rather than a guess.
 */

import { MANPOWER_ROWS } from "../../../data/manpowerPlan";

const HONORIFICS = ["นางสาว", "นาง", "นาย", "น.ส.", "ด.ช.", "ด.ญ."];

function normalizeName(name: string): string {
  let n = name;
  for (const h of HONORIFICS) n = n.split(h).join("");
  return n.replace(/\s+/g, "");
}

const NAME_TO_POSITION = new Map<string, string>();
for (const row of MANPOWER_ROWS) {
  if (row.type === "slot" && row.emp) {
    const label = row.pos || row.name;
    if (label) NAME_TO_POSITION.set(normalizeName(row.emp), label);
  }
}

/** Returns the employee's position title, or null if not found in the manpower plan roster */
export function getPositionForName(employeeName: string): string | null {
  return NAME_TO_POSITION.get(normalizeName(employeeName)) ?? null;
}
