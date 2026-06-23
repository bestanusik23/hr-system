import { useState } from "react";
import PageLayout from "../../components/PageLayout";
import { useAuth } from "../../context/AuthContext";
import ManpowerDashboard from "./ManpowerDashboard";
import MasterList from "./MasterList";
import NewHireTab from "./NewHireTab";
import ResignTab from "./ResignTab";

type Tab = "dashboard" | "master" | "newhire" | "resign";

export default function ManpowerPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [bump, setBump] = useState(0);          // force-refresh dependents after writes

  const canEdit = user && ["hr", "admin"].includes(user.role);

  const TABS: { key: Tab; icon: string; label: string; hidden?: boolean }[] = [
    { key: "dashboard", icon: "📊", label: "ภาพรวม Manpower" },
    { key: "master",    icon: "🗂️", label: "อัตรากำลังพนักงาน" },
    { key: "newhire",   icon: "➕", label: "เพิ่มพนักงานเริ่มงานใหม่", hidden: !canEdit },
    { key: "resign",    icon: "📤", label: "เพิ่มพนักงานลาออก",       hidden: !canEdit },
  ];

  return (
    <PageLayout title="Manpower CRR" accent="#0891b2">
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 24, flexWrap: "wrap",
        background: "#fff", borderRadius: 8, padding: 4, width: "fit-content",
        boxShadow: "0 1px 4px rgba(0,56,198,0.08)", border: "1px solid #dce4f5" }}>
        {TABS.filter(t => !t.hidden).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "9px 18px", borderRadius: 6, border: "none", fontFamily: "inherit",
            fontSize: 13, fontWeight: tab === t.key ? 700 : 400, cursor: "pointer",
            background: tab === t.key ? "#0891b2" : "transparent",
            color: tab === t.key ? "#fff" : "#64748b",
            display: "flex", alignItems: "center", gap: 6, transition: "all .15s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <ManpowerDashboard key={`d${bump}`} />}
      {tab === "master"    && <MasterList key={`m${bump}`} onChanged={() => setBump(b => b + 1)} />}
      {tab === "newhire"   && (
        <NewHireTab onSaved={() => { setBump(b => b + 1); setTab("master"); }} />
      )}
      {tab === "resign"    && (
        <ResignTab onSaved={() => { setBump(b => b + 1); setTab("master"); }} />
      )}
    </PageLayout>
  );
}
