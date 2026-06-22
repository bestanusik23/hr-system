import { useState } from "react";
import PageLayout from "../../components/PageLayout";
import { useAuth } from "../../context/AuthContext";
import EmployeeList from "./EmployeeList";
import EvaluationList from "./EvaluationList";
import TimelineView from "./TimelineView";

type Tab = "employees" | "evaluations" | "timeline";

export default function EvalPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("employees");

  const canManageEmployees = user && ["hr", "admin"].includes(user.role);

  return (
    <PageLayout title="ระบบประเมินผลพนักงาน" accent="#16A34A">
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "#fff",
        borderRadius: 12, padding: 4, width: "fit-content",
        boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
        <TabBtn active={tab === "employees"} onClick={() => setTab("employees")} color="#16A34A">
          👤 พนักงานทดลองงาน
        </TabBtn>
        <TabBtn active={tab === "evaluations"} onClick={() => setTab("evaluations")} color="#16A34A">
          📋 ใบประเมิน
        </TabBtn>
        <TabBtn active={tab === "timeline"} onClick={() => setTab("timeline")} color="#16A34A">
          📅 ประวัติ Timeline
        </TabBtn>
      </div>

      {tab === "employees"   && <EmployeeList />}
      {tab === "evaluations" && <EvaluationList />}
      {tab === "timeline"    && <TimelineView />}
    </PageLayout>
  );
}

function TabBtn({ active, onClick, children, color }: {
  active: boolean; onClick: () => void; children: React.ReactNode; color: string;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 20px", borderRadius: 9, border: "none", fontFamily: "inherit",
      fontSize: 14, fontWeight: active ? 700 : 400, cursor: "pointer",
      background: active ? color : "transparent",
      color: active ? "#fff" : "#64748b",
      transition: "all .15s",
    }}>{children}</button>
  );
}
