/**
 * barApi.ts — ชั้นข้อมูลกลางของเมนู Bar Management
 *
 * รวมข้อมูล 4 แหล่งที่ "มีอยู่แล้ว" ในระบบ ไม่สร้างการนำเข้าข้อมูลซ้ำซ้อน:
 *   1. dept_bar_config      → Approved Bar + ประเภทงาน (ตั้งค่าในหน้า Bar Management)
 *   2. ไฟล์กะที่นำเข้าแล้ว   → Actual Bar (นำเข้า Excel ที่แท็บ Timeline เหมือนเดิม)
 *   3. workforce_ot_entries → ยอดเงิน OT (กรอกเอง / นำเข้า Excel ค่าเวร เหมือนเดิม)
 *   4. ot_approvals         → ชั่วโมง OT + เหตุผล + สถานะอนุมัติ (ของใหม่)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAvailableMonths, calculateMonthly } from "../workforce/api";
import type { ParseResult, MonthOption, DeptTimelineItem } from "../workforce/api";
import { loadImportLocal, loadImportRemote } from "../workforce/persist";
import { getPlanByPayrollDept } from "../workforce/planMap";
import { PAYROLL_DEPT_NAMES } from "../workforce/divisionMap";
import {
  actualBarForDept, slotBars, totalsOf, FALLBACK_STANDARDS, compareMonthKey, shortMonthLabel,
  type BarConfigRow, type DeptBarRow, type DeptType, type ShiftStandardRow,
} from "./barMath";

// ─── REST helpers ─────────────────────────────────────────────────────────────
async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    const d = await r.json() as T & { ok?: boolean };
    return d?.ok === false ? null : d;
  } catch { return null; }
}

export async function fetchBarConfig(): Promise<BarConfigRow[]> {
  const d = await getJson<{ config: BarConfigRow[] }>("/api/manpower/bar-config");
  return d?.config ?? [];
}

export async function saveBarConfig(row: {
  dept_name: string; approved_bar: number; dept_type: DeptType; active?: number; note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("/api/manpower/bar-config", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    return await r.json() as { ok: boolean; error?: string };
  } catch { return { ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" }; }
}

export async function fetchShiftStandards(): Promise<ShiftStandardRow[]> {
  const d = await getJson<{ standards: ShiftStandardRow[] }>("/api/manpower/shift-standards");
  return d?.standards?.length ? d.standards : FALLBACK_STANDARDS;
}

export async function saveShiftStandard(row: {
  position: string; hours: number; bar_value: number; note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("/api/manpower/shift-standards", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    return await r.json() as { ok: boolean; error?: string };
  } catch { return { ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" }; }
}

export async function deleteShiftStandard(position: string, hours: number) {
  try {
    const r = await fetch(`/api/manpower/shift-standards?position=${encodeURIComponent(position)}&hours=${hours}`,
      { method: "DELETE" });
    return await r.json() as { ok: boolean; error?: string };
  } catch { return { ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" }; }
}

export interface OtApprovalRow {
  month: string; dept_name: string; ot_hours: number; over_bar: number;
  reason: string; status: "pending" | "approved" | "rejected";
  requested_by: string | null; decided_by: string | null;
  decided_at: string | null; decision_note: string; updated_at: string;
}

export async function fetchOtApprovals(month: string): Promise<OtApprovalRow[]> {
  const d = await getJson<{ approvals: OtApprovalRow[] }>(
    `/api/manpower/ot-approvals?month=${encodeURIComponent(month)}`);
  return d?.approvals ?? [];
}

export async function saveOtRequest(row: {
  month: string; dept_name: string; ot_hours: number; over_bar: number; reason: string;
}) {
  try {
    const r = await fetch("/api/manpower/ot-approvals", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    return await r.json() as { ok: boolean; error?: string };
  } catch { return { ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" }; }
}

export async function decideOtRequest(row: {
  month: string; dept_name: string; status: "approved" | "rejected" | "pending"; decision_note?: string;
}) {
  try {
    const r = await fetch("/api/manpower/ot-approvals", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    return await r.json() as { ok: boolean; error?: string };
  } catch { return { ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" }; }
}

export interface OtEntryRow { dept_name: string; amount_thb: number; note: string; updated_at: string }

export async function fetchOtEntries(month: string): Promise<OtEntryRow[]> {
  const d = await getJson<{ entries: OtEntryRow[] }>(
    `/api/manpower/ot-entries?month=${encodeURIComponent(month)}`);
  return d?.entries ?? [];
}

export interface OtMonthTotal { month: string; total_thb: number; dept_count: number }

export async function fetchOtMonthTotals(): Promise<OtMonthTotal[]> {
  const d = await getJson<{ months: OtMonthTotal[] }>("/api/manpower/ot-entries?months=all");
  return d?.months ?? [];
}

// ─── Hook หลัก ────────────────────────────────────────────────────────────────
export interface BarData {
  rows: DeptBarRow[];
  totals: ReturnType<typeof totalsOf>;
  standards: ShiftStandardRow[];
  config: BarConfigRow[];
  monthOptions: MonthOption[];
  hasShiftData: boolean;
  loading: boolean;
  reload: () => void;
  parsed: ParseResult | null;
}

/**
 * โหลดและรวมข้อมูลทั้งหมดของเดือนที่เลือก
 * Approved Bar: ใช้ค่าที่ตั้งไว้ใน dept_bar_config ก่อน — ถ้ายังไม่ตั้ง จะใช้ plan_qty
 * จาก manpower_plan เป็นค่าเริ่มต้น (เท่ากับพฤติกรรมเดิมของ Workforce Timeline)
 */
