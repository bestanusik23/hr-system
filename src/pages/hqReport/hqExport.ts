// Fills the HQ "HR Dashboard" template (public/templates/hq-dashboard-template.xlsx —
// the file last sent to HQ with its data rows cleared) and downloads it.
// Static sheets (สายงาน, Map, Labor Cost, Health Category), named ranges and the
// sheet layout come from the template; only the Data_* rows are written here.
// Formula cells keep the same formulas as the sample and also carry a computed
// value, so the numbers show even before Excel recalculates.
import * as XLSX from "xlsx";
import {
  GROUP, HOSPITAL, LINES, LINE_FUNC, LINE_LABOR, TENURE_BANDS, AGE_BANDS, isProfessional,
  monthAbbr, tenureBand, ageBand, loadTemplate, readTemplateLists,
  type HqReport, type Line,
} from "./hqReportCalc";

type Val = string | number | null | { f: string; v: string | number };

const SAMPLE_NOTE = "เกณฑ์เดือน: ผู้เริ่มงาน/ผู้ลาออกนับตามรอบ 26 ของเดือนก่อน – 25 ของเดือนนั้น ส่วน Existing FT ใน Data_Manpower นับ ณ สิ้นเดือน";

function excelDate(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
}

function writeRows(ws: XLSX.WorkSheet, rows: Val[][], dateCols: number[] = []) {
  rows.forEach((row, ri) => {
    const r = ri + 1; // row 0 = header from the template
    row.forEach((val, c) => {
      if (val === null || val === "") return;
      const addr = XLSX.utils.encode_cell({ r, c });
      if (typeof val === "object") {
        ws[addr] = { t: typeof val.v === "number" ? "n" : "s", v: val.v, f: val.f };
      } else if (typeof val === "number") {
        ws[addr] = dateCols.includes(c) ? { t: "n", v: val, z: "yyyy-mm-dd" } : { t: "n", v: val };
      } else {
        ws[addr] = { t: "s", v: val };
      }
    });
  });
  const ref = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  ref.e.r = Math.max(ref.e.r, rows.length);
  ws["!ref"] = XLSX.utils.encode_range(ref);
}

const lineCols = (month: string, l: Line) => [monthAbbr(month), GROUP, HOSPITAL, l, LINE_FUNC[l], LINE_LABOR[l]];
const funcF = (r: number, col = "D") => `IF(${col}${r}="","",IFERROR(VLOOKUP(TRIM(CLEAN(${col}${r})),FuncMap,2,FALSE),"Unmapped"))`;

