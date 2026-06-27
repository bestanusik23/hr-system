// ใบประกาศนียบัตร — ตาม Canva template โรงพยาบาลเชียงราย ราม

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

// SVG data-uri สำหรับ print background circles
const CIRC_ENC = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='560' height='794'>`+
  `<g fill='none' stroke='%237BAFD4' stroke-width='2' opacity='0.22'>`+
  [110,205,310,420,540].map(r=>`<circle cx='0' cy='490' r='${r}'/>`).join("")+
  `</g></svg>`
);

const PRINT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,400;0,600;0,700;0,800;0,900&display=swap');
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: 'Sarabun','TH Sarabun New',sans-serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cert-wrap {
  width: 297mm; height: 210mm; position: relative;
  background: #fff url("data:image/svg+xml,${CIRC_ENC}") no-repeat left center;
  overflow: hidden; display: flex; flex-direction: column;
}
.bar-r { position: absolute; right: 0; top: 0; bottom: 0; width: 10mm; background: #1d4ed8; z-index: 2; }
.main  { flex: 1; margin: 0 16mm 0 6mm; display: flex; flex-direction: column; position: relative; z-index: 1; }
.hdr   { display: flex; justify-content: space-between; align-items: center; padding: 4.5mm 0 3.5mm; }
.acc-row { display: flex; gap: 2mm; align-items: center; }
.acc-txt { border: 1.5px solid #c4cfee; border-radius: 1.5mm; padding: 0.8mm 2.5mm;
           font-size: 7pt; font-weight: 800; color: #1d4ed8; background: #f8faff; }
.acc-img { height: 11mm; object-fit: contain; }
.year    { background: #1d4ed8; color: #fff; border-radius: 3.5mm; padding: 1.5mm 5mm; font-size: 9.5pt; font-weight: 800; }
.body    { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.h-hosp  { font-size: 26pt; font-weight: 900; color: #0a1d6b; }
.h-sub   { font-size: 13.5pt; color: #1e293b; margin-top: 2mm; }
.h-recip { font-size: 42pt; font-weight: 900; color: #0a1d6b; line-height: 1.1; margin: 3.5mm 0 4.5mm; }
.h-detail { font-size: 13pt; color: #1e293b; line-height: 1.85; }
.h-loc   { font-size: 13pt; color: #1d4ed8; margin-top: 2mm; line-height: 1.85; }
.h-give  { font-size: 13pt; font-weight: 800; color: #1e293b; margin-top: 2.5mm; }
.sigs    { display: flex; justify-content: space-around; width: 100%; margin-top: 5mm; }
.sig-name { font-size: 13pt; font-weight: 800; color: #1d4ed8; }
.sig-pos  { font-size: 10pt; color: #475569; margin-top: 0.8mm; }
.footer  { background: #1d4ed8; color: #fff; padding: 2.5mm 14mm 2.5mm 0;
           font-size: 10pt; font-weight: 700; letter-spacing: 0.16em; text-align: right;
           position: relative; z-index: 1; }
.qr-img  { position: absolute; bottom: 12mm; right: 13mm; width: 14mm; height: 14mm; border-radius: 1.5mm; z-index: 3; }
.cid     { position: absolute; bottom: 13mm; left: 6mm; font-size: 6.5pt; color: #94a3b8; font-family: monospace; z-index: 3; }
img      { max-width: 100%; }
`;

