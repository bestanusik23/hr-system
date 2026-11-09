import { useMemo, useState } from "react";
import { EXCLUDED_LINE, LINES, monthAbbr, nextMonth, saveLaborCost, savePayrollDept, type ApiData } from "./hqReportCalc";
import { deptLineMap, linesOf, parsePayroll, type PayrollFile } from "./hqPayroll";

// แท็บ "เงินเดือน" — admin only. อ่านไฟล์รายงานเงินเดือนในเบราว์เซอร์ แล้วบันทึกเฉพาะยอดรวมรายสายงาน
// ค่านอกเวลา/ค่าเวรในงวดจ่ายใด ถือเป็นค่าใช้จ่ายของเดือนก่อนหน้างวดนั้น

const card: React.CSSProperties = { background: "#fff", border: "1px solid #E6EBF5", borderRadius: 12, padding: 16, boxShadow: "0 4px 14px rgba(20,40,90,.05)", marginBottom: 14 };
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", background: "#F2F5FB", fontWeight: 700, fontSize: 12.5, color: "#334155", borderBottom: "1px solid #E6EBF5", whiteSpace: "nowrap" };
const thR: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "7px 10px", borderBottom: "1px solid #EEF2F8", fontSize: 13, verticalAlign: "middle" };
const num: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const inp: React.CSSProperties = { padding: "6px 8px", border: "1px solid #D5DCEB", borderRadius: 7, fontSize: 13, fontFamily: "inherit", background: "#fff" };
const h3: React.CSSProperties = { margin: "0 0 6px", fontSize: 15 };
const sub: React.CSSProperties = { margin: "0 0 10px", fontSize: 12.5, color: "#6B7A99" };

