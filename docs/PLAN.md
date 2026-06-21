# แผนแปลง Prototype → ระบบใช้งานจริง (DRAFT — รอตรวจก่อนเริ่มเขียนโค้ด)

รพ.เชียงราย ราม · ระบบบริหารทรัพยากรบุคคล · 5 ระบบ

---

## 1. สถาปัตยกรรมรวม

```
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Pages (frontend SPA — คงดีไซน์เดิมจาก prototype)  │
│   เรียก API ภายใต้ /api/*                                     │
└───────────────┬─────────────────────────────────────────────┘
                │
        ┌───────▼─────────┐      4 ระบบ → D1
        │ Pages Functions │──────────────────────► Cloudflare D1 (ใหม่, แยกจาก CRR Asset)
        │  (/functions/api)│      eval, training, transfer, exec
        └───────┬─────────┘
                │ recruit → live
                └──────────────────────────────► Google Sheets API
                                                 (SHEET_APPLICATIONS, SHEET_MANPOWER)
```

- **Frontend:** ✅ rebuild หน้าจอเดิมเป็น SPA จริง (React + Vite) โดย **คงหน้าตา/สี/ฟอนต์เดิมทุกประการ** เลิกใช้ dc-runtime ที่โหลด React/Babel จาก unpkg ตอน runtime, deploy บน Cloudflare Pages
- **Backend:** Cloudflare Pages Functions (TypeScript) ผูก D1 binding ชื่อ `HR_DB` (คนละ instance กับ CRR Asset)
- **Auth:** session cookie (httpOnly) + ตาราง `sessions`, รหัสผ่าน hash ด้วย PBKDF2-SHA256 (Web Crypto — ใช้ได้บน Workers), RBAC ตรวจฝั่ง server ทุก endpoint
- **Source of truth:** D1 สำหรับ 4 ระบบ · Google Sheets สำหรับ recruit (สดทั้งอ่าน/เขียน)

---

## 2. การแบ่งแหล่งข้อมูล

| ระบบ | แหล่งข้อมูล | หมายเหตุ |
|---|---|---|
| eval (ประเมินผล) | **D1** | workflow head→deputy เก็บ state จริง |
| training (ฝึกอบรม) | **D1** | คอร์ส + ผู้เข้าอบรม |
| transfer (ย้ายแผนก) | **D1** | workflow 3 ขั้น |
| exec (dashboard) | **D1 + Sheets** | อ่าน/รวมผลอย่างเดียว ไม่มีตารางของตัวเอง |
| **recruit (สรรหา)** | **Google Sheets (live)** | ไม่ลง D1 — อ่าน/เขียนสดผ่าน Sheets API |

---

## 3. Google Sheets API — สิ่งที่คุณต้องตั้งค่าเอง (ส่วนขอสิทธิ์)

ระบบ recruit จะอ่าน/เขียนสดผ่าน **Service Account** (ไม่ต้อง OAuth ผู้ใช้). ขั้นตอนที่คุณต้องทำใน Google Cloud:

