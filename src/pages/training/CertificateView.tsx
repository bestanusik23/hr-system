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
  const d = new Date(iso);
  const MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
                  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export default function CertificateView({ cert, onClose }: Props) {
  const qrUrl = `${window.location.origin}/cert/verify?token=${cert.qr_token}`;

  function print() {
    const el = document.getElementById("cert-print-area");
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>ใบประกาศนียบัตร - ${cert.full_name}</title>
        <style>
          @page { size: A4 landscape; margin: 0; }
          body { margin: 0; padding: 0; font-family: 'Sarabun', 'TH Sarabun New', sans-serif; }
          .cert-wrap { width: 297mm; height: 210mm; position: relative; background: #fff; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .bar-left { position: absolute; left: 0; top: 0; bottom: 0; width: 14mm; background: #0038C6; }
          .bar-right { position: absolute; right: 0; top: 0; bottom: 0; width: 14mm; background: #0038C6; }
          .thin-bar-left { position: absolute; left: 17mm; top: 0; bottom: 0; width: 3mm; background: #0038C6; opacity: 0.3; }
          .thin-bar-right { position: absolute; right: 17mm; top: 0; bottom: 0; width: 3mm; background: #0038C6; opacity: 0.3; }
          .content { padding: 10mm 26mm; text-align: center; width: 100%; box-sizing: border-box; }
          .company { font-size: 20pt; font-weight: 900; color: #0038C6; margin-bottom: 2mm; }
          .subtitle { font-size: 14pt; color: #334155; margin-bottom: 4mm; }
          .recipient-name { font-size: 28pt; font-weight: 900; color: #0038C6; margin: 4mm 0; }
          .detail { font-size: 13pt; color: #334155; line-height: 1.7; margin-bottom: 2mm; }
          .wish { font-size: 12pt; color: #475569; margin-top: 3mm; }
          .issued { font-size: 12pt; color: #475569; margin-top: 1mm; }
          .sigs { display: flex; justify-content: space-around; margin-top: 8mm; width: 100%; }
          .sig-box { text-align: center; width: 90mm; }
          .sig-line { border-top: 1.5px solid #334155; margin: 0 20mm 3mm; }
          .sig-name { font-size: 13pt; font-weight: 700; color: #0a1628; }
          .sig-pos { font-size: 10pt; color: #64748b; }
          .footer { position: absolute; bottom: 0; left: 14mm; right: 14mm; background: #0038C6; color: #fff; text-align: center; padding: 3mm; font-size: 11pt; font-weight: 700; letter-spacing: 0.15em; }
          .header-row { display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 6mm; }
          .badge { background: #0038C6; color: #fff; border-radius: 8px; padding: 3mm 5mm; font-size: 11pt; font-weight: 800; }
          .qr-img { position: absolute; bottom: 14mm; right: 22mm; width: 20mm; height: 20mm; }
          .cert-id { position: absolute; bottom: 15mm; left: 22mm; font-size: 8pt; color: #94a3b8; font-family: monospace; }
        </style>
      </head>
      <body>
        ${el.innerHTML}
      </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 600);
  }

  return (
    <div>
      {/* Toolbar */}
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

      {/* Certificate preview */}
      <div style={{ overflowX: "auto" }}>
        <div id="cert-print-area">
          <div className="cert-wrap" style={{
            width: "1060px", height: "750px", position: "relative",
            background: "#ffffff", overflow: "hidden",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif",
            boxShadow: "0 8px 40px rgba(0,56,198,0.18)", border: "1px solid #dce4f5",
          }}>
            {/* Blue bars */}
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 50, background: "#0038C6" }} />
            <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 50, background: "#0038C6" }} />
            <div style={{ position: "absolute", left: 60, top: 0, bottom: 0, width: 10, background: "#0038C6", opacity: 0.25 }} />
            <div style={{ position: "absolute", right: 60, top: 0, bottom: 0, width: 10, background: "#0038C6", opacity: 0.25 }} />

            {/* Content */}
            <div style={{ padding: "28px 90px", textAlign: "center", width: "100%", boxSizing: "border-box" }}>
              {/* Header row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                {/* Hospital logo placeholder */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 44, height: 44, background: "#0038C6", borderRadius: 8,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 900, fontSize: 11, lineHeight: 1.1, textAlign: "center" }}>
                    RAM+
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#0038C6", letterSpacing: "0.04em" }}>CHIANGRAI</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#0038C6" }}>RAM+ HOSPITAL</div>
                  </div>
                </div>
                {/* Accreditation logos */}
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {["URS", "UKAS", "AACI", "GLP"].map(a => (
                    <div key={a} style={{ width: 32, height: 32, borderRadius: 4, background: "#f0f5ff",
                      border: "1px solid #c4cfee", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 8, fontWeight: 800, color: "#0038C6" }}>{a}</div>
                  ))}
                </div>
                {/* Year badge */}
                <div style={{ background: "#0038C6", color: "#fff", borderRadius: 8, padding: "6px 14px",
                  fontSize: 13, fontWeight: 800 }}>
                  ประจำปี {new Date().getFullYear() + 543}
                </div>
              </div>

              {/* Company name */}
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0038C6", marginBottom: 4 }}>
                บริษัท วัชรศิริเวช จำกัด
              </div>
              <div style={{ fontSize: 15, color: "#334155", marginBottom: 14 }}>
                ขอมอบเกียรติบัตรฉบับนี้ไว้เพื่อแสดงว่า
              </div>

              {/* Recipient name */}
              <div style={{ fontSize: 34, fontWeight: 900, color: "#0038C6", marginBottom: 10,
                letterSpacing: "0.02em" }}>
                {cert.full_name}
              </div>

              {/* Training detail */}
              <div style={{ fontSize: 15, color: "#334155", lineHeight: 1.8 }}>
                ได้เข้ารับการฝึกอบรม <strong>{cert.course_name}</strong><br />
                {cert.course_date && <>วันที่ {thDate(cert.course_date)}<br /></>}
                ณ โรงพยาบาลเชียงราย ราม
                {cert.hours && cert.hours > 0 && (
                  <> · ระยะเวลา <strong>{cert.hours}</strong> ชั่วโมง</>
                )}
              </div>

              <div style={{ fontSize: 14, color: "#475569", marginTop: 10 }}>
                ขอให้มีความสุขสวัสดิ์ ความเจริญ และประสบผลสำเร็จสืบไป
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                ให้ ณ วันที่ {thDate(cert.issued_at)}
              </div>

              {/* Signatures */}
              <div style={{ display: "flex", justifyContent: "space-around", marginTop: 24 }}>
                <div style={{ textAlign: "center", width: 220 }}>
                  <div style={{ borderTop: "1.5px solid #475569", margin: "0 24px 10px" }} />
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0a1628" }}>นายอนุสิกข์ ทองแผ่น</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    (รักษาการ รองผอ. ฝ่ายบริหารค่าตอบแทน<br />และพัฒนาคุณภาพ)
                  </div>
                </div>
                <div style={{ textAlign: "center", width: 220 }}>
                  <div style={{ borderTop: "1.5px solid #475569", margin: "0 24px 10px" }} />
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0a1628" }}>นายแพทย์วัชระ เตชะธีราวัฒน์</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    (ผู้อำนวยการโรงพยาบาลเชียงราย ราม)
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ position: "absolute", bottom: 0, left: 50, right: 50,
              background: "#0038C6", color: "#fff", textAlign: "center",
              padding: "7px 0", fontSize: 13, fontWeight: 700, letterSpacing: "0.18em" }}>
              HUMAN RESOURCE DEVELOPMENT ( HRD )
            </div>

            {/* QR code bottom-right */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent(qrUrl)}`}
              alt="QR Verify"
              style={{ position: "absolute", bottom: 44, right: 70, width: 62, height: 62,
                borderRadius: 5, border: "2px solid #c4cfee" }} />

            {/* Cert ID bottom-left */}
            <div style={{ position: "absolute", bottom: 46, left: 70,
              fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>
              {cert.cert_id}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
