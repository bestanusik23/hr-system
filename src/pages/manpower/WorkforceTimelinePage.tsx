import { useState } from "react";
import { useNavigate } from "react-router-dom";
import WorkforceTimeline from "./WorkforceTimeline";
import ManpowerTable from "./ManpowerTable";

type Tab = "timeline" | "plan";

export default function WorkforceTimelinePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("timeline");

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f4f6fb",
      fontFamily: "'IBM Plex Sans Thai', sans-serif",
      padding: "16px 20px 32px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => navigate("/")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "transparent", border: "1.5px solid #e2e8f0",
            borderRadius: 8, padding: "7px 16px",
            color: "#475569", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "#eef3ff";
            (e.currentTarget as HTMLButtonElement).style.color = "#0038c6";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#c4cfee";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#475569";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          กลับหน้าหลัก
        </button>

        <div style={{ display: "flex", gap: 2, background: "#fff", borderRadius: 8, padding: 4,
          boxShadow: "0 1px 4px rgba(0,56,198,0.08)", border: "1px solid #e2e8f0" }}>
          {([
            { key: "timeline" as const, icon: "🕐", label: "ไทม์ไลน์กำลังคน + OT" },
            { key: "plan" as const,     icon: "📋", label: "ตารางอัตรากำลัง (Bar Chart)" },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "9px 18px", borderRadius: 6, border: "none", fontFamily: "inherit",
              fontSize: 13, fontWeight: tab === t.key ? 700 : 400, cursor: "pointer",
              background: tab === t.key ? "#0038C6" : "transparent",
              color: tab === t.key ? "#fff" : "#64748b",
              display: "flex", alignItems: "center", gap: 6, transition: "all .15s",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "timeline" && <WorkforceTimeline />}
      {tab === "plan" && <ManpowerTable />}
    </div>
  );
}
