// ใบประกาศนียบัตร — Ultra Premium Corporate Design

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
@import url('https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,600;0,700;0,800;0,900;1,400&display=swap');
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: 'Sarabun','TH Sarabun New',sans-serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
img { max-width: 100%; }
`;

// ── Design constants (A4-landscape proportions) ──────────────────────────
const W     = 1122;
const H     = 794;
const PANEL = 190;     // large side panels
const TOP   = 8;       // top strip
const FOOT  = 50;      // footer bar
const RADII = [90, 170, 260, 355, 460, 570]; // concentric arcs

const BLUE  = "#0038C6";
const NAVY  = "#0A2F6B";
const DARK  = "#1e293b";
const SLATE = "#64748b";
const MID   = "#26A9E0"; // secondary accent

export default function CertificateView({ cert, onClose }: Props) {
  const qrUrl = `${window.location.origin}/cert/verify?token=${cert.qr_token}`;
  const year  = new Date().getFullYear() + 543;

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

  // ── SVG concentric arcs inside panels ───────────────────────────────────
  const LeftCircles = () => (
    <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", overflow:"visible" }}>
      <g fill="none" stroke="white" strokeWidth="1.2" opacity={0.18}>
        {RADII.map(r => <circle key={r} cx={0} cy={H / 2} r={r} />)}
      </g>
    </svg>
  );
  const RightCircles = () => (
    <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", overflow:"visible" }}>
      <g fill="none" stroke="white" strokeWidth="1.2" opacity={0.18}>
        {RADII.map(r => <circle key={r} cx={PANEL} cy={H / 2} r={r} />)}
      </g>
    </svg>
  );

  // ── Decorative dividers ─────────────────────────────────────────────────
  const TriDivider = () => (
    <div style={{ display:"flex", alignItems:"center", gap:12,
      width:"78%", margin:"8px auto 12px" }}>
      <div style={{ flex:1, height:1.5, background:`linear-gradient(to right,transparent,${BLUE})` }} />
      <div style={{ display:"flex", gap:7, alignItems:"center" }}>
        <span style={{ color:MID, fontSize:10 }}>◆</span>
        <span style={{ color:NAVY, fontSize:14 }}>◆</span>
        <span style={{ color:MID, fontSize:10 }}>◆</span>
      </div>
      <div style={{ flex:1, height:1.5, background:`linear-gradient(to left,transparent,${BLUE})` }} />
    </div>
  );

  const SigDivider = () => (
    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, width:"100%" }}>
      <div style={{ flex:1, height:1, background:BLUE, opacity:0.4 }} />
      <span style={{ color:BLUE, fontSize:10, opacity:0.7 }}>◆</span>
      <div style={{ flex:1, height:1, background:BLUE, opacity:0.4 }} />
    </div>
  );

  // Inner content area dimensions
  const contentW = W - PANEL * 2;

  return (
    <div>
      {/* Controls */}
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

          {/* ══════════════ Certificate Canvas ══════════════ */}
          <div style={{
            width:W, height:H, position:"relative", background:"#fff", overflow:"hidden",
            fontFamily:"'Sarabun','TH Sarabun New',sans-serif",
            boxShadow:"0 12px 64px rgba(10,47,107,0.22)",
          }}>

            {/* Top blue strip */}
            <div style={{ position:"absolute", top:0, left:0, right:0, height:TOP,
              background:BLUE, zIndex:4 }} />

            {/* ── Left panel ── */}
            <div style={{ position:"absolute", left:0, top:0, bottom:0,
              width:PANEL, background:BLUE, overflow:"hidden", zIndex:2 }}>
              <LeftCircles />
            </div>

            {/* ── Right panel ── */}
            <div style={{ position:"absolute", right:0, top:0, bottom:0,
              width:PANEL, background:BLUE, overflow:"hidden", zIndex:2 }}>
              <RightCircles />
            </div>

            {/* ── Footer bar ── */}
            <div style={{
              position:"absolute", bottom:0, left:0, right:0, height:FOOT,
              background:BLUE, zIndex:3,
              display:"flex", alignItems:"center", justifyContent:"flex-end",
              paddingRight: PANEL + 14,
            }}>
              <span style={{
                color:"#fff", fontWeight:700,
                letterSpacing:"0.22em", fontSize:15,
              }}>
                HUMAN RESOURCE DEVELOPMENT ( HRD )
              </span>
            </div>

            {/* ── Inner content area ── */}
            <div style={{
              position:"absolute",
              top:TOP, left:PANEL, right:PANEL, bottom:FOOT,
              display:"flex", flexDirection:"column",
              padding:"0 14px",
            }}>

              {/* ── HEADER: 3-column grid for perfect centering ── */}
              <div style={{
                display:"grid", gridTemplateColumns:"1fr auto 1fr",
                alignItems:"center", padding:"10px 0 6px", gap:6,
              }}>
                {/* Logo left */}
                <img src="/logo-nobg.png" alt="Chiangrai RAM+ Hospital"
                  onError={e => { (e.target as HTMLImageElement).style.display="none"; }}
                  style={{ height:76, objectFit:"contain", justifySelf:"start" }} />

                {/* Accreditation logos center */}
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <img src="/urs-ukas.jpg" alt="URS UKAS"
                    style={{ height:58, objectFit:"contain" }} />
                  <img src="/aaci-gold.png" alt="AACI Gold"
                    style={{ height:62, objectFit:"contain" }} />
                  <img src="/aaci-iso.jpg" alt="AACI ISO"
                    style={{ height:56, objectFit:"contain" }} />
                  <img src="/glp.webp" alt="GLP"
                    style={{ height:62, objectFit:"contain" }} />
                </div>

                {/* Year badge right */}
                <div style={{
                  justifySelf:"end",
                  background:BLUE, color:"#fff", borderRadius:10,
                  padding:"8px 18px", fontSize:14, fontWeight:800, whiteSpace:"nowrap",
                }}>ประจำปี {year}</div>
              </div>

              {/* ── MAIN BODY: vertically centered ── */}
              <div style={{
                flex:1, display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center", textAlign:"center",
                gap:0,
              }}>

                {/* Hospital name */}
                <div style={{
                  fontSize:40, fontWeight:800, color:NAVY,
                  letterSpacing:"0.02em", lineHeight:1.2,
                }}>
                  โรงพยาบาลเชียงราย ราม
                </div>

                {/* Subtitle */}
                <div style={{ fontSize:20, color:SLATE, marginTop:4, letterSpacing:"0.01em" }}>
                  ขอมอบเกียรติบัตรฉบับนี้ไว้เพื่อแสดงว่า
                </div>

                {/* Recipient name — largest text */}
                <div style={{
                  fontSize:66, fontWeight:900, color:NAVY,
                  lineHeight:1.1, margin:"10px 0 2px",
                  maxWidth: contentW - 40,
                  letterSpacing:"-0.01em",
                }}>
                  {cert.full_name}
                </div>

                {/* ♦ divider */}
                <TriDivider />

                {/* Course description */}
                <div style={{
                  fontSize:19, color:DARK, lineHeight:1.85,
                  maxWidth: contentW - 60,
                }}>
                  ได้เข้าร่วมการอบรม <span style={{ fontWeight:700 }}>{cert.course_name}</span>
                  {cert.course_date && <><br />วันที่ {thDate(cert.course_date)}</>}
                </div>

                {/* Location + completion */}
                <div style={{
                  fontSize:18, color:BLUE, marginTop:5, lineHeight:1.85,
                }}>
                  ณ โรงพยาบาลเชียงราย ราม
                  <br />โดยบรรลุวัตถุประสงค์ของโครงการทุกประการ
                </div>

                {/* Issue date */}
                <div style={{
                  fontSize:19, fontWeight:700, color:DARK, marginTop:6,
                }}>
                  ให้ ณ วันที่ {thDate(cert.course_date)}
                </div>
              </div>

              {/* ── SIGNATURES: bottom of content area ── */}
              <div style={{
                display:"flex", justifyContent:"space-between",
                alignItems:"flex-end",
                padding:"0 32px 14px",
              }}>
                {[
                  { name:"นายอนุสิกข์ ทองแผ่น",        pos:"รองผู้อำนวยการฝ่ายบริหารและพัฒนาคุณภาพ" },
                  { name:"นายแพทย์วัชระ เตชะธีราวัฒน์", pos:"ผู้อำนวยการโรงพยาบาลเชียงราย ราม" },
                ].map(s => (
                  <div key={s.name} style={{ textAlign:"center", minWidth:240 }}>
                    <SigDivider />
                    <div style={{ fontSize:16, fontWeight:800, color:NAVY }}>{s.name}</div>
                    <div style={{ fontSize:12, color:SLATE, marginTop:2 }}>({s.pos})</div>
                  </div>
                ))}
              </div>
            </div>

            {/* QR code */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(qrUrl)}`}
              alt="QR"
              style={{
                position:"absolute", bottom:FOOT + 6, right:PANEL + 12,
                width:52, height:52, borderRadius:5,
                border:"1px solid #c4cfee", zIndex:4,
              }} />

            {/* Cert ID */}
            <div style={{
              position:"absolute", bottom:FOOT + 8, left:PANEL + 14,
              fontSize:8.5, color:"#94a3b8", fontFamily:"monospace", zIndex:4,
            }}>
              {cert.cert_id}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
