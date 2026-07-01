import { useNavigate } from "react-router-dom";
import WorkforceTimeline from "./WorkforceTimeline";

export default function WorkforceTimelinePage() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f4f6fb",
      fontFamily: "'IBM Plex Sans Thai', sans-serif",
      padding: "32px 24px 64px",
    }}>
      {/* Header */}
      <div style={{ maxWidth: 1100, margin: "0 auto 28px" }}>
        <button
          onClick={() => navigate("/")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "transparent", border: "1.5px solid #e2e8f0",
            borderRadius: 8, padding: "7px 16px",
            color: "#475569", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            transition: "all .15s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "#eef3ff";
            (e.currentTarget as HTMLButtonElement).style.color = "#0038c6";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#c4cfee";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#475569";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          กลับหน้าหลัก
        </button>
      </div>

      {/* Timeline card */}
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <WorkforceTimeline />
      </div>
    </div>
  );
}
