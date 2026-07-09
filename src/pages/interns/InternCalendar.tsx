import { useMemo, useState } from "react";
import type { InternListItem } from "./InternsPage";

type CalView = "month" | "week" | "timeline";

const STATUS_META: Record<string, { label: string; color: string }> = {
  upcoming:    { label: "รอเริ่มฝึก",  color: "#0891b2" },
  active:      { label: "กำลังฝึกงาน", color: "#16a34a" },
  ending_soon: { label: "ใกล้สิ้นสุด", color: "#d97706" },
  completed:   { label: "สิ้นสุดแล้ว", color: "#64748b" },
  cancelled:   { label: "ยกเลิก",      color: "#dc2626" },
};

const DAYS_TH   = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTHS_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function fullName(i: { prefix: string | null; first_name: string; last_name: string }) {
  return `${i.prefix ?? ""}${i.first_name} ${i.last_name}`.trim();
}
function thaiDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_TH[m - 1]} ${y + 543}`;
}
function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function inRange(day: string, start: string, end: string) {
  return day >= start && day <= end;
}

export default function InternCalendar({ interns, onOpenProfile }: {
  interns: InternListItem[]; onOpenProfile: (id: number) => void;
}) {
  const [calView, setCalView] = useState<CalView>("month");
  const [year, setYear]   = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [dayDetail, setDayDetail] = useState<{ date: string; rows: InternListItem[] } | null>(null);
  const [selected, setSelected] = useState<InternListItem | null>(null);

  const [fStatus, setFStatus] = useState("");
  const [fInst, setFInst]     = useState("");
  const [fDept, setFDept]     = useState("");
  const [fType, setFType]     = useState("");

  const filtered = useMemo(() => interns.filter(i =>
    (!fStatus || i.status === fStatus) &&
    (!fInst || i.institution_name === fInst) &&
    (!fDept || i.department_name === fDept) &&
    (!fType || i.training_type === fType)
  ), [interns, fStatus, fInst, fDept, fType]);

  const institutionsList = useMemo(() => [...new Set(interns.map(i => i.institution_name).filter(Boolean))] as string[], [interns]);
  const departmentsList  = useMemo(() => [...new Set(interns.map(i => i.department_name).filter(Boolean))] as string[], [interns]);

  function eventsOn(day: string): InternListItem[] {
    return filtered.filter(i => inRange(day, i.start_date, i.end_date));
  }

  function calDays(): (number | null)[] {
    const first   = new Date(year, month, 1).getDay();
    const daysInM = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array(first).fill(null);
    for (let d = 1; d <= daysInM; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const navBtn: React.CSSProperties = { padding: "5px 14px", borderRadius: 6, border: "1.5px solid #e5e7eb",
    background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#7c3aed" };
  const filterSel: React.CSSProperties = { padding: "7px 10px", borderRadius: 7, border: "1.5px solid #e5e7eb",
    fontSize: 12, fontFamily: "inherit", background: "#fff" };

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
          borderBottom: "1px solid #f1f5f9", background: "#faf9ff", flexWrap: "wrap" }}>
          {calView !== "timeline" && (
            <>
              <button onClick={prevMonth} style={navBtn}>←</button>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#0a1628", minWidth: 110, textAlign: "center" }}>
                {MONTHS_TH[month]} {year + 543}
              </span>
              <button onClick={nextMonth} style={navBtn}>→</button>
            </>
          )}
          <div style={{ display: "flex", gap: 3, background: "#ede9fe", borderRadius: 6, padding: 2, marginLeft: calView === "timeline" ? 0 : 8 }}>
            {(["month", "week", "timeline"] as CalView[]).map(v => (
              <button key={v} onClick={() => setCalView(v)} style={{
                padding: "4px 12px", borderRadius: 4, border: "none",
                background: calView === v ? "#7c3aed" : "transparent", color: calView === v ? "#fff" : "#6d28d9",
                fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                {v === "month" ? "เดือน" : v === "week" ? "สัปดาห์" : "Timeline"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
            <select style={filterSel} value={fStatus} onChange={e => setFStatus(e.target.value)}>
              <option value="">ทุกสถานะ</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select style={filterSel} value={fInst} onChange={e => setFInst(e.target.value)}>
              <option value="">ทุกสถาบัน</option>
              {institutionsList.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select style={filterSel} value={fDept} onChange={e => setFDept(e.target.value)}>
              <option value="">ทุกแผนก</option>
              {departmentsList.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select style={filterSel} value={fType} onChange={e => setFType(e.target.value)}>
              <option value="">ทุกรูปแบบ</option>
              {["ฝึกงาน", "สหกิจศึกษา", "ดูงาน", "ฝึกประสบการณ์วิชาชีพ", "อื่นๆ"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Month view */}
        {calView === "month" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "#faf9ff", borderBottom: "1px solid #e5e7eb" }}>
              {DAYS_TH.map(d => <div key={d} style={{ padding: "8px 0", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#6d28d9" }}>{d}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
              {calDays().map((day, i) => {
                const dateStr = day ? isoDate(year, month, day) : "";
                const items = day ? eventsOn(dateStr) : [];
                const isToday = day ? dateStr === new Date().toISOString().slice(0, 10) : false;
                return (
                  <div key={i} style={{ minHeight: 84, padding: "6px 6px 4px",
                    borderRight: i % 7 !== 6 ? "1px solid #f8fafc" : "none", borderBottom: "1px solid #f8fafc",
                    background: day ? "#fff" : "#fafbff" }}>
                    {day && (
                      <>
                        <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 400, color: isToday ? "#fff" : "#475569",
                          background: isToday ? "#7c3aed" : "transparent", width: 21, height: 21, borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>{day}</div>
                        {items.slice(0, 2).map(it => {
                          const meta = STATUS_META[it.status] ?? STATUS_META.upcoming;
                          return (
                            <div key={it.id} onClick={() => setSelected(it)}
                              style={{ fontSize: 10, background: meta.color + "15", color: meta.color,
                                borderLeft: `3px solid ${meta.color}`, borderRadius: "0 4px 4px 0",
                                padding: "2px 5px", marginBottom: 3, cursor: "pointer",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {fullName(it)}
                            </div>
                          );
                        })}
                        {items.length > 2 && (
                          <div onClick={() => setDayDetail({ date: dateStr, rows: items })}
                            style={{ fontSize: 10, color: "#7c3aed", cursor: "pointer", paddingLeft: 4, fontWeight: 700 }}>
                            +{items.length - 2} คน
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Week view */}
        {calView === "week" && <WeekView interns={filtered} onSelect={setSelected} />}

        {/* Timeline view */}
        {calView === "timeline" && (
          <div style={{ padding: 16 }}>
            {[...filtered].sort((a, b) => a.start_date < b.start_date ? -1 : 1).length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>ไม่มีข้อมูล</div>
            ) : [...filtered].sort((a, b) => a.start_date < b.start_date ? -1 : 1).map(it => {
              const meta = STATUS_META[it.status] ?? STATUS_META.upcoming;
              return (
                <div key={it.id} onClick={() => setSelected(it)}
                  style={{ display: "flex", gap: 14, padding: "12px 16px", marginBottom: 8,
                    background: "#fff", borderRadius: 8, border: "1px solid #ede9fe",
                    borderLeft: `4px solid ${meta.color}`, cursor: "pointer" }}>
                  <div style={{ width: 150, flexShrink: 0, fontSize: 11.5, color: "#64748b" }}>
                    {thaiDate(it.start_date)}<br />– {thaiDate(it.end_date)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#0a1628", fontSize: 13 }}>{fullName(it)}</div>
                    <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                      {it.institution_name ?? "—"} · {it.department_name ?? "—"}
                    </div>
                  </div>
                  <span style={{ background: meta.color + "18", color: meta.color, borderRadius: 6,
                    padding: "3px 10px", fontSize: 11, fontWeight: 700, alignSelf: "center", whiteSpace: "nowrap" }}>{meta.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick detail side panel */}
      {selected && (
        <div style={{ width: 300, flexShrink: 0, background: "#fff", borderRadius: 12,
          border: "1px solid #e5e7eb", padding: "20px 18px", height: "fit-content", position: "sticky", top: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#ede9fe",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#7c3aed" }}>
              {selected.first_name.charAt(0)}
            </div>
            <button onClick={() => setSelected(null)} style={{ border: "none", background: "none", fontSize: 16, cursor: "pointer", color: "#94a3b8" }}>×</button>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0a1628", marginBottom: 2 }}>{fullName(selected)}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>{selected.institution_name ?? "—"}</div>
          <DetailRow label="คณะ/สาขา" value={selected.major ?? "—"} />
          <DetailRow label="แผนก" value={selected.department_name ?? "—"} />
          <DetailRow label="ระยะเวลาฝึก" value={`${thaiDate(selected.start_date)} – ${thaiDate(selected.end_date)}`} />
          {selected.status !== "completed" && selected.status !== "cancelled" && (
            <DetailRow label="เหลืออีก" value={`${selected.days_remaining} วัน`} />
          )}
          <DetailRow label="ผู้ควบคุม" value={selected.supervisor_name ?? "—"} />
          <DetailRow label="เบอร์โทร" value={selected.phone ?? "—"} />
          <div style={{ marginTop: 14 }}>
            <span style={{ background: (STATUS_META[selected.status]?.color ?? "#64748b") + "18",
              color: STATUS_META[selected.status]?.color ?? "#64748b", borderRadius: 20, padding: "4px 12px",
              fontSize: 11.5, fontWeight: 700 }}>{STATUS_META[selected.status]?.label ?? selected.status}</span>
          </div>
          <button onClick={() => onOpenProfile(selected.id)}
            style={{ width: "100%", marginTop: 16, padding: "10px 0", borderRadius: 8, border: "none",
              background: "#7c3aed", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
            ดูข้อมูลฉบับเต็ม
          </button>
        </div>
      )}

      {dayDetail && (
        <div onClick={e => { if (e.target === e.currentTarget) setDayDetail(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.5)", zIndex: 300,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 22, maxWidth: 420, width: "100%", maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>นักศึกษาฝึกงานวันที่ {thaiDate(dayDetail.date)}</div>
            {dayDetail.rows.map(it => (
              <div key={it.id} onClick={() => { setSelected(it); setDayDetail(null); }}
                style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12.5, marginBottom: 4,
                  background: "#faf9ff", border: "1px solid #ede9fe" }}>
                {fullName(it)} <span style={{ color: "#94a3b8" }}>· {it.department_name ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: "1px solid #f8fafc" }}>
      <span style={{ color: "#94a3b8" }}>{label}</span>
      <span style={{ color: "#334155", fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function WeekView({ interns, onSelect }: { interns: InternListItem[]; onSelect: (i: InternListItem) => void }) {
  const today = new Date();
  const startDay = new Date(today); startDay.setDate(today.getDate() - today.getDay());
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(startDay); d.setDate(startDay.getDate() + i); return d; });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", minHeight: 260 }}>
      {days.map((d, i) => {
        const iso = d.toISOString().slice(0, 10);
        const items = interns.filter(it => inRange(iso, it.start_date, it.end_date));
        const isToday = iso === today.toISOString().slice(0, 10);
        return (
          <div key={i} style={{ borderRight: i < 6 ? "1px solid #f8fafc" : "none", padding: "8px 6px" }}>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{DAYS_TH[i]}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: isToday ? "#fff" : "#0a1628",
                background: isToday ? "#7c3aed" : "transparent", width: 26, height: 26, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "2px auto" }}>{d.getDate()}</div>
            </div>
            {items.map(it => {
              const meta = STATUS_META[it.status] ?? STATUS_META.upcoming;
              return (
                <div key={it.id} onClick={() => onSelect(it)}
                  style={{ fontSize: 10, background: meta.color + "15", color: meta.color, borderRadius: 4,
                    padding: "3px 5px", marginBottom: 3, cursor: "pointer",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {fullName(it)}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
