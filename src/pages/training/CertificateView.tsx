// ใบประกาศนียบัตร — ออกแบบตาม template โรงพยาบาลเชียงราย ราม

interface CertData {
  cert_id: string; full_name: string; position: string | null;
  department: string | null; hours: number | null;
  course_name: string; course_date: string | null;
  issued_at: string; status: string; qr_token: string;
  trainer: string | null;
}

interface Props { cert: CertData; onClose?: () => void; }

function thDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  const MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
                  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

const PRINT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap');
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: 'Sarabun', 'TH Sarabun New', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cert-wrap { width: 297mm; height: 210mm; position: relative; background: #fff; overflow: hidden; display: flex; flex-direction: column; }
.bar-l { position: absolute; left: 0; top: 0; bottom: 0; width: 12mm; background: #0038C6; }
.bar-l2 { position: absolute; left: 14mm; top: 0; bottom: 0; width: 2.5mm; background: #0038C6; opacity: 0.28; }
.bar-r { position: absolute; right: 0; top: 0; bottom: 0; width: 12mm; background: #0038C6; }
.bar-r2 { position: absolute; right: 14mm; top: 0; bottom: 0; width: 2.5mm; background: #0038C6; opacity: 0.28; }
.inner { margin: 0 20mm; height: 100%; display: flex; flex-direction: column; }
.hdr { display: flex; justify-content: space-between; align-items: center; padding: 5mm 0 3mm; border-bottom: 0.5px solid #dce4f5; }
.logo-box { display: flex; align-items: center; gap: 3mm; }
.logo-sq { width: 12mm; height: 12mm; background: #0038C6; border-radius: 2.5mm; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 8pt; font-weight: 900; line-height: 1.1; text-align: center; }
.logo-txt-top { font-size: 7.5pt; font-weight: 700; color: #0038C6; letter-spacing: 0.05em; }
.logo-txt-bot { font-size: 10pt; font-weight: 900; color: #0038C6; }
.acc-logos { display: flex; gap: 2.5mm; align-items: center; }
.acc-badge { border: 1px solid #c4cfee; border-radius: 1.5mm; padding: 1mm 2.5mm; font-size: 7.5pt; font-weight: 800; color: #0038C6; background: #f8faff; }
.year-badge { background: #0038C6; color: #fff; border-radius: 3mm; padding: 2mm 5mm; font-size: 10pt; font-weight: 800; }
.body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2mm 0 1mm; gap: 1mm; }
.company { font-size: 18pt; font-weight: 900; color: #0038C6; }
.sub { font-size: 13pt; color: #334155; }
.name { font-size: 38pt; font-weight: 900; color: #0038C6; line-height: 1.15; letter-spacing: 0.01em; }
.detail { font-size: 13pt; color: #334155; line-height: 1.75; }
.detail b { color: #0a1628; font-weight: 800; }
.wish { font-size: 11.5pt; color: #475569; margin-top: 1mm; }
.given { font-size: 11pt; color: #64748b; }
.sigs { display: flex; justify-content: space-around; width: 100%; margin-top: 4mm; }
.sig { text-align: center; width: 80mm; }
.sig-line { border-top: 1.5px solid #475569; margin: 0 12mm 2.5mm; }
.sig-name { font-size: 12.5pt; font-weight: 800; color: #0a1628; }
.sig-pos { font-size: 9.5pt; color: #64748b; line-height: 1.4; }
.footer { background: #0038C6; color: #fff; text-align: center; padding: 2.5mm 0; font-size: 10pt; font-weight: 700; letter-spacing: 0.18em; margin: 0 12mm; }
.qr { position: absolute; bottom: 12mm; right: 19mm; width: 18mm; height: 18mm; border-radius: 1.5mm; border: 1px solid #c4cfee; }
.cert-id { position: absolute; bottom: 13mm; left: 19mm; font-size: 7pt; color: #94a3b8; font-family: monospace; }
`;

export default function CertificateView({ cert, onClose }: Props) {
  const qrUrl = `${window.location.origin}/cert/verify?token=${cert.qr_token}`;

  function print() {
    const el = document.getElementById("cert-print-area");
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>ใบประกาศนียบัตร - ${cert.full_name}</title>
      <style>${PRINT_CSS}</style></head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 800);
  }

  const year = new Date().getFullYear() + 543;

  // Scale preview to fit screen (297mm → ~1060px)
  const scale = 1060 / (297 * 3.7795);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button onClick={print}
          style={{ padding: "9px 20px", borderRadius: 7, border: "none",
            background: "#0038C6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          🖨️ พิมพ์ / บันทึก PDF
        </button>
        {onClose && (
          <button onClick={onClose}
            style={{ padding: "9px 18px", borderRadius: 7, border: "1.5px solid #c4cfee",
              background: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            ← กลับ
          </button>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <div id="cert-print-area">
          {/* ─── cert-wrap ─── */}
          <div className="cert-wrap" style={{
            width: 1122, height: 794, position: "relative", background: "#fff", overflow: "hidden",
            display: "flex", flexDirection: "column",
            fontFamily: "'Sarabun','TH Sarabun New',sans-serif",
            boxShadow: "0 8px 40px rgba(0,56,198,0.18)", border: "1px solid #dce4f5",
          }}>
            {/* Side bars */}
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 45, background: "#0038C6" }} />
            <div style={{ position: "absolute", left: 54, top: 0, bottom: 0, width: 9, background: "#0038C6", opacity: 0.25 }} />
            <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 45, background: "#0038C6" }} />
            <div style={{ position: "absolute", right: 54, top: 0, bottom: 0, width: 9, background: "#0038C6", opacity: 0.25 }} />

            {/* Inner container */}
            <div style={{ margin: "0 75px", height: "100%", display: "flex", flexDirection: "column" }}>

              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "18px 0 12px", borderBottom: "1px solid #e8eeff" }}>
                {/* Logo */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img src="/logo-nobg.png" alt="RAM+" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    style={{ height: 48, objectFit: "contain" }} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#0038C6", letterSpacing: "0.06em" }}>CHIANGRAI</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#0038C6" }}>RAM+ HOSPITAL</div>
                  </div>
                </div>
                {/* Accreditation badges */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {["URS","UKAS","AACI","GLP"].map(a => (
                    <div key={a} style={{ border: "1.5px solid #c4cfee", borderRadius: 5, padding: "5px 10px",
                      fontSize: 11, fontWeight: 800, color: "#0038C6", background: "#f8faff" }}>{a}</div>
                  ))}
                </div>
                {/* Year badge */}
                <div style={{ background: "#0038C6", color: "#fff", borderRadius: 10, padding: "7px 18px",
                  fontSize: 14, fontWeight: 800 }}>ประจำปี {year}</div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", textAlign: "center", gap: 0 }}>

                <div style={{ fontSize: 22, fontWeight: 900, color: "#0038C6", marginBottom: 2 }}>
                  บริษัท วัชรศิริเวช จำกัด
                </div>
                <div style={{ fontSize: 16, color: "#334155", marginBottom: 10 }}>
                  ขอมอบเกียรติบัตรฉบับนี้ไว้เพื่อแสดงว่า
                </div>

                {/* Name — largest element */}
                <div style={{ fontSize: 52, fontWeight: 900, color: "#0038C6",
                  lineHeight: 1.15, letterSpacing: "0.01em", marginBottom: 10 }}>
                  {cert.full_name}
                </div>

                {/* Course detail */}
                <div style={{ fontSize: 16, color: "#334155", lineHeight: 1.85 }}>
                  ได้เข้ารับการฝึกอบรม <span style={{ fontWeight: 800, color: "#0a1628" }}>{cert.course_name}</span>
                  {cert.course_date && (
                    <><br />วันที่ {thDate(cert.course_date)}</>
                  )}
                  <br />ณ โรงพยาบาลเชียงราย ราม
                </div>

                <div style={{ fontSize: 15, color: "#475569", marginTop: 10 }}>
                  ขอให้มีความสุขสวัสดิ์ ความเจริญ และประสบผลสำเร็จสืบไป
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
                  ให้ ณ วันที่ {thDate(cert.issued_at)}
                </div>

                {/* Signatures */}
                <div style={{ display: "flex", justifyContent: "space-around", width: "100%", marginTop: 22 }}>
                  {[
                    { name: "นายอนุสิกข์ ทองแผ่น",      pos: "(รักษาการ รองผอ. ฝ่ายบริหารค่าตอบแทน\nและพัฒนาคุณภาพ)" },
                    { name: "นายแพทย์วัชระ เตชะธีราวัฒน์", pos: "(ผู้อำนวยการโรงพยาบาลเชียงราย ราม)" },
                  ].map(s => (
                    <div key={s.name} style={{ textAlign: "center", width: 260 }}>
                      <div style={{ borderTop: "1.5px solid #475569", margin: "0 30px 10px" }} />
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#0a1628" }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, whiteSpace: "pre-line", lineHeight: 1.45 }}>
                        {s.pos}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{ background: "#0038C6", color: "#fff", textAlign: "center",
                padding: "8px 0", fontSize: 13, fontWeight: 700, letterSpacing: "0.18em",
                margin: "0 -75px", paddingLeft: 75, paddingRight: 75 }}>
                HUMAN RESOURCE DEVELOPMENT ( HRD )
              </div>
            </div>

            {/* QR code */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrUrl)}`}
              alt="QR Verify"
              style={{ position: "absolute", bottom: 42, right: 68,
                width: 68, height: 68, borderRadius: 6, border: "1.5px solid #c4cfee" }} />

            {/* Cert ID */}
            <div style={{ position: "absolute", bottom: 44, left: 70,
              fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>
              {cert.cert_id}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
