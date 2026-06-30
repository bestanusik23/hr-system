import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface Notif { id: number; icon: string; text: string; kind: string; link: string; created_at: string; }

function NotifBell() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen]     = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifs = () =>
    fetch("/api/notifications").then(r => r.json()).then((d: { ok: boolean; notifications?: Notif[] }) => {
      if (d.ok && d.notifications) setNotifs(d.notifications);
    }).catch(() => {});

  useEffect(() => {
    fetchNotifs();
    const t = setInterval(fetchNotifs, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (n: Notif) => {
    await fetch(`/api/notifications?id=${n.id}`, { method: "PATCH" }).catch(() => {});
    setNotifs(prev => prev.filter(x => x.id !== n.id));
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH" }).catch(() => {});
    setNotifs([]);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ position: "relative", background: "rgba(255,255,255,0.15)", border: "none",
          borderRadius: 7, width: 34, height: 34, cursor: "pointer", fontSize: 16,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
        🔔
        {notifs.length > 0 && (
          <span style={{ position: "absolute", top: 4, right: 4, background: "#ef4444",
            color: "#fff", borderRadius: "50%", fontSize: 9, fontWeight: 700,
            minWidth: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px", lineHeight: 1 }}>
            {notifs.length}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 42, width: 320, background: "#fff",
          borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", zIndex: 200,
          border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #f1f5f9",
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>การแจ้งเตือน</span>
            {notifs.length > 0 && (
              <button onClick={markAllRead}
                style={{ fontSize: 11, color: "#0038C6", background: "none", border: "none", cursor: "pointer" }}>
                อ่านทั้งหมด
              </button>
            )}
          </div>
          {notifs.length === 0 ? (
            <div style={{ padding: "20px 14px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>ไม่มีการแจ้งเตือน</div>
          ) : notifs.map(n => (
            <div key={n.id} onClick={() => markRead(n)}
              style={{ padding: "10px 14px", borderBottom: "1px solid #f8fafc", cursor: "pointer",
                display: "flex", gap: 10, alignItems: "flex-start",
                background: "#eff6ff", transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#dbeafe")}
              onMouseLeave={e => (e.currentTarget.style.background = "#eff6ff")}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{n.icon || "📋"}</span>
              <div>
                <div style={{ fontSize: 12.5, color: "#1e293b", lineHeight: 1.4 }}>{n.text}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>
                  {new Date(n.created_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

        {/* Right: bell + user info */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <NotifBell />
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
