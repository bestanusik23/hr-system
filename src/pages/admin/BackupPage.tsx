import { useState } from "react";
import PageLayout from "../../components/PageLayout";

interface BackupResponse {
  ok: boolean; error?: string;
  exported_at: string; exported_by: string; version: number;
  tables: Record<string, unknown[]>;
  table_errors?: Record<string, string>;
}

export default function BackupPage() {
  const [loading, setLoading]         = useState(false);
  const [err, setErr]                 = useState("");
  const [lastResult, setLastResult]   = useState<{ exportedAt: string; tableCount: number; rowCount: number; warnings: string[] } | null>(null);

  async function downloadBackup() {
    setLoading(true); setErr(""); setLastResult(null);
    try {
      const r = await fetch("/api/admin/backup");
      const d = await r.json() as BackupResponse;
      if (!d.ok) { setErr(d.error ?? "สำรองข้อมูลไม่สำเร็จ"); return; }

      const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const ts   = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const a    = document.createElement("a");
      a.href = url; a.download = `hr-backup-${ts}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const tableCount = Object.keys(d.tables).length;
      const rowCount    = Object.values(d.tables).reduce((s, rows) => s + rows.length, 0);
      const warnings    = d.table_errors ? Object.entries(d.table_errors).map(([t, e]) => `${t}: ${e}`) : [];
      setLastResult({ exportedAt: d.exported_at, tableCount, rowCount, warnings });
    } catch {
      setErr("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageLayout title="สำรองข้อมูล" accent="#0038C6">
      <div style={{ display: "grid", gap: 20, maxWidth: 640 }}>

        <div style={{ background: "#eff6ff", border: "1.5px solid #c4cfee", borderRadius: 10,
          padding: "14px 18px", fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
          ระบบจะรวบรวมข้อมูลทั้งหมดในระบบ (พนักงาน, การประเมิน, การอบรม, การโอนย้าย, สรรหาบุคลากร,
          อัตรากำลัง, คำสั่งออกหน่วย, ผู้ใช้งาน ฯลฯ) เป็นไฟล์ JSON เดียว แล้วดาวน์โหลดลงเครื่องทันที
          กรุณาเก็บไฟล์นี้ไว้ในที่ปลอดภัย (เช่น Google Drive ขององค์กร) — ไฟล์นี้มีข้อมูลส่วนบุคคลของพนักงานทั้งหมด
        </div>

        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #dce4f5",
          boxShadow: "0 2px 10px rgba(0,56,198,.05)", padding: "28px 26px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🗄️</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0a1628", marginBottom: 6 }}>สำรองข้อมูลทั้งระบบ</div>
          <div style={{ fontSize: 12.5, color: "#94a3b8", marginBottom: 22 }}>
            ดาวน์โหลดไฟล์ .json ที่รวมข้อมูลทุกตารางในระบบ ณ เวลาปัจจุบัน
          </div>
          <button onClick={downloadBackup} disabled={loading}
            style={{ padding: "13px 32px", borderRadius: 10, border: "none",
              background: loading ? "#94a3b8" : "#0038C6", color: "#fff", fontWeight: 800, fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 14px rgba(0,56,198,.3)" }}>
            {loading ? "กำลังสำรองข้อมูล…" : "⬇️ ดาวน์โหลดข้อมูลสำรอง"}
          </button>

          {err && (
            <div style={{ marginTop: 18, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8,
              padding: "10px 14px", fontSize: 12.5, color: "#dc2626", textAlign: "left" }}>{err}</div>
          )}
          {lastResult && (
            <div style={{ marginTop: 18, textAlign: "left" }}>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8,
                padding: "10px 14px", fontSize: 12.5, color: "#166534" }}>
                ✅ ดาวน์โหลดสำเร็จ — {lastResult.tableCount} ตาราง / {lastResult.rowCount.toLocaleString()} แถว
                (ณ {new Date(lastResult.exportedAt).toLocaleString("th-TH")})
              </div>
              {lastResult.warnings.length > 0 && (
                <div style={{ marginTop: 8, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
                  padding: "10px 14px", fontSize: 12, color: "#92400e" }}>
                  ⚠ บางตารางข้ามไป (อาจยังไม่ได้สร้างในฐานข้อมูล):
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {lastResult.warnings.map(w => <li key={w}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10,
          padding: "14px 18px", fontSize: 12.5, color: "#92400e", lineHeight: 1.7 }}>
          ⚠️ ไฟล์สำรองนี้เป็นการ "ดาวน์โหลดเพื่อเก็บไว้" เท่านั้น ระบบยังไม่มีปุ่มนำเข้าข้อมูลกลับ (Restore) อัตโนมัติ
          เนื่องจากการทับข้อมูลทั้งหมดมีความเสี่ยงสูงที่จะทำข้อมูลที่บันทึกหลังจุดสำรองหายไป
          หากต้องกู้คืนข้อมูลจริง กรุณาติดต่อผู้ดูแลระบบ/ผู้พัฒนา พร้อมส่งไฟล์นี้ไปเพื่อดำเนินการกู้คืนอย่างระมัดระวัง
        </div>
      </div>
    </PageLayout>
  );
}
