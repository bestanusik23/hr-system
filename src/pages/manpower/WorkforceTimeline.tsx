import { useState, useEffect } from "react";

// ─── Static data ────────────────────────────────────────────────────────────
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

type ShiftKey = "night" | "morning" | "evening";

const SHIFT_INFO: Record<ShiftKey, { label: string; color: string; sMin: number; eMin: number }> = {
  night:   { label: "เวรดึก 00:00–08:00",  color: "#1d4ed8", sMin: 0,   eMin: 480  },
  morning: { label: "เวรเช้า 08:00–16:00", color: "#3fb96a", sMin: 480, eMin: 960  },
  evening: { label: "เวรบ่าย 16:00–24:00", color: "#8b6fe0", sMin: 960, eMin: 1440 },
};

const SHIFT_KEYS: ShiftKey[] = ["night", "morning", "evening"];
const ROW_H     = 64;
const DEPT_W    = 164;
const COUNT_W   = 90;
const HEADER_H  = 46;
const TOTAL_MIN = 1440;
const HOURS     = Array.from({ length: 24 }, (_, i) => i);
const toPct     = (min: number) => `${(min / TOTAL_MIN * 100).toFixed(4)}%`;

const T_NIGHT = 22, T_MORNING = 109, T_EVENING = 27, T_TOTAL = 158;

const HOURLY: [string, number][] = [
  ["00:00",22],["01:00",22],["02:00",22],["03:00",22],
  ["04:00",22],["05:00",22],["06:00",22],["07:00",22],
  ["08:00",109],["09:00",109],["10:00",109],["11:00",109],
  ["12:00",109],["13:00",109],["14:00",109],["15:00",109],
  ["16:00",27],["17:00",27],["18:00",27],["19:00",27],
  ["20:00",27],["21:00",27],["22:00",27],["23:00",27],
];
const MAX_HOURLY = 109;
const PEAK_HOUR  = "08:00";

function getNow() {
  const d = new Date();
  const min = d.getHours() * 60 + d.getMinutes();
  return { str: `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`, min };
}

