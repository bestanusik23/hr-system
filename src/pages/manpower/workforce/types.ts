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
  morningShift: number;
  eveningShift: number;
  nightShift: number;
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

/** Compatible with the existing Dept type used by WorkforceTimeline */
export interface DeptTimelineItem {
  name: string;
  sub: string;
  plan: number;
  filled: number;
  shifts: { night: number; morning: number; evening: number };
}

export interface ShiftSummaryItem {
  shift: string;
  staff: number;
  percentage: number;
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
