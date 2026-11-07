import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LINES, EXCLUDED_LINE, PERIOD_LABEL, monthAbbr, fetchHqData, saveExtra, saveLineMap, deleteLineMap,
  loadTemplate, readTemplateLists, buildReport,
  type ApiData, type PeriodKey, type PersonRow, type TemplateLists,
} from "./hqReportCalc";
import { exportHqDashboard } from "./hqExport";

// เมนู "รายงาน RAM GROUP" (รายงานส่งสำนักงานใหญ่) — admin only.
// สรุป HR Dashboard รายไตรมาส/รายปี จากข้อมูลพนักงาน + แผนอัตรากำลัง แล้ว export เป็น
// xlsx ตามแม่แบบที่ส่งสำนักงานใหญ่ ช่องที่ระบบไม่มี (อายุผู้ลาออก ช่องทางสรรหา หมวดเหตุผล)
// ให้ผู้ดูแลกรอกในแท็บของแต่ละกลุ่ม

type Tab = "summary" | "resign" | "hire" | "map";

const card: React.CSSProperties = { background: "#fff", border: "1px solid #E6EBF5", borderRadius: 12, padding: 16, boxShadow: "0 4px 14px rgba(20,40,90,.05)", marginBottom: 14 };
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", background: "#F2F5FB", fontWeight: 700, fontSize: 12.5, color: "#334155", borderBottom: "1px solid #E6EBF5", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "7px 10px", borderBottom: "1px solid #EEF2F8", fontSize: 13, verticalAlign: "middle" };
const num: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const inp: React.CSSProperties = { padding: "6px 8px", border: "1px solid #D5DCEB", borderRadius: 7, fontSize: 13, fontFamily: "inherit", background: "#fff" };

