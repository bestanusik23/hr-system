// Seniority of a position, read from its title (the system has no level field).
// Used to list positions senior-first: executives, managers, heads, staff, assistants.

export const POSITION_TIERS = ["ผู้บริหาร", "หัวหน้างาน", "วิชาชีพ / เจ้าหน้าที่", "ผู้ช่วย / พนักงาน"];
const OFFICER_TIER = 2;

const LEVELS: { tier: number; re: RegExp }[] = [
  { tier: 0, re: /^(รักษาการ\s*)?ผู้อำนวยการ/ },
  { tier: 0, re: /^(รักษาการ\s*)?รอง\s*(ผู้อำนวยการ|ผอ\.?)/ },
  { tier: 0, re: /^ผู้ช่วย(รอง)?ผู้อำนวยการ/ },
  { tier: 0, re: /^(ผู้จัดการ|สมุห์บัญชี)/ },
  { tier: 0, re: /^ผู้ช่วยผู้จัดการ/ },
  { tier: 1, re: /^หัวหน้า/ },
  { tier: 1, re: /^รองหัวหน้า/ },
  { tier: 3, re: /^(ผู้ช่วย|ผู้ช่่วย|พนักงาน|แม่บ้าน)/ },
];

/** tier = POSITION_TIERS index; rank = finer order (lower is more senior). */
export function positionLevel(position: string): { tier: number; rank: number } {
  const p = (position ?? "").trim();
  const index = LEVELS.findIndex(l => l.re.test(p));
  if (index < 0) return { tier: OFFICER_TIER, rank: LEVELS.findIndex(l => l.tier > OFFICER_TIER) - 0.5 };
  return { tier: LEVELS[index].tier, rank: index };
}
