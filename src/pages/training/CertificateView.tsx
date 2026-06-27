// ใบประกาศนียบัตร — Ultra Premium Design

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
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800;900&display=swap');
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: 'Sarabun','TH Sarabun New',sans-serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
img { max-width: 100%; }
`;

// Design constants
const W = 1122, H = 794;
const PANEL = 138;   // each side panel width
const TOP   = 7;     // top blue strip height
const FOOT  = 44;    // footer height
const RADII = [65, 125, 192, 264, 342, 425]; // circle radii

const BLUE  = "#0038C6";
const NAVY  = "#0A2F6B";
const DARK  = "#1e293b";
const SLATE = "#475569";

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

  // ── panel SVG circles ──
  const LeftCircles = () => (
    <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", overflow:"visible" }}>
      <g fill="none" stroke="white" strokeWidth="1.5" opacity={0.20}>
        {RADII.map(r => <circle key={r} cx={0} cy={H / 2} r={r} />)}
      </g>
    </svg>
  );
  const RightCircles = () => (
    <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", overflow:"visible" }}>
      <g fill="none" stroke="white" strokeWidth="1.5" opacity={0.20}>
        {RADII.map(r => <circle key={r} cx={PANEL} cy={H / 2} r={r} />)}
      </g>
    </svg>
  );

  // ── decorative dividers ──
  const TriDivider = () => (
    <div style={{ display:"flex", alignItems:"center", gap:14, width:"68%", margin:"5px auto 14px" }}>
      <div style={{ flex:1, height:1.5, background:BLUE }} />
      <span style={{ color:NAVY, fontSize:16, letterSpacing:9 }}>♦ ♦ ♦</span>
      <div style={{ flex:1, height:1.5, background:BLUE }} />
    </div>
  );

  const SigDivider = () => (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
      <div style={{ flex:1, height:1, background:BLUE }} />
      <span style={{ color:BLUE, fontSize:13 }}>♦</span>
      <div style={{ flex:1, height:1, background:BLUE }} />
    </div>
  );

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
            <div style={{ position:"absolute", top:0, left:0, right:0, height:TOP, background:BLUE, zIndex:4 }} />

            {/* Left panel */}
            <div style={{ position:"absolute", left:0, top:0, bottom:0, width:PANEL, background:BLUE, overflow:"hidden", zIndex:2 }}>
              <LeftCircles />
            </div>

            {/* Right panel */}
            <div style={{ position:"absolute", right:0, top:0, bottom:0, width:PANEL, background:BLUE, overflow:"hidden", zIndex:2 }}>
              <RightCircles />
            </div>

            {/* Footer */}
            <div style={{
              position:"absolute", bottom:0, left:0, right:0, height:FOOT,
              background:BLUE, zIndex:3,
              display:"flex", alignItems:"center", justifyContent:"flex-end",
              paddingRight: PANEL + 22,
            }}>
              <span style={{ color:"#fff", fontWeight:700, letterSpacing:"0.17em", fontSize:14 }}>
                HUMAN RESOURCE DEVELOPMENT ( HRD )
              </span>
            </div>

            {/* ── Inner content ── */}
            <div style={{
              position:"absolute",
              top:TOP, left:PANEL, right:PANEL, bottom:FOOT,
              display:"flex", flexDirection:"column",
              padding:"0 22px",
            }}>

              {/* HEADER */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"13px 0 11px" }}>
                {/* Hospital logo */}
                <img src="/logo-nobg.png" alt="Chiangrai RAM+ Hospital"
                  onError={e => { (e.target as HTMLImageElement).style.display="none"; }}
                  style={{ height:64, objectFit:"contain" }} />

                {/* Accreditation row */}
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  {(["URS","UKAS"] as string[]).map(a => (
                    <div key={a} style={{
                      border:"1.5px solid #c4cfee", borderRadius:5,
                      padding:"5px 10px", fontSize:11, fontWeight:800,
                      color:BLUE, background:"#f8faff",
                    }}>{a}</div>
                  ))}
                  <img src="/aaci-gold.png" alt="AACI" style={{ height:54, objectFit:"contain" }} />
                  <img src="/aaci-iso.jpg"  alt="AACI ISO" style={{ height:48, objectFit:"contain" }} />
                  <div style={{
                    border:"1.5px solid #c4cfee", borderRadius:5, padding:"4px 9px",
                    textAlign:"center", color:BLUE, background:"#f8faff", lineHeight:1.25,
                  }}>
                    <div style={{ fontSize:13, fontWeight:900 }}>GLP</div>
                    <div style={{ fontSize:8, fontWeight:700 }}>Good Labour<br />Practices</div>
                  </div>
                </div>

                {/* Year badge */}
                <div style={{
                  background:BLUE, color:"#fff", borderRadius:10,
                  padding:"7px 18px", fontSize:14, fontWeight:800, whiteSpace:"nowrap",
                }}>ประจำปี พ.ศ. {year}</div>
              </div>

              {/* ── BODY (flex: 1, vertically centered) ── */}
              <div style={{
                flex:1, display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center", textAlign:"center",
              }}>
                {/* Hospital name */}
                <div style={{ fontSize:34, fontWeight:900, color:NAVY }}>
                  โรงพยาบาลเชียงราย ราม
                </div>

                {/* Subtitle */}
                <div style={{ fontSize:18, color:DARK, marginTop:3 }}>
                  ขอมอบเกียรติบัตรฉบับนี้ไว้เพื่อแสดงว่า
                </div>

                {/* Recipient name */}
                <div style={{
                  fontSize:62, fontWeight:900, color:NAVY,
                  lineHeight:1.1, margin:"10px 0 4px",
                  maxWidth: W - PANEL * 2 - 60,
                }}>
                  {cert.full_name}
                </div>

                {/* ♦♦♦ divider */}
                <TriDivider />

                {/* Course description */}
                <div style={{ fontSize:17, color:DARK, lineHeight:1.8, maxWidth:W - PANEL * 2 - 80 }}>
                  ได้เข้าร่วมการอบรม {cert.course_name}
                  {cert.course_date && <><br />วันที่ {thDate(cert.course_date)}</>}
                </div>

                {/* Location + achievement (blue) */}
                <div style={{ fontSize:17, color:BLUE, marginTop:5, lineHeight:1.8 }}>
                  ณ โรงพยาบาลเชียงราย ราม
                  <br />โดยบรรลุวัตถุประสงค์ของโครงการทุกประการ
                </div>

                {/* Issue date */}
                <div style={{ fontSize:17, fontWeight:800, color:DARK, marginTop:7 }}>
                  ให้ ณ วันที่ {thDate(cert.issued_at)}
                </div>

                {/* ── SIGNATURES ── */}
                <div style={{ display:"flex", justifyContent:"space-around", width:"100%", marginTop:20 }}>
                  {[
                    { name:"นายอนุสิกข์ ทองแผ่น",         pos:"(รองผู้อำนวยการฝ่ายบริหารและพัฒนาคุณภาพ)" },
                    { name:"นายแพทย์วัชระ เตชะธีราวัฒน์",  pos:"(ผู้อำนวยการโรงพยาบาลเชียงราย ราม)" },
                  ].map(s => (
                    <div key={s.name} style={{ textAlign:"center", minWidth:220 }}>
                      <SigDivider />
                      <div style={{ fontSize:16, fontWeight:800, color:BLUE }}>{s.name}</div>
                      <div style={{ fontSize:12, color:SLATE, marginTop:3 }}>{s.pos}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* QR code */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(qrUrl)}`}
              alt="QR"
              style={{
                position:"absolute", bottom:FOOT + 8, right:PANEL + 14,
                width:56, height:56, borderRadius:6,
                border:"1px solid #c4cfee", zIndex:4,
              }} />

            {/* Cert ID */}
            <div style={{
              position:"absolute", bottom:FOOT + 10, left:PANEL + 14,
              fontSize:9, color:"#94a3b8", fontFamily:"monospace", zIndex:4,
            }}>
              {cert.cert_id}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
