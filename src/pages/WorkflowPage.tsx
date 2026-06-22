import { useState } from "react";
import PageLayout from "../components/PageLayout";

type Tab = "eval" | "transfer" | "recruit" | "training" | "rbac";

const TAB_LIST: { id: Tab; label: string; icon: string }[] = [
  { id: "eval",     label: "ประเมินผล",       icon: "📋" },
  { id: "transfer", label: "โอนย้าย",          icon: "🔄" },
  { id: "recruit",  label: "สรรหา",            icon: "🔍" },
  { id: "training", label: "ฝึกอบรม",          icon: "🎓" },
  { id: "rbac",     label: "สิทธิ์ทั้งหมด",    icon: "🔑" },
];

interface StepBox {
  step?: string;
  status: string;
  role: string;
  action: string;
  reject?: boolean;
  color: string;
  bg: string;
  border: string;
}

function FlowStep({ box, last }: { box: StepBox; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{
          background: box.bg, border: `2px solid ${box.border}`,
          borderRadius: 12, padding: "14px 18px", minWidth: 145, textAlign: "center",
        }}>
          {box.step && (
            <div style={{ fontSize: 10, fontWeight: 700, color: box.color,
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              {box.step}
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 800, color: box.color, marginBottom: 6 }}>
            {box.status}
          </div>
          <div style={{ fontSize: 11, background: "rgba(0,0,0,0.07)", borderRadius: 5,
            padding: "2px 8px", display: "inline-block", color: box.color, fontWeight: 600 }}>
            {box.role}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 5, lineHeight: 1.4 }}>
            {box.action}
          </div>
          {box.reject && (
            <div style={{ fontSize: 10, color: "#dc2626", marginTop: 4, fontWeight: 600 }}>
              ↳ ปฏิเสธ → rejected
            </div>
          )}
        </div>
      </div>
      {!last && (
        <div style={{ display: "flex", alignItems: "center", paddingTop: 28, margin: "0 4px" }}>
          <div style={{ width: 30, height: 2, background: "#94a3b8", position: "relative" }}>
            <div style={{ position: "absolute", right: -1, top: -4,
              width: 0, height: 0, borderTop: "5px solid transparent",
              borderBottom: "5px solid transparent", borderLeft: "8px solid #94a3b8" }} />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <div style={{ width: 4, height: 18, background: "#0038C6", borderRadius: 2 }} />
      <span style={{ fontSize: 13, fontWeight: 800, color: "#0038C6",
        textTransform: "uppercase", letterSpacing: "0.07em" }}>{children}</span>
    </div>
  );
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#fffbeb", border: "1px solid #fde68a",
      borderLeft: "4px solid #f59e0b", borderRadius: 8,
      padding: "12px 16px", fontSize: 12.5, color: "#475569", lineHeight: 1.7, marginTop: 18 }}>
      {children}
    </div>
  );
}

function RoleBadge({ role, color, bg }: { role: string; color: string; bg: string }) {
  return (
    <span style={{ display: "inline-block", background: bg, color, borderRadius: 5,
      padding: "2px 9px", fontSize: 11, fontWeight: 700, margin: "1px 2px" }}>
      {role}
    </span>
  );
}