export function useBarData(month: string): BarData {
  const [parsed, setParsed]       = useState<ParseResult | null>(null);
  const [config, setConfig]       = useState<BarConfigRow[]>([]);
  const [standards, setStandards] = useState<ShiftStandardRow[]>(FALLBACK_STANDARDS);
  const [planMap, setPlanMap]     = useState<Map<string, number>>(new Map());
  const [otEntries, setOtEntries] = useState<OtEntryRow[]>([]);
  const [approvals, setApprovals] = useState<OtApprovalRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [bump, setBump]           = useState(0);

  const reload = useCallback(() => setBump(b => b + 1), []);

  // ข้อมูลที่ไม่ผูกกับเดือน
  useEffect(() => {
    let alive = true;
    (async () => {
      const [cfg, std, plan] = await Promise.all([
        fetchBarConfig(), fetchShiftStandards(), getPlanByPayrollDept().catch(() => new Map<string, number>()),
      ]);
      if (!alive) return;
      setConfig(cfg); setStandards(std); setPlanMap(plan);
    })();
    return () => { alive = false; };
  }, [bump]);

  // ไฟล์กะที่นำเข้าไว้ (localStorage ก่อน แล้วค่อยทับด้วยของเซิร์ฟเวอร์)
  useEffect(() => {
    let alive = true;
    const local = loadImportLocal();
    if (local) setParsed(local.parsed);
    loadImportRemote().then(remote => {
      if (!alive || !remote) return;
      if (local && local.importedAt === remote.importedAt) return;
      setParsed(remote.parsed);
    });
    return () => { alive = false; };
  }, [bump]);

  // ข้อมูลรายเดือน
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const [entries, appr] = await Promise.all([fetchOtEntries(month), fetchOtApprovals(month)]);
      if (!alive) return;
      setOtEntries(entries); setApprovals(appr); setLoading(false);
    })();
    return () => { alive = false; };
  }, [month, bump]);

  const monthOptions = useMemo(() => (parsed ? getAvailableMonths(parsed) : []), [parsed]);

  // ตารางกะของเดือนที่เลือก (ค่าเฉลี่ยต่อวัน — หน่วยเดียวกับ Approved Bar ต่อวัน)
  const shiftDepts: DeptTimelineItem[] | null = useMemo(() => {
    if (!parsed) return null;
    const match = monthOptions.find(m => m.key === month);
    if (!match) return null;
    return calculateMonthly(parsed, match, planMap).departmentTimeline;
  }, [parsed, monthOptions, month, planMap]);

  const rows: DeptBarRow[] = useMemo(() => {
    const cfgMap  = new Map(config.map(c => [c.dept_name, c]));
    const shiftMap = new Map((shiftDepts ?? []).map(d => [d.name, d]));
    const otMap   = new Map(otEntries.map(e => [e.dept_name, e]));
    const apprMap = new Map(approvals.map(a => [a.dept_name, a]));

    const names = Array.from(new Set([...PAYROLL_DEPT_NAMES, ...config.map(c => c.dept_name)]))
      .filter(n => (cfgMap.get(n)?.active ?? 1) !== 0);

    return names.map(name => {
      const cfg   = cfgMap.get(name);
      const shift = shiftMap.get(name);
      const appr  = apprMap.get(name);

      const approvedBar = cfg?.approved_bar ?? planMap.get(name) ?? 0;
      const actualBar   = shift ? actualBarForDept(shift, standards) : 0;
      const otCost      = otMap.get(name)?.amount_thb ?? 0;

      return {
        name,
        type: (cfg?.dept_type ?? "Service") as DeptType,
        approvedBar,
        actualBar,
        headcount: shift?.filled ?? 0,
        variance: Math.round((actualBar - approvedBar) * 100) / 100,
        utilization: approvedBar > 0 ? (actualBar / approvedBar) * 100 : 0,
        otCost,
        otHours: appr?.ot_hours ?? 0,
        otPerBar: actualBar > 0 ? otCost / actualBar : 0,
        otStatus: (appr?.status ?? "none") as DeptBarRow["otStatus"],
        otReason: appr?.reason ?? "",
        slots: shift ? slotBars(shift.blocks) : new Array(12).fill(0),
        hasShiftData: !!shift,
      };
    }).sort((a, b) => b.otCost - a.otCost || a.name.localeCompare(b.name, "th"));
  }, [config, shiftDepts, otEntries, approvals, planMap, standards]);

  return {
    rows,
    totals: totalsOf(rows),
    standards, config, monthOptions,
    hasShiftData: shiftDepts !== null,
    loading, reload, parsed,
  };
}

