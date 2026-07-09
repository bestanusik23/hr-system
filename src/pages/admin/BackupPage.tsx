import { useRef, useState } from "react";
import PageLayout from "../../components/PageLayout";
import { useAuth } from "../../context/AuthContext";

interface BackupResponse {
  ok: boolean; error?: string;
  exported_at: string; exported_by: string; version: number;
  tables: Record<string, unknown[]>;
  table_errors?: Record<string, string>;
}
interface RestoreResponse {
  ok: boolean; error?: string;
  restored?: Record<string, number>;
  errors?: Record<string, string>;
}

const CONFIRM_PHRASE = "RESTORE";

export default function BackupPage() {
  const { user } = useAuth();

  const [loading, setLoading]         = useState(false);
  const [err, setErr]                 = useState("");
  const [lastResult, setLastResult]   = useState<{ exportedAt: string; tableCount: number; rowCount: number; warnings: string[] } | null>(null);

  // Restore flow
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileData, setFileData]       = useState<BackupResponse | null>(null);
  const [fileErr, setFileErr]         = useState("");
  const [liveCounts, setLiveCounts]   = useState<Record<string, number> | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring]     = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResponse | null>(null);
  const [restoreErr, setRestoreErr]   = useState("");

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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileErr(""); setFileData(null); setLiveCounts(null); setConfirmText(""); setRestoreResult(null); setRestoreErr("");

    try {
      const text = JSON.parse(await file.text()) as BackupResponse;
      if (!text.tables) { setFileErr("ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลที่ถูกต้อง"); return; }
      setFileData(text);

      // Fetch current live counts for a before/after comparison.
      const r = await fetch("/api/admin/backup");
      const live = await r.json() as BackupResponse;
      if (live.ok) {
        const counts: Record<string, number> = {};
        for (const [t, rows] of Object.entries(live.tables)) counts[t] = rows.length;
        setLiveCounts(counts);
      }
    } catch {
      setFileErr("ไม่สามารถอ่านไฟล์นี้ได้ — ตรวจสอบว่าเป็นไฟล์ .json ที่ดาวน์โหลดจากระบบนี้");
    }
  }

  async function doRestore() {
    if (!fileData || confirmText !== CONFIRM_PHRASE) return;
    setRestoring(true); setRestoreErr(""); setRestoreResult(null);
    try {
      const r = await fetch("/api/admin/restore", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tables: fileData.tables }),
      });
      const d = await r.json() as RestoreResponse;
      setRestoreResult(d);
      if (!d.ok && d.error) setRestoreErr(d.error);
    } catch {
      setRestoreErr("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setRestoring(false);
    }
  }

  if (!user || user.username !== "admin") {
    return (
      <PageLayout title="สำรองข้อมูล" accent="#0038C6">
        <div style={{ textAlign: "center", padding: 60, color: "#dc2626", background: "#fff",
          borderRadius: 14, border: "1px solid #fecaca" }}>
          หน้านี้จำกัดสิทธิ์เฉพาะบัญชี admin เท่านั้น
        </div>
      </PageLayout>
    );
  }

  const fileTableCount = fileData ? Object.keys(fileData.tables).length : 0;
  const fileRowCount   = fileData ? Object.values(fileData.tables).reduce((s, rows) => s + rows.length, 0) : 0;
  const canRestore     = fileData && confirmText === CONFIRM_PHRASE && !restoring;

  return (
    <PageLayout title="สำรองข้อมูล" accent="#0038C6">
      <div style={{ display: "grid", gap: 20, maxWidth: 680 }}>

        {/* ── Backup / export ── */}
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

        {/* ── Restore / import ── */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #fecaca",
          boxShadow: "0 2px 10px rgba(220,38,38,.06)", padding: "26px 26px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 24 }}>♻️</span>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0a1628" }}>กู้คืนข้อมูลจากไฟล์สำรอง</div>
          </div>
          <div style={{ fontSize: 12.5, color: "#94a3b8", marginBottom: 18, lineHeight: 1.7 }}>
            ⚠️ การกู้คืนจะ<b style={{ color: "#dc2626" }}>ล้างข้อมูลปัจจุบันทั้งหมดแล้วแทนที่ด้วยข้อมูลในไฟล์สำรองทุกตาราง</b>
            {" "}ข้อมูลใดๆ ที่บันทึกหลังจากเวลาที่สำรองไฟล์นี้ไว้จะหายไปอย่างถาวร กรุณาตรวจสอบให้แน่ใจก่อนดำเนินการ
          </div>

          <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileSelect}
            style={{ fontSize: 13, fontFamily: "inherit", marginBottom: 12 }} />

          {fileErr && (
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8,
              padding: "10px 14px", fontSize: 12.5, color: "#dc2626", marginBottom: 12 }}>{fileErr}</div>
          )}

          {fileData && (
            <div style={{ marginTop: 8 }}>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
                padding: "14px 16px", marginBottom: 14, fontSize: 12.5, color: "#334155" }}>
                <div style={{ marginBottom: 8 }}>
                  <b>ไฟล์สำรอง:</b> {fileTableCount} ตาราง / {fileRowCount.toLocaleString()} แถว
                  {fileData.exported_at && <> — สำรองเมื่อ {new Date(fileData.exported_at).toLocaleString("th-TH")}</>}
                  {fileData.exported_by && <> โดย {fileData.exported_by}</>}
                </div>
                {liveCounts && (
                  <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                      <thead>
                        <tr style={{ background: "#eef2fb" }}>
                          <th style={{ padding: "6px 10px", textAlign: "left" }}>ตาราง</th>
                          <th style={{ padding: "6px 10px", textAlign: "right" }}>ปัจจุบัน</th>
                          <th style={{ padding: "6px 10px", textAlign: "right" }}>ในไฟล์สำรอง</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(fileData.tables).sort().map(t => {
                          const cur = liveCounts[t] ?? 0;
                          const file = fileData.tables[t]?.length ?? 0;
                          const changed = cur !== file;
                          return (
                            <tr key={t} style={{ borderTop: "1px solid #f1f5f9", background: changed ? "#fffbeb" : undefined }}>
                              <td style={{ padding: "5px 10px" }}>{t}</td>
                              <td style={{ padding: "5px 10px", textAlign: "right" }}>{cur}</td>
                              <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: changed ? 700 : 400,
                                color: changed ? "#b45309" : "#334155" }}>{file}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                พิมพ์คำว่า "{CONFIRM_PHRASE}" เพื่อยืนยันว่าต้องการทับข้อมูลทั้งระบบ
              </label>
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                style={{ width: "100%", maxWidth: 260, padding: "9px 12px", borderRadius: 7,
                  border: "1.5px solid #fecaca", fontSize: 13, fontFamily: "inherit", outline: "none",
                  marginBottom: 14, boxSizing: "border-box" }} />

              <div>
                <button onClick={doRestore} disabled={!canRestore}
                  style={{ padding: "12px 28px", borderRadius: 10, border: "none",
                    background: canRestore ? "#dc2626" : "#e2e8f0",
                    color: canRestore ? "#fff" : "#94a3b8", fontWeight: 800, fontSize: 14,
                    cursor: canRestore ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                  {restoring ? "กำลังกู้คืน…" : "♻️ ยืนยันการกู้คืนข้อมูล"}
                </button>
              </div>

              {restoreErr && (
                <div style={{ marginTop: 14, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8,
                  padding: "10px 14px", fontSize: 12.5, color: "#dc2626" }}>{restoreErr}</div>
              )}
              {restoreResult && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ background: restoreResult.ok ? "#f0fdf4" : "#fffbeb",
                    border: `1px solid ${restoreResult.ok ? "#bbf7d0" : "#fde68a"}`, borderRadius: 8,
                    padding: "10px 14px", fontSize: 12.5, color: restoreResult.ok ? "#166534" : "#92400e" }}>
                    {restoreResult.ok ? "✅ กู้คืนข้อมูลสำเร็จทุกตาราง" : "⚠ กู้คืนสำเร็จบางส่วน — มีบางตารางผิดพลาด"}
                    {restoreResult.restored && (
                      <> — รวม {Object.values(restoreResult.restored).reduce((s, n) => s + n, 0).toLocaleString()} แถว</>
                    )}
                  </div>
                  {restoreResult.errors && (
                    <div style={{ marginTop: 8, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8,
                      padding: "10px 14px", fontSize: 12, color: "#dc2626" }}>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {Object.entries(restoreResult.errors).map(([t, e]) => <li key={t}>{t}: {e}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10,
          padding: "14px 18px", fontSize: 12.5, color: "#92400e", lineHeight: 1.7 }}>
          ⚠️ ทั้งการสำรองและกู้คืนข้อมูลจำกัดสิทธิ์ไว้เฉพาะบัญชี admin เท่านั้น และการกู้คืนจะแทนที่ข้อมูลรหัสผ่าน
          ของผู้ใช้งานทุกคนด้วยค่าที่บันทึกไว้ตอนสำรอง (รวมถึงบัญชีของคุณเอง) หากมีการเปลี่ยนรหัสผ่านหลังจุดสำรอง
          จะต้องตั้งรหัสผ่านใหม่อีกครั้งหลังกู้คืน
        </div>
      </div>
    </PageLayout>
  );
}
