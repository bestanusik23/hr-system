import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { ReactNode } from "react";

interface Props {
  title: string;
  accent?: string;
  children: ReactNode;
}

export default function PageLayout({ title, accent = "#0038C6", children }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "inherit" }}>
      {/* Top bar */}
      <div style={{ background: accent, padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 8px rgba(0,0,0,.18)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => navigate("/")} style={{ background: "rgba(255,255,255,.18)", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            ← หน้าหลัก
          </button>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: user?.color ?? "#334155", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12 }}>
            {user?.initial ?? "?"}
          </div>
          <span style={{ color: "#fff", fontSize: 13 }}>{user?.full_name}</span>
          <button onClick={async () => { await logout(); navigate("/login"); }} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, padding: "5px 12px", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            ออก
          </button>
        </div>
      </div>
      {/* Content */}
      <div style={{ padding: 28, maxWidth: 1100, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