export default function WorkflowPage() {
  const [tab, setTab] = useState<Tab>("eval");

  return (
    <PageLayout title="Workflow & สิทธิ์การอนุมัติ" accent="#0038C6">
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {TAB_LIST.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: "9px 20px", borderRadius: 10, border: "2px solid",
              fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
              transition: "all .12s",
              borderColor: tab === t.id ? "#0038C6" : "#dce4f5",
              background: tab === t.id ? "#0038C6" : "#fff",
              color: tab === t.id ? "#fff" : "#475569",
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ===== EVAL ===== */}
      {tab === "eval" && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 1px 8px rgba(0,0,0,.06)" }}>
          <SectionTitle>ระบบประเมินผลพนักงานทดลองงาน — 4 ขั้นตอน</SectionTitle>

          <div style={{ overflowX: "auto", paddingBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 0, minWidth: 780 }}>
              <FlowStep box={{
                step: "เริ่มต้น", status: "📝 draft",
                role: "หัวหน้าแผนก", action: "กรอกคะแนน + ส่งใบประเมิน",
                color: "#92400e", bg: "#fefce8", border: "#fde68a",
              }} />
              <FlowStep box={{
                step: "ขั้นตอน 2", status: "⏳ pending_deputy",
                role: "รองผู้อำนวยการ", action: "deputy_approve / reject",
                reject: true, color: "#5b21b6", bg: "#ede9fe", border: "#c4b5fd",
              }} />
              <FlowStep box={{
                step: "ขั้นตอน 3", status: "📂 pending_hr",
                role: "HR", action: "hr_acknowledge (รับรอง)",
                color: "#1e40af", bg: "#dbeafe", border: "#bfdbfe",
              }} />
              <FlowStep box={{
                step: "ขั้นตอน 4", status: "🏁 pending_final",
                role: "รองผอ.ค่าตอบแทน", action: "final_approve / reject",
                reject: true, color: "#9a3412", bg: "#fff7ed", border: "#fed7aa",
              }} />
              <FlowStep box={{
                step: "สำเร็จ", status: "✅ approved",
                role: "ระบบ", action: "ออกใบรับรอง + บันทึก",
                color: "#14532d", bg: "#dcfce7", border: "#bbf7d0",
              }} last />
            </div>
          </div>

          <NoteBox>
            <strong style={{ color: "#0038C6" }}>สิทธิ์แต่ละ Role</strong><br />
            • <strong>head</strong> — กรอกและส่งใบประเมิน (เฉพาะแผนกที่รับผิดชอบ)<br />
            • <strong>deputy</strong> — อนุมัติขั้น 2 (เฉพาะฝ่ายที่รับผิดชอบ)<br />
            • <strong>hr</strong> — สร้างใบประเมิน + รับรองขั้น 3<br />
            • <strong>deputyHR</strong> — อนุมัติขั้นสุดท้าย (ทุกฝ่าย)<br />
            • <strong>admin</strong> — ดำเนินการได้ทุกขั้นตอน ทุกฝ่าย
          </NoteBox>

          {/* Status legend */}
          <div style={{ marginTop: 20, borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>
              สถานะทั้งหมดในระบบ
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { s: "draft", c: "#92400e", bg: "#fefce8" },
                { s: "pending_deputy", c: "#5b21b6", bg: "#ede9fe" },
                { s: "pending_hr", c: "#1e40af", bg: "#dbeafe" },
                { s: "pending_final", c: "#9a3412", bg: "#fff7ed" },
                { s: "approved", c: "#14532d", bg: "#dcfce7" },
                { s: "rejected", c: "#7f1d1d", bg: "#fee2e2" },
              ].map(x => (
                <span key={x.s} style={{ background: x.bg, color: x.c, borderRadius: 7,
                  padding: "4px 12px", fontSize: 12, fontWeight: 600,
                  border: `1px solid ${x.c}33` }}>
                  {x.s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== TRANSFER ===== */}
      {tab === "transfer" && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 1px 8px rgba(0,0,0,.06)" }}>
          <SectionTitle>ระบบโอนย้ายแผนก — 3 ขั้นตอน</SectionTitle>

          <div style={{ overflowX: "auto", paddingBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 0, minWidth: 640 }}>
              <FlowStep box={{
                step: "เริ่มต้น", status: "📤 submitted",
                role: "HR", action: "สร้างคำขอโอนย้าย",
                color: "#1e3a8a", bg: "#f0f5ff", border: "#c4cfee",
              }} />
              <FlowStep box={{
                step: "ขั้นตอน 1", status: "⏳ head_approved",
                role: "หัวหน้าแผนก", action: "head_approve / reject",
                reject: true, color: "#5b21b6", bg: "#ede9fe", border: "#c4b5fd",
              }} />
              <FlowStep box={{
                step: "ขั้นตอน 2", status: "⏳ deputy_approved",
                role: "รองผอ. / รองผอ.ค่าตอบแทน", action: "deputy_approve / reject",
                reject: true, color: "#1e40af", bg: "#dbeafe", border: "#bfdbfe",
              }} />
              <FlowStep box={{
                step: "สำเร็จ", status: "✅ completed",
                role: "HR", action: "hr_approve + อัปเดตข้อมูล",
                color: "#14532d", bg: "#dcfce7", border: "#bbf7d0",
              }} last />
            </div>
          </div>

          <NoteBox>
            <strong style={{ color: "#0038C6" }}>สิทธิ์แต่ละ Role</strong><br />
            • <strong>hr</strong> — สร้างคำขอ + อนุมัติขั้นสุดท้าย (hr_approve) + อัปเดต department พนักงาน<br />
            • <strong>head</strong> — head_approve/reject (เฉพาะแผนกที่รับผิดชอบ)<br />
            • <strong>deputy / deputyHR</strong> — deputy_approve/reject (เฉพาะฝ่ายที่รับผิดชอบ)<br />
            • <strong>admin</strong> — ดำเนินการได้ทุกขั้นตอน
          </NoteBox>

          <div style={{ marginTop: 20, borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>
              สถานะทั้งหมด
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { s: "submitted", c: "#1e3a8a", bg: "#f0f5ff" },
                { s: "head_approved", c: "#5b21b6", bg: "#ede9fe" },
                { s: "deputy_approved", c: "#1e40af", bg: "#dbeafe" },
                { s: "completed", c: "#14532d", bg: "#dcfce7" },
                { s: "rejected", c: "#7f1d1d", bg: "#fee2e2" },
              ].map(x => (
                <span key={x.s} style={{ background: x.bg, color: x.c, borderRadius: 7,
                  padding: "4px 12px", fontSize: 12, fontWeight: 600,
                  border: `1px solid ${x.c}33` }}>
                  {x.s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== RECRUIT ===== */}
      {tab === "recruit" && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 1px 8px rgba(0,0,0,.06)" }}>
          <SectionTitle>ระบบสรรหาบุคลากร — Google Sheets</SectionTitle>

          <div style={{ overflowX: "auto", paddingBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 0, minWidth: 720 }}>
              <FlowStep box={{
                step: "รับใบสมัคร", status: "รอพิจารณา",
                role: "ระบบ", action: "บันทึกลง Google Sheets",
                color: "#1e3a8a", bg: "#f0f5ff", border: "#c4cfee",
              }} />
              <FlowStep box={{
                step: "ขั้นตอน 1", status: "รอนัดสัมภาษณ์",
                role: "HR / หัวหน้า", action: "พิจารณาเบื้องต้น",
                color: "#5b21b6", bg: "#ede9fe", border: "#c4b5fd",
              }} />
              <FlowStep box={{
                step: "ขั้นตอน 2", status: "รอกรอกใบสมัคร",
                role: "HR", action: "นัดสัมภาษณ์ + ใบสมัคร",
                color: "#1e40af", bg: "#dbeafe", border: "#bfdbfe",
              }} />
              <FlowStep box={{
                step: "ขั้นตอน 3", status: "ผ่านการสัมภาษณ์",
                role: "HR", action: "บันทึกผลสัมภาษณ์",
                color: "#0c4a6e", bg: "#e0f2fe", border: "#bae6fd",
              }} />
              <FlowStep box={{
                step: "ขั้นสุดท้าย", status: "รับเข้างาน / ไม่ผ่าน",
                role: "รองผอ. / admin", action: "อนุมัติผลขั้นสุดท้าย",
                color: "#14532d", bg: "#dcfce7", border: "#bbf7d0",
              }} last />
            </div>
          </div>

          <NoteBox>
            <strong style={{ color: "#0038C6" }}>สิทธิ์แต่ละ Role</strong><br />
            • <strong>hr</strong> — อัปเดตสถานะทุกขั้น ยกเว้นขั้นสุดท้าย<br />
            • <strong>head</strong> — ส่งผู้สมัครเข้าสัมภาษณ์ (เฉพาะแผนกที่รับผิดชอบ)<br />
            • <strong>deputy / deputyHR / admin</strong> — อนุมัติขั้นสุดท้าย: รับเข้างาน / ไม่ผ่าน<br />
            • <strong>หมายเหตุ</strong> — ข้อมูลเก็บใน Google Sheets ไม่ใช่ฐานข้อมูล D1
          </NoteBox>

          <div style={{ marginTop: 20, borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>
              สถานะ (ค่าใน Google Sheets)
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { s: "รอพิจารณา", c: "#1e3a8a", bg: "#f0f5ff" },
                { s: "รอนัดสัมภาษณ์", c: "#5b21b6", bg: "#ede9fe" },
                { s: "รอกรอกใบสมัคร", c: "#1e40af", bg: "#dbeafe" },
                { s: "ผ่านการสัมภาษณ์", c: "#0c4a6e", bg: "#e0f2fe" },
                { s: "รับเข้างาน", c: "#14532d", bg: "#dcfce7" },
                { s: "ไม่ผ่าน", c: "#7f1d1d", bg: "#fee2e2" },
              ].map(x => (
                <span key={x.s} style={{ background: x.bg, color: x.c, borderRadius: 7,
                  padding: "4px 12px", fontSize: 12, fontWeight: 600,
                  border: `1px solid ${x.c}33` }}>
                  {x.s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== TRAINING ===== */}
      {tab === "training" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Back-office */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 1px 8px rgba(0,0,0,.06)" }}>
            <SectionTitle>ระบบจัดการหลักสูตร (Login Required)</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "#f8faff", borderRadius: 10, padding: 16, border: "1px solid #dce4f5" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0038C6", marginBottom: 10 }}>
                  hr / admin
                </div>
                <div style={{ fontSize: 13, color: "#475569", lineHeight: 2 }}>
                  ✓ สร้าง / แก้ไขหลักสูตร<br />
                  ✓ ยกเลิกหลักสูตร (is_cancelled)<br />
                  ✓ เปิด/ปิด QR ลงทะเบียน (reg_open)<br />
                  ✓ ลงทะเบียนผู้เข้าอบรมแบบ manual<br />
                  ✓ ออกใบรับรอง (cert_id)<br />
                  ✓ อัปโหลดรูปกิจกรรม<br />
                  ✓ ดู Dashboard สรุปผล
                </div>
              </div>
              <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 16, border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", marginBottom: 10 }}>
                  head / deputy / deputyHR
                </div>
                <div style={{ fontSize: 13, color: "#475569", lineHeight: 2 }}>
                  ✓ ดูหลักสูตรและแผนอบรม<br />
                  ✓ ดูรายชื่อผู้เข้าอบรม<br />
                  ✓ ดู Dashboard สรุปผล<br />
                  ✗ ไม่สามารถสร้าง/แก้ไขหลักสูตร<br />
                  ✗ ไม่สามารถออกใบรับรอง
                </div>
              </div>
            </div>
          </div>

          {/* Public */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 1px 8px rgba(0,0,0,.06)" }}>
            <SectionTitle>ระบบ Public (ไม่ต้อง Login)</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {[
                { title: "/checkin?token=…", color: "#0038C6", bg: "#f0f5ff", items: ["สแกน QR ลงทะเบียน", "ลงทะเบียนล่วงหน้า (pre-reg)", "Auto check-in วันอบรม", "ตรวจสอบ late / on-time"] },
                { title: "/survey?token=&aid=…", color: "#16a34a", bg: "#f0fdf4", items: ["ตอบแบบสอบถามหลังอบรม", "ป้องกันตอบซ้ำ (localStorage)", "5 ข้อ + ช่องแสดงความคิดเห็น"] },
                { title: "/cert/verify", color: "#7c3aed", bg: "#faf5ff", items: ["ตรวจสอบใบรับรองการอบรม", "ค้นหาด้วย cert_id", "ไม่ต้องล็อกอิน"] },
              ].map(sec => (
                <div key={sec.title} style={{ background: sec.bg, borderRadius: 10, padding: 14, border: `1px solid ${sec.color}33` }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: sec.color, marginBottom: 10,
                    fontFamily: "monospace", background: "#fff", borderRadius: 5, padding: "3px 8px",
                    display: "inline-block" }}>
                    {sec.title}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.9 }}>
                    {sec.items.map(i => <div key={i}>✓ {i}</div>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status legend */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 8px rgba(0,0,0,.06)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>สถานะหลักสูตร</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { s: "draft", c: "#92400e", bg: "#fefce8" },
                    { s: "open", c: "#1e40af", bg: "#dbeafe" },
                    { s: "done", c: "#14532d", bg: "#dcfce7" },
                    { s: "cancelled", c: "#7f1d1d", bg: "#fee2e2" },
                  ].map(x => (
                    <span key={x.s} style={{ background: x.bg, color: x.c, borderRadius: 7,
                      padding: "4px 12px", fontSize: 12, fontWeight: 600, border: `1px solid ${x.c}33` }}>
                      {x.s}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>สถานะผู้เข้าอบรม</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { s: "registered", c: "#5b21b6", bg: "#ede9fe" },
                    { s: "checked_in", c: "#14532d", bg: "#dcfce7" },
                    { s: "late", c: "#c2410c", bg: "#fff7ed" },
                  ].map(x => (
                    <span key={x.s} style={{ background: x.bg, color: x.c, borderRadius: 7,
                      padding: "4px 12px", fontSize: 12, fontWeight: 600, border: `1px solid ${x.c}33` }}>
                      {x.s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== RBAC ===== */}
      {tab === "rbac" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 1px 8px rgba(0,0,0,.06)" }}>
            <SectionTitle>ตารางสิทธิ์ทั้งหมด (RBAC Matrix)</SectionTitle>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
                <thead>
                  <tr>
                    {["Role", "ประเมินผล", "โอนย้าย", "สรรหา", "ฝึกอบรม", "Exec Dashboard"].map(h => (
                      <th key={h} style={{ background: "#0038C6", color: "#fff", padding: "10px 14px",
                        textAlign: "left", fontWeight: 700, fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      role: "admin", roleColor: "#14532d", roleBg: "#dcfce7",
                      eval: "ทุกขั้นตอน", transfer: "ทุกขั้นตอน",
                      recruit: "ทุกสถานะ", training: "Full", exec: "✓",
                    },
                    {
                      role: "hr", roleColor: "#1e40af", roleBg: "#dbeafe",
                      eval: "สร้าง · Step 3", transfer: "สร้าง · Step 3",
                      recruit: "Step 1–3", training: "Full", exec: "✓",
                    },
                    {
                      role: "head", roleColor: "#92400e", roleBg: "#fefce8",
                      eval: "Step 1 (scope)", transfer: "Step 1 (scope)",
                      recruit: "นัดสัมภาษณ์", training: "ดูเท่านั้น", exec: "—",
                    },
                    {
                      role: "deputy", roleColor: "#5b21b6", roleBg: "#ede9fe",
                      eval: "Step 2 (scope)", transfer: "Step 2 (scope)",
                      recruit: "รับเข้า/ไม่ผ่าน", training: "ดูเท่านั้น", exec: "✓",
                    },
                    {
                      role: "deputyHR", roleColor: "#9a3412", roleBg: "#fff7ed",
                      eval: "Step 4 (final)", transfer: "Step 2 (scope)",
                      recruit: "รับเข้า/ไม่ผ่าน", training: "ดูเท่านั้น", exec: "✓",
                    },
                  ].map((row, i) => (
                    <tr key={row.role} style={{ background: i % 2 === 0 ? "#fff" : "#f8faff" }}>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid #e8eeff" }}>
                        <RoleBadge role={row.role} color={row.roleColor} bg={row.roleBg} />
                      </td>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid #e8eeff", fontSize: 12 }}>{row.eval}</td>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid #e8eeff", fontSize: 12 }}>{row.transfer}</td>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid #e8eeff", fontSize: 12 }}>{row.recruit}</td>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid #e8eeff", fontSize: 12 }}>{row.training}</td>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid #e8eeff", fontSize: 12,
                        color: row.exec === "✓" ? "#16a34a" : "#94a3b8", fontWeight: 700 }}>{row.exec}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <NoteBox>
              <strong style={{ color: "#0038C6" }}>(scope)</strong> = จำกัดตาม scope_division_id หรือ scope_department_id ที่ตั้งค่าในหน้า Admin → ผู้ใช้งาน<br />
              <strong>Step 1</strong> = หัวหน้าอนุมัติ &nbsp;|&nbsp;
              <strong>Step 2</strong> = รองผอ.อนุมัติ &nbsp;|&nbsp;
              <strong>Step 3</strong> = HR ดำเนินการ &nbsp;|&nbsp;
              <strong>Step 4</strong> = รองผอ.ค่าตอบแทนอนุมัติขั้นสุดท้าย
            </NoteBox>
          </div>

          {/* Role descriptions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { role: "admin", color: "#14532d", bg: "#f0fdf4", border: "#bbf7d0",
                desc: "ผู้ดูแลระบบ — เข้าถึงและดำเนินการได้ทุกฟีเจอร์ทุกฝ่าย ไม่มีข้อจำกัด scope" },
              { role: "hr", color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe",
                desc: "เจ้าหน้าที่ HR — จัดการพนักงาน, ฝึกอบรม, โอนย้าย, ดู Exec Dashboard" },
              { role: "head", color: "#92400e", bg: "#fffbeb", border: "#fde68a",
                desc: "หัวหน้าแผนก — ประเมินพนักงาน + อนุมัติโอนย้าย เฉพาะแผนกที่รับผิดชอบ (scope_department_id)" },
              { role: "deputy", color: "#5b21b6", bg: "#faf5ff", border: "#ddd6fe",
                desc: "รองผู้อำนวยการ — อนุมัติขั้น 2 ของประเมิน/โอนย้าย เฉพาะฝ่ายที่รับผิดชอบ (scope_division_id)" },
              { role: "deputyHR", color: "#9a3412", bg: "#fff7ed", border: "#fed7aa",
                desc: "รองผอ.ฝ่ายบริหารค่าตอบแทน — อนุมัติขั้นสุดท้ายการประเมิน + อนุมัติขั้น 2 โอนย้าย + รับสมัครงาน" },
            ].map(r => (
              <div key={r.role} style={{ background: r.bg, border: `1.5px solid ${r.border}`,
                borderRadius: 12, padding: "14px 18px" }}>
                <RoleBadge role={r.role} color={r.color} bg={r.border} />
                <div style={{ fontSize: 12.5, color: "#475569", marginTop: 8, lineHeight: 1.6 }}>
                  {r.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