// ─── Scoped CSS (prefix hrwt- / id #hrwt) ───────────────────────────────────
const CSS = `
#hrwt{
  --hr-blue:#0038C6; --hr-cyan:#26A9E0; --hr-line:#eaedf5;
  --hr-ink:#1b2a4a;  --hr-muted:#6b7794; --hr-bg:#f4f6fb;
  font-family:'IBM Plex Sans Thai',system-ui,sans-serif;
  color:var(--hr-ink); background:var(--hr-bg);
  border-radius:18px; padding:24px; box-sizing:border-box;
}
#hrwt *{box-sizing:border-box;}

/* Head */
.hrwt-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.hrwt-title{font-size:22px;font-weight:700;letter-spacing:-.2px;margin:0;display:flex;align-items:center;gap:12px;}
.hrwt-title .bar{width:5px;height:24px;border-radius:6px;background:linear-gradient(var(--hr-blue),var(--hr-cyan));flex-shrink:0;}
.hrwt-sub{margin:6px 0 0 17px;color:var(--hr-muted);font-size:13.5px;}
.hrwt-date-tag{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--hr-line);border-radius:12px;padding:9px 14px;font-size:13px;font-weight:600;color:var(--hr-ink);box-shadow:0 2px 8px rgba(20,40,90,.05);}
.hrwt-date-tag .dot{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.15);}

/* Filter */
.hrwt-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:#fff;border:1px solid var(--hr-line);border-radius:14px;padding:12px;margin-bottom:16px;box-shadow:0 4px 14px rgba(20,40,90,.04);}
.hrwt-search{flex:1 1 200px;min-width:180px;display:flex;align-items:center;gap:8px;background:#fbfcfe;border:1px solid var(--hr-line);border-radius:10px;padding:0 12px;height:40px;}
.hrwt-search svg{flex:0 0 auto;color:var(--hr-muted);}
.hrwt-search input{border:none;background:none;outline:none;font-family:inherit;font-size:13.5px;width:100%;color:var(--hr-ink);}

/* KPI */
.hrwt-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:18px;}
.hrwt-kpi{background:#fff;border:1px solid var(--hr-line);border-radius:14px;padding:15px 16px;position:relative;overflow:hidden;box-shadow:0 4px 14px rgba(20,40,90,.05);transition:.18s;}
.hrwt-kpi:hover{transform:translateY(-3px);box-shadow:0 10px 26px rgba(20,40,90,.10);}
.hrwt-kpi .ic{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;margin-bottom:11px;}
.hrwt-kpi .lbl{font-size:11.5px;color:var(--hr-muted);font-weight:500;line-height:1.35;}
.hrwt-kpi .val{font-size:26px;font-weight:700;margin-top:3px;letter-spacing:-.5px;}
.hrwt-kpi .val small{font-size:12px;font-weight:500;color:var(--hr-muted);margin-left:3px;}
.hrwt-kpi .foot{font-size:11px;color:var(--hr-muted);margin-top:5px;}
.hrwt-kpi .foot b{color:#16a34a;font-weight:600;}
.hrwt-kpi::after{content:"";position:absolute;right:-24px;top:-24px;width:80px;height:80px;border-radius:50%;opacity:.05;}
.hrwt-kpi.c1 .ic,.hrwt-kpi.c1::after{background:rgba(0,56,198,.10);color:var(--hr-blue);}
.hrwt-kpi.c2 .ic,.hrwt-kpi.c2::after{background:rgba(38,169,224,.12);color:var(--hr-cyan);}
.hrwt-kpi.c3 .ic,.hrwt-kpi.c3::after{background:rgba(63,185,106,.14);color:#2f9e56;}
.hrwt-kpi.c4 .ic,.hrwt-kpi.c4::after{background:rgba(139,111,224,.14);color:#7a5be0;}
.hrwt-kpi.c5 .ic,.hrwt-kpi.c5::after{background:rgba(17,42,107,.12);color:#112a6b;}
.hrwt-kpi.c6 .ic,.hrwt-kpi.c6::after{background:rgba(245,165,36,.15);color:#e08c00;}

/* Legend */
.hrwt-legend{display:flex;flex-wrap:wrap;gap:8px 16px;padding:8px 4px;font-size:12px;color:var(--hr-ink);}
.hrwt-legend span{display:inline-flex;align-items:center;gap:7px;}
.hrwt-legend i{width:22px;height:10px;border-radius:5px;display:inline-block;}

/* Panel */
.hrwt-panel{background:#fff;border:1px solid var(--hr-line);border-radius:16px;box-shadow:0 6px 20px rgba(20,40,90,.06);overflow:hidden;margin-bottom:18px;}
.hrwt-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px 8px;flex-wrap:wrap;}
.hrwt-panel-head h3{margin:0;font-size:16px;font-weight:700;}

/* Grid */
.hrwt-grid{overflow-y:auto;overflow-x:hidden;max-height:660px;}
.hrwt-canvas{position:relative;}
.hrwt-row{display:flex;border-bottom:1px solid var(--hr-line);}
.hrwt-row:last-child{border-bottom:none;}
.hrwt-c-dept,.hrwt-c-count{background:#fff;display:flex;align-items:center;flex-shrink:0;}
.hrwt-c-dept{width:${DEPT_W}px;padding:0 8px 0 16px;font-weight:600;font-size:13.5px;}
.hrwt-c-count{width:${COUNT_W}px;padding:0 12px;color:var(--hr-blue);font-weight:700;font-size:14px;border-right:1px solid var(--hr-line);}
.hrwt-c-count small{color:var(--hr-muted);font-weight:500;font-size:11px;margin-left:2px;}
.hrwt-header{position:sticky;top:0;z-index:7;background:#f8fafd;box-shadow:0 1px 0 var(--hr-line);}
.hrwt-header .hrwt-c-dept,.hrwt-header .hrwt-c-count{background:#f8fafd;height:${HEADER_H}px;font-size:12px;color:var(--hr-muted);font-weight:600;}
.hrwt-ruler{flex:1;display:flex;height:${HEADER_H}px;position:relative;}
.hrwt-tick{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--hr-muted);border-left:1px solid #eef1f7;overflow:hidden;}
.hrwt-track{position:relative;flex:1;height:${ROW_H}px;display:flex;min-width:0;}
.hrwt-slot{flex:1;min-width:0;border-left:1px solid #f1f4fa;}
.hrwt-bar{position:absolute;height:16px;border-radius:9px;display:flex;align-items:center;padding:0 8px;font-size:11px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;cursor:pointer;box-shadow:0 2px 6px rgba(20,40,90,.18);transition:transform .12s,filter .12s,box-shadow .12s;}
.hrwt-bar:hover{transform:scaleY(1.15);filter:saturate(1.2);box-shadow:0 5px 14px rgba(20,40,90,.28);z-index:3;}
.hrwt-now-seg{position:absolute;top:0;bottom:0;width:2px;background:#ef4444;opacity:.7;pointer-events:none;z-index:4;}

/* Summary */
.hrwt-summary{display:grid;grid-template-columns:1.4fr 1fr 1.1fr;gap:16px;}
.hrwt-scard{background:#fff;border:1px solid var(--hr-line);border-radius:16px;padding:18px;box-shadow:0 6px 20px rgba(20,40,90,.06);}
.hrwt-scard h4{margin:0 0 14px;font-size:14px;font-weight:700;}
.hrwt-bars{display:flex;align-items:flex-end;gap:4px;height:160px;padding-top:16px;}
.hrwt-bcol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;height:100%;position:relative;}
.hrwt-bcol .bv{font-size:8px;color:var(--hr-muted);font-weight:600;}
.hrwt-bcol .bfill{width:75%;max-width:18px;border-radius:4px 4px 2px 2px;background:linear-gradient(var(--hr-cyan),var(--hr-blue));min-height:3px;}
.hrwt-bcol.peak .bfill{background:linear-gradient(#ffb64d,#f5a524);box-shadow:0 0 0 2px rgba(245,165,36,.2);}
.hrwt-bcol .bx{font-size:7px;color:var(--hr-muted);transform:rotate(-45deg);transform-origin:center;white-space:nowrap;margin-top:3px;}
.hrwt-bcol .peak-tag{position:absolute;top:-2px;background:#f5a524;color:#fff;font-size:8px;font-weight:700;padding:1px 4px;border-radius:4px;}
.hrwt-tbl{width:100%;border-collapse:collapse;font-size:12.5px;}
.hrwt-tbl th{text-align:left;color:var(--hr-muted);font-weight:600;font-size:11px;padding:8px 10px;border-bottom:2px solid var(--hr-line);}
.hrwt-tbl td{padding:10px 10px;border-bottom:1px solid var(--hr-line);}
.hrwt-tbl td:first-child{display:flex;align-items:center;gap:8px;font-weight:500;}
.hrwt-tbl .sw{width:11px;height:11px;border-radius:3px;flex:0 0 auto;}
.hrwt-tbl td.num{text-align:right;font-weight:600;}
.hrwt-tbl tr.total td{border-top:2px solid var(--hr-line);border-bottom:none;font-weight:700;color:var(--hr-blue);}
.hrwt-deptbars{display:flex;flex-direction:column;gap:10px;}
.hrwt-db{display:grid;grid-template-columns:80px 1fr 30px;align-items:center;gap:8px;font-size:12px;}
.hrwt-db .nm{font-weight:600;text-align:right;color:var(--hr-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.hrwt-db .tr{height:13px;background:#f1f4fa;border-radius:7px;overflow:hidden;}
.hrwt-db .fl{height:100%;border-radius:7px;background:linear-gradient(90deg,var(--hr-cyan),var(--hr-blue));}
.hrwt-db .qv{font-weight:700;color:var(--hr-blue);}
@media(max-width:1100px){.hrwt-kpis{grid-template-columns:repeat(3,1fr);}.hrwt-summary{grid-template-columns:1fr;}}
@media(max-width:700px){#hrwt{padding:14px;}.hrwt-kpis{grid-template-columns:repeat(2,1fr);}}
`;

