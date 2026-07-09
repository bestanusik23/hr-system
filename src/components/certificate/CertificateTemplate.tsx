// Shared certificate design system — one visual template + print pipeline reused by every
// certificate in the system (training completion, intern completion, and any future type).
// Uses the site's global font (IBM Plex Sans Thai, declared in index.html / src/index.css)
// instead of introducing a separate typeface for printed documents.
import { useRef, useLayoutEffect, useEffect, useState } from "react";

export interface CertificateSigner { name: string; title: string; }

export const CERT_COLORS = {
  blue: "#0038C6", navy: "#0A2F6B", mid: "#26A9E0",
  light: "#E6E7E8", dark: "#1e293b", muted: "#64748b",
} as const;

// A4 landscape canvas, px (matches @page size below at 96dpi-ish scale).
export const CERT_W = 1122;
export const CERT_H = 794;
const S_HEADER = Math.round(CERT_H * 0.14);
const S_BODY   = Math.round(CERT_H * 0.56);
const S_SIG    = Math.round(CERT_H * 0.20);
const S_FOOT   = CERT_H - S_HEADER - S_BODY - S_SIG;
const RADII = [83, 165, 248, 338, 434, 540];

// Site-wide font stack — IBM Plex Sans Thai only goes up to weight 700 (no 800/900),
// so headings here lean on size/letter-spacing rather than heavier weights for emphasis.
export const CERT_FONT_STACK = "'IBM Plex Sans Thai', -apple-system, BlinkMacSystemFont, sans-serif";

export const DEFAULT_SIGNERS: CertificateSigner[] = [
  { name: "นายอนุสิกข์ ทองแผ่น",         title: "รองผู้อำนวยการฝ่ายบริหารและพัฒนาคุณภาพ" },
  { name: "นายแพทย์วัชระ เตชะธีราวัฒน์", title: "ผู้อำนวยการโรงพยาบาลเชียงราย ราม" },
];

export const CERT_PRINT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap');
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; }
body { font-family: ${CERT_FONT_STACK};
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
img { display: block; }
`;

// Opens a print-only popup containing just the certificate markup (no app chrome/nav),
// waits for the popup's fonts to finish loading before printing so the PDF/print output
// matches the on-screen preview instead of racing a fixed timeout.
export function printCertificateArea(domId: string, printDocTitle: string) {
  const el = document.getElementById(domId);
  if (!el) return;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="UTF-8">` +
    `<title>${printDocTitle}</title>` +
    `<style>${CERT_PRINT_CSS}</style></head><body>${el.innerHTML}</body></html>`
  );
  win.document.close();
  const doPrint = () => { win.print(); win.close(); };
  const fonts = win.document.fonts;
  if (fonts?.ready) {
    fonts.ready.then(() => setTimeout(doPrint, 150)).catch(() => setTimeout(doPrint, 900));
  } else {
    setTimeout(doPrint, 900);
  }
}

