import { useState } from "react";
import { useAuth, hasRole } from "../../context/AuthContext";
import PageLayout from "../../components/PageLayout";
import RoundsList from "./RoundsList";
import AdminConfig from "./AdminConfig";

type Tab = "rounds" | "admin";

export default function AnnualEvalPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("rounds");
  const canAdmin = hasRole(user, "hr", "deputyHR", "admin");

  const TABS: { key: Tab; icon: string; label: string }[] = [
    { key: "rounds", icon: "📊", label: "รอบประเมิน" },
    ...(canAdmin ? [{ key: "admin" as Tab, icon: "⚙️", label: "ตั้งค่า" }] : []),
  ];

  return (
    <PageLayout title="ประเมินผลการปฏิบัติงานประจำปี" accent="#0038C6">
      <div style={{ display: "flex", gap: 2, marginBottom: 24,
        background: "#fff", borderRadius: 8, padding: 4, width: "fit-content",
        boxShadow: "0 1px 4px rgba(0,56,198,0.08)", border: "1px solid #dce4f5" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "9px 20px", borderRadius: 6, border: "none", fontFamily: "inherit",
            fontSize: 13, fontWeight: tab === t.key ? 700 : 400, cursor: "pointer",
            background: tab === t.key ? "#0038C6" : "transparent",
            color: tab === t.key ? "#fff" : "#64748b",
            display: "flex", alignItems: "center", gap: 6, transition: "all .15s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "rounds" && <RoundsList />}
      {tab === "admin" && canAdmin && <AdminConfig />}
    </PageLayout>
  );
}
