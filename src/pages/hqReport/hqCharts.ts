// "% คน เทียบ % เงินเดือน" — comparison table, bars and pies as one HTML string, so the
// analysis tab and the printed report show exactly the same thing. Every string in it is a
// fixed label or a computed number; no user-entered text.
import { laborCompare, NEAR_POINTS, pct, VERDICT_TEXT, type CompareRow, type Verdict } from "./hqAnalysis";
import type { HqReport } from "./hqReportCalc";

const PEOPLE = "#2a78d6", COST = "#eb6834";
// Colour follows the group: Admin and Back Office are the same people, so they share a colour.
const GROUP_COLOR: Record<string, string> = {
  Services: "#2a78d6", Admin: "#eb6834",
  Nursing: "#2a78d6", "Support Service": "#1baf7a", "Back Office": "#eb6834", Ancillary: "#7f858f",
};
const INK = "#1E293B", INK2 = "#475569", MUTED = "#6B7A99";
const VERDICT_BG: Record<Verdict, string> = { above: "#FCE8DF", below: "#E3EEFB", near: "#E4F3EA" };

const legend = (items: [string, string][]) => `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px 12px;font-size:10.5px;color:${INK2};margin-top:2px">${
  items.map(([label, color]) => `<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:2px;background:${color}"></span>${label}</span>`).join("")
}</div>`;

const chartTitle = (t: string) => `<div style="font-size:11.5px;font-weight:700;color:${INK};text-align:center;margin-bottom:3px">${t}</div>`;

function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(3, w);
  return `M${x} ${y}h${w - r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${r - w}z`;
}

function barsChart(title: string, rows: CompareRow[]): string {
  const W = 300, labelW = 90, valueW = 44, barH = 13, rowGap = 12;
  const plot = W - labelW - valueW;
  const top = Math.max(0.01, ...rows.flatMap(r => [r.headShare, r.costShare]));
  const body = rows.map((r, i) => {
    const y = i * (barH * 2 + 2 + rowGap) + 2;
    const bar = (v: number, yy: number, color: string, name: string) => `<g><title>${r.label} ${name}: ${pct(v)}</title>
      <path d="${barPath(labelW, yy, Math.max(1, (v / top) * plot), barH)}" fill="${color}"/>
      <text x="${labelW + (v / top) * plot + 4}" y="${yy + barH - 3}" font-size="10.5" font-weight="700" fill="${INK}">${pct(v)}</text></g>`;
    return `<text x="${labelW - 6}" y="${y + barH + 4}" text-anchor="end" font-size="10.5" fill="${INK2}">${r.label}</text>
      ${bar(r.headShare, y, PEOPLE, "% จำนวนคน")}${bar(r.costShare, y + barH + 2, COST, "% ค่าใช้จ่ายเงินเดือน")}`;
  }).join("");
  const H = rows.length * (barH * 2 + 2 + rowGap);
  return `<div style="flex:1 1 240px;min-width:0">${chartTitle(title)}
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${title}" style="display:block;font-family:inherit">
      <line x1="${labelW}" y1="0" x2="${labelW}" y2="${H - rowGap + 4}" stroke="#CBD5E1"/>${body}
    </svg>${legend([["% จำนวนคน", PEOPLE], ["% ค่าใช้จ่ายเงินเดือน", COST]])}</div>`;
}

function pieChart(title: string, slices: { label: string; value: number }[]): string {
  const cx = 120, cy = 82, r = 58;
  const parts = slices.filter(s => s.value > 0);
  let start = -Math.PI / 2;
  const body = parts.map(s => {
    const sweep = s.value * 2 * Math.PI, end = start + sweep, mid = start + sweep / 2;
    const color = GROUP_COLOR[s.label];
    const pt = (a: number, rad = r) => `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
    const shape = parts.length === 1
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`
      : `<path d="M${cx} ${cy}L${pt(start)}A${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${pt(end)}Z" fill="${color}" stroke="#fff" stroke-width="2"/>`;
    const lx = cx + (r + 8) * Math.cos(mid), ly = cy + (r + 8) * Math.sin(mid);
    const anchor = Math.cos(mid) > 0.2 ? "start" : Math.cos(mid) < -0.2 ? "end" : "middle";
    start = end;
    return `<g><title>${s.label}: ${pct(s.value)}</title>${shape}
      <text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${anchor}" font-size="10.5" font-weight="700" fill="${INK}">${pct(s.value)}</text></g>`;
  }).join("");
  return `<div style="flex:1 1 200px;min-width:0">${chartTitle(title)}
    <svg viewBox="0 0 240 164" width="100%" role="img" aria-label="${title}" style="display:block;font-family:inherit">${body}</svg>
    ${legend(slices.map(s => [s.label, GROUP_COLOR[s.label]]))}</div>`;
}

