import { useEffect, useState } from "react";

interface CertInfo {
  cert_id: string; full_name: string; institution_name: string | null;
  faculty: string | null; major: string | null; department_name: string | null;
  start_date: string | null; end_date: string | null; issued_at: string; status: string;
}

function thDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
                  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export default function InternCertVerifyPage() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [cert, setCert]       = useState<CertInfo | null>(null);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setError("ไม่พบ Token"); setLoading(false); return; }
    fetch(`/api/interns/verify/${encodeURIComponent(token)}`)
      .then(r => r.json() as Promise<{ ok: boolean; certificate?: CertInfo; error?: string }>)
      .then(d => {
        if (!d.ok || !d.certificate) setError(d.error ?? "ไม่พบใบประกาศ");
        else setCert(d.certificate);
        setLoading(false);
      });
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", background: "#faf9ff", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <div style={{ width: 44, height: 44, background: "#7c3aed", borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 900, fontSize: 11, lineHeight: 1.2, textAlign: "center" }}>
          RAM+
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#7c3aed" }}>CHIANGRAI RAM+ HOSPITAL</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>ตรวจสอบความถูกต้องใบรับรองการฝึกงาน</div>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, maxWidth: 500, width: "100%",
        boxShadow: "0 8px 32px rgba(124,58,237,0.18)", border: "1px solid #ede9fe",
        borderTop: "4px solid #7c3aed", padding: "32px 36px" }}>

        {loading ? (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: "20px 0" }}>กำลังตรวจสอบ…</div>
        ) : error ? (
          <>
            <div style={{ textAlign: "center", fontSize: 48, marginBottom: 12 }}>❌</div>
            <div style={{ textAlign: "center", fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>ไม่พบใบรับรอง</div>
            <div style={{ textAlign: "center", color: "#64748b", fontSize: 14 }}>{error}</div>
          </>
        ) : cert ? (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              {cert.status === "issued" ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
                  background: "#dcfce7", color: "#16a34a", borderRadius: 24,
                  padding: "8px 20px", fontWeight: 800, fontSize: 15, border: "1.5px solid #bbf7d0" }}>
                  ✅ ใบรับรองถูกต้อง (Valid)
                </div>
              ) : (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
                  background: "#fee2e2", color: "#dc2626", borderRadius: 24,
                  padding: "8px 20px", fontWeight: 800, fontSize: 15, border: "1.5px solid #fecaca" }}>
                  ❌ ใบรับรองถูกยกเลิก (Revoked)
                </div>
              )}
            </div>

            <div style={{ background: "#faf9ff", borderRadius: 10, padding: "18px 20px",
              border: "1px solid #ede9fe", marginBottom: 16 }}>
              <Row label="เลขที่ใบรับรอง" value={cert.cert_id} mono />
              <Row label="ชื่อผู้ถือ"      value={cert.full_name} bold />
              <Row label="สถาบันการศึกษา" value={cert.institution_name ?? "—"} />
              <Row label="คณะ / สาขา"     value={[cert.faculty, cert.major].filter(Boolean).join(" / ") || "—"} />
              <Row label="แผนกที่ฝึก"     value={cert.department_name ?? "—"} />
              <Row label="ระยะเวลาฝึกงาน" value={`${thDate(cert.start_date)} – ${thDate(cert.end_date)}`} />
              <Row label="วันที่ออกใบรับรอง" value={thDate(cert.issued_at)} />
            </div>

            <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
              ออกโดย โรงพยาบาลเชียงราย ราม · Human Resource Development (HRD)
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
      borderBottom: "1px solid #ede9fe", padding: "8px 0", fontSize: 13 }}>
      <span style={{ color: "#64748b", flexShrink: 0, marginRight: 10 }}>{label}</span>
      <span style={{ color: "#0a1628", fontWeight: bold ? 800 : 600, fontFamily: mono ? "monospace" : "inherit", textAlign: "right" }}>{value}</span>
    </div>
  );
}
