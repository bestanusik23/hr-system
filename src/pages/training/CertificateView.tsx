// ใบประกาศนียบัตร — Ultra Premium · CSS Grid Layout

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
  const M = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
             "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear() + 543}`;
}

const PRINT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800;900&display=swap');
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Sarabun','TH Sarabun New',sans-serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
img { display: block; }
`;

// ── Canvas & Grid constants ─────────────────────────────────────────────────
const W     = 1122;   // A4 landscape width  px
const H     = 794;    // A4 landscape height px
const PANEL = 185;    // side panel width

// Section heights (must total H)
const S_STRIP  = 8;
const S_HEADER = Math.round(H * 0.14) - S_STRIP;  // 103 px
const S_BODY   = Math.round(H * 0.58);             // 461 px
const S_SIG    = Math.round(H * 0.18);             // 143 px
const S_FOOT   = H - S_STRIP - S_HEADER - S_BODY - S_SIG; // 79 px

// Concentric arc radii inside panels
const RADII = [88, 166, 250, 340, 438, 544];

// Palette
const BLUE  = "#0038C6";
const NAVY  = "#0A2F6B";
const MID   = "#26A9E0";
const LIGHT = "#E6E7E8";
const DARK  = "#1e293b";
const MUTED = "#64748b";

export default function CertificateView({ cert, onClose }: Props) {
  const qrUrl = `${window.location.origin}/cert/verify?token=${cert.qr_token}`;
  const year  = new Date().getFullYear() + 543;

  // Auto-scale recipient name to always fit on one line
  const nameW   = W - PANEL * 2 - 48;
  const nameSz  = Math.min(68, Math.max(34, Math.floor(nameW / (cert.full_name.length * 0.73))));

  function print() {
    const el = document.getElementById("cert-print-area");
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      `<!DOCTYPE html><html><head><meta charset="UTF-8">` +
      `<title>ใบประกาศนียบัตร — ${cert.full_name}</title>` +
      `<style>${PRINT_CSS}</style></head><body>${el.innerHTML}</body></html>`
    );
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 900);
  }

  // ── Concentric arcs (SVG inside panels) ─────────────────────────────────
  const LeftArcs = () => (
    <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", overflow:"visible" }}>
      <g fill="none" stroke="#fff" strokeWidth="1" opacity="0.15">
        {RADII.map(r => <circle key={r} cx={0} cy={H / 2} r={r} />)}
      </g>
    </svg>
  );
  const RightArcs = () => (
    <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", overflow:"visible" }}>
      <g fill="none" stroke="#fff" strokeWidth="1" opacity="0.15">
        {RADII.map(r => <circle key={r} cx={PANEL} cy={H / 2} r={r} />)}
      </g>
    </svg>
  );

  // ── Luxury diamond divider ───────────────────────────────────────────────
  const LuxDivider = () => (
    <div style={{
      display:"flex", alignItems:"center", gap:14,
      width:"72%", margin:"7px auto 10px",
    }}>
      <div style={{ flex:1, height:"1px", background:LIGHT }} />
      <div style={{ display:"flex", gap:7, alignItems:"center" }}>
        <span style={{ width:5, height:5, background:MID,  transform:"rotate(45deg)", display:"inline-block" }} />
        <span style={{ width:7, height:7, background:NAVY, transform:"rotate(45deg)", display:"inline-block" }} />
        <span style={{ width:5, height:5, background:MID,  transform:"rotate(45deg)", display:"inline-block" }} />
      </div>
      <div style={{ flex:1, height:"1px", background:LIGHT }} />
    </div>
  );

  // ─── Main render ────────────────────────────────────────────────────────
  return (
    <div>
      {/* Print controls */}
      <div style={{ display:"flex", gap:10, marginBottom:16 }}>
        <button onClick={print} style={{
          padding:"9px 20px", borderRadius:7, border:"none",
          background:BLUE, color:"#fff", fontWeight:700, fontSize:13,
          cursor:"pointer", fontFamily:"inherit",
        }}>🖨️ พิมพ์ / บันทึก PDF</button>
        {onClose && (
          <button onClick={onClose} style={{
            padding:"9px 18px", borderRadius:7, border:"1.5px solid #c4cfee",
            background:"#fff", fontSize:13, cursor:"pointer", fontFamily:"inherit",
          }}>← กลับ</button>
        )}
      </div>

      <div style={{ overflowX:"auto" }}>
        <div id="cert-print-area">

          {/*
           * ═══════════════════════════════════════════════════════════════
           *  CSS GRID: 3 columns × 5 rows
           *
           *  cols:  [PANEL]  [content 1fr]  [PANEL]
           *  rows:  strip | header | body | signature | footer
           * ═══════════════════════════════════════════════════════════════
           */}
          <div style={{
            width: W, height: H,
            display: "grid",
            gridTemplateColumns: `${PANEL}px 1fr ${PANEL}px`,
            gridTemplateRows: `${S_STRIP}px ${S_HEADER}px ${S_BODY}px ${S_SIG}px ${S_FOOT}px`,
            background: "#fff",
            overflow: "hidden",
            fontFamily: "'Sarabun','TH Sarabun New',sans-serif",
            boxShadow: "0 12px 64px rgba(10,47,107,.22)",
          }}>

            {/* ── Top strip: full width ───────────────────────── */}
            <div style={{
              gridColumn: "1 / -1", gridRow: "1",
              background: BLUE,
            }} />

            {/* ── Left panel: rows 2→5 ────────────────────────── */}
            <div style={{
              gridColumn: "1", gridRow: "2 / 6",
              background: BLUE, position: "relative", overflow: "hidden",
            }}>
              <LeftArcs />
            </div>

            {/* ── Right panel: rows 2→5 ───────────────────────── */}
            <div style={{
              gridColumn: "3", gridRow: "2 / 6",
              background: BLUE, position: "relative", overflow: "hidden",
            }}>
              <RightArcs />
            </div>

            {/* ════════════════════════════════════════════════════
             *  ROW 2 — HEADER (14%)
             *  3-column inner grid: logo | accreditations | badge
             * ════════════════════════════════════════════════════ */}
            <div style={{
              gridColumn: "2", gridRow: "2",
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              padding: "0 22px",
              borderBottom: `1.5px solid ${LIGHT}`,
            }}>

              {/* Logo — left-aligned */}
              <div style={{ display:"flex", alignItems:"center" }}>
                <img
                  src="/logo-nobg.png"
                  alt="Chiangrai RAM+ Hospital"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  style={{ height: 70, objectFit: "contain" }}
                />
              </div>

              {/* Accreditation logos — centered, all same height */}
              <div style={{
                display: "flex", gap: 10, alignItems: "center",
                justifyContent: "center",
              }}>
                {[
                  { src:"/urs-ukas.jpg",  alt:"URS UKAS"  },
                  { src:"/aaci-gold.png", alt:"AACI Gold"  },
                  { src:"/aaci-iso.jpg",  alt:"AACI ISO"   },
                  { src:"/glp.webp",      alt:"GLP"        },
                ].map(img => (
                  <img key={img.src} src={img.src} alt={img.alt}
                    style={{ height: 56, objectFit: "contain" }} />
                ))}
              </div>

              {/* Year badge — right-aligned */}
              <div style={{ display:"flex", justifyContent:"flex-end" }}>
                <div style={{
                  background: BLUE, color: "#fff",
                  borderRadius: 8, padding: "7px 16px",
                  fontSize: 13, fontWeight: 800, whiteSpace: "nowrap",
                  letterSpacing: "0.02em",
                }}>ประจำปี {year}</div>
              </div>
            </div>

            {/* ════════════════════════════════════════════════════
             *  ROW 3 — BODY CONTENT (58%)
             *  Centered column: hospital → subtitle → name → info
             * ════════════════════════════════════════════════════ */}
            <div style={{
              gridColumn: "2", gridRow: "3",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              textAlign: "center",
              padding: "0 28px",
            }}>

              {/* Hospital name */}
              <div style={{
                fontSize: 38, fontWeight: 800, color: NAVY,
                letterSpacing: "0.025em", lineHeight: 1.2,
              }}>
                โรงพยาบาลเชียงราย ราม
              </div>

              {/* Subtitle */}
              <div style={{
                fontSize: 18, color: MUTED, fontWeight: 400,
                marginTop: 4, letterSpacing: "0.01em",
              }}>
                ขอมอบเกียรติบัตรฉบับนี้ไว้เพื่อแสดงว่า
              </div>

              {/* Recipient name — single line, auto-sized */}
              <div style={{
                fontSize: nameSz,
                fontWeight: 900, color: NAVY,
                lineHeight: 1.15, marginTop: 8,
                whiteSpace: "nowrap",
                letterSpacing: "-0.015em",
                maxWidth: "100%",
              }}>
                {cert.full_name}
              </div>

              {/* Diamond divider */}
              <LuxDivider />

              {/* Course + date */}
              <div style={{
                fontSize: 18, color: DARK, lineHeight: 1.85,
              }}>
                ได้เข้าร่วมการอบรม{" "}
                <span style={{ fontWeight: 700 }}>{cert.course_name}</span>
                {cert.course_date && (
                  <><br />วันที่ {thDate(cert.course_date)}</>
                )}
              </div>

              {/* Location */}
              <div style={{
                fontSize: 17, color: BLUE,
                marginTop: 5, lineHeight: 1.8,
              }}>
                ณ โรงพยาบาลเชียงราย ราม
                <br />โดยบรรลุวัตถุประสงค์ของโครงการทุกประการ
              </div>

              {/* Issue date */}
              <div style={{
                fontSize: 17, fontWeight: 700, color: DARK, marginTop: 5,
              }}>
                ให้ ณ วันที่ {thDate(cert.course_date)}
              </div>
            </div>

            {/* ════════════════════════════════════════════════════
             *  ROW 4 — SIGNATURE (18%)
             *  3-col: [left sig] [QR + certID] [right sig]
             * ════════════════════════════════════════════════════ */}
            <div style={{
              gridColumn: "2", gridRow: "4",
              display: "grid",
              gridTemplateColumns: "1fr 80px 1fr",
              alignItems: "center",
              padding: "8px 32px 10px",
              borderTop: `1.5px solid ${LIGHT}`,
              gap: 12,
            }}>

              {/* Left signature */}
              <div style={{ textAlign: "center" }}>
                <div style={{ height: 1, background: BLUE, opacity: 0.3, marginBottom: 8 }} />
                <div style={{
                  fontSize: 15, fontWeight: 800, color: NAVY,
                  letterSpacing: "0.01em",
                }}>นายอนุสิกข์ ทองแผ่น</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
                  (รองผู้อำนวยการฝ่ายบริหารและพัฒนาคุณภาพ)
                </div>
              </div>

              {/* Center — QR code + cert ID */}
              <div style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: 4,
              }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(qrUrl)}`}
                  alt="QR"
                  style={{
                    width: 58, height: 58,
                    borderRadius: 6,
                    border: `1px solid ${LIGHT}`,
                  }}
                />
                <div style={{
                  fontSize: 7.5, color: MUTED,
                  fontFamily: "monospace", letterSpacing: "0.02em",
                  textAlign: "center", lineHeight: 1.3,
                }}>
                  {cert.cert_id}
                </div>
              </div>

              {/* Right signature */}
              <div style={{ textAlign: "center" }}>
                <div style={{ height: 1, background: BLUE, opacity: 0.3, marginBottom: 8 }} />
                <div style={{
                  fontSize: 15, fontWeight: 800, color: NAVY,
                  letterSpacing: "0.01em",
                }}>นายแพทย์วัชระ เตชะธีราวัฒน์</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
                  (ผู้อำนวยการโรงพยาบาลเชียงราย ราม)
                </div>
              </div>
            </div>

            {/* ════════════════════════════════════════════════════
             *  ROW 5 — FOOTER (10%) — full width span
             * ════════════════════════════════════════════════════ */}
            <div style={{
              gridColumn: "1 / -1", gridRow: "5",
              background: BLUE,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: PANEL + 18,
              paddingLeft:  PANEL + 18,
            }}>
              <span style={{
                color: "#fff", fontSize: 15,
                fontWeight: 700, letterSpacing: "0.24em",
              }}>
                HUMAN RESOURCE DEVELOPMENT ( HRD )
              </span>
            </div>

          </div>{/* end certificate grid */}
        </div>
      </div>
    </div>
  );
}