export function laborCompareHtml(rep: HqReport): string {
  if (!rep.laborStatus.some(s => s.hasRegular)) return "";
  const { byLabor, byFunc } = laborCompare(rep);
  const cell = "padding:3px 7px;border:1px solid #D5DCEB";
  const row = (r: CompareRow, first: boolean) => `<tr style="${first ? "border-top:2px solid #475569" : ""}">
    <td style="${cell};font-weight:700;color:${INK}">${r.label}</td>
    <td style="${cell};text-align:right">${pct(r.headShare)}</td>
    <td style="${cell};text-align:right">${pct(r.costShare)}</td>
    <td style="${cell};text-align:right;font-weight:700;background:${VERDICT_BG[r.verdict]}">${r.gap >= 0 ? "+" : ""}${r.gap.toFixed(1)}%</td>
    <td style="${cell};font-weight:600;background:${VERDICT_BG[r.verdict]}">${VERDICT_TEXT[r.verdict]}</td>
  </tr>`;
  const head = "padding:4px 7px;background:#1F3864;color:#fff;font-weight:700;text-align:center";
  const table = `<div style="flex:2 1 440px;min-width:0">
    <table style="width:100%;border-collapse:collapse;font-size:11.5px">
      <thead><tr><th style="${head};text-align:left">กลุ่ม</th><th style="${head}">% จำนวนคน</th><th style="${head}">% ค่าใช้จ่ายเงินเดือน</th><th style="${head}">ส่วนต่าง (จุด %)</th><th style="${head}">สรุป</th></tr></thead>
      <tbody>${byLabor.map(r => row(r, false)).join("")}${byFunc.map((r, i) => row(r, i === 0)).join("")}</tbody>
    </table>
    <div style="font-size:10.5px;color:${MUTED};margin-top:4px">อ่านผล: ถ้า % เงินเดือนมากกว่า % คน แปลว่ากลุ่มนั้นมีเงินเดือนเฉลี่ยสูงกว่าค่าเฉลี่ยรวม · เกณฑ์ถือว่า "ใกล้เคียงกัน" ±${NEAR_POINTS.toFixed(1)} จุด %</div>
  </div>`;
  const slices = (rows: CompareRow[], k: "costShare" | "headShare") => rows.map(r => ({ label: r.label, value: r[k] }));
  return `<div style="display:flex;flex-wrap:wrap;gap:10px 16px;align-items:flex-start">${table}${barsChart("Labor Cost: % คน เทียบ % เงินเดือน", byLabor)}${barsChart("Functional: % คน เทียบ % เงินเดือน", byFunc)}</div>
  <div style="display:flex;flex-wrap:wrap;gap:10px 16px;margin-top:10px">
    ${pieChart("สัดส่วนค่าใช้จ่ายเงินเดือนตาม Labor Cost", slices(byLabor, "costShare"))}
    ${pieChart("สัดส่วนค่าใช้จ่ายเงินเดือนตาม Functional", slices(byFunc, "costShare"))}
    ${pieChart("สัดส่วนจำนวนคนตาม Labor Cost", slices(byLabor, "headShare"))}
    ${pieChart("สัดส่วนจำนวนคนตาม Functional", slices(byFunc, "headShare"))}
  </div>`;
}