export default function CertificateView({ cert, onClose }: Props) {
  const qrUrl = `${window.location.origin}/cert/verify?token=${cert.qr_token}`;
  const year = new Date().getFullYear() + 543;

  function print() {
    const el = document.getElementById("cert-print-area");
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      `<!DOCTYPE html><html><head><meta charset="UTF-8">` +
      `<title>ใบประกาศนียบัตร - ${cert.full_name}</title>` +
      `<style>${PRINT_CSS}</style></head><body>${el.innerHTML}</body></html>`
    );
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 900);
  }

  const W = 1122, H = 794;
  const C_CX = 0, C_CY = Math.round(H * 0.62); // circle center (left-edge, lower-mid)

  // shared inline style shortcuts
  const S = {
    navy:  "#0a1d6b" as const,
    blue:  "#1d4ed8" as const,
    dark:  "#1e293b" as const,
    slate: "#475569" as const,
  };

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button onClick={print} style={{
          padding: "9px 20px", borderRadius: 7, border: "none",
          background: S.blue, color: "#fff", fontWeight: 700, fontSize: 13,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          🖨️ พิมพ์ / บันทึก PDF
        </button>
        {onClose && (
          <button onClick={onClose} style={{
            padding: "9px 18px", borderRadius: 7, border: "1.5px solid #c4cfee",
            background: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}>
            ← กลับ
          </button>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <div id="cert-print-area">

          {/* ══════════════════════════════════════════════════════ */}
          {/* Certificate canvas                                     */}
          {/* ══════════════════════════════════════════════════════ */}
          <div style={{
            width: W, height: H, position: "relative", background: "#fff",
            overflow: "hidden", display: "flex", flexDirection: "column",
            fontFamily: "'Sarabun','TH Sarabun New',sans-serif",
            boxShadow: "0 8px 48px rgba(29,78,216,0.20)",
          }}>

            {/* Decorative concentric circle arcs — left background */}
            <svg
              style={{ position: "absolute", left: 0, top: 0, width: 560, height: H,
                pointerEvents: "none", zIndex: 0 }}
              viewBox={`0 0 560 ${H}`}
            >
              <g fill="none" stroke="#7BAFD4" strokeWidth="2" opacity={0.22}>
                {[110, 205, 310, 420, 540].map(r => (
                  <circle key={r} cx={C_CX} cy={C_CY} r={r} />
                ))}
              </g>
            </svg>

            {/* Right blue bar */}
            <div style={{ position: "absolute", right: 0, top: 0, bottom: 0,
              width: 38, background: S.blue, zIndex: 2 }} />

            {/* ── Main content (flex column, fills height) ── */}
            <div style={{ position: "relative", zIndex: 1,
              margin: "0 58px 0 28px", flex: 1,
              display: "flex", flexDirection: "column" }}>

              {/* Header row */}
              <div style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "12px 0 10px" }}>

                {/* Left group: RAM+ logo + accreditation badges side-by-side */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img src="/logo-nobg.png" alt="Chiangrai RAM+ Hospital"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    style={{ height: 72, objectFit: "contain" }} />
                  <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                    {(["URS","UKAS"] as string[]).map(a => (
                      <div key={a} style={{
                        border: "1.5px solid #c4cfee", borderRadius: 5,
                        padding: "5px 10px", fontSize: 11, fontWeight: 800,
                        color: S.blue, background: "#f8faff",
                      }}>{a}</div>
                    ))}
                    <img src="/aaci-gold.png" alt="AACI"
                      style={{ height: 54, objectFit: "contain" }} />
                    <img src="/aaci-iso.jpg" alt="AACI ISO"
                      style={{ height: 48, objectFit: "contain" }} />
                    <div style={{
                      border: "1.5px solid #c4cfee", borderRadius: 5,
                      padding: "4px 9px", textAlign: "center",
                      color: S.blue, background: "#f8faff", lineHeight: 1.25,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 900 }}>GLP</div>
                      <div style={{ fontSize: 8, fontWeight: 700 }}>Good Labour<br />Practices</div>
                    </div>
                  </div>
                </div>

                {/* Year badge — flush right */}
                <div style={{
                  background: S.blue, color: "#fff", borderRadius: 10,
                  padding: "8px 20px", fontSize: 15, fontWeight: 800, whiteSpace: "nowrap",
                }}>
                  ประจำปี พ.ศ. {year}
                </div>
              </div>

              {/* Body — centered vertically */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", textAlign: "center" }}>

                {/* Hospital name */}
                <div style={{ fontSize: 36, fontWeight: 900, color: S.navy }}>
                  โรงพยาบาลเชียงราย ราม
                </div>

                {/* Sub-title */}
                <div style={{ fontSize: 19, color: S.dark, marginTop: 3 }}>
                  ขอมอบเกียรติบัตรฉบับนี้ไว้เพื่อแสดงว่า
                </div>

                {/* Recipient name — largest element */}
                <div style={{
                  fontSize: 58, fontWeight: 900, color: S.navy,
                  lineHeight: 1.1, margin: "10px 0 12px",
                }}>
                  {cert.full_name}
                </div>

                {/* Course description */}
                <div style={{ fontSize: 17, color: S.dark, lineHeight: 1.8, maxWidth: 830 }}>
                  ได้เข้าร่วมการอบรม {cert.course_name}
                  {cert.course_date && <><br />วันที่ {thDate(cert.course_date)}</>}
                </div>

                {/* Location + achievement — blue */}
                <div style={{ fontSize: 17, color: S.blue, marginTop: 4, lineHeight: 1.8 }}>
                  ณ โรงพยาบาลเชียงราย ราม
                  <br />โดยบรรลุวัตถุประสงค์ของโครงการทุกประการ
                </div>

                {/* Issue date */}
                <div style={{ fontSize: 17, fontWeight: 800, color: S.dark, marginTop: 6 }}>
                  ให้ ณ วันที่ {thDate(cert.issued_at)}
                </div>

                {/* Signatures — no lines, name in blue */}
                <div style={{ display: "flex", justifyContent: "space-around",
                  width: "100%", marginTop: 16 }}>
                  {[
                    { name: "นายอนุสิกข์ ทองแผ่น",          pos: "รองผู้อำนวยการฝ่ายบริหารและพัฒนาคุณภาพ" },
                    { name: "นายแพทย์วัชระ เตชะธีราวัฒน์",  pos: "(ผู้อำนวยการโรงพยาบาลเชียงราย ราม)" },
                  ].map(s => (
                    <div key={s.name} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: S.blue }}>{s.name}</div>
                      <div style={{ fontSize: 13, color: S.slate, marginTop: 3 }}>{s.pos}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer — full-width, outside margin div */}
            <div style={{
              background: S.blue, color: "#fff",
              padding: "9px 70px 9px 0",
              fontSize: 14, fontWeight: 700, letterSpacing: "0.16em",
              textAlign: "right", position: "relative", zIndex: 1,
            }}>
              HUMAN RESOURCE DEVELOPMENT ( HRD )
            </div>

            {/* QR code */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent(qrUrl)}`}
              alt="QR"
              style={{ position: "absolute", bottom: 44, right: 52,
                width: 58, height: 58, borderRadius: 5,
                border: "1px solid #c4cfee", zIndex: 3 }} />

            {/* Certificate ID */}
            <div style={{ position: "absolute", bottom: 46, left: 30,
              fontSize: 9, color: "#94a3b8", fontFamily: "monospace", zIndex: 3 }}>
              {cert.cert_id}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
