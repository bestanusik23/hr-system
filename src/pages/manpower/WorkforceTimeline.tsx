import { useState, useEffect } from "react";

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

const SHIFT_META: Record<ShiftKey, {
  label: string; color: string; grad: string;
  zoneColor: string; zoneBorder: string;
  leftPct: number; widthPct: number;
}> = {
  night:   { label: "เวรดึก",  color: "#001d66", grad: "linear-gradient(135deg,#001d66 0%,#1e3a8a 100%)", zoneColor: "rgba(0,29,102,0.035)",  zoneBorder: "1px solid rgba(0,29,102,0.12)",  leftPct: 0,      widthPct: 33.333 },
  morning: { label: "เวรเช้า", color: "#0038c6", grad: "linear-gradient(135deg,#0038c6 0%,#2563eb 100%)", zoneColor: "rgba(0,56,198,0.04)",   zoneBorder: "1px solid rgba(0,56,198,0.12)",  leftPct: 33.333, widthPct: 33.334 },
  evening: { label: "เวรบ่าย", color: "#c27803", grad: "linear-gradient(135deg,#c27803 0%,#d97706 100%)", zoneColor: "rgba(194,120,3,0.035)", zoneBorder: "none",                           leftPct: 66.667, widthPct: 33.333 },
};

const SHIFT_TABS: { key: Shift; label: string; n?: number }[] = [
  { key: "all",     label: "ทุกช่วงเวลา" },
  { key: "night",   label: "เวรดึก · 00:00–08:00",  n: 22 },
  { key: "morning", label: "เวรเช้า · 08:00–16:00", n: 109 },
  { key: "evening", label: "เวรบ่าย · 16:00–24:00", n: 27 },
];

const TAB_ACTIVE_BG: Record<Shift, string> = {
  all:     "linear-gradient(135deg,#334155,#1e293b)",
  night:   "linear-gradient(135deg,#001d66,#1e3a8a)",
  morning: "linear-gradient(135deg,#0038c6,#2563eb)",
  evening: "linear-gradient(135deg,#c27803,#d97706)",
};

const ZONE_TICKS = [
  { t: "00:00", p: 0 }, { t: "04:00", p: 16.67 }, { t: "08:00", p: 33.33 },
  { t: "12:00", p: 50 }, { t: "16:00", p: 66.67 }, { t: "20:00", p: 83.33 },
  { t: "24:00", p: 99.8 },
];

const SHIFT_KEYS: ShiftKey[] = ["night", "morning", "evening"];
const DEPT_W = 200;

function getNow(): [number, string] {
  const d = new Date();
  const pct = (d.getHours() * 60 + d.getMinutes()) / 1440 * 100;
  const str = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return [pct, str];
}

function fillColor(pct: number) {
  if (pct >= 75) return "#16a34a";
  if (pct >= 50) return "#0038c6";
  return "#f59e0b";
}

