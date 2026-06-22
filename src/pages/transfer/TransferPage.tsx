import { useState } from "react";
import PageLayout from "../../components/PageLayout";
import { useAuth } from "../../context/AuthContext";
import TransferList from "./TransferList";
import TransferForm from "./TransferForm";

export default function TransferPage() {
  const { user } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const canCreate = user && ["hr", "head", "admin"].includes(user.role);

  return (
    <PageLayout title="ระบบคำขอย้ายแผนก" accent="#0038C6">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        {canCreate && (
          <button onClick={() => setShowNew(true)} style={{
            padding: "10px 22px", borderRadius: 8, border: "none",
            background: "#0038C6", color: "#fff", fontWeight: 700,
            fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 2px 8px rgba(0,56,198,0.25)",
          }}>
            + ส่งคำขอย้ายแผนก
          </button>
        )}
      </div>
      <TransferList key={refresh} />
      {showNew && (
        <TransferForm onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); setRefresh(r => r + 1); }} />
      )}
    </PageLayout>
  );
}
