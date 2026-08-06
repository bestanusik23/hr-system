import { useState } from "react";
import { useNavigate } from "react-router-dom";
import WorkforceTimeline from "../WorkforceTimeline";
import ExecutiveDashboard from "./ExecutiveDashboard";
import BarSetup from "./BarSetup";
import ShiftStandard from "./ShiftStandard";
import OtApproval from "./OtApproval";
import BarAnalytics from "./BarAnalytics";
import { BAR_CSS } from "./barStyles";
import { currentPayrollMonthKey } from "./barMath";

/**
 * Bar Management — เมนูรวมของระบบบริหารกำลังคนด้วย Bar Chart
 * (เดิมชื่อ "Workforce Timeline" ซึ่งตอนนี้ย้ายมาเป็นแท็บสุดท้ายและยังทำงานเหมือนเดิมทุกอย่าง
 *  รวมถึงการนำเข้า Excel กะ / Excel ค่าเวร และการกรอกยอด OT รายเดือน)
 */
type Tab = "dashboard" | "bars" | "shift" | "ot" | "analytics" | "timeline";

const TABS: { key: Tab; icon: string; label: string; desc: string }[] = [
  { key: "dashboard", icon: "📊", label: "Executive Dashboard", desc: "ภาพรวมสำหรับผู้บริหาร" },
  { key: "bars",      icon: "🎚️", label: "Bar Management",      desc: "กำหนด Approved Bar ของแต่ละแผนก" },
  { key: "shift",     icon: "⏱️", label: "Shift Standard",      desc: "มาตรฐาน 8 / 10 / 12 ชม. ของแต่ละตำแหน่ง" },
  { key: "ot",        icon: "✅", label: "OT Approval",         desc: "อนุมัติ OT เมื่อใช้ Bar เกินแผน" },
  { key: "analytics", icon: "📈", label: "Bar Analytics",       desc: "แนวโน้มและประสิทธิภาพการใช้ Bar" },
  { key: "timeline",  icon: "🗓️", label: "Timeline & นำเข้า Excel", desc: "ตารางกะรายวัน/รายเดือน + นำเข้าไฟล์ (ของเดิม)" },
];

export default function BarManagementPage() {
  const navigate = useNavigate();
  const [tab, setTab]     = useState<Tab>("dashboard");
  const [month, setMonth] = useState<string>(currentPayrollMonthKey);
  const active = TABS.find(t => t.key === tab)!;

  return (
    <div id="barmgr" style={{ minHeight: "100vh", background: "#F2F5FB", padding: "16px 20px 32px" }}>
      <style>{BAR_CSS}</style>

      <button className="btn" onClick={() => navigate("/")} style={{ marginBottom: 14 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        กลับหน้าหลัก
      </button>

      {/* ── หัวเรื่อง ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between",
                    gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.3px",
                       display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 5, height: 24, borderRadius: 6,
                           background: "linear-gradient(#0B4FC7,#26A9E0)", flexShrink: 0 }} />
            Bar Management
          </h2>
          <p style={{ margin: "6px 0 0 17px", color: "#6B7A99", fontSize: 13.5 }}>
            บริหารกำลังคนและควบคุมต้นทุนแรงงานด้วย Bar Chart — {active.desc}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff",
                      border: "1px solid #E6EBF5", borderRadius: 12, padding: "9px 14px",
                      fontSize: 13, fontWeight: 600, boxShadow: "0 2px 8px rgba(20,40,90,.05)" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e",
                         boxShadow: "0 0 0 4px rgba(34,197,94,.15)" }} />
          <span>รอบเดือน {month}</span>
        </div>
      </div>

      {/* ── แท็บเมนู ── */}
      <div style={{ display: "flex", gap: 3, marginBottom: 16, flexWrap: "wrap", background: "#fff",
                    borderRadius: 12, padding: 5, width: "fit-content", maxWidth: "100%",
                    border: "1px solid #E6EBF5", boxShadow: "0 4px 14px rgba(20,40,90,.05)" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} title={t.desc}
                  style={{ padding: "9px 15px", borderRadius: 9, border: "none", fontFamily: "inherit",
                           fontSize: 13, fontWeight: tab === t.key ? 700 : 500, cursor: "pointer",
                           background: tab === t.key ? "#0B4FC7" : "transparent",
                           color: tab === t.key ? "#fff" : "#6B7A99",
                           display: "flex", alignItems: "center", gap: 6, transition: "all .15s" }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <ExecutiveDashboard month={month} onMonthChange={setMonth} />}
      {tab === "bars"      && <BarSetup month={month} />}
      {tab === "shift"     && <ShiftStandard />}
      {tab === "ot"        && <OtApproval month={month} onMonthChange={setMonth} />}
      {tab === "analytics" && <BarAnalytics month={month} />}
      {tab === "timeline"  && <WorkforceTimeline />}
    </div>
  );
}