export default function WorkforceTimeline() {
  const [active, setActive] = useState<Shift>("all");
  const [[nowPct, nowStr], setNow] = useState<[number, string]>(getNow);

  useEffect(() => {
    const id = setInterval(() => setNow(getNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      background: "#fff",
      borderRadius: 20,
      overflow: "hidden",
      boxShadow: "0 8px 32px rgba(0,56,198,.12), 0 1px 4px rgba(0,0,0,.06)",
    }}>

      {/* ══ Gradient Header ══ */}
      <div style={{
        background: "linear-gradient(135deg, #0038c6 0%, #001d66 100%)",
        padding: "22px 24px 18px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* decorative blobs */}
        <div style={{ position: "absolute", top: -40, right: 80,  width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 20,  right: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,.04)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -20, left: 40, width: 80, height: 80, borderRadius: "50%", background: "rgba(38,169,224,.15)", pointerEvents: "none" }} />

        {/* title + kpi */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", position: "relative" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>
              ไทม์ไลน์กำลังคนที่ปฏิบัติงาน
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.6)", marginTop: 4 }}>
              บุคลากรปัจจุบันแยกตามฝ่ายและช่วงเวลาปฏิบัติงาน
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {([
              ["158", "ปฏิบัติงาน", "#93c5fd"],
              ["239", "อัตราแผน",   "rgba(255,255,255,.55)"],
              ["9",   "ฝ่าย",        "rgba(255,255,255,.55)"],
            ] as [string, string, string][]).map(([n, l, nc]) => (
              <div key={l} style={{
                background: "rgba(255,255,255,.13)",
                border: "1px solid rgba(255,255,255,.2)",
                borderRadius: 14,
                padding: "10px 18px",
                textAlign: "center",
                minWidth: 76,
                backdropFilter: "blur(6px)",
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: nc, lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.55)", marginTop: 4, fontWeight: 500 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* shift tabs */}
        <div style={{ display: "flex", gap: 7, marginTop: 18, flexWrap: "wrap", position: "relative" }}>
          {SHIFT_TABS.map(t => {
            const on = active === t.key;
            return (
              <button key={t.key} onClick={() => setActive(t.key)} style={{
                border: on ? "none" : "1.5px solid rgba(255,255,255,.25)",
                background: on ? TAB_ACTIVE_BG[t.key] : "rgba(255,255,255,.10)",
                color: "#fff",
                borderRadius: 10,
                padding: "7px 14px",
                fontSize: 12.5,
                fontFamily: "inherit",
                fontWeight: on ? 700 : 500,
                cursor: "pointer",
                transition: "all .15s",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                boxShadow: on ? "0 4px 12px rgba(0,0,0,.25)" : "none",
              }}>
                {t.label}
                {t.n !== undefined && (
                  <span style={{
                    background: on ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.16)",
                    borderRadius: 99,
                    padding: "1px 8px",
                    fontSize: 11, fontWeight: 700,
                    lineHeight: 1.6,
                  }}>{t.n}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ Chart ══ */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 640 }}>

          {/* Ruler */}
          <div style={{ display: "flex", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{
              width: DEPT_W, minWidth: DEPT_W,
              padding: "8px 14px",
              fontSize: 10, fontWeight: 700, color: "#94a3b8",
              letterSpacing: "0.08em", textTransform: "uppercase" as const,
              borderRight: "1px solid #e2e8f0",
              display: "flex", alignItems: "center",
            }}>ฝ่าย / แผนก</div>

            <div style={{ flex: 1, position: "relative", height: 50 }}>
              {/* zone bands */}
              {SHIFT_KEYS.map(s => {
                const m = SHIFT_META[s];
                const label = { night: "ดึก", morning: "เช้า", evening: "บ่าย" }[s];
                const textColor = s === "evening" ? "#92400e" : m.color;
                return (
                  <div key={s} style={{
                    position: "absolute", top: 0, height: 20,
                    left: `${m.leftPct}%`, width: `${m.widthPct}%`,
                    background: m.zoneColor,
                    borderRight: m.zoneBorder,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
                      textTransform: "uppercase" as const, color: textColor,
                    }}>{label}</span>
                  </div>
                );
              })}
              {/* zone background lower half */}
              {SHIFT_KEYS.map(s => {
                const m = SHIFT_META[s];
                return (
                  <div key={`bg-${s}`} style={{
                    position: "absolute", top: 20, bottom: 0,
                    left: `${m.leftPct}%`, width: `${m.widthPct}%`,
                    borderRight: m.zoneBorder,
                  }} />
                );
              })}
              {/* hour ticks */}
              {ZONE_TICKS.map(tick => (
                <span key={tick.t} style={{
                  position: "absolute", bottom: 7, left: `${tick.p}%`,
                  transform: "translateX(-50%)",
                  fontSize: 10, color: "#94a3b8", fontWeight: 600, pointerEvents: "none",
                }}>{tick.t}</span>
              ))}
              {/* now indicator */}
              <div style={{
                position: "absolute", bottom: 0, left: `${nowPct}%`,
                transform: "translateX(-50%)",
                display: "flex", flexDirection: "column", alignItems: "center",
                pointerEvents: "none", zIndex: 10,
              }}>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, color: "#ef4444",
                  background: "#fff",
                  border: "1.5px solid rgba(239,68,68,.35)",
                  padding: "1px 5px", borderRadius: 4,
                  whiteSpace: "nowrap", marginBottom: 1, lineHeight: 1.6,
                  boxShadow: "0 2px 6px rgba(239,68,68,.18)",
                }}>{nowStr}</span>
                <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "6px solid #ef4444" }} />
              </div>
            </div>
          </div>

          {/* Dept rows */}
          {DEPTS.map((dept, idx) => {
            const pct = Math.round(dept.filled / dept.plan * 100);
            const fc  = fillColor(pct);
            return (
              <div key={dept.name} style={{
                display: "flex", alignItems: "stretch",
                borderBottom: idx < DEPTS.length - 1 ? "1px solid #f1f5f9" : "none",
                background: idx % 2 === 0 ? "#fafcff" : "#fff",
              }}>

                {/* label */}
                <div style={{
                  width: DEPT_W, minWidth: DEPT_W,
                  padding: "13px 14px",
                  borderRight: "1px solid #e8edf5",
                  display: "flex", flexDirection: "column", justifyContent: "center", gap: 2,
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b", lineHeight: 1.3 }}>{dept.name}</div>
                  {dept.sub && <div style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 500 }}>{dept.sub}</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                    <div style={{ flex: 1, height: 5, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 99, width: `${pct}%`,
                        background: `linear-gradient(90deg, ${fc}, ${fc}99)`,
                        transition: "width .4s",
                      }} />
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: fc,
                      background: `${fc}18`,
                      border: `1px solid ${fc}30`,
                      borderRadius: 99, padding: "0 6px", lineHeight: 1.7,
                    }}>{pct}%</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 1 }}>{dept.filled} / {dept.plan} คน</div>
                </div>

                {/* track */}
                <div style={{ flex: 1, position: "relative", minHeight: 68 }}>
                  {/* zone dashes */}
                  {SHIFT_KEYS.map(s => {
                    const m = SHIFT_META[s];
                    return (
                      <div key={s} style={{
                        position: "absolute", top: 0, bottom: 0,
                        left: `${m.leftPct}%`, width: `${m.widthPct}%`,
                        borderRight: s !== "evening"
                          ? `1px dashed ${s === "night" ? "rgba(0,29,102,.07)" : "rgba(0,56,198,.07)"}`
                          : "none",
                      }} />
                    );
                  })}

                  {/* shift bars */}
                  {SHIFT_KEYS.map(s => {
                    const count = dept.shifts[s];
                    if (count === 0) return null;
                    const m   = SHIFT_META[s];
                    const dim = active !== "all" && active !== s;
                    return (
                      <div key={s}
                        title={`${dept.name}${dept.sub ? ` · ${dept.sub}` : ""} | ${m.label}: ${count} คน`}
                        style={{
                          position: "absolute",
                          top: 10, bottom: 10,
                          left: `calc(${m.leftPct}% + 4px)`,
                          width: `calc(${m.widthPct}% - 8px)`,
                          borderRadius: 10,
                          background: m.grad,
                          opacity: dim ? 0.07 : 1,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 800, color: "#fff",
                          overflow: "hidden", whiteSpace: "nowrap",
                          transition: "opacity .2s",
                          cursor: "default",
                          boxShadow: dim ? "none" : `0 3px 10px ${m.color}60`,
                        }}>
                        <span style={{
                          background: "rgba(255,255,255,.22)",
                          borderRadius: 7,
                          padding: "2px 10px",
                          lineHeight: 1.6,
                        }}>{count} คน</span>
                      </div>
                    );
                  })}

                  {/* now line */}
                  <div style={{
                    position: "absolute", top: 0, bottom: 0,
                    left: `${nowPct}%`, width: 2,
                    background: "linear-gradient(180deg, transparent 0%, rgba(239,68,68,.75) 12%, rgba(239,68,68,.75) 88%, transparent 100%)",
                    borderRadius: 1, pointerEvents: "none", zIndex: 8,
                    boxShadow: "0 0 6px rgba(239,68,68,.35)",
                  }} />
                </div>
              </div>
            );
          })}

          {/* Totals footer */}
          <div style={{ display: "flex", borderTop: "2px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{
              width: DEPT_W, minWidth: DEPT_W,
              padding: "14px 14px",
              fontSize: 12, fontWeight: 700, color: "#1e293b",
              borderRight: "1px solid #e2e8f0",
              display: "flex", alignItems: "center",
            }}>รวมทุกฝ่าย</div>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
              {([
                ["22",  SHIFT_META.night.grad,   SHIFT_META.night.color,   "คน · เวรดึก",  "rgba(0,29,102,.25)"],
                ["109", SHIFT_META.morning.grad, SHIFT_META.morning.color, "คน · เวรเช้า", "rgba(0,56,198,.25)"],
                ["27",  SHIFT_META.evening.grad, SHIFT_META.evening.color, "คน · เวรบ่าย", "rgba(194,120,3,.25)"],
              ] as [string, string, string, string, string][]).map(([n, grad, , l, shadow], i) => (
                <div key={i} style={{
                  padding: "12px 0", textAlign: "center",
                  borderRight: i < 2 ? "1px dashed #e2e8f0" : "none",
                }}>
                  <div style={{
                    display: "inline-block",
                    background: grad,
                    borderRadius: 10,
                    padding: "4px 20px",
                    fontSize: 22, fontWeight: 800, color: "#fff",
                    lineHeight: 1.3, marginBottom: 5,
                    boxShadow: `0 4px 12px ${shadow}`,
                  }}>{n}</div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", gap: 16, padding: "13px 20px",
        flexWrap: "wrap", alignItems: "center",
        borderTop: "1px solid #f0f4f8",
        background: "#fafbff",
      }}>
        {SHIFT_KEYS.map(s => {
          const m = SHIFT_META[s];
          const labels: Record<ShiftKey, string> = {
            night: "เวรดึก 00:00–08:00", morning: "เวรเช้า 08:00–16:00", evening: "เวรบ่าย 16:00–24:00",
          };
          return (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#475569" }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: m.grad, flexShrink: 0, boxShadow: `0 1px 3px ${m.color}50` }} />
              {labels[s]}
            </div>
          );
        })}
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#475569" }}>
          <span style={{ width: 3, height: 14, borderRadius: 99, background: "#ef4444", flexShrink: 0, boxShadow: "0 0 4px rgba(239,68,68,.4)" }} />
          เวลาปัจจุบัน
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>ข้อมูล: แผนกำลังคน 2569 · อัปเดต มิ.ย. 2569</span>
      </div>

    </div>
  );
}