// ─── SVG icons ───────────────────────────────────────────────────────────────
const IcUsers    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcBuilding = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M15 21V9h4a1 1 0 0 1 1 1v11M2 21h20M9 7h1M9 11h1M9 15h1"/></svg>;
const IcSunrise  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 18a5 5 0 0 0-10 0M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-3 4 3"/></svg>;
const IcSunset   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 18a5 5 0 0 0-10 0M12 9V2M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M16 5l-4 4-4-4"/></svg>;
const IcMoon     = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const IcBolt     = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;

// ─── Component ───────────────────────────────────────────────────────────────
export default function WorkforceTimeline() {
  const [now, setNow] = useState(getNow);
  const [search, setSearch] = useState("");
  const [tip, setTip] = useState<{ x: number; y: number; dept: string; shift: string; count: number; color: string } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(getNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  const filtered = search.trim()
    ? DEPTS.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.sub.toLowerCase().includes(search.toLowerCase())
      )
    : DEPTS;

  const dateStr  = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
  const nowPct   = toPct(now.min);
  const maxFill  = Math.max(...DEPTS.map(d => d.filled));

  return (
    <div id="hrwt">
      <style>{CSS}</style>

      {/* ── Section Header ── */}
      <div className="hrwt-head">
        <div>
          <h2 className="hrwt-title">
            <span className="bar" />
            ตารางการทำงานบุคลากรประจำวัน
          </h2>
          <p className="hrwt-sub">สรุปจำนวนบุคลากรที่ปฏิบัติงานในแต่ละฝ่าย แยกตามช่วงเวลาการทำงาน</p>
        </div>
        <div className="hrwt-date-tag">
          <span className="dot" />
          <span>{dateStr}</span>
        </div>
      </div>

      {/* ── Filter ── */}
      <div className="hrwt-filters">
        <div className="hrwt-search">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" />
          </svg>
          <input
            placeholder="ค้นหาฝ่าย / แผนก"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="hrwt-kpis">
        {([
          { c:"c1", icon:<IcUsers/>,    lbl:"บุคลากรปฏิบัติงานวันนี้", val:T_TOTAL,   unit:"คน",   foot:<><b>▲ ปฏิบัติงานจริง</b></> },
          { c:"c2", icon:<IcBuilding/>, lbl:"ฝ่ายที่เปิดให้บริการ",    val:9,         unit:"ฝ่าย", foot:"ครอบคลุมทุกฝ่าย" },
          { c:"c3", icon:<IcSunrise/>,  lbl:"กะเช้า 08:00–16:00",      val:T_MORNING, unit:"คน",   foot:`${(T_MORNING/T_TOTAL*100).toFixed(0)}% ของทั้งหมด` },
          { c:"c4", icon:<IcSunset/>,   lbl:"กะบ่าย 16:00–24:00",      val:T_EVENING, unit:"คน",   foot:`${(T_EVENING/T_TOTAL*100).toFixed(0)}% ของทั้งหมด` },
          { c:"c5", icon:<IcMoon/>,     lbl:"กะดึก 00:00–08:00",       val:T_NIGHT,   unit:"คน",   foot:`${(T_NIGHT/T_TOTAL*100).toFixed(0)}% ของทั้งหมด` },
          { c:"c6", icon:<IcBolt/>,     lbl:"ช่วงเวลากำลังคนสูงสุด",  val:PEAK_HOUR, unit:"",     foot:<><b>{MAX_HOURLY} คน</b> กำลังปฏิบัติงาน</> },
        ] as const).map((k, i) => (
          <div key={i} className={`hrwt-kpi ${k.c}`}>
            <div className="ic">{k.icon}</div>
            <div className="lbl">{k.lbl}</div>
            <div className="val">{k.val}{k.unit && <small>{k.unit}</small>}</div>
            <div className="foot">{k.foot}</div>
          </div>
        ))}
      </div>

      {/* ── Timeline Panel ── */}
      <div className="hrwt-panel">
        <div className="hrwt-panel-head">
          <h3>ไทม์ไลน์การปฏิบัติงานรายฝ่าย</h3>
          <div className="hrwt-legend">
            {SHIFT_KEYS.map(s => (
              <span key={s}>
                <i style={{ background: SHIFT_INFO[s].color }} />
                {SHIFT_INFO[s].label}
              </span>
            ))}
            <span>
              <i style={{ background: "#ef4444", height: 2, borderRadius: 1 }} />
              เวลาปัจจุบัน
            </span>
          </div>
        </div>

        <div className="hrwt-grid">
          <div className="hrwt-canvas">

            {/* Header */}
            <div className="hrwt-row hrwt-header">
              <div className="hrwt-c-dept">ฝ่าย / แผนก</div>
              <div className="hrwt-c-count">จำนวน</div>
              <div className="hrwt-ruler">
                {HOURS.map(h => (
                  <div key={h} className="hrwt-tick">{String(h).padStart(2,"0")}:00</div>
                ))}
                {/* NOW pill in ruler */}
                <div style={{ position:"absolute", bottom:0, left:nowPct, transform:"translateX(-50%)", pointerEvents:"none", zIndex:10, display:"flex", flexDirection:"column", alignItems:"center" }}>
                  <span style={{ fontSize:9.5, fontWeight:700, color:"#ef4444", background:"#fff", border:"1.5px solid rgba(239,68,68,.3)", padding:"1px 6px", borderRadius:4, whiteSpace:"nowrap", marginBottom:1, lineHeight:1.6, boxShadow:"0 2px 5px rgba(239,68,68,.2)" }}>NOW {now.str}</span>
                  <div style={{ width:0, height:0, borderLeft:"4px solid transparent", borderRight:"4px solid transparent", borderTop:"5px solid #ef4444" }} />
                </div>
              </div>
            </div>

            {/* Dept rows */}
            {filtered.map(dept => {
              const bars = SHIFT_KEYS.filter(s => dept.shifts[s] > 0);
              const laneH = 16, gap = 5;
              const blockH = bars.length * laneH + (bars.length - 1) * gap;
              const top0   = (ROW_H - blockH) / 2;
              const fillPct = Math.round(dept.filled / dept.plan * 100);

              return (
                <div key={dept.name} className="hrwt-row">
                  <div className="hrwt-c-dept" style={{ flexDirection:"column", alignItems:"flex-start", justifyContent:"center", gap:2 }}>
                    <span style={{ lineHeight:1.3 }}>{dept.name}</span>
                    {dept.sub && <span style={{ fontSize:11, color:"#94a3b8", fontWeight:400 }}>{dept.sub}</span>}
                    <div style={{ width:"100%", height:3, background:"#e2e8f0", borderRadius:99, overflow:"hidden", marginTop:2 }}>
                      <div style={{ height:"100%", width:`${fillPct}%`, background:"linear-gradient(90deg,#26A9E0,#0038C6)", borderRadius:99 }} />
                    </div>
                  </div>
                  <div className="hrwt-c-count">{dept.filled}<small>คน</small></div>
                  <div className="hrwt-track">
                    {HOURS.map(h => <div key={h} className="hrwt-slot" />)}
                    {bars.map((s, i) => {
                      const info  = SHIFT_INFO[s];
                      const count = dept.shifts[s];
                      const top   = top0 + i * (laneH + gap);
                      return (
                        <div key={s}
                          className="hrwt-bar"
                          style={{ left: toPct(info.sMin), width: `${((info.eMin - info.sMin) / TOTAL_MIN * 100).toFixed(4)}%`, top, background: info.color }}
                          onMouseMove={e => setTip({ x: e.clientX + 14, y: e.clientY + 14, dept: dept.name + (dept.sub ? ` · ${dept.sub}` : ""), shift: info.label, count, color: info.color })}
                          onMouseLeave={() => setTip(null)}
                        >
                          {count} คน
                        </div>
                      );
                    })}
                    {/* NOW line segment */}
                    <div className="hrwt-now-seg" style={{ left: nowPct }} />
                  </div>
                </div>
              );
            })}


          </div>
        </div>
      </div>

      {/* ── Summary Row ── */}
      <div className="hrwt-summary">

        {/* Hourly bar chart */}
        <div className="hrwt-scard">
          <h4>สรุปจำนวนบุคลากรตามช่วงเวลา</h4>
          <div className="hrwt-bars">
            {HOURLY.map(([t, v]) => {
              const isPeak = v === MAX_HOURLY;
              return (
                <div key={t} className={`hrwt-bcol${isPeak ? " peak" : ""}`}>
                  {isPeak
                    ? <div className="peak-tag">{v}</div>
                    : <div className="bv">{v}</div>}
                  <div className="bfill" style={{ height: `${(v / MAX_HOURLY * 100).toFixed(1)}%` }} />
                  <div className="bx">{t}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shift summary table */}
        <div className="hrwt-scard">
          <h4>สรุปตามกะการทำงาน</h4>
          <table className="hrwt-tbl">
            <thead>
              <tr>
                <th>ช่วงเวลา</th>
                <th style={{ textAlign:"right" }}>จำนวน (คน)</th>
                <th style={{ textAlign:"right" }}>ร้อยละ</th>
              </tr>
            </thead>
            <tbody>
              {SHIFT_KEYS.map(s => {
                const cnt  = { night: T_NIGHT, morning: T_MORNING, evening: T_EVENING }[s];
                const info = SHIFT_INFO[s];
                return (
                  <tr key={s}>
                    <td><span className="sw" style={{ background: info.color }} />{info.label}</td>
                    <td className="num">{cnt}</td>
                    <td className="num">{(cnt / T_TOTAL * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
              <tr className="total">
                <td>รวมทั้งหมด</td>
                <td className="num">{T_TOTAL}</td>
                <td className="num">100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Dept comparison */}
        <div className="hrwt-scard">
          <h4>เปรียบเทียบจำนวนบุคลากรตามฝ่าย</h4>
          <div className="hrwt-deptbars">
            {[...DEPTS].sort((a, b) => b.filled - a.filled).map(d => (
              <div key={d.name} className="hrwt-db">
                <div className="nm" title={d.name}>{d.name}</div>
                <div className="tr">
                  <div className="fl" style={{ width: `${(d.filled / maxFill * 100).toFixed(1)}%` }} />
                </div>
                <div className="qv">{d.filled}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Tooltip */}
      {tip && (
        <div style={{
          position:"fixed", left: tip.x, top: tip.y, pointerEvents:"none",
          background:"#0f1b38", color:"#fff", padding:"9px 12px",
          borderRadius:10, fontSize:12, lineHeight:1.6, zIndex:9999,
          boxShadow:"0 10px 30px rgba(0,0,0,.3)", maxWidth:230,
        }}>
          <div style={{ fontWeight:700, marginBottom:3 }}>{tip.dept}</div>
          <div><span style={{ display:"inline-block", width:9, height:9, borderRadius:3, background:tip.color, marginRight:6, verticalAlign:"middle" }} />{tip.shift}</div>
          <div>ปฏิบัติงาน <span style={{ color:"#7fc6ff", fontWeight:700 }}>{tip.count} คน</span></div>
        </div>
      )}

      {/* Footer note */}
      <div style={{ marginTop:8, fontSize:11, color:"#94a3b8", textAlign:"right" }}>
        ข้อมูล: แผนกำลังคน 2569 · อัปเดต มิ.ย. 2569
      </div>
    </div>
  );
}
