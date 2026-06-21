# ระบบบริหารทรัพยากรบุคคล · รพ.เชียงราย ราม

ระบบ HR 5 ระบบ (recruit / eval / training / transfer / exec) — แปลงจาก design prototype เป็นระบบใช้งานจริง

## Stack
- **Frontend:** React 18 + Vite 5 (SPA) → Cloudflare Pages
- **API:** Cloudflare Pages Functions (TypeScript) — `functions/api/*`
- **DB:** Cloudflare D1 (`HR_DB`, ใหม่ แยกจาก CRR Asset) — eval / training / transfer / exec
- **recruit:** Google Sheets API (live) — ไม่ลง D1

## โครงสร้าง
```
functions/api/      Pages Functions (REST API)
functions/lib/      shared (Env types, auth, db helpers)
migrations/         D1 schema + seed (SQLite)
src/                React app
scripts/            dev tools (validate_sql.py)
docs/PLAN.md        แผนสถาปัตยกรรมเต็ม
```

## คำสั่ง
```bash
npm install --ignore-scripts   # ติดตั้ง deps (เครื่องที่บล็อก native postinstall)
npm run typecheck              # ตรวจ TypeScript (app + functions)
python scripts/validate_sql.py # ตรวจ migrations ด้วย sqlite3
npm run build                  # build (ทำใน Cloudflare CI — เครื่อง local อาจรันไม่ได้)
```

> ⚠️ เครื่องพัฒนาเปิด Smart App Control → build/run native (vite, wrangler) ในเครื่องไม่ได้
> ใช้ cloud-build: push GitHub → Cloudflare Pages build/deploy. ดู [docs/DEPLOY.md](docs/DEPLOY.md)
