import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { ReactNode } from "react";

interface Props { title: string; accent?: string; children: ReactNode; }

export default function PageLayout({ title, accent = "#0038C6", children }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#f0f5ff", fontFamily: "inherit" }}>
      {/* Top bar */}
      <div style={{
        background: "#0038C6", height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", boxShadow: "0 2px 12px rgba(0,56,198,0.25)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        {/* Left: back + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => navigate("/")}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 7,
              padding: "6px 14px", color: "#fff", fontSize: 12, cursor: "pointer",
              fontFamily: "inherit", fontWeight: 500, letterSpacing: "0.02em",
              display: "flex", alignItems: "center", gap: 6 }}>
            ← หน้าหลัก
          </button>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.2)" }} />
          {accent !== "#0038C6" && (
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />
          )}
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>{title}</span>
        </div>

        {/* Right: user info */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%",
            background: user?.color ?? "rgba(255,255,255,0.2)",
            border: "2px solid rgba(255,255,255,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 12 }}>
            {user?.initial ?? "?"}
          </div>
          <div style={{ color: "#fff" }}>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{user?.full_name}</div>
            <div style={{ fontSize: 10, opacity: 0.65, letterSpacing: "0.04em" }}>{user?.role_title ?? user?.role}</div>
          </div>
          <button onClick={async () => { await logout(); navigate("/login"); }}
            style={{ marginLeft: 6, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 7, padding: "5px 12px", color: "#fff", fontSize: 12,
              cursor: "pointer", fontFamily: "inherit" }}>
            ออก
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