const nowYear = new Date().getFullYear();
const defaultPeriod = (): { year: number; period: PeriodKey } => {
  // Most recent finished quarter
  const q = Math.floor(new Date().getMonth() / 3); // 0..3 = current quarter index
  return q === 0 ? { year: nowYear - 1, period: "Q4" } : { year: nowYear, period: (`Q${q}` as PeriodKey) };
};
const thDate = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}/${m}/${y + 543}`;
};

export default function HqReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const init = defaultPeriod();
  const [year, setYear] = useState(init.year);
  const [period, setPeriod] = useState<PeriodKey>(init.period);
  const [tab, setTab] = useState<Tab>("summary");
  const [data, setData] = useState<ApiData | null>(null);
  const [lists, setLists] = useState<TemplateLists | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const isAdmin = user?.role === "admin";

  const reload = () => fetchHqData().then(setData).catch(e => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => {
    if (!isAdmin) return;
    reload();
    loadTemplate().then(wb => setLists(readTemplateLists(wb))).catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [isAdmin]);

  const rep = useMemo(() => (data ? buildReport(data, year, period, lists) : null), [data, year, period, lists]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const patchExtra = async (p: PersonRow, change: Partial<Pick<PersonRow, "age" | "channel" | "reason">>) => {
    const next = { ...p, ...change };
    try {
      await saveExtra({ employee_id: p.id, age: next.age, sourcing_channel: next.channel, reason: next.reason });
      setData(d => {
        if (!d) return d;
        const rest = d.extras.filter(x => x.employee_id !== p.id);
        return { ...d, extras: [...rest, { employee_id: p.id, age: next.age, sourcing_channel: next.channel, reason: next.reason }] };
      });
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  const doExport = async () => {
    if (!rep) return;
    setBusy(true); setMsg("");
    try { setMsg(`ดาวน์โหลดแล้ว: ${await exportHqDashboard(rep)}`); }
    catch (e) { setMsg(`Export ไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(false); }
  };

  const missingAge = rep?.resigns.filter(p => p.age === null).length ?? 0;
  const missingReason = rep?.resigns.filter(p => !p.reason).length ?? 0;
  const missingChannel = rep?.hires.filter(p => !p.channel).length ?? 0;

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: "summary", label: "📊 สรุปอัตรากำลัง" },
    { key: "resign", label: "🚪 ผู้ลาออก", badge: missingAge + missingReason },
    { key: "hire", label: "🆕 พนักงานใหม่", badge: missingChannel },
    { key: "map", label: "🧭 จับคู่สายงาน", badge: rep?.unmapped.length },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F2F5FB", padding: "16px 20px 32px" }}>
      <button onClick={() => navigate("/")}
        style={{ marginBottom: 14, background: "#fff", border: "1px solid #E6EBF5", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "#334155" }}>
        ← กลับหน้าหลัก
      </button>

      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 5, height: 24, borderRadius: 6, background: "linear-gradient(#1F3864,#2F5597)" }} />
        รายงาน RAM GROUP
      </h2>
      <p style={{ margin: "6px 0 14px 17px", color: "#6B7A99", fontSize: 13.5 }}>
        HR Dashboard (RAM Group) — สรุปอัตรากำลัง ผู้เริ่มงาน ผู้ลาออก แยกตามสายงาน และ export เป็นไฟล์ Excel ตามแบบที่ส่งสำนักงานใหญ่
      </p>

      <div style={{ ...card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 13 }}>ปี (ค.ศ.)&nbsp;
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={inp}>
            {[nowYear - 2, nowYear - 1, nowYear].map(y => <option key={y} value={y}>{y} (พ.ศ. {y + 543})</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13 }}>งวด&nbsp;
          <select value={period} onChange={e => setPeriod(e.target.value as PeriodKey)} style={inp}>
            {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map(k => <option key={k} value={k}>{PERIOD_LABEL[k]}</option>)}
          </select>
        </label>
        <button onClick={doExport} disabled={!rep || !lists || busy}
          style={{ marginLeft: "auto", padding: "9px 16px", borderRadius: 9, border: "none", background: "#1F7A3D", color: "#fff", fontWeight: 700, fontFamily: "inherit", cursor: busy ? "wait" : "pointer", opacity: !rep || !lists ? 0.5 : 1 }}>
          {busy ? "กำลังสร้างไฟล์…" : "⬇ Export HR Dashboard (.xlsx)"}
        </button>
        {msg && <div style={{ width: "100%", fontSize: 12.5, color: msg.startsWith("Export ไม่") ? "#B42318" : "#1F7A3D" }}>{msg}</div>}
        {rep && (missingAge + missingReason + missingChannel + rep.unmapped.length) > 0 && (
          <div style={{ width: "100%", fontSize: 12.5, color: "#9A6700", background: "#FFF8E1", borderRadius: 8, padding: "8px 10px" }}>
            ยังกรอกไม่ครบ: อายุผู้ลาออก {missingAge} คน · เหตุผลลาออก {missingReason} คน · ช่องทางสรรหา {missingChannel} คน · ตำแหน่งที่ยังไม่จับคู่สายงาน {rep.unmapped.length} รายการ
            (export ได้ แต่ช่องที่ขาดจะว่าง / เป็น Other)
          </div>
        )}
      </div>

      {error && <div style={{ ...card, color: "#B42318" }}>{error}</div>}
      {!rep && !error && <div style={card}>กำลังโหลด…</div>}

      {rep && (
        <>
          <div style={{ display: "flex", gap: 3, marginBottom: 14, flexWrap: "wrap", background: "#fff", borderRadius: 12, padding: 5, width: "fit-content", maxWidth: "100%", border: "1px solid #E6EBF5" }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ padding: "9px 14px", borderRadius: 9, border: "none", fontFamily: "inherit", fontSize: 13, cursor: "pointer",
                  fontWeight: tab === t.key ? 700 : 500, background: tab === t.key ? "#1F3864" : "transparent", color: tab === t.key ? "#fff" : "#6B7A99" }}>
                {t.label}{t.badge ? <span style={{ marginLeft: 6, background: "#F59E0B", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>{t.badge}</span> : null}
              </button>
            ))}
          </div>

          {tab === "summary" && (
            <div style={card}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760 }}>
                  <thead><tr>
                    <th style={th}>เดือน</th><th style={th}>สายงาน</th>
                    <th style={{ ...th, textAlign: "right" }}>Planned</th><th style={{ ...th, textAlign: "right" }}>Existing FT</th>
                    <th style={{ ...th, textAlign: "right" }}>Existing PT</th><th style={{ ...th, textAlign: "right" }}>Vacant</th>
                    <th style={{ ...th, textAlign: "right" }}>เริ่มงาน</th><th style={{ ...th, textAlign: "right" }}>ลาออก</th>
                  </tr></thead>
                  <tbody>
                    {rep.months.map(ym => {
                      const rows = rep.manpower.filter(m => m.month === ym);
                      const sum = rows.reduce((a, m) => ({ planned: a.planned + m.planned, ft: a.ft + m.ft, pt: a.pt + m.pt }), { planned: 0, ft: 0, pt: 0 });
                      const h = rep.hires.filter(p => p.month === ym), r = rep.resigns.filter(p => p.month === ym);
                      return [
                        ...rows.map((m, i) => (
                          <tr key={`${ym}-${m.line}`}>
                            <td style={td}>{i === 0 ? monthAbbr(ym) : ""}</td><td style={td}>{m.line}</td>
                            <td style={num}>{m.planned}</td><td style={num}>{m.ft}</td><td style={num}>{m.pt}</td>
                            <td style={num}>{m.planned - m.ft - m.pt}</td>
                            <td style={num}>{h.filter(p => p.line === m.line).length}</td>
                            <td style={num}>{r.filter(p => p.line === m.line).length}</td>
                          </tr>
                        )),
                        <tr key={`${ym}-sum`} style={{ background: "#F8FAFD", fontWeight: 700 }}>
                          <td style={td}></td><td style={td}>รวม {monthAbbr(ym)}</td>
                          <td style={num}>{sum.planned}</td><td style={num}>{sum.ft}</td><td style={num}>{sum.pt}</td>
                          <td style={num}>{sum.planned - sum.ft - sum.pt}</td><td style={num}>{h.length}</td><td style={num}>{r.length}</td>
                        </tr>,
                      ];
                    })}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 12, color: "#6B7A99", margin: "10px 0 0" }}>
                Planned = แผนอัตรากำลังปัจจุบัน (เมนู Manpower) · Existing นับ ณ สิ้นเดือน · เริ่มงาน/ลาออก นับรอบวันที่ 26 เดือนก่อน – 25 ของเดือน ·
                ไม่นับผู้เช่าสถานที่ประกอบวิชาชีพเวชกรรม นักศึกษาฝึกงาน และตำแหน่งที่ตั้งเป็น "ไม่นับ"
              </p>
            </div>
          )}

          {tab === "resign" && (
            <div style={card}>
              <PeopleTable rows={rep.resigns} kind="resign" lists={lists} onChange={patchExtra} />
            </div>
          )}

          {tab === "hire" && (
            <div style={card}>
              <PeopleTable rows={rep.hires} kind="hire" lists={lists} onChange={patchExtra} />
            </div>
          )}

          {tab === "map" && data && <LineMapTab data={data} unmapped={rep.unmapped} onSaved={reload} />}
        </>
      )}
    </div>
  );
}