function CirclesBg() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${CERT_W} ${CERT_H}`}>
        <g fill="none" stroke={CERT_COLORS.blue} strokeWidth="1" opacity="0.05">
          {RADII.map(r => <circle key={`l${r}`} cx={0} cy={CERT_H / 2} r={r} />)}
        </g>
        <g fill="none" stroke={CERT_COLORS.blue} strokeWidth="1" opacity="0.05">
          {RADII.map(r => <circle key={`r${r}`} cx={CERT_W} cy={CERT_H / 2} r={r} />)}
        </g>
      </svg>
    </div>
  );
}

function LuxDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, width: "62%", margin: "10px auto 14px" }}>
      <div style={{ flex: 1, height: "1px", background: CERT_COLORS.light }} />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ width: 4, height: 4, background: CERT_COLORS.mid, transform: "rotate(45deg)", display: "inline-block" }} />
        <span style={{ width: 6, height: 6, background: CERT_COLORS.navy, transform: "rotate(45deg)", display: "inline-block" }} />
        <span style={{ width: 4, height: 4, background: CERT_COLORS.mid, transform: "rotate(45deg)", display: "inline-block" }} />
      </div>
      <div style={{ flex: 1, height: "1px", background: CERT_COLORS.light }} />
    </div>
  );
}

// Lightweight markup so the certificate body can be a plain, HR-editable string: "\n" is a
// manual line break, "**word**" is bold. This is what makes the "edit text before printing"
// panel below possible — a textarea can round-trip this format losslessly.
function renderRichText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => (
    <span key={i}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
        seg.startsWith("**") && seg.endsWith("**")
          ? <b key={j}>{seg.slice(2, -2)}</b>
          : <span key={j}>{seg}</span>
      )}
      {i < lines.length - 1 && <br />}
    </span>
  ));
}

export interface CertificateTemplateProps {
  /** Unique DOM id for the printable area — must be unique per certificate type on the page. */
  domId: string;
  printDocTitle: string;
  certId: string;
  qrVerifyUrl: string;
  recipientName: string;
  /** Small line above the recipient name (e.g. "ขอมอบเกียรติบัตรฉบับนี้ไว้เพื่อแสดงว่า"). */
  eyebrow: string;
  /** Descriptive paragraph(s) — plain text; use "\n" for a manual line break and "**word**" for bold. */
  bodyText: string;
  issuedOnText: string;
  signers?: CertificateSigner[];
  onClose?: () => void;
  nameMaxSize?: number;
  nameMinSize?: number;
}

export default function CertificateTemplate({
  domId, printDocTitle, certId, qrVerifyUrl, recipientName, eyebrow, bodyText, issuedOnText,
  signers = DEFAULT_SIGNERS, onClose, nameMaxSize = 78, nameMinSize = 30,
}: CertificateTemplateProps) {
  const year = new Date().getFullYear() + 543;

  const wrapRef     = useRef<HTMLDivElement>(null);
  const nameRef      = useRef<HTMLDivElement>(null);
  const bodyRef       = useRef<HTMLDivElement>(null);
  const bodyTextRef   = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Editable copy of the text fields — starts as the caller's default and can be adjusted
  // before printing (e.g. fixing an awkward line break) without touching the underlying data.
  const [showEditor, setShowEditor] = useState(false);
  const [editName, setEditName]     = useState(recipientName);
  const [editBody, setEditBody]     = useState(bodyText);
  const [editIssued, setEditIssued] = useState(issuedOnText);
  useEffect(() => setEditName(recipientName), [recipientName]);
  useEffect(() => setEditBody(bodyText), [bodyText]);
  useEffect(() => setEditIssued(issuedOnText), [issuedOnText]);

  function resetEdits() { setEditName(recipientName); setEditBody(bodyText); setEditIssued(issuedOnText); }

  // Scale certificate to fit available width — no horizontal scrollbar.
  useLayoutEffect(() => {
    const update = () => {
      const avail = wrapRef.current?.offsetWidth ?? (window.innerWidth - 32);
      setScale(Math.min(1, avail / CERT_W));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Shrink recipient name until it fits on one line, regardless of how long the name is.
  useLayoutEffect(() => {
    const el = nameRef.current, box = bodyRef.current;
    if (!el || !box) return;
    const maxW = box.clientWidth - 80;
    let sz = nameMaxSize;
    el.style.fontSize = sz + "px";
    while (el.scrollWidth > maxW && sz > nameMinSize) { sz--; el.style.fontSize = sz + "px"; }
  }, [editName, scale, nameMaxSize, nameMinSize]);

  // Shrink the body paragraph if a long institution/department name pushes it past its
  // row's height budget, so the layout never overflows into the signature row.
  useLayoutEffect(() => {
    const el = bodyTextRef.current;
    if (!el) return;
    let sz = 19;
    el.style.fontSize = sz + "px";
    while (el.scrollHeight > 160 && sz > 13) { sz--; el.style.fontSize = sz + "px"; }
  }, [editBody, scale]);

  return (
    <div>
      {/* Controls — not part of the printed output */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button onClick={() => printCertificateArea(domId, printDocTitle)} style={{
          padding: "9px 20px", borderRadius: 7, border: "none",
          background: CERT_COLORS.blue, color: "#fff", fontWeight: 700, fontSize: 13,
          cursor: "pointer", fontFamily: "inherit",
        }}>🖨️ พิมพ์ / บันทึก PDF</button>
        <button onClick={() => setShowEditor(v => !v)} style={{
          padding: "9px 18px", borderRadius: 7, border: `1.5px solid ${showEditor ? CERT_COLORS.blue : "#c4cfee"}`,
          background: showEditor ? "#eff6ff" : "#fff", color: CERT_COLORS.blue, fontWeight: 700, fontSize: 13,
          cursor: "pointer", fontFamily: "inherit",
        }}>✏️ แก้ไขข้อความก่อนพิมพ์</button>
        {onClose && (
          <button onClick={onClose} style={{
            padding: "9px 18px", borderRadius: 7, border: "1.5px solid #c4cfee",
            background: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}>← กลับ</button>
        )}
      </div>

      {showEditor && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
          padding: "16px 18px", marginBottom: 16, maxWidth: 700 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 10 }}>
            แก้ไขข้อความในใบประกาศก่อนพิมพ์ — ขึ้นบรรทัดใหม่: กด Enter · ตัวหนา: ครอบด้วย **ข้อความ**
          </div>
          <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>ชื่อผู้รับ</label>
          <input value={editName} onChange={e => setEditName(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #e2e8f0",
              fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
          <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>ข้อความรายละเอียด</label>
          <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={4}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #e2e8f0",
              fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 10, resize: "vertical" }} />
          <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>บรรทัดวันที่ออกให้</label>
          <input value={editIssued} onChange={e => setEditIssued(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #e2e8f0",
              fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
          <button onClick={resetEdits} style={{
            padding: "7px 14px", borderRadius: 6, border: "1.5px solid #e2e8f0", background: "#fff",
            color: "#64748b", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
          }}>↺ คืนค่าเดิม</button>
        </div>
      )}

      <div ref={wrapRef} style={{ width: "100%", overflow: "hidden", height: Math.round(CERT_H * scale) + 8 }}>
        <div style={{ transformOrigin: "top left", transform: `scale(${scale})`, width: CERT_W }}>
          <div id={domId}>
            <div style={{
              width: CERT_W, height: CERT_H, background: "#fff", border: `6px solid ${CERT_COLORS.blue}`,
              boxSizing: "border-box", position: "relative", overflow: "hidden",
              display: "grid", gridTemplateRows: `${S_HEADER}px ${S_BODY}px ${S_SIG}px ${S_FOOT}px`,
              fontFamily: CERT_FONT_STACK, boxShadow: "0 8px 48px rgba(0,56,198,.18)",
            }}>
              <CirclesBg />

              {/* ROW 1 — header */}
              <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center",
                justifyContent: "space-between", borderBottom: `1px solid ${CERT_COLORS.light}` }}>
                <div style={{ flexShrink: 0, alignSelf: "stretch", display: "flex", alignItems: "flex-start" }}>
                  <img src="/logo-nobg.png" alt="Chiangrai RAM+ Hospital"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    style={{ height: S_HEADER, objectFit: "contain", objectPosition: "left top" }} />
                </div>
                <div style={{ display: "flex", gap: 18, alignItems: "center", justifyContent: "center", flex: 1 }}>
                  {[
                    { src: "/urs-ukas.jpg", alt: "URS UKAS" },
                    { src: "/aaci-gold.png", alt: "AACI Gold" },
                    { src: "/aaci-iso.jpg", alt: "AACI ISO" },
                    { src: "/glp.webp", alt: "GLP" },
                  ].map(img => (
                    <img key={img.src} src={img.src} alt={img.alt} style={{ height: 56, objectFit: "contain" }} />
                  ))}
                </div>
                <div style={{ flexShrink: 0, paddingRight: 24 }}>
                  <div style={{ background: CERT_COLORS.blue, color: "#fff", borderRadius: 8, padding: "8px 18px",
                    fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.05em" }}>ประจำปี {year}</div>
                </div>
              </div>

              {/* ROW 2 — body */}
              <div ref={bodyRef} style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 40px" }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: CERT_COLORS.navy, letterSpacing: "0.06em", lineHeight: 1.25 }}>
                  โรงพยาบาลเชียงราย ราม
                </div>
                <div style={{ fontSize: 17, color: CERT_COLORS.muted, fontWeight: 400, marginTop: 8, letterSpacing: "0.02em" }}>
                  {eyebrow}
                </div>
                <div ref={nameRef} style={{ fontSize: nameMaxSize, fontWeight: 700, color: CERT_COLORS.navy,
                  lineHeight: 1.15, marginTop: 12, whiteSpace: "nowrap", letterSpacing: "-0.01em", maxWidth: "100%" }}>
                  {editName}
                </div>

                <LuxDivider />

                <div ref={bodyTextRef} style={{ fontSize: 19, color: CERT_COLORS.dark, lineHeight: 1.85, maxWidth: 860 }}>
                  {renderRichText(editBody)}
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 600, color: CERT_COLORS.dark, marginTop: 12 }}>
                  {editIssued}
                </div>
              </div>

              {/* ROW 3 — signature */}
              <div style={{ position: "relative", zIndex: 1, display: "grid",
                gridTemplateColumns: `repeat(${signers.length}, 1fr)`, alignItems: "center",
                padding: "0 100px 16px", borderTop: `1px solid ${CERT_COLORS.light}` }}>
                {signers.map(sig => (
                  <div key={sig.name} style={{ textAlign: "center", padding: "16px 24px 0" }}>
                    <div style={{ height: "1px", background: CERT_COLORS.blue, opacity: 0.3, width: "80%", margin: "0 auto 10px" }} />
                    <div style={{ fontSize: 15, fontWeight: 700, color: CERT_COLORS.navy, letterSpacing: "0.01em" }}>
                      {sig.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: CERT_COLORS.muted, marginTop: 4 }}>({sig.title})</div>
                  </div>
                ))}

                {/* QR — white padded frame gives adequate quiet-zone margin for scanning */}
                <div style={{ position: "absolute", bottom: 16, right: 20, display: "flex",
                  flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ background: "#fff", padding: 6, borderRadius: 6, border: `1px solid ${CERT_COLORS.light}` }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(qrVerifyUrl)}`}
                      alt="QR" width={56} height={56} />
                  </div>
                  <div style={{ fontSize: 7, color: CERT_COLORS.muted, fontFamily: "monospace", letterSpacing: "0.02em",
                    textAlign: "center", lineHeight: 1.3, maxWidth: 80, wordBreak: "break-all" }}>{certId}</div>
                </div>
              </div>

              {/* ROW 4 — footer */}
              <div style={{ position: "relative", zIndex: 1, background: CERT_COLORS.blue,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: "0.28em" }}>
                  HUMAN RESOURCE DEVELOPMENT ( HRD )
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
