// ใบประกาศนียบัตร — Ultra Premium Corporate · Art Director Revision

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

// ── Canvas ──────────────────────────────────────────────────────────────────
const W     = 1122;
const H     = 794;
const PANEL = 185;

// Section heights — must sum to H exactly
// Header 17% | Body 57% | Signature 18% | Footer ≈ 55px
const S_STRIP  = 8;
const S_HEADER = 127;   // taller header
const S_BODY   = 449;   // main content
const S_SIG    = 155;   // signature row (vertically centred sigs)
const S_FOOT   = 55;    // slim footer
// 8 + 127 + 449 + 155 + 55 = 794 ✓

// Concentric arcs — reduced to near-invisible for luxury feel
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

  // Auto-scale recipient name to fit one line, max 25% bigger than previous cap
  const nameW  = W - PANEL * 2 - 64;   // usable width (minus inner padding)
  const nameSz = Math.min(85, Math.max(38, Math.floor(nameW / (cert.full_name.length * 0.52))));

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

  // ── Concentric arcs — ultra-thin, very low opacity ──────────────────────
  const LeftArcs = () => (
    <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", overflow:"visible" }}>
      <g fill="none" stroke="#fff" strokeWidth="0.75" opacity="0.12">
        {RADII.map(r => <circle key={r} cx={0} cy={H / 2} r={r} />)}
      </g>
    </svg>
  );
  const RightArcs = () => (
    <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", overflow:"visible" }}>
      <g fill="none" stroke="#fff" strokeWidth="0.75" opacity="0.12">
        {RADII.map(r => <circle key={r} cx={PANEL} cy={H / 2} r={r} />)}
      </g>
    </svg>
  );

  // ── Luxury diamond rule — minimal, refined ───────────────────────────────
  const LuxDivider = () => (
    <div style={{
      display:"flex", alignItems:"center", gap:16,
      width:"66%", margin:"8px auto 12px",
    }}>
      <div style={{ flex:1, height:"1px", background:LIGHT }} />
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <span style={{ width:4, height:4, background:MID,  transform:"rotate(45deg)", display:"inline-block" }} />
        <span style={{ width:6, height:6, background:NAVY, transform:"rotate(45deg)", display:"inline-block" }} />
        <span style={{ width:4, height:4, background:MID,  transform:"rotate(45deg)", display:"inline-block" }} />
      </div>
      <div style={{ flex:1, height:"1px", background:LIGHT }} />
    </div>
  );

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
           *  CSS GRID — 3 cols × 5 rows
           *
           *  cols : [PANEL 185px] [content 1fr] [PANEL 185px]
           *  rows : strip 8 | header 127 | body 449 | sig 155 | footer 55
           * ═══════════════════════════════════════════════════════════════
           */}
          <div style={{
            width:W, height:H,
            display:"grid",
            gridTemplateColumns:`${PANEL}px 1fr ${PANEL}px`,
            gridTemplateRows:`${S_STRIP}px ${S_HEADER}px ${S_BODY}px ${S_SIG}px ${S_FOOT}px`,
            background:"#fff",
            overflow:"hidden",
            position:"relative",
            fontFamily:"'Sarabun','TH Sarabun New',sans-serif",
            boxShadow:"0 12px 64px rgba(10,47,107,.22)",
          }}>

            {/* Top blue strip — full width */}
            <div style={{ gridColumn:"1/-1", gridRow:"1", background:BLUE }} />

            {/* Left panel */}
            <div style={{
              gridColumn:"1", gridRow:"2/6",
              background:BLUE, position:"relative", overflow:"hidden",
            }}>
              <LeftArcs />
            </div>

            {/* Right panel */}
            <div style={{
              gridColumn:"3", gridRow:"2/6",
              background:BLUE, position:"relative", overflow:"hidden",
            }}>
              <RightArcs />
            </div>

            {/* ═══════════════════════════════════════════════════════════
             *  ROW 2 — HEADER (127px)
             *  Swiss Grid inner 3-col: logo | accreditations | year badge
             * ═══════════════════════════════════════════════════════════ */}
            <div style={{
              gridColumn:"2", gridRow:"2",
              display:"grid",
              gridTemplateColumns:"1fr auto 1fr",
              alignItems:"center",
              padding:"0 28px",
              borderBottom:`1px solid ${LIGHT}`,
            }}>

              {/* Left: hospital logo */}
              <div style={{ display:"flex", alignItems:"center" }}>
                <img
                  src="/logo-nobg.png"
                  alt="Chiangrai RAM+ Hospital"
                  onError={e => { (e.target as HTMLImageElement).style.display="none"; }}
                  style={{ height:82, objectFit:"contain" }}
                />
              </div>

              {/* Center: accreditation logos — all same height, equal gap */}
              <div style={{
                display:"flex", gap:16, alignItems:"center", justifyContent:"center",
              }}>
                {[
                  { src:"/urs-ukas.jpg",  alt:"URS UKAS"  },
                  { src:"/aaci-gold.png", alt:"AACI Gold"  },
                  { src:"/aaci-iso.jpg",  alt:"AACI ISO"   },
                  { src:"/glp.webp",      alt:"GLP"        },
                ].map(img => (
                  <img key={img.src} src={img.src} alt={img.alt}
                    style={{ height:60, objectFit:"contain" }} />
                ))}
              </div>

              {/* Right: year badge */}
              <div style={{ display:"flex", justifyContent:"flex-end" }}>
                <div style={{
                  background:BLUE, color:"#fff", borderRadius:8,
                  padding:"8px 18px", fontSize:13, fontWeight:800,
                  whiteSpace:"nowrap", letterSpacing:"0.04em",
                }}>ประจำปี {year}</div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
             *  ROW 3 — BODY (449px)
             *  Vertically centred flex column — max white space
             * ═══════════════════════════════════════════════════════════ */}
            <div style={{
              gridColumn:"2", gridRow:"3",
              display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center",
              textAlign:"center",
              padding:"0 40px",
              gap:0,
            }}>

              {/* Hospital name */}
              <div style={{
                fontSize:40, fontWeight:800, color:NAVY,
                letterSpacing:"0.025em", lineHeight:1.2,
              }}>
                โรงพยาบาลเชียงราย ราม
              </div>

              {/* Subtitle */}
              <div style={{
                fontSize:18, color:MUTED, fontWeight:400,
                marginTop:6, letterSpacing:"0.01em",
              }}>
                ขอมอบเกียรติบัตรฉบับนี้ไว้เพื่อแสดงว่า
              </div>

              {/* Recipient name — single line, auto-sized, 25% cap increase */}
              <div style={{
                fontSize:nameSz, fontWeight:900, color:NAVY,
                lineHeight:1.15, marginTop:10,
                whiteSpace:"nowrap", letterSpacing:"-0.015em",
                maxWidth:"100%",
              }}>
                {cert.full_name}
              </div>

              {/* Diamond rule */}
              <LuxDivider />

              {/* Course + date */}
              <div style={{ fontSize:19, color:DARK, lineHeight:2, marginTop:2 }}>
                ได้เข้าร่วมการอบรม{" "}
                <span style={{ fontWeight:700 }}>{cert.course_name}</span>
                {cert.course_date && (
                  <><br />วันที่ {thDate(cert.course_date)}</>
                )}
              </div>

              {/* Location */}
              <div style={{ fontSize:18, color:BLUE, marginTop:8, lineHeight:1.9 }}>
                ณ โรงพยาบาลเชียงราย ราม
                <br />โดยบรรลุวัตถุประสงค์ของโครงการทุกประการ
              </div>

              {/* Issue date */}
              <div style={{
                fontSize:18, fontWeight:700, color:DARK, marginTop:10,
              }}>
                ให้ ณ วันที่ {thDate(cert.course_date)}
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
             *  ROW 4 — SIGNATURE (155px)
             *  2-col: [left sig] [right sig]  — QR moved to corner
             * ═══════════════════════════════════════════════════════════ */}
            <div style={{
              gridColumn:"2", gridRow:"4",
              display:"grid",
              gridTemplateColumns:"1fr 1fr",
              alignItems:"center",
              padding:"0 56px 14px",
              borderTop:`1px solid ${LIGHT}`,
            }}>

              {/* Left signature */}
              <div style={{ textAlign:"center", padding:"14px 20px 0" }}>
                <div style={{
                  height:"1px", background:BLUE, opacity:0.3,
                  marginBottom:10, width:"80%", margin:"0 auto 10px",
                }} />
                <div style={{
                  fontSize:15, fontWeight:800, color:NAVY,
                  letterSpacing:"0.01em",
                }}>
                  นายอนุสิกข์ ทองแผ่น
                </div>
                <div style={{ fontSize:11.5, color:MUTED, marginTop:4 }}>
                  (รองผู้อำนวยการฝ่ายบริหารและพัฒนาคุณภาพ)
                </div>
              </div>

              {/* Right signature */}
              <div style={{ textAlign:"center", padding:"14px 20px 0" }}>
                <div style={{
                  height:"1px", background:BLUE, opacity:0.3,
                  marginBottom:10, width:"80%", margin:"0 auto 10px",
                }} />
                <div style={{
                  fontSize:15, fontWeight:800, color:NAVY,
                  letterSpacing:"0.01em",
                }}>
                  นายแพทย์วัชระ เตชะธีราวัฒน์
                </div>
                <div style={{ fontSize:11.5, color:MUTED, marginTop:4 }}>
                  (ผู้อำนวยการโรงพยาบาลเชียงราย ราม)
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
             *  ROW 5 — FOOTER (55px) — spans all 3 columns
             * ═══════════════════════════════════════════════════════════ */}
            <div style={{
              gridColumn:"1/-1", gridRow:"5",
              background:BLUE,
              display:"flex", alignItems:"center",
              justifyContent:"flex-end",
              paddingRight:PANEL + 18,
            }}>
              <span style={{
                color:"#fff", fontSize:14.5,
                fontWeight:700, letterSpacing:"0.24em",
              }}>
                HUMAN RESOURCE DEVELOPMENT ( HRD )
              </span>
            </div>

            {/* ═══════════════════════════════════════════════════════════
             *  QR Code — bottom-right corner, above footer, inside panel
             *  position:absolute within position:relative grid container
             * ═══════════════════════════════════════════════════════════ */}
            <div style={{
              position:"absolute",
              bottom: S_FOOT + 14,
              right: 20,
              zIndex:5,
              display:"flex", flexDirection:"column", alignItems:"center", gap:4,
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(qrUrl)}`}
                alt="QR"
                style={{
                  width:58, height:58,
                  borderRadius:6,
                  border:"1.5px solid rgba(255,255,255,0.4)",
                }}
              />
              <div style={{
                fontSize:7, color:"rgba(255,255,255,0.7)",
                fontFamily:"monospace", letterSpacing:"0.02em",
                textAlign:"center", lineHeight:1.3,
                maxWidth:80,
                wordBreak:"break-all",
              }}>
                {cert.cert_id}
              </div>
            </div>

          </div>{/* end certificate grid */}
        </div>
      </div>
    </div>
  );
}