function PeopleTable({ rows, kind, lists, onChange }: {
  rows: PersonRow[]; kind: "resign" | "hire"; lists: TemplateLists | null;
  onChange: (p: PersonRow, c: Partial<Pick<PersonRow, "age" | "channel" | "reason">>) => void;
}) {
  if (rows.length === 0) return <div style={{ color: "#6B7A99", fontSize: 13 }}>ไม่มีรายการในงวดนี้</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 820 }}>
        <thead><tr>
          <th style={th}>เดือน</th><th style={th}>ชื่อ-สกุล</th><th style={th}>ตำแหน่ง</th><th style={th}>สายงาน</th>
          <th style={th}>วันเริ่มงาน</th>
          {kind === "resign" ? <><th style={th}>วันลาออก</th><th style={th}>อายุ (ปี)</th><th style={th}>เหตุผล (ตามรายการ สนญ.)</th></>
                             : <th style={th}>ช่องทางสรรหา</th>}
        </tr></thead>
        <tbody>
          {rows.map(p => (
            <tr key={`${kind}-${p.id}`}>
              <td style={td}>{monthAbbr(p.month)}</td><td style={td}>{p.name}</td><td style={td}>{p.position}</td>
              <td style={td}>{p.line}</td><td style={td}>{thDate(p.start)}</td>
              {kind === "resign" ? (
                <>
                  <td style={td}>{thDate(p.resign)}</td>
                  <td style={td}>
                    <input type="number" min={15} max={90} defaultValue={p.age ?? ""} style={{ ...inp, width: 70, borderColor: p.age === null ? "#F59E0B" : "#D5DCEB" }}
                      onBlur={e => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        if (v !== p.age) onChange(p, { age: v });
                      }} />
                  </td>
                  <td style={td}>
                    <select value={p.reason ?? ""} onChange={e => onChange(p, { reason: e.target.value || null })}
                      style={{ ...inp, maxWidth: 260, borderColor: p.reason ? "#D5DCEB" : "#F59E0B" }}>
                      <option value="">— เลือก —</option>
                      {(lists?.reasons ?? []).map(r => <option key={r} value={r}>{r}{lists?.reasonCat[r] ? ` → ${lists.reasonCat[r]}` : ""}</option>)}
                    </select>
                    {p.resignReasonText && p.resignReasonText !== p.reason && (
                      <div style={{ fontSize: 11.5, color: "#6B7A99", marginTop: 3 }}>ที่บันทึกไว้: {p.resignReasonText}</div>
                    )}
                  </td>
                </>
              ) : (
                <td style={td}>
                  <select value={p.channel ?? ""} onChange={e => onChange(p, { channel: e.target.value || null })}
                    style={{ ...inp, borderColor: p.channel ? "#D5DCEB" : "#F59E0B" }}>
                    <option value="">— เลือก —</option>
                    {(lists?.channels ?? []).map(c => <option key={c} value={c}>{c}{lists?.channelCat[c] ? ` → ${lists.channelCat[c]}` : ""}</option>)}
                  </select>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LineMapTab({ data, unmapped, onSaved }: { data: ApiData; unmapped: { division: string; position: string; employees: number; planQty: number }[]; onSaved: () => void }) {
  const [filter, setFilter] = useState("");
  const options = [...LINES, EXCLUDED_LINE];
  const save = async (div: string, pos: string, line: string) => {
    try {
      if (line) await saveLineMap(div, pos, line); else await deleteLineMap(div, pos);
      onSaved();
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };
  const mapped = data.lineMap
    .filter(m => !filter || `${m.division_name} ${m.position} ${m.line}`.includes(filter))
    .sort((a, b) => a.division_name.localeCompare(b.division_name) || a.position.localeCompare(b.position));

  return (
    <>
      <div style={card}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>ตำแหน่งที่ยังไม่จับคู่สายงาน ({unmapped.length})</h3>
        <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#6B7A99" }}>
          ตำแหน่งเหล่านี้ยังไม่ถูกนับในรายงาน เลือกสายงานให้ (หรือ "ไม่นับ") ระบบจะบันทึกทันที
        </p>
        {unmapped.length === 0 ? <div style={{ fontSize: 13, color: "#1F7A3D" }}>จับคู่ครบแล้ว ✓</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
              <thead><tr><th style={th}>ฝ่าย</th><th style={th}>ตำแหน่ง</th><th style={{ ...th, textAlign: "right" }}>พนักงาน</th><th style={{ ...th, textAlign: "right" }}>แผน</th><th style={th}>สายงาน</th></tr></thead>
              <tbody>
                {unmapped.map(u => (
                  <tr key={`${u.division}|${u.position}`}>
                    <td style={td}>{u.division || "—"}</td><td style={td}>{u.position || "—"}</td>
                    <td style={num}>{u.employees}</td><td style={num}>{u.planQty}</td>
                    <td style={td}>
                      <select defaultValue="" onChange={e => e.target.value && save(u.division, u.position, e.target.value)} style={inp}>
                        <option value="">— เลือก —</option>
                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>ตารางจับคู่ ฝ่าย + ตำแหน่ง → สายงาน ({data.lineMap.length})</h3>
          <input placeholder="ค้นหา…" value={filter} onChange={e => setFilter(e.target.value)} style={{ ...inp, marginLeft: "auto", width: 200 }} />
        </div>
        <div style={{ overflowX: "auto", maxHeight: 520, overflowY: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
            <thead><tr><th style={th}>ฝ่าย</th><th style={th}>ตำแหน่ง</th><th style={th}>สายงาน</th></tr></thead>
            <tbody>
              {mapped.map(m => (
                <tr key={`${m.division_name}|${m.position}`}>
                  <td style={td}>{m.division_name}</td><td style={td}>{m.position}</td>
                  <td style={td}>
                    <select value={m.line} onChange={e => save(m.division_name, m.position, e.target.value)} style={inp}>
                      {options.map(o => <option key={o} value={o}>{o}</option>)}
                      <option value="">(ลบการจับคู่)</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
