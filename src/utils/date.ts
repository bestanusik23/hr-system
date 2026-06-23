// Shared date helpers — handles Buddhist Era (พ.ศ.) inputs gracefully.

export function toGregorian(dateStr: string): Date {
  const d = new Date(dateStr);
  if (d.getFullYear() >= 2500) return new Date(d.getFullYear() - 543, d.getMonth(), d.getDate());
  return d;
}

/** Whole days elapsed since a date (positive = in the past). */
export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - toGregorian(dateStr).getTime()) / 86400000);
}

/** Whole days remaining until a date (positive = in the future, negative = overdue). */
export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((toGregorian(dateStr).getTime() - Date.now()) / 86400000);
}

/** Years/months of service from a start date. */
export function tenure(startDate: string | null): string {
  const days = daysSince(startDate);
  if (days === null || days < 0) return "—";
  const years  = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years > 0)  return `${years} ปี ${months} เดือน`;
  if (months > 0) return `${months} เดือน`;
  return `${days} วัน`;
}

export function formatThaiDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return toGregorian(dateStr).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}
