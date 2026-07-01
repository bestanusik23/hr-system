import { useState, useEffect } from "react";

// ── Static data — manpowerPlan.ts aggregated by divId (June 2026) ──────
// Shift splits modelled from hospital ops: clinical/24h depts → 3 shifts;
// admin depts → day only.  night + morning + evening === filled for each row.
const DEPTS = [
  { name: "ฝ่ายเทคนิคบริการ", sub: "สหสาขา",    plan: 52, filled: 36, shifts: { night: 6,  morning: 22, evening: 8 } },
  { name: "ฝ่ายการพยาบาล",    sub: "ส่วนหน้า",   plan: 41, filled: 29, shifts: { night: 8,  morning: 14, evening: 7 } },
  { name: "ฝ่ายบริการ",       sub: "",            plan: 47, filled: 24, shifts: { night: 4,  morning: 14, evening: 6 } },
  { name: "ฝ่ายการเงิน",      sub: "",            plan: 20, filled: 16, shifts: { night: 0,  morning: 16, evening: 0 } },
  { name: "ฝ่ายสนับสนุน",     sub: "",            plan: 23, filled: 16, shifts: { night: 2,  morning: 10, evening: 4 } },
  { name: "ฝ่ายการแพทย์",     sub: "",            plan: 20, filled: 14, shifts: { night: 2,  morning: 10, evening: 2 } },
  { name: "สนง.ผู้อำนวยการ",  sub: "",            plan: 17, filled: 10, shifts: { night: 0,  morning: 10, evening: 0 } },
  { name: "ฝ่ายพัฒนาองค์กร",  sub: "",            plan: 12, filled:  9, shifts: { night: 0,  morning:  9, evening: 0 } },
  { name: "ฝ่ายบริหาร",       sub: "ค่าตอบแทนฯ", plan:  7, filled:  4, shifts: { night: 0,  morning:  4, evening: 0 } },
] as const;

type Shift    = "all" | "night" | "morning" | "evening";
type ShiftKey = "night" | "morning" | "evening";

const SHIFT_META: Record<ShiftKey, { label: string; color: string; leftPct: number; widthPct: number }> = {
  night:   { label: "เวรดึก",  color: "#001d66", leftPct: 0,      widthPct: 33.333 },
  morning: { label: "เวรเช้า", color: "#0038c6", leftPct: 33.333, widthPct: 33.334 },
  evening: { label: "เวรบ่าย", color: "#c27803", leftPct: 66.667, widthPct: 33.333 },
};

const SHIFT_TABS: { key: Shift; label: string; n?: number }[] = [
  { key: "all",     label: "ทุกช่วงเวลา" },
  { key: "night",   label: "เวรดึก · 00:00–08:00",  n: 22 },
  { key: "morning", label: "เวรเช้า · 08:00–16:00", n: 109 },
  { key: "evening", label: "เวรบ่าย · 16:00–24:00", n: 27 },
];

const TAB_ACTIVE_BG: Record<Shift, string> = {
  all: "#334155", night: "#001d66", morning: "#0038c6", evening: "#c27803",
};

function getNow(): [number, string] {
  const d   = new Date();
  const pct = (d.getHours() * 60 + d.getMinutes()) / 1440 * 100;
  const str = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  return [pct, str];
}

const BORDER     = "1px solid #e2e8f0";
const DEPT_W     = 200;
const ZONE_TICKS = [
  { t: "00:00", p: 0 }, { t: "04:00", p: 16.67 }, { t: "08:00", p: 33.33 },
  { t: "12:00", p: 50 }, { t: "16:00", p: 66.67 }, { t: "20:00", p: 83.33 },
  { t: "24:00", p: 99.8 },
];
const ZONE_LABELS = [
  { s: "night",   l: "ดึก",  lp: 16.667, c: "#001d66" },
  { s: "morning", l: "เช้า", lp: 50,     c: "#0038c6" },
  { s: "evening", l: "บ่าย", lp: 83.333, c: "#92400e" },
];
const ZONE_SHIFTS: { key: ShiftKey; night: string; day: string }[] = [
  { key: "night",   night: "rgba(0,29,102,0.05)",  day: "1px solid rgba(0,29,102,0.14)"  },
  { key: "morning", night: "rgba(0,56,198,0.04)",  day: "1px solid rgba(0,56,198,0.14)"  },
  { key: "evening", night: "rgba(194,120,3,0.05)", day: "none" },
];

