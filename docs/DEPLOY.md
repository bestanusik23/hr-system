# การ Deploy (Cloud-build ผ่าน Git)

เครื่องพัฒนาเปิด Smart App Control → build/run ในเครื่องไม่ได้ จึงให้ Cloudflare build/deploy ในคลาวด์
ขั้นตอนด้านล่าง **ส่วนที่ต้องใช้บัญชีของคุณ** (GitHub + Cloudflare) — ผมทำแทนไม่ได้ ต้องคุณกดเอง

---

## A. ดันโค้ดขึ้น Git (ทำครั้งแรกครั้งเดียว)
repo `hr-system/` ถูก `git init` + commit แรกไว้ให้แล้ว เหลือผูก remote:

1. สร้าง repo ใหม่ (private) บน GitHub หรือ GitLab เช่น `hr-system` (ปล่อยว่าง ไม่ต้องมี README)
2. ในโฟลเดอร์ `hr-system`:
   ```bash
   git remote add origin https://github.com/<คุณ>/hr-system.git
   git branch -M main
   git push -u origin main
   ```
   *(การ push ต้องใช้ login GitHub ของคุณ — ผมทำให้ไม่ได้)*

---

## B. สร้าง D1 database (ใหม่ แยกจาก CRR Asset)
ใช้ Cloudflare Dashboard (ไม่ต้องมี wrangler ในเครื่อง):

1. Dashboard → **Workers & Pages → D1 → Create database** → ชื่อ `hr-system` → Create
2. คัดลอก **Database ID** ที่ได้
3. เปิดไฟล์ `wrangler.toml` แก้ `database_id = "REPLACE_WITH_D1_DATABASE_ID"` เป็น ID จริง แล้ว commit + push
4. รัน schema: D1 → `hr-system` → แท็บ **Console** →
   - วางเนื้อหาทั้งไฟล์ `migrations/0001_init.sql` → Run
   - วางเนื้อหาทั้งไฟล์ `migrations/0002_seed.sql` → Run
   *(หรือถ้าใช้ wrangler ในเครื่องที่ไม่ถูกบล็อกได้: `npx wrangler d1 migrations apply HR_DB --remote`)*

---

## C. สร้าง Pages project (ผูกกับ Git)
1. Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → เลือก repo `hr-system`
2. **Build settings:**
   - Framework preset: `None`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
   - Environment variable: `NODE_VERSION` = `20`
3. **ผูก D1 binding:** Pages project → **Settings → Functions → D1 database bindings** →
   - Variable name: `HR_DB`  →  Database: `hr-system`
   - เพิ่มทั้ง **Production** และ **Preview**
4. **Environment variables** (Settings → Environment variables) เพิ่ม:
   - `SHEET_APPLICATIONS` = `16fm5iBMg0pwTs23MUDhlibyQXhcZ42Uhit-ALVFNzoc`
   - `SHEET_MANPOWER` = `1B-xB-vr8lDsi8F60vbw23q0YkcHWXRPjEWwZUb7kgLA`
   - *(secrets เช่น `SESSION_SECRET`, `GOOGLE_SA_*` เพิ่มเป็น Secret ทีหลังตอนทำ auth/recruit)*
5. Deploy: push ขึ้น main → build อัตโนมัติ (หรือกด Retry deployment)

---

## D. ตรวจว่าใช้ได้
เปิด URL ที่ deploy → หน้า Home ต้องโชว์ 5 การ์ด และแถบล่างต้องขึ้น:
> · เชื่อมต่อ D1 สำเร็จ — ฝ่าย 11 · หัวข้อประเมิน 10

- ถ้าขึ้น "ยังเชื่อมต่อ D1 ไม่ได้" → ยังไม่ได้ผูก binding `HR_DB` (ข้อ C3) หรือยังไม่ได้รัน migration (ข้อ B4)
- เรียก `/<url>/api/health` ตรง ๆ เพื่อดู JSON ก็ได้

> หลังจาก foundation ผ่าน ผมจะสร้าง auth + ทีละระบบ push เพิ่ม — แต่ละ push จะได้ Preview URL ให้ทดสอบทีละระบบ
