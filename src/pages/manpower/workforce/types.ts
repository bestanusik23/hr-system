// ─── Core data types for the Workforce Engine ────────────────────────────────

/** Minutes from midnight [0, 2879] — extended range supports overnight shifts */
export interface TimeRange {
  startMin: number;
  endMin: number;   // may exceed 1440 for overnight (e.g. I16 16:00→08:00 = 960→1920)
}

/** One day's shift record for an employee */
export interface ShiftRecord {
  date: string;         // "DD/MM/YYYY" Thai BE
  code: string;         // e.g. "D08", "N00", "I16"
  name: string;         // full shift name from Excel
  ranges: TimeRange[];  // 1 range normally, 2 for split shifts like I008
  isActive: boolean;    // false = DAY OFF / leave / unparseable
}

/** An employee extracted from the payroll Excel */
export interface Employee {
  code: string;
  name: string;
  deptCode: string;
  deptName: string;   // cleaned — branch suffix removed
  branch: string;
  records: ShiftRecord[];
}

/** Output from parseWorkbook() */
export interface ParseResult {
  employees: Employee[];
  availableDates: string[];   // sorted "DD/MM/YYYY"
  reportTitle: string;
  dateRangeStr: string;
}

// ─── Dashboard data types ─────────────────────────────────────────────────────

export interface KPIData {
  totalActiveStaff: number;
  departmentsOperating: number;
  currentActiveStaff: number;
  peakHour: string;
  peakWorkforce: number;
  lowHour: string;
  lowWorkforce: number;
}

export interface HourlyPoint {
  hour: string;   // "HH:00"
  staff: number;
}

/** One distinct working-time period found in the actual data (e.g. "07:00–16:00", "20:00–08:00") */
export interface ShiftBlock {
  label: string;      // "HH:MM–HH:MM" already wrapped for display
  startMin: number;   // 0–1439
  endMin: number;     // may exceed 1440 for overnight blocks
  count: number;      // staff working this exact block
  color: string;      // stable color for this time period, shared across departments
}

/** Compatible with the existing Dept type used by WorkforceTimeline */
export interface DeptTimelineItem {
  name: string;
  sub: string;
  plan: number;
  filled: number;
  blocks: ShiftBlock[];   // variable-length list of actual time periods worked in this department
  otPaid?: number;        // ยอด OT ที่จ่ายจริง (บาท) — filled in by WorkforceTimeline from workforce_ot_entries, not the engine
}

/** One department's OT amount for a payroll month, entered manually by HR (workforce_ot_entries) */
export interface OtEntry {
  month: string;      // "MM/YYYY" Thai BE, e.g. "07/2569"
  deptName: string;
  amountThb: number;
  note: string;
}

export interface ShiftSummaryItem {
  shift: string;       // actual time period label, e.g. "08:00–16:00"
  staff: number;
  percentage: number;
  color: string;
}

export interface DeptRankItem {
  department: string;
  staff: number;
}

export interface DashboardData {
  kpi: KPIData;
  hourlyWorkforce: HourlyPoint[];   // 06:00→05:00 next day (25 points)
  departmentTimeline: DeptTimelineItem[];
  shiftSummary: ShiftSummaryItem[];
  departmentRanking: DeptRankItem[];
  metadata: {
    targetDate: string;
    availableDates: string[];
    generatedAt: string;
    totalEmployees: number;
  };
}

/** One calendar month grouped from ParseResult.availableDates */
export interface MonthOption {
  key: string;      // "MM/YYYY" Thai BE, e.g. "06/2569"
  label: string;    // "มิถุนายน 2569"
  dates: string[];  // all "DD/MM/YYYY" dates in this file that fall in this month
}

/** One employee actively on duty at a specific point in time (used by the real-time NOW-line click) */
export interface CurrentStaffEntry {
  department: string;
  name: string;
  rangeLabel: string;   // the shift time period they're working, e.g. "08:00–16:00"
}

/** Monthly aggregate — person-day totals for reporting, reuses the same panel shapes as DashboardData */
export interface MonthlySummary {
  monthLabel: string;
  daysInRange: number;
  totalPersonDays: number;
  avgStaffPerDay: number;
  departmentsOperating: number;
  shiftSummary: ShiftSummaryItem[];       // total person-days per actual time period
  hourlyWorkforce: HourlyPoint[];         // averaged per hour across the month
  peakHour: string;
  peakWorkforce: number;                 // average, not a period sum
  departmentTimeline: DeptTimelineItem[]; // filled/blocks = avg per day, for the Gantt panel
  departmentRanking: DeptRankItem[];      // staff = total person-days
}
