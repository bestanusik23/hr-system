// ใบประกาศนียบัตร — Premium White Design
import { useRef, useLayoutEffect, useState } from "react";

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

// Canvas — A4 landscape pixels
const W = 1122;
const H = 794;

// Section heights: 14% | 56% | 20% | 10%
const S_HEADER = Math.round(H * 0.14);
const S_BODY   = Math.round(H * 0.56);
const S_SIG    = Math.round(H * 0.20);
const S_FOOT   = H - S_HEADER - S_BODY - S_SIG;

// Palette
const BLUE  = "#0038C6";
const NAVY  = "#0A2F6B";
const MID   = "#26A9E0";
const LIGHT = "#E6E7E8";
const DARK  = "#1e293b";
const MUTED = "#64748b";

const RADII = [83, 165, 248, 338, 434, 540];

export default function CertificateView({ cert, onClose }: Props) {
  const qrUrl   = `${window.location.origin}/cert/verify?token=${cert.qr_token}`;
  const year    = new Date().getFullYear() + 543;

  const wrapRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Scale certificate to fit available width — no horizontal scrollbar
  useLayoutEffect(() => {
    const update = () => {
      const avail = wrapRef.current?.offsetWidth ?? (window.innerWidth - 32);
      setScale(Math.min(1, avail / W));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Shrink recipient name until it fits on one line (DOM measurement)
  useLayoutEffect(() => {
    const el  = nameRef.current;
    const box = bodyRef.current;
    if (!el || !box) return;
    const maxW = box.clientWidth - 80;
    let sz = 85;
    el.style.fontSize = sz + "px";
    while (el.scrollWidth > maxW && sz > 32) {
      sz--;
      el.style.fontSize = sz + "px";
    }
  }, [cert.full_name, scale]);

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

  const CirclesBg = () => (
    <div style={{
      position:"absolute", inset:0, overflow:"hidden",
      pointerEvents:"none", zIndex:0,
    }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <g fill="none" stroke={BLUE} strokeWidth="1" opacity="0.05">
          {RADII.map(r => <circle key={`l${r}`} cx={0} cy={H / 2} r={r} />)}
        </g>
        <g fill="none" stroke={BLUE} strokeWidth="1" opacity="0.05">
          {RADII.map(r => <circle key={`r${r}`} cx={W} cy={H / 2} r={r} />)}
        </g>
      </svg>
    </div>
  );

  const LuxDivider = () => (
    <div style={{ display:"flex", alignItems:"center", gap:14, width:"62%", margin:"10px auto 14px" }}>
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

      {/* Scale-to-fit wrapper — height collapses to match scaled cert */}
      <div ref={wrapRef} style={{ width:"100%", overflow:"hidden", height: Math.round(H * scale) + 8 }}>
        <div style={{ transformOrigin:"top left", transform:`scale(${scale})`, width:W }}>
          <div id="cert-print-area">

            {/* ══════════════════════════════════════════════════════════
             *  Certificate canvas — white bg · 6px blue border · 4 rows
             * ══════════════════════════════════════════════════════════ */}
            <div style={{
              width:W, height:H,
              background:"#fff",
              border:`6px solid ${BLUE}`,
              boxSizing:"border-box",
              position:"relative",
              overflow:"hidden",
              display:"grid",
              gridTemplateRows:`${S_HEADER}px ${S_BODY}px ${S_SIG}px ${S_FOOT}px`,
              fontFamily:"'Sarabun','TH Sarabun New',sans-serif",
              boxShadow:"0 8px 48px rgba(0,56,198,.18)",
            }}>

              <CirclesBg />

              {/* ── ROW 1: HEADER ─────────────────────────────────────── */}
              <div style={{
                position:"relative", zIndex:1,
                display:"flex",
                alignItems:"center",
                justifyContent:"space-between",
                borderBottom:`1px solid ${LIGHT}`,
              }}>
                {/* Logo — flush to top-left corner */}
                <div style={{ flexShrink:0, alignSelf:"stretch", display:"flex", alignItems:"flex-start" }}>
                  <img
                    src="/logo-nobg.png"
                    alt="Chiangrai RAM+ Hospital"
                    onError={e => { (e.target as HTMLImageElement).style.display="none"; }}
                    style={{ height:S_HEADER, objectFit:"contain", objectPosition:"left top" }}
                  />
                </div>

                {/* Accreditations — centred */}
                <div style={{ display:"flex", gap:18, alignItems:"center", justifyContent:"center", flex:1 }}>
                  {[
                    { src:"/urs-ukas.jpg",  alt:"URS UKAS"  },
                    { src:"/aaci-gold.png", alt:"AACI Gold"  },
                    { src:"/aaci-iso.jpg",  alt:"AACI ISO"   },
                    { src:"/glp.webp",      alt:"GLP"        },
                  ].map(img => (
                    <img key={img.src} src={img.src} alt={img.alt}
                      style={{ height:56, objectFit:"contain" }} />
                  ))}
                </div>

                {/* Year badge */}
                <div style={{ flexShrink:0, paddingRight:24 }}>
                  <div style={{
                    background:BLUE, color:"#fff", borderRadius:8,
                    padding:"8px 18px", fontSize:13, fontWeight:800,
                    whiteSpace:"nowrap", letterSpacing:"0.04em",
                  }}>ประจำปี {year}</div>
                </div>
              </div>

              {/* ── ROW 2: BODY ───────────────────────────────────────── */}
              <div ref={bodyRef} style={{
                position:"relative", zIndex:1,
                display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center",
                textAlign:"center",
                padding:"0 40px",
              }}>
                <div style={{ fontSize:40, fontWeight:800, color:NAVY, letterSpacing:"0.025em", lineHeight:1.2 }}>
                  โรงพยาบาลเชียงราย ราม
                </div>
                <div style={{ fontSize:18, color:MUTED, fontWeight:400, marginTop:6, letterSpacing:"0.01em" }}>
                  ขอมอบเกียรติบัตรฉบับนี้ไว้เพื่อแสดงว่า
                </div>
                <div ref={nameRef} style={{
                  fontSize:85, fontWeight:900, color:NAVY,
                  lineHeight:1.15, marginTop:10,
                  whiteSpace:"nowrap", letterSpacing:"-0.015em", maxWidth:"100%",
                }}>
                  {cert.full_name}
                </div>

                <LuxDivider />

                <div style={{ fontSize:19, color:DARK, lineHeight:2 }}>
                  ได้เข้าร่วมการอบรม{" "}
                  <span style={{ fontWeight:700 }}>{cert.course_name}</span>
                  {cert.course_date && <><br />วันที่ {thDate(cert.course_date)}</>}
                </div>
                <div style={{ fontSize:18, color:BLUE, marginTop:8, lineHeight:1.9 }}>
                  ณ โรงพยาบาลเชียงราย ราม<br />โดยบรรลุวัตถุประสงค์ของโครงการทุกประการ
                </div>
                <div style={{ fontSize:18, fontWeight:700, color:DARK, marginTop:10 }}>
                  ให้ ณ วันที่ {thDate(cert.course_date)}
                </div>
              </div>

              {/* ── ROW 3: SIGNATURE ──────────────────────────────────── */}
              <div style={{
                position:"relative", zIndex:1,
                display:"grid", gridTemplateColumns:"1fr 1fr",
                alignItems:"center",
                padding:"0 144px 16px",
                borderTop:`1px solid ${LIGHT}`,
              }}>
                {[
                  { name:"นายอนุสิกข์ ทองแผ่น",         pos:"(รองผู้อำนวยการฝ่ายบริหารและพัฒนาคุณภาพ)" },
                  { name:"นายแพทย์วัชระ เตชะธีราวัฒน์", pos:"(ผู้อำนวยการโรงพยาบาลเชียงราย ราม)"       },
                ].map(sig => (
                  <div key={sig.name} style={{ textAlign:"center", padding:"16px 24px 0" }}>
                    <div style={{ height:"1px", background:BLUE, opacity:0.3, width:"80%", margin:"0 auto 10px" }} />
                    <div style={{ fontSize:15, fontWeight:800, color:NAVY, letterSpacing:"0.01em" }}>
                      {sig.name}
                    </div>
                    <div style={{ fontSize:11.5, color:MUTED, marginTop:4 }}>{sig.pos}</div>
                  </div>
                ))}

                {/* QR — bottom-right of signature section */}
                <div style={{
                  position:"absolute", bottom:16, right:20,
                  display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(qrUrl)}`}
                    alt="QR"
                    style={{ width:58, height:58, borderRadius:6, border:`1.5px solid ${LIGHT}` }}
                  />
                  <div style={{
                    fontSize:7, color:MUTED, fontFamily:"monospace",
                    letterSpacing:"0.02em", textAlign:"center", lineHeight:1.3,
                    maxWidth:80, wordBreak:"break-all",
                  }}>
                    {cert.cert_id}
                  </div>
                </div>
              </div>

              {/* ── ROW 4: FOOTER ─────────────────────────────────────── */}
              <div style={{
                position:"relative", zIndex:1,
                background:BLUE,
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <span style={{ color:"#fff", fontSize:14.5, fontWeight:700, letterSpacing:"0.24em" }}>
                  HUMAN RESOURCE DEVELOPMENT ( HRD )
                </span>
              </div>

            </div>{/* end certificate */}
          </div>
        </div>
      </div>
    </div>
  );
}