export async function exportHqDashboard(rep: HqReport): Promise<string> {
  const wb = await loadTemplate();
  const lists = readTemplateLists(wb);
  const sheet = (name: string) => {
    const ws = wb.Sheets[name];
    if (!ws) throw new Error(`แม่แบบไม่มีชีต ${name}`);
    return ws;
  };

  // Map → Report year
  const map = sheet("Map");
  map["AF4"] = { t: "n", v: rep.year };

  // Data_Manpower
  writeRows(sheet("Data_Manpower"), rep.manpower.map((m, i) => {
    const r = i + 2, total = m.ft + m.pt;
    return [...lineCols(m.month, m.line), m.planned, m.ft, m.pt,
      { f: `IF(G${r}="","",N(H${r})+N(I${r}))`, v: total },
      { f: `IF(G${r}="","",G${r}-J${r})`, v: m.planned - total },
      { f: funcF(r), v: LINE_FUNC[m.line] }];
  }));

  // Data_Resign (2) — one row per resignation; the Year-of-Services sheet sums it.
  const rs2 = sheet("Data_Resign (2)");
  writeRows(rs2, rep.resigns.map((p, i) => {
    const r = i + 2;
    const tenure = p.start && p.resign ? tenureBand(p.start, p.resign) : "";
    return [...lineCols(p.month, p.line),
      p.start && p.resign ? { f: `LOOKUP(DATEDIF(L${r},M${r},"m"),{0,4,12,24,36,60,120,180},Map!$AM$4:$AM$11)`, v: tenure } : null,
      1, p.name, p.position, p.age,
      p.start ? excelDate(p.start) : null, p.resign ? excelDate(p.resign) : null,
      p.age !== null ? { f: `LOOKUP(K${r},{0,21,25,35,45,55,61},Map!$AQ$4:$AQ$10)`, v: ageBand(p.age) } : null];
  }), [11, 12]);

  // Data_Manpower Year of Services — month × line, SUMIFS over Data_Resign (2)
  const yos: Val[][] = [];
  const tenureCols = ["G", "H", "I", "J", "K", "L", "M", "N"];
  const ageCols = ["O", "P", "Q", "R", "S", "T", "U"];
  for (const ym of rep.months) for (const l of LINES) {
    const r = yos.length + 2;
    const people = rep.resigns.filter(p => p.month === ym && p.line === l);
    const sumifs = (bandCol: string, hdr: string) =>
      `SUMIFS('Data_Resign (2)'!$H$2:$H$201,'Data_Resign (2)'!$A$2:$A$201,$A${r},'Data_Resign (2)'!$D$2:$D$201,$D${r},'Data_Resign (2)'!$${bandCol}$2:$${bandCol}$201,"="&${hdr}$1)`;
    const tCounts = TENURE_BANDS.map(b => people.filter(p => p.start && p.resign && tenureBand(p.start, p.resign) === b).length);
    const aCounts = AGE_BANDS.map(b => people.filter(p => p.age !== null && ageBand(p.age) === b).length);
    const tSum = tCounts.reduce((a, b) => a + b, 0), aSum = aCounts.reduce((a, b) => a + b, 0);
    yos.push([...lineCols(ym, l),
      ...tenureCols.map((c, i) => ({ f: sumifs("G", c), v: tCounts[i] })),
      ...ageCols.map((c, i) => ({ f: sumifs("N", c), v: aCounts[i] })),
      { f: funcF(r), v: LINE_FUNC[l] },
      { f: `IF(A${r}="","",SUM(G${r}:N${r}))`, v: tSum },
      { f: `IF(A${r}="","",SUM(O${r}:U${r}))`, v: aSum },
      { f: `IF(A${r}="","",IF(W${r}=X${r},"OK","Years of Services ≠ Age Group"))`, v: tSum === aSum ? "OK" : "Years of Services ≠ Age Group" },
      r === 2 ? "Resigned employees summarised from Data_Resign (2)" : null]);
  }
  const yosWs = sheet("Data_Manpower Year of Services");
  // Header cells are formulas (=Map!$AM$4 …) — give them a cached value too, since the
  // SUMIFS rows match against them.
  [...tenureCols.map((c, i) => [c, TENURE_BANDS[i]]), ...ageCols.map((c, i) => [c, AGE_BANDS[i]])].forEach(([c, band]) => {
    const cell = yosWs[`${c}1`];
    if (cell) { cell.t = "s"; cell.v = band; }
  });
  writeRows(yosWs, yos);

  // Hires per line (sample header says "Hired" in "Data_Exisitng by level")
  const hiresBy = (ym: string, l: Line) => rep.hires.filter(p => p.month === ym && p.line === l).length;
  const byLine: Val[][] = [];
  const hiredRows: Val[][] = [];
  for (const ym of rep.months) for (const l of LINES) {
    const n = hiresBy(ym, l);
    byLine.push([...lineCols(ym, l), n]);
    if (n > 0) {
      const r = hiredRows.length + 2;
      hiredRows.push([monthAbbr(ym), GROUP, HOSPITAL, l, LINE_FUNC[l], n, { f: funcF(r), v: LINE_FUNC[l] }]);
    }
  }
  writeRows(sheet("Data_Exisitng by level"), byLine);
  writeRows(sheet("Data_Hired"), hiredRows);

  // Data_Sourcing — month × channel
  const src: Val[][] = [];
  for (const ym of rep.months) {
    const counts = new Map<string, number>();
    for (const p of rep.hires.filter(h => h.month === ym)) {
      const ch = p.channel || "Other";
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    for (const [ch, n] of counts) {
      const r = src.length + 2;
      src.push([monthAbbr(ym), GROUP, HOSPITAL, ch, n,
        { f: `IF(D${r}="","",IFERROR(VLOOKUP(TRIM(CLEAN(D${r})),ChanMap,2,FALSE),"Unmapped"))`, v: lists.channelCat[ch] ?? "Unmapped" },
        r === 2 ? SAMPLE_NOTE : null]);
    }
  }
  writeRows(sheet("Data_Sourcing"), src);

  // Data_Resign — one row per resignation
  writeRows(sheet("Data_Resign"), rep.resigns.map((p, i) => {
    const r = i + 2, prof = isProfessional(p.line);
    return [monthAbbr(p.month), GROUP, HOSPITAL, p.line, LINE_FUNC[p.line], 1, prof ? 1 : 0, prof ? 0 : 1,
      { f: funcF(r), v: LINE_FUNC[p.line] }];
  }));

  // Data_Reason — month × raw reason
  const rea: Val[][] = [];
  for (const ym of rep.months) {
    const counts = new Map<string, number>();
    for (const p of rep.resigns.filter(x => x.month === ym)) {
      const k = p.reason || "ไม่ระบุเหตุผล";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const [reason, n] of counts) {
      const r = rea.length + 2;
      const cat = lists.reasonCat[reason] ?? "Unmapped";
      rea.push([monthAbbr(ym), GROUP, HOSPITAL, reason, n,
        { f: `IF(D${r}="","",IFERROR(VLOOKUP(TRIM(CLEAN(D${r})),ReasonMap,2,FALSE),"Unmapped"))`, v: cat },
        { f: `IF(F${r}="","",IFERROR(VLOOKUP(F${r},ReasonTypeMap,2,FALSE),"Unmapped"))`, v: lists.reasonType[cat] ?? "Unmapped" }]);
    }
  }
  writeRows(sheet("Data_Reason"), rea);

  const first = monthAbbr(rep.months[0]), last = monthAbbr(rep.months[rep.months.length - 1]);
  const now = new Date();
  const stamp = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}${now.getFullYear()}`;
  const fileName = `HR_Dashboard_RAM_CRR_${first}-${last}_${rep.year}_${stamp}.xlsx`;
  XLSX.writeFile(wb, fileName, { bookType: "xlsx", compression: true });
  return fileName;
}