// ─── แนวโน้มรายเดือน (ใช้ร่วมกันโดย Executive Dashboard และ Bar Analytics) ──────
export interface TrendPoint {
  key: string; label: string; otCost: number; actualBar: number;
  utilization: number; otPerBar: number; hasShift: boolean;
}

/**
 * รวมยอด OT รายเดือน (workforce_ot_entries) กับ Actual Bar ที่คำนวณจากไฟล์กะของเดือนนั้น
 * รับค่าที่ useBarData ของผู้เรียกดึงมาแล้ว (parsed/standards/monthOptions/approvedTotal)
 * เพื่อไม่ต้องดึงไฟล์กะซ้ำสองรอบ
 */
export function useOtTrend(
  month: string,
  parsed: ParseResult | null,
  standards: ShiftStandardRow[],
  monthOptions: MonthOption[],
  approvedTotal: number,
): TrendPoint[] {
  const [otMonths, setOtMonths] = useState<OtMonthTotal[]>([]);
  useEffect(() => { fetchOtMonthTotals().then(setOtMonths); }, [month]);

  return useMemo(() => {
    const otMap = new Map(otMonths.map(m => [m.month, m.total_thb]));
    const keys = Array.from(new Set([...otMap.keys(), ...monthOptions.map(m => m.key)]))
      .sort(compareMonthKey)
      .slice(-12);

    return keys.map(key => {
      const opt = monthOptions.find(m => m.key === key);
      let actualBar = 0;
      if (parsed && opt) {
        const depts = calculateMonthly(parsed, opt, new Map()).departmentTimeline;
        actualBar = depts.reduce((s, d) => s + actualBarForDept(d, standards), 0);
      }
      const otCost = otMap.get(key) ?? 0;
      return {
        key,
        label: shortMonthLabel(key),
        otCost, actualBar,
        utilization: approvedTotal > 0 && actualBar > 0 ? (actualBar / approvedTotal) * 100 : 0,
        otPerBar: actualBar > 0 ? otCost / actualBar : 0,
        hasShift: actualBar > 0,
      };
    });
  }, [otMonths, monthOptions, parsed, standards, approvedTotal]);
}