1. **สร้าง/เลือกโปรเจกต์** ใน [Google Cloud Console](https://console.cloud.google.com)
2. **เปิดใช้ Google Sheets API** (APIs & Services → Library → "Google Sheets API" → Enable)
3. **สร้าง Service Account** (IAM & Admin → Service Accounts → Create) → ตั้งชื่อ เช่น `hr-recruit-bot`
4. **สร้าง Key แบบ JSON** (เลือก service account → Keys → Add Key → JSON) — จะได้ไฟล์ `.json` มี `client_email` กับ `private_key`
5. **แชร์ Google Sheets ทั้ง 2 ไฟล์** ให้อีเมล service account (รูปแบบ `xxx@yyy.iam.gserviceaccount.com`) สิทธิ์ **Editor**
   - SHEET_APPLICATIONS: `16fm5iBMg0pwTs23MUDhlibyQXhcZ42Uhit-ALVFNzoc`
   - SHEET_MANPOWER: `1B-xB-vr8lDsi8F60vbw23q0YkcHWXRPjEWwZUb7kgLA`
6. **ส่งค่าให้ผมตั้งเป็น Cloudflare secret** (ผมจะใส่ผ่าน `wrangler secret put`, ไม่ commit ลง repo):
   - `GOOGLE_SA_EMAIL` = client_email
   - `GOOGLE_SA_PRIVATE_KEY` = private_key (ทั้งก้อน รวม `-----BEGIN PRIVATE KEY-----`)
   - sheet IDs ทั้งสอง (ใส่ใน config ได้, ไม่ลับ)

> ฝั่งโค้ด: Worker จะ mint JWT (RS256) เซ็นด้วย private_key ผ่าน Web Crypto → แลกเป็น access token (scope `spreadsheets`) → เรียก `spreadsheets.values` อ่าน/เขียน. **ผมต้องรู้โครงคอลัมน์จริงของชีททั้งสอง** (แถวหัวตาราง = field อะไรบ้าง) — ขอ screenshot หรือสิทธิ์ดูชีท ตอนเริ่มทำ recruit

---

## 4. RBAC — บทบาท & สิทธิ์ (อิง roleMatrix ในดีไซน์)

5 บทบาท (ตรงกับดีไซน์เดิมเป๊ะ): `hr` · `head` · `deputy` · `deputyHR` · `admin`
- **deputyHR** = role แยกของตัวเอง (รองผอ.ฝ่ายบริหารค่าตอบแทนฯ ผู้อนุมัติขั้นสุดท้าย) — ตรรกะ "ปิด workflow ขั้นสุดท้าย" อยู่ใน API
- **ยังไม่มีบทบาท employee (พนักงาน)** ในเฟสนี้ (ตัดสินใจเลื่อนออกไป)

ตาราง seed `role_module_access` (access: full / scope / approve / view / submit / none) — ดู `db/seed.sql`:

| role | recruit | eval | training | transfer | exec | permissions |
|---|---|---|---|---|---|---|
| hr | full | full | full | full | full | none |
| head | scope | scope | view | submit | none | none |
| deputy | scope | approve | view | approve | full | none |
| deputyHR | view | approve | view | approve* | full | none |
| admin | full | full | full | full | full | full |

> `scope` = เห็นเฉพาะฝ่าย/แผนกของตน (ใช้ `scope_division_id` / `scope_department_id`)
> `approve*` ของ deputyHR = สิทธิ์อนุมัติ **ขั้นสุดท้าย (HR)** ใน workflow ย้ายแผนก

---

## 5. ลำดับลงมือ (ทำพร้อมกัน แต่ทดสอบทีละระบบ)

> Deploy พร้อมกันทั้งหมด แต่ปิดทดสอบ (smoke test) ทีละระบบก่อนไปต่อ เพื่อจับปัญหาเร็ว

0. **Infra:** สร้าง D1 ใหม่ + `wrangler.toml` + รัน `schema.sql` + seed (org 12 ฝ่าย, eval_topics 10 ข้อ, role matrix, ผู้ใช้ตั้งต้น)
1. **Auth + RBAC** (ฐานของทุกระบบ) → ทดสอบ login จริง 5 บทบาท + การกรองเมนู
2. **eval** → ทดสอบ workflow ประเมิน head→deputy ครบวงจร
3. **transfer** → ทดสอบ workflow 3 ขั้น
4. **training** → ทดสอบ CRUD คอร์ส/ผู้เข้าอบรม + dashboard
5. **recruit (Sheets)** → ทดสอบอ่าน/เขียนชีทจริง (ต้องมี credential จากข้อ 3)
6. **exec** → ทดสอบ KPI รวม (D1 + Sheets)
7. **Migrate ข้อมูลตั้งต้น** จาก mock/ชีท เข้า D1 (employees, courses, ฯลฯ)

---

## 6. การตัดสินใจที่ยืนยันแล้ว ✅

1. **Frontend:** rebuild เป็น React+Vite SPA คงดีไซน์เดิม (เลิก dc-runtime)
2. **บทบาท:** 5 ตัว `hr/head/deputy/deputyHR/admin` — **ยังไม่เพิ่ม employee** ในเฟสนี้
3. **deputyHR:** เป็น role แยกของตัวเอง

*(ยังไม่เขียนโค้ดแอป/API — `docs/PLAN.md` + `db/schema.sql` + `db/seed.sql` คือสิ่งที่ขอให้ตรวจก่อน)*