export default function WorkforceTimeline() {
  const [active, setActive] = useState<Shift>("all");
  const [[nowPct, nowStr], setNow] = useState<[number, string]>(getNow);

  useEffect(() => {
    const id = setInterval(() => setNow(getNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 22, boxShadow: "0 1px 6px rgba(0,0,0,.06)" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0a1628" }}>ไทม์ไลน์กำลังคนที่ปฏิบัติงาน</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>บุคลากรปัจจุบันแยกตามฝ่ายและช่วงเวลาปฏิบัติงาน</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {([ ["158","ปฏิบัติงาน"], ["239","อัตราแผน"], ["9","ฝ่าย"] ] as [string, string][]).map(([n, l]) => (
            <div key={l} style={{ background: "#f1f5f9", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 70 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#0038c6", lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Shift-filter tabs ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {SHIFT_TABS.map(t => {
          const on = active === t.key;
          return (
            <button key={t.key} onClick={() => setActive(t.key)} style={{
              border: on ? "none" : "1.5px solid #e2e8f0",
              background: on ? TAB_ACTIVE_BG[t.key] : "#fff",
              color: on ? "#fff" : "#64748b",
              borderRadius: 7, padding: "6px 13px", fontSize: 12.5,
              fontFamily: "inherit", fontWeight: 500, cursor: "pointer",
              transition: "all .12s",
            }}>
              {t.label}
              {t.n !== undefined && <span style={{ opacity: .6, marginLeft: 4, fontWeight: 400 }}>({t.n} คน)</span>}
            </button>
          );
        })}
      </div>

      {/* ── Chart ── */}
      <div style={{ border: BORDER, borderRadius: 12, overflow: "hidden", overflowX: "auto" }}>
        <div style={{ minWidth: 640 }}>

          {/* Ruler */}
          <div style={{ display: "flex", background: "#f8fafc", borderBottom: BORDER }}>
            <div style={{ width: DEPT_W, minWidth: DEPT_W, padding: "8px 14px", fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.07em", textTransform: "uppercase" as const, borderRight: BORDER, display: "flex", alignItems: "center" }}>
              ฝ่าย / แผนก
            </div>
            <div style={{ flex: 1, position: "relative", height: 42 }}>
              {/* Zone shading */}
              {ZONE_SHIFTS.map(z => (
                <div key={z.key} style={{
                  position: "absolute", top: 0, bottom: 0,
                  left: `${SHIFT_META[z.key].leftPct}%`, width: `${SHIFT_META[z.key].widthPct}%`,
                  background: z.night, borderRight: z.day,
                }} />
              ))}
              {/* Zone name labels */}
              {ZONE_LABELS.map(z => (
                <span key={z.s} style={{
                  position: "absolute", top: 5, left: `${z.lp}%`,
                  transform: "translateX(-50%)",
                  fontSize: 9, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase" as const,
                  color: z.c, pointerEvents: "none",
                }}>{z.l}</span>
              ))}
              {/* Hour ticks */}
              {ZONE_TICKS.map(tick => (
                <span key={tick.t} style={{
                  position: "absolute", bottom: 7, left: `${tick.p}%`,
                  transform: "translateX(-50%)",
                  fontSize: 10, color: "#94a3b8", fontWeight: 600, pointerEvents: "none",
                }}>{tick.t}</span>
              ))}
              {/* Now indicator — triangle + time in ruler only, no per-row dot */}
              <div style={{
                position: "absolute", bottom: 0, left: `${nowPct}%`,
                transform: "translateX(-50%)",
                display: "flex", flexDirection: "column", alignItems: "center",
                pointerEvents: "none", zIndex: 10,
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: "rgb(239,68,68)",
                  background: "rgba(255,255,255,0.95)", padding: "1px 4px",
                  borderRadius: 3, whiteSpace: "nowrap", marginBottom: 1, lineHeight: 1.5,
                }}>{nowStr}</span>
                <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "5px solid rgb(239,68,68)" }} />
              </div>
            </div>
          </div>

          {/* Dept rows */}
          {DEPTS.map((dept, idx) => {
            const fillPct = Math.round(dept.filled / dept.plan * 100);
            return (
              <div key={dept.name} style={{
                display: "flex", alignItems: "stretch",
                borderBottom: idx < DEPTS.length - 1 ? BORDER : "none",
                background: idx % 2 === 0 ? "#fafcff" : "#fff",
              }}>
                {/* Dept label */}
                <div style={{ width: DEPT_W, minWidth: DEPT_W, padding: "12px 14px", borderRight: BORDER, display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b", lineHeight: 1.35 }}>
                    {dept.name}
                    {dept.sub && <span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}> · {dept.sub}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{dept.filled} / {dept.plan} คน ({fillPct}%)</div>
                  <div style={{ height: 3, background: "#e2e8f0", borderRadius: 99, marginTop: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${fillPct}%`, background: "linear-gradient(90deg,#0038c6,#60a5fa)" }} />
                  </div>
                </div>

                {/* Track */}
                <div style={{ flex: 1, position: "relative", minHeight: 62 }}>
                  {/* Zone dividers */}
                  {ZONE_SHIFTS.map(z => (
                    <div key={z.key} style={{
                      position: "absolute", top: 0, bottom: 0,
                      left: `${SHIFT_META[z.key].leftPct}%`, width: `${SHIFT_META[z.key].widthPct}%`,
                      borderRight: z.key !== "evening"
                        ? `1px dashed ${z.key === "night" ? "rgba(0,29,102,0.1)" : "rgba(0,56,198,0.1)"}`
                        : "none",
                    }} />
                  ))}

                  {/* Shift bars */}
                  {(["night", "morning", "evening"] as ShiftKey[]).map(s => {
                    const count = dept.shifts[s];
                    if (count === 0) return null;
                    const m   = SHIFT_META[s];
                    const dim = active !== "all" && active !== s;
                    return (
                      <div key={s}
                        title={`${dept.name}${dept.sub ? " · " + dept.sub : ""} | ${m.label}: ${count} คน`}
                        style={{
                          position: "absolute",
                          top: 11, bottom: 11,
                          left: `calc(${m.leftPct}% + 2px)`,
                          width: `calc(${m.widthPct}% - 4px)`,
                          borderRadius: 6,
                          background: m.color,
                          opacity: dim ? 0.1 : 1,
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                          fontSize: 11, fontWeight: 600, color: "#fff",
                          overflow: "hidden", whiteSpace: "nowrap",
                          transition: "opacity .18s",
                          cursor: "default",
                        }}>
                        <span style={{ background: "rgba(255,255,255,0.22)", borderRadius: 4, padding: "1px 5px", lineHeight: 1.5 }}>{count}</span>
                        <span style={{ opacity: .85 }}>คน</span>
                      </div>
                    );
                  })}

                  {/* Now line — thin vertical, no obstructing dot */}
                  <div style={{
                    position: "absolute", top: 0, bottom: 0,
                    left: `${nowPct}%`,
                    width: 2,
                    background: "rgba(239,68,68,0.55)",
                    borderRadius: 1,
                    pointerEvents: "none",
                    zIndex: 8,
                  }} />
                </div>
              </div>
            );
          })}

          {/* Totals footer */}
          <div style={{ display: "flex", borderTop: "1.5px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{ width: DEPT_W, minWidth: DEPT_W, padding: "10px 14px", fontSize: 11.5, fontWeight: 600, color: "#475569", borderRight: BORDER, display: "flex", alignItems: "center" }}>
              รวมทุกฝ่าย
            </div>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
              {([["22","#001d66","คน · เวรดึก"], ["109","#0038c6","คน · เวรเช้า"], ["27","#92400e","คน · เวรบ่าย"]] as [string,string,string][]).map(([n, c, l], i) => (
                <div key={i} style={{ padding: "10px 0", textAlign: "center", fontSize: 11.5, color: "#64748b", borderRight: i < 2 ? "1px dashed #e2e8f0" : "none", lineHeight: 1.5 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c, lineHeight: 1, marginBottom: 3 }}>{n}</div>
                  {l}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 18, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
        {([["#001d66","เวรดึก 00:00–08:00"],["#0038c6","เวรเช้า 08:00–16:00"],["#c27803","เวรบ่าย 16:00–24:00"]] as [string,string][]).map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#64748b" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c, flexShrink: 0 }} />
            {l}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#64748b" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "rgb(239,68,68)", flexShrink: 0 }} />
          เวลาปัจจุบัน
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>ข้อมูล: แผนกำลังคน 2569 · อัปเดต มิ.ย. 2569</span>
      </div>

    </div>
  );
}
