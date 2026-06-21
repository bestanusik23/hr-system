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
    <PageLayout title="ระบบคำขอย้ายแผนก" accent="#E0533D">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        {canCreate && (
          <button onClick={() => setShowNew(true)} style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#E0533D", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            + ส่งคำขอย้ายแผนก
          </button>
        )}
      </div>
      <TransferList key={refresh} />
      {showNew && (
        <TransferForm onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); setRefresh(r => r + 1); }} />
      )}
    </PageLayout>
  );
}
