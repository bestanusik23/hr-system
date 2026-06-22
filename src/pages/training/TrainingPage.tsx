import { useState } from "react";
import PageLayout from "../../components/PageLayout";
import { useAuth } from "../../context/AuthContext";
import PlanTab     from "./PlanTab";
import RegTab      from "./RegTab";
import SummaryTab  from "./SummaryTab";
import CertTab     from "./CertTab";

type Tab = "plan" | "reg" | "summary" | "cert";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "plan",    label: "วางแผนอบรม",    icon: "📋" },
  { key: "reg",     label: "ลงทะเบียน",      icon: "✍️" },
  { key: "summary", label: "สรุปผล",         icon: "📊" },
  { key: "cert",    label: "ใบประกาศ",       icon: "🎓" },
];

export default function TrainingPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("plan");
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  const canEdit = !!user && ["hr", "admin"].includes(user.role);

  function goToTab(t: Tab, courseId?: number) {
    if (courseId !== undefined) setSelectedCourseId(courseId);
    setTab(t);
  }

  return (
    <PageLayout title="ระบบบริหารการฝึกอบรม" accent="#0038C6">
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 22,
        background: "#f0f5ff", borderRadius: 9, padding: 4,
        border: "1px solid #dce4f5", width: "fit-content" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: "8px 20px", borderRadius: 6, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: tab === t.key ? 700 : 400,
              background:  tab === t.key ? "#0038C6" : "transparent",
              color:       tab === t.key ? "#fff"    : "#475569",
              transition:  "all .15s",
              display: "flex", alignItems: "center", gap: 6,
            }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {tab === "plan"    && <PlanTab    canEdit={canEdit} onNavigate={goToTab} />}
      {tab === "reg"     && <RegTab     canEdit={canEdit} initCourseId={selectedCourseId} />}
      {tab === "summary" && <SummaryTab canEdit={canEdit} initCourseId={selectedCourseId} />}
      {tab === "cert"    && <CertTab    canEdit={canEdit} initCourseId={selectedCourseId} />}
    </PageLayout>
  );
}
