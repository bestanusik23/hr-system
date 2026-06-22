import { useState } from "react";
import PageLayout from "../../components/PageLayout";
import EmployeeList from "./EmployeeList";
import EvaluationList from "./EvaluationList";
import TimelineView from "./TimelineView";

type Tab = "employees" | "evaluations" | "timeline";

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: "employees",   icon: "👤", label: "พนักงานทดลองงาน" },
  { key: "evaluations", icon: "📋", label: "ใบประเมิน" },
  { key: "timeline",    icon: "📅", label: "ประวัติ Timeline" },
];

export default function EvalPage() {
  const [tab, setTab] = useState<Tab>("employees");

  return (
    <PageLayout title="ระบบประเมินผลพนักงาน" accent="#16A34A">
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 24,
        background: "#fff", borderRadius: 8, padding: 4, width: "fit-content",
        boxShadow: "0 1px 4px rgba(0,56,198,0.08)", border: "1px solid #dce4f5" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "9px 20px", borderRadius: 6, border: "none", fontFamily: "inherit",
            fontSize: 13, fontWeight: tab === t.key ? 700 : 400, cursor: "pointer",
            background: tab === t.key ? "#0038C6" : "transparent",
            color: tab === t.key ? "#fff" : "#64748b",
            display: "flex", alignItems: "center", gap: 6,
            transition: "all .15s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "employees"   && <EmployeeList />}
      {tab === "evaluations" && <EvaluationList />}
      {tab === "timeline"    && <TimelineView />}
    </PageLayout>
  );
}
