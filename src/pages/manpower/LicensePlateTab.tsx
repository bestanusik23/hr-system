import { useEffect, useState } from "react";
import { formatThaiDate } from "../../utils/date";

interface Employee {
  id: number; full_name: string; position: string; division_name: string;
  license_number: string | null; license_expiry: string | null;
  car_plate_1: string | null; car_plate_2: string | null;
  moto_plate_1: string | null; moto_plate_2: string | null;
  emp_status: string;
}

interface LicenseAlert {
  id: number; full_name: string; position: string; division_name: string;
  license_number: string; license_expiry: string; days_left: number;
}

function licenseBadge(expiry: string | null) {
  if (!expiry) return null;
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0)     return { text: `หมดแล้ว ${Math.abs(days)} วัน`, bg: "#fee2e2", color: "#dc2626" };
  if (days <= 15)   return { text: `🔴 ${days} วัน`, bg: "#fee2e2", color: "#dc2626" };
  if (days <= 30)   return { text: `🟡 ${days} วัน`, bg: "#fefce8", color: "#b45309" };
  return { text: `✅ ${days} วัน`, bg: "#f0fdf4", color: "#16a34a" };
}

const fieldStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 7,
  border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
  letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6,
};

export default function LicensePlateTab() {
  const [q, setQ]             = useState("");
  const [debouncedQ, setDQ]   = useState("");
  const [employees, setEmps]  = useState<Employee[]>([]);
  const [alerts, setAlerts]   = useState<LicenseAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [alertsLoaded, setAL] = useState(false);

  // Edit modal state
  const [editEmp,     setEditEmpRaw] = useState<Employee | null>(null);
  const [editLicense, setEditLicense] = useState("");
  const [editExpiry,  setEditExpiry]  = useState("");
  const [editCar1,    setEditCar1]    = useState("");
  const [editCar2,    setEditCar2]    = useState("");
  const [editMoto1,   setEditMoto1]   = useState("");
  const [editMoto2,   setEditMoto2]   = useState("");
  const [editSaving,  setEditSaving]  = useState(false);
  const [editError,   setEditError]   = useState("");

  function openEdit(emp: Employee) {
    setEditEmpRaw(emp);
    setEditLicense(emp.license_number ?? "");
    setEditExpiry(emp.license_expiry ?? "");
    setEditCar1(emp.car_plate_1 ?? "");
    setEditCar2(emp.car_plate_2 ?? "");
    setEditMoto1(emp.moto_plate_1 ?? "");
    setEditMoto2(emp.moto_plate_2 ?? "");
    setEditError("");
  }

  async function saveEdit() {
    if (!editEmp) return;
    setEditSaving(true); setEditError("");
    try {
      const r = await fetch(`/api/manpower/employees/${editEmp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editEmp.full_name,
          position: editEmp.position,
          license_number: editLicense.trim() || null,
          license_expiry: editExpiry || null,
          car_plate_1: editCar1.trim() || null,
          car_plate_2: editCar2.trim() || null,
          moto_plate_1: editMoto1.trim() || null,
          moto_plate_2: editMoto2.trim() || null,
        }),
      });
      const d = await r.json() as { ok: boolean; error?: string };
      if (!d.ok) { setEditError(d.error ?? "เกิดข้อผิดพลาด"); return; }
      // Update local state immediately
      const updated: Employee = {
        ...editEmp,
        license_number: editLicense.trim() || null,
        license_expiry: editExpiry || null,
        car_plate_1: editCar1.trim() || null,
        car_plate_2: editCar2.trim() || null,
        moto_plate_1: editMoto1.trim() || null,
        moto_plate_2: editMoto2.trim() || null,
      };
      setEmps(prev => prev.map(e => e.id === editEmp.id ? updated : e));
      // Refresh alerts (license expiry may have changed)
      fetch("/api/manpower/license-alerts").then(r => r.json())
        .then((d: { ok: boolean; alerts: LicenseAlert[] }) => { if (d.ok) setAlerts(d.alerts ?? []); });
      setEditEmpRaw(null);
    } catch {
      setEditError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setEditSaving(false);
    }
  }

  /* Debounce */
  useEffect(() => {
    const t = setTimeout(() => setDQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  /* Load license alerts on mount */
  useEffect(() => {
    fetch("/api/manpower/license-alerts").then(r => r.json())
      .then((d: { ok: boolean; alerts: LicenseAlert[] }) => {
        if (d.ok) setAlerts(d.alerts ?? []);
        setAL(true);
      });
  }, []);

  /* Search employees */
  useEffect(() => {
    if (!debouncedQ.trim()) { setEmps([]); return; }
    setLoading(true);
    fetch(`/api/manpower/employees?q=${encodeURIComponent(debouncedQ)}`)
      .then(r => r.json())
      .then((d: { ok: boolean; employees: Employee[] }) => {
        setEmps(d.ok ? d.employees : []);
        setLoading(false);
      });
  }, [debouncedQ]);

  const inp: React.CSSProperties = {
    width: "100%", padding: "10px 14px 10px 38px", borderRadius: 8,
    border: "1.5px solid #c4cfee", fontSize: 14, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  const searching = debouncedQ.trim().length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Search ── */}
      <div style={{ background: "#fff", borderRadius: 14, padding: 22, boxShadow: "0 1px 6px rgba(0,0,0,.06)" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0a1628", marginBottom: 4 }}>
          🔍 ค้นหาพนักงาน
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
          ค้นหาด้วยชื่อ · ตำแหน่ง · เลขใบประกอบวิชาชีพ · ทะเบียนรถ
        </div>
        <div style={{ position: "relative" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={q} onChange={e => setQ(e.target.value)} style={inp}
            placeholder="พิมพ์ชื่อ, เลขใบประกอบ, หรือทะเบียนรถ…" />
          {q && (
            <button onClick={() => setQ("")}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 18 }}>
              ×
            </button>
          )}
        </div>

        {/* Search results */}
        {searching && (
          <div style={{ marginTop: 16 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 24, color: "#94a3b8", fontSize: 13 }}>กำลังค้นหา…</div>
            ) : employees.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "#94a3b8", fontSize: 13 }}>ไม่พบข้อมูล</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
                  พบ {employees.length} รายการ
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["ชื่อ-นามสกุล","ตำแหน่ง","ฝ่าย","ใบประกอบ","หมดอายุ","รถยนต์","มอเตอร์ไซ์",""].map(h => (
                        <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700,
                          color: "#475569", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((e, i) => {
                      const badge = licenseBadge(e.license_expiry);
                      return (
                        <tr key={e.id} style={{ background: i % 2 === 0 ? "#fafbff" : "#fff",
                          borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "9px 12px", fontWeight: 600, color: "#0a1628" }}>{e.full_name}</td>
                          <td style={{ padding: "9px 12px", color: "#475569" }}>{e.position || "—"}</td>
                          <td style={{ padding: "9px 12px", color: "#64748b" }}>{e.division_name || "—"}</td>
                          <td style={{ padding: "9px 12px", color: "#0038c6", fontWeight: 600 }}>
                            {e.license_number || "—"}
                          </td>
                          <td style={{ padding: "9px 12px" }}>
                            {badge ? (
                              <span style={{ background: badge.bg, color: badge.color, fontWeight: 700,
                                padding: "3px 8px", borderRadius: 5, whiteSpace: "nowrap" }}>
                                {badge.text}
                              </span>
                            ) : "—"}
                          </td>
                          <td style={{ padding: "9px 12px", color: "#475569" }}>
                            {[e.car_plate_1, e.car_plate_2].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td style={{ padding: "9px 12px", color: "#475569" }}>
                            {[e.moto_plate_1, e.moto_plate_2].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td style={{ padding: "6px 10px" }}>
                            <button onClick={() => openEdit(e)}
                              style={{ background: "none", border: "1px solid #c4cfee", borderRadius: 6,
                                padding: "4px 10px", cursor: "pointer", fontSize: 12, color: "#0038C6",
                                whiteSpace: "nowrap" }}>
                              ✏️ แก้ไข
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── License Expiry Alerts ── */}
      <div style={{ background: "#fff", borderRadius: 14, padding: 22, boxShadow: "0 1px 6px rgba(0,0,0,.06)" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0a1628", marginBottom: 4 }}>
          ⚠️ ใบประกอบวิชาชีพใกล้หมดอายุ
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
          แจ้งเตือนล่วงหน้า — 🔴 เหลือน้อยกว่า 15 วัน · 🟡 เหลือน้อยกว่า 30 วัน
        </div>

        {!alertsLoaded ? (
          <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 20 }}>กำลังโหลด…</div>
        ) : alerts.length === 0 ? (
          <div style={{ color: "#16a34a", fontSize: 13, background: "#f0fdf4",
            border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 16px" }}>
            ✅ ไม่มีใบประกอบวิชาชีพที่ใกล้หมดอายุในช่วง 30 วันนี้
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map(a => {
              const urgent = a.days_left <= 15;
              return (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "12px 16px", borderRadius: 10,
                  background: urgent ? "#fff5f5" : "#fffbeb",
                  border: `1px solid ${urgent ? "#fecaca" : "#fde68a"}`,
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                    background: urgent ? "#dc2626" : "#d97706",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 800, fontSize: 14,
                  }}>
                    {a.days_left < 0 ? "!" : a.days_left}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0a1628" }}>{a.full_name}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {a.position || "—"} · {a.division_name || "—"}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                      ใบประกอบ: <b style={{ color: "#0038c6" }}>{a.license_number}</b>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: urgent ? "#dc2626" : "#b45309" }}>
                        {a.days_left < 0
                          ? `หมดแล้ว ${Math.abs(a.days_left)} วัน`
                          : `เหลือ ${a.days_left} วัน`}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                        หมด {formatThaiDate(a.license_expiry)}
                      </div>
                    </div>
                    <button onClick={() => openEdit({
                      id: a.id, full_name: a.full_name, position: a.position,
                      division_name: a.division_name, license_number: a.license_number,
                      license_expiry: a.license_expiry, car_plate_1: null, car_plate_2: null,
                      moto_plate_1: null, moto_plate_2: null, emp_status: "passed",
                    })}
                      style={{ background: "none", border: "1px solid #c4cfee", borderRadius: 7,
                        padding: "5px 12px", cursor: "pointer", fontSize: 12, color: "#0038C6",
                        whiteSpace: "nowrap" }}>
                      ✏️ แก้ไข
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {editEmp && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditEmpRaw(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.55)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 500,
            boxShadow: "0 24px 60px rgba(0,56,198,0.22)", border: "1px solid #c4cfee",
            borderTop: "4px solid #0038C6", padding: "28px 30px" }}>

            <div style={{ fontSize: 15, fontWeight: 700, color: "#0a1628", marginBottom: 4,
              display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 4, height: 18, borderRadius: 2, background: "#0038C6" }} />
              แก้ไขใบประกอบ / ทะเบียนรถ
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
              {editEmp.full_name} · {editEmp.position || "—"}
            </div>

            {/* License */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>เลขใบประกอบวิชาชีพ</label>
              <input value={editLicense} onChange={e => setEditLicense(e.target.value)}
                placeholder="เช่น น.45678" style={fieldStyle} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>วันหมดอายุใบประกอบ</label>
              <input type="date" value={editExpiry} onChange={e => setEditExpiry(e.target.value)}
                style={fieldStyle} />
            </div>

            {/* Cars */}
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 10,
                textTransform: "uppercase", letterSpacing: "0.07em" }}>ทะเบียนรถยนต์</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ ...labelStyle, textTransform: "none" }}>คันที่ 1</label>
                  <input value={editCar1} onChange={e => setEditCar1(e.target.value)}
                    placeholder="เช่น กข 1234 เชียงราย" style={fieldStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, textTransform: "none" }}>คันที่ 2</label>
                  <input value={editCar2} onChange={e => setEditCar2(e.target.value)}
                    placeholder="—" style={fieldStyle} />
                </div>
              </div>
            </div>

            {/* Motos */}
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: "14px 16px", marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 10,
                textTransform: "uppercase", letterSpacing: "0.07em" }}>ทะเบียนมอเตอร์ไซ์</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ ...labelStyle, textTransform: "none" }}>คันที่ 1</label>
                  <input value={editMoto1} onChange={e => setEditMoto1(e.target.value)}
                    placeholder="เช่น ขข 5678 เชียงราย" style={fieldStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, textTransform: "none" }}>คันที่ 2</label>
                  <input value={editMoto2} onChange={e => setEditMoto2(e.target.value)}
                    placeholder="—" style={fieldStyle} />
                </div>
              </div>
            </div>

            {editError && (
              <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 7,
                padding: "9px 12px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>
                {editError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditEmpRaw(null)} disabled={editSaving}
                style={{ flex: 1, padding: "11px 0", borderRadius: 7, border: "1.5px solid #c4cfee",
                  background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                ยกเลิก
              </button>
              <button onClick={saveEdit} disabled={editSaving}
                style={{ flex: 2, padding: "11px 0", borderRadius: 7, border: "none",
                  background: editSaving ? "#94a3b8" : "#0038C6", color: "#fff",
                  fontWeight: 700, cursor: editSaving ? "not-allowed" : "pointer",
                  fontFamily: "inherit", fontSize: 13 }}>
                {editSaving ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