const baht = (v: number) => Math.round(v).toLocaleString("en-US");
const payLabel = (ym: string) => `${monthAbbr(ym)} ${Number(ym.slice(0, 4)) + 543}`;
const prevMonthOf = (ym: string) => {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

export default function SalaryTab({ data, onSaved }: { data: ApiData; onSaved: () => Promise<unknown> }) {
  const [files, setFiles] = useState<PayrollFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const lineOf = useMemo(() => deptLineMap(data.payrollDeptMap), [data.payrollDeptMap]);

  const depts = useMemo(() => {
    const m = new Map<string, number>();
    files.forEach(f => f.depts.forEach(d => m.set(d.name, Math.max(m.get(d.name) ?? 0, d.headcount))));
    return [...m.entries()]
      .map(([name, headcount]) => ({ name, headcount, line: lineOf.get(name) ?? "" }))
      .sort((a, b) => Number(!!a.line) - Number(!!b.line) || a.name.localeCompare(b.name, "th"));
  }, [files, lineOf]);
  const unmapped = depts.filter(d => !d.line).length;

  const preview = useMemo(() => files.map(f => {
    const rows = linesOf(f, lineOf);
    return {
      f, rows,
      headcount: rows.reduce((s, r) => s + r.headcount, 0),
      regular: rows.reduce((s, r) => s + r.regular, 0),
      otShift: rows.reduce((s, r) => s + r.ot + r.shift, 0),
      excluded: f.depts.filter(d => lineOf.get(d.name) === EXCLUDED_LINE).reduce((s, d) => s + d.regular + d.otShift, 0),
      unmappedAmount: f.depts.filter(d => !lineOf.has(d.name)).reduce((s, d) => s + d.regular + d.otShift, 0),
    };
  }), [files, lineOf]);

  const saved = useMemo(() => {
    const m = new Map<string, { regular: number; otShift: number; headcount: number }>();
    data.laborCost.forEach(x => {
      const a = m.get(x.pay_month) ?? { regular: 0, otShift: 0, headcount: 0 };
      m.set(x.pay_month, { regular: a.regular + x.regular, otShift: a.otShift + x.ot_shift, headcount: a.headcount + x.headcount });
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data.laborCost]);

  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true); setMsg("");
    const good: PayrollFile[] = [], bad: string[] = [];
    for (const file of Array.from(list)) {
      try { good.push(parsePayroll(await file.arrayBuffer(), file.name)); }
      catch (e) { bad.push(e instanceof Error ? e.message : String(e)); }
    }
    const months = good.map(f => f.payMonth);
    const dup = months.filter((m, i) => months.indexOf(m) !== i);
    setFiles(good.filter(f => !dup.includes(f.payMonth)).sort((a, b) => a.payMonth.localeCompare(b.payMonth)));
    setErrors([...bad, ...[...new Set(dup)].map(m => `เลือกไฟล์ของงวด ${payLabel(m)} มากกว่า 1 ไฟล์ — ข้ามงวดนี้`)]);
    setBusy(false);
  };

  const setDept = async (name: string, line: string) => {
    if (!line) return;
    try { await savePayrollDept(name, line); await onSaved(); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  const save = async () => {
    setBusy(true); setMsg("");
    try {
      await saveLaborCost(preview.map(p => ({ pay_month: p.f.payMonth, rows: p.rows })));
      await onSaved();
      setMsg(`บันทึกแล้ว ${preview.length} งวด`);
      setFiles([]);
    } catch (e) { setMsg(`บันทึกไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div style={card}>
        <h3 style={h3}>อัพโหลดไฟล์เงินเดือน</h3>
        <p style={sub}>
          เลือกไฟล์รายงานเงินเดือนได้หลายงวดพร้อมกัน ระบบอ่านงวดจากวันที่ในไฟล์ · ไฟล์ถูกอ่านในเครื่องนี้เท่านั้น ระบบบันทึกเฉพาะยอดรวมรายสายงาน ไม่เก็บเงินเดือนรายคน ·
          อัพโหลดงวดเดิมซ้ำจะแทนที่ยอดของงวดนั้น
        </p>
        <input type="file" accept=".xls,.xlsx" multiple disabled={busy} onChange={e => { void pick(e.target.files); e.target.value = ""; }} />
        {errors.map(x => <div key={x} style={{ fontSize: 12.5, color: "#B42318", marginTop: 6 }}>{x}</div>)}
        {msg && <div style={{ fontSize: 12.5, marginTop: 8, color: msg.startsWith("บันทึกไม่") ? "#B42318" : "#1F7A3D" }}>{msg}</div>}
      </div>

      {files.length > 0 && (
        <>
          <div style={card}>
            <h3 style={h3}>แผนกในไฟล์ → สายงาน {unmapped > 0 && <span style={{ color: "#B42318", fontSize: 13 }}>(ยังไม่จับคู่ {unmapped} แผนก)</span>}</h3>
            <p style={sub}>ต้องเลือกสายงาน (หรือ "ไม่นับ") ให้ครบทุกแผนกก่อนบันทึก ระบบจำไว้ใช้กับงวดถัดไป · ถ้าแก้การจับคู่ภายหลัง ต้องอัพโหลดงวดเก่าใหม่ยอดจึงจะเปลี่ยน</p>
            <div style={{ overflowX: "auto", maxHeight: 380, overflowY: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 520 }}>
                <thead><tr><th style={th}>แผนก</th><th style={thR}>จำนวนคน</th><th style={th}>สายงาน</th></tr></thead>
                <tbody>
                  {depts.map(d => (
                    <tr key={d.name}>
                      <td style={td}>{d.name}</td>
                      <td style={num}>{d.headcount}</td>
                      <td style={td}>
                        <select value={d.line} onChange={e => void setDept(d.name, e.target.value)} style={{ ...inp, borderColor: d.line ? "#D5DCEB" : "#F59E0B" }}>
                          <option value="">— เลือก —</option>
                          {[...LINES, EXCLUDED_LINE].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={card}>
            <h3 style={h3}>ตรวจยอดก่อนบันทึก</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760 }}>
                <thead><tr>
                  <th style={th}>งวดจ่าย</th><th style={thR}>จำนวนคน</th><th style={thR}>รายได้ประจำ</th><th style={thR}>ค่านอกเวลา + ค่าเวร</th>
                  <th style={thR}>ไม่นับ</th><th style={thR}>ยังไม่จับคู่</th>
                </tr></thead>
                <tbody>
                  {preview.map(p => (
                    <tr key={p.f.payMonth}>
                      <td style={td}>{payLabel(p.f.payMonth)}{data.laborCost.some(x => x.pay_month === p.f.payMonth) && <span style={{ marginLeft: 6, fontSize: 11.5, color: "#9A6700" }}>แทนที่ยอดเดิม</span>}</td>
                      <td style={num}>{p.headcount}</td><td style={num}>{baht(p.regular)}</td><td style={num}>{baht(p.otShift)}</td>
                      <td style={num}>{baht(p.excluded)}</td>
                      <td style={{ ...num, color: p.unmappedAmount ? "#B42318" : undefined }}>{baht(p.unmappedAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => void save()} disabled={busy || unmapped > 0}
              style={{ marginTop: 12, padding: "9px 18px", borderRadius: 9, border: "none", background: "#1F3864", color: "#fff", fontWeight: 700, fontFamily: "inherit", cursor: busy ? "wait" : "pointer", opacity: busy || unmapped > 0 ? 0.5 : 1 }}>
              บันทึก {preview.length} งวด
            </button>
          </div>
        </>
      )}

      <div style={card}>
        <h3 style={h3}>งวดที่บันทึกแล้ว ({saved.length})</h3>
        <p style={sub}>รายได้ประจำลงเป็นค่าใช้จ่ายของเดือนที่จ่าย ส่วนค่านอกเวลาและค่าเวรลงเป็นค่าใช้จ่ายของเดือนก่อนหน้า</p>
        {saved.length === 0 ? <div style={{ fontSize: 13, color: "#6B7A99" }}>ยังไม่มีข้อมูล</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 680 }}>
              <thead><tr>
                <th style={th}>งวดจ่าย</th><th style={thR}>จำนวนคน</th><th style={thR}>รายได้ประจำ</th><th style={thR}>ค่านอกเวลา + ค่าเวร</th><th style={th}>ค่านอกเวลา/เวร ลงเดือน</th>
              </tr></thead>
              <tbody>
                {saved.map(([ym, s]) => (
                  <tr key={ym}>
                    <td style={td}>{payLabel(ym)}{!saved.some(([x]) => x === nextMonth(ym)) && <span style={{ marginLeft: 6, fontSize: 11.5, color: "#9A6700" }}>รองวดถัดไป</span>}</td>
                    <td style={num}>{s.headcount}</td><td style={num}>{baht(s.regular)}</td><td style={num}>{baht(s.otShift)}</td>
                    <td style={td}>{payLabel(prevMonthOf(ym))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
