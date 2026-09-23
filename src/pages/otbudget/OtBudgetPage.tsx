import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, hasRole } from "../../context/AuthContext";
import ReportTab from "./ReportTab";
import EntryTab from "./EntryTab";
import CategorySetup from "./CategorySetup";

type Tab = "report" | "entry" | "setup";

const nowBEYear = new Date().getFullYear() + 543;

export default function OtBudgetPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("report");
  const [year, setYear] = useState<string>(String(nowBEYear));

  const canManage = hasRole(user, "hr", "admin", "deputyHR");

  const TABS: { key: Tab; icon: string; label: string }[] = [
    { key: "report", icon: "📊", label: "รายงาน" },
    ...(canManage ? [{ key: "entry" as Tab, icon: "✏️", label: "กรอกข้อมูล" }] : []),
    ...(canManage ? [{ key: "setup" as Tab, icon: "⚙️", label: "ตั้งค่าหมวด" }] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F2F5FB", padding: "16px 20px 32px" }}>
      <button onClick={() => navigate("/")} className="ot-back-btn print-hide"
        style={{ marginBottom: 14, background: "#fff", border: "1px solid #E6EBF5", borderRadius: 8,
          padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "#334155" }}>
        ← กลับหน้าหลัก
      </button>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between",
                    gap: 16, flexWrap: "wrap", marginBottom: 14 }} className="print-hide">
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.3px",
                       display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 5, height: 24, borderRadius: 6,
                           background: "linear-gradient(#1F3864,#2F5597)", flexShrink: 0 }} />
            ประมาณการ OT และจ่ายจริง
          </h2>
          <p style={{ margin: "6px 0 0 17px", color: "#6B7A99", fontSize: 13.5 }}>
            เปรียบเทียบงบประมาณกับยอดจ่ายจริงรายเดือน แยกตามหมวดงาน
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 3, marginBottom: 16, flexWrap: "wrap", background: "#fff",
                    borderRadius: 12, padding: 5, width: "fit-content", maxWidth: "100%",
                    border: "1px solid #E6EBF5", boxShadow: "0 4px 14px rgba(20,40,90,.05)" }}
        className="print-hide">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
                  style={{ padding: "9px 15px", borderRadius: 9, border: "none", fontFamily: "inherit",
                           fontSize: 13, fontWeight: tab === t.key ? 700 : 500, cursor: "pointer",
                           background: tab === t.key ? "#1F3864" : "transparent",
                           color: tab === t.key ? "#fff" : "#6B7A99",
                           display: "flex", alignItems: "center", gap: 6, transition: "all .15s" }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {tab === "report" && <ReportTab year={year} onYearChange={setYear} />}
      {tab === "entry" && canManage && <EntryTab year={year} onYearChange={setYear} />}
      {tab === "setup" && canManage && <CategorySetup />}
    </div>
  );
}
