# Shippr

ระบบติดตามตลาดค่าระวางเรือและเลือกสายเรือด้วย AHP สำหรับ freight forwarder

สามอย่างที่ระบบนี้ทำ

1. **ติดตามค่าระวาง** — Drewry WCI, SCFI รายสัปดาห์ และ Baltic Dry Index / BDRY รายวัน พร้อม WoW, MoM, ค่าเฉลี่ยเคลื่อนที่ และการเตือนเมื่อราคาพุ่ง
2. **เฝ้าระวังการติดขัด** — เวลารอเทียบท่าของท่าเรือ hub และข่าว disruption ที่ติด tag อัตโนมัติ (ทะเลแดง การประท้วง จุดคอขวด)
3. **ตัดสินใจเลือกสายเรือ** — Analytic Hierarchy Process เต็มรูปแบบ พร้อม decision memo ที่พิมพ์ส่งลูกค้าได้

---

## Stack

| ส่วน | ใช้อะไร |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| ฐานข้อมูล | Supabase Postgres + Prisma 7 (ผ่าน `@prisma/adapter-pg`) |
| Auth | เขียนเอง — username + password (scrypt จาก `node:crypto`) + session เก็บใน DB |
| กราฟ | Recharts สำหรับ radar, inline SVG สำหรับ sparkline |
| ดึงข้อมูล | axios + cheerio, rss-parser, yahoo-finance2 |
| ตั้งเวลา | Vercel Cron |
| Test | Vitest |

---

## ติดตั้ง

### 1. ติดตั้ง dependency

```bash
npm install
```

### 2. ตั้งค่า `.env`

คัดลอกจาก `.env.example` แล้วเติมค่าจาก Supabase

| ตัวแปร | เอามาจากไหน |
| --- | --- |
| `DATABASE_URL` | Supabase → Connect → **Transaction pooler** (พอร์ต 6543) |
| `DIRECT_URL` | Supabase → Connect → **Session pooler** (พอร์ต 5432) |
| `CRON_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

ทำไมต้องมีสองเส้น: migration รัน DDL ซึ่งผ่าน pgbouncer ไม่ได้ จึงต้องใช้ direct
connection ส่วนตัวแอปตอนรันใช้ pooler เพื่อไม่ให้ connection หมด

> ใช้ Session pooler เป็นค่าเริ่มต้นเพราะ direct connection (`db.<ref>.supabase.co`)
> เป็น IPv6 อย่างเดียว เครือข่ายที่ไม่มี IPv6 จะได้ error P1001
>
> รหัสผ่านที่มีอักขระสงวนของ URL เช่น `#` ต้อง encode ก่อน ไม่งั้นทุกอย่างหลังอักขระนั้นจะหายไป
> `node -e "console.log(encodeURIComponent('รหัสผ่าน'))"`

### 3. สร้างตารางและ seed

```bash
npm run db:migrate        # สร้างตารางตาม schema
npm run db:seed           # seed ท่าเรือ hub 6 แห่ง
npm run db:seed -- --demo # เพิ่มข้อมูลตัวอย่าง 26 สัปดาห์ สำหรับดู UI ก่อนมีข้อมูลจริง
```

### 4. สร้างบัญชีผู้ดูแลคนแรก

ระบบไม่มีการสมัครเอง บัญชีแรกต้องสร้างจาก CLI ไม่งั้นจะไม่มีใครเข้าหลังบ้านได้เลย

```bash
npm run user create napat ADMIN
```

คำสั่งจะถามรหัสผ่านแบบไม่แสดงบนหน้าจอ (ไม่รับรหัสผ่านเป็น argument เพราะจะไปค้างใน shell history และใน process list)

ข้อมูลตัวอย่างบันทึกเป็น `source=MANUAL` พร้อมหมายเหตุกำกับ ลบออกก่อนใช้งานจริงได้ง่าย

### 5. รัน

```bash
npm run dev
```

---

## คำสั่งที่ใช้บ่อย

```bash
npm run dev          # รัน dev server
npm run build        # build production
npm test             # รัน test ทั้งหมด
npm run typecheck    # ตรวจ type
npm run db:studio    # เปิด Prisma Studio ดูข้อมูล
npm run db:migrate   # สร้าง migration ใหม่หลังแก้ schema
```

---

## งานที่รันตามเวลา

ตั้งไว้ใน `vercel.json` ทุก route ต้องส่ง `Authorization: Bearer $CRON_SECRET`

| Route | ตาราง | ทำอะไร |
| --- | --- | --- |
| `/api/cron/freight-index` | ศุกร์ 10:00 UTC | Scrape Drewry WCI และ SCFI |
| `/api/cron/market-sentiment` | ทุกวัน 06:00 UTC | ดึง BDI และ BDRY จาก Yahoo Finance |
| `/api/cron/news` | ทุกวัน 07:00 UTC | อ่าน RSS จาก Loadstar และ gCaptain |

### ข่าวทุก 4 ชั่วโมงบน Vercel Hobby

Vercel แพ็กเกจ Hobby จำกัด cron ไว้ที่วันละครั้ง ซึ่งช้าเกินไปสำหรับเรดาร์เตือนภัย —
ข่าวทะเลแดงที่ประกาศตอนบ่ายไม่ควรเพิ่งขึ้นหน้าจอตอนเช้าวันถัดไป

`.github/workflows/ingest-news.yml` จึงยิง endpoint เดิมทุก 4 ชั่วโมงจาก GitHub Actions
ซึ่งไม่มีข้อจำกัดนี้และไม่มีค่าใช้จ่าย เปิดใช้โดยตั้ง repository secret สองตัวที่
Settings → Secrets and variables → Actions

| Secret | ค่า |
| --- | --- |
| `APP_URL` | URL ของ deployment เช่น `https://shippr.vercel.app` ไม่ต้องมี `/` ท้าย |
| `CRON_SECRET` | ค่าเดียวกับที่ตั้งใน Vercel environment |

เมื่อเปิด workflow นี้แล้ว **ให้ลบรายการ `/api/cron/news` ออกจาก `vercel.json`**
ไม่อย่างนั้นจะรันซ้อนกันวันละครั้ง (ไม่ทำให้ข้อมูลซ้ำ เพราะเป็น upsert แต่ทำให้ run log อ่านยาก)

ถ้าอัปเกรดเป็น Pro แล้ว ใช้ cron ของ Vercel อย่างเดียวได้ โดยเปลี่ยน schedule
ของ news กลับเป็น `0 */4 * * *` แล้วปิด workflow

ยิงเองเพื่อทดสอบ

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/news
```

รันซ้ำได้ไม่เกิดข้อมูลซ้ำ ทุกการเขียนเป็น upsert บน natural key

---

## เรื่องที่ควรรู้ก่อนแก้โค้ด

### ข้อมูลที่ดึงอัตโนมัติไม่ได้ ไม่ใช่บั๊ก

Drewry แสดง WCI เป็นกราฟ ไม่มีตาราง HTML และ Shanghai Shipping Exchange บล็อกบอท
scraper จึงเปราะโดยธรรมชาติ **หน้ากรอกมือคือทางหลักของดัชนีเหล่านี้ ไม่ใช่ทางสำรอง**

เมื่อ scraper ล้มเหลว ระบบจะ **ไม่เขียนอะไรเลย** และบันทึกไว้ใน `ScrapeRun`
หน้า dashboard จะขึ้นว่าข้อมูลค้าง เพราะการกินข้อมูลผิดเข้า benchmark ที่คนเอาไปตั้งราคา
แย่กว่าการไม่มีข้อมูล — ช่องว่างมองเห็นได้ แต่ตัวเลขผิดมองไม่เห็น

ทุก adapter validate ตัวเองด้วย Zod ก่อน return ค่าที่หลุดช่วงที่เป็นไปได้
(WCI 200–20,000 USD/FEU, SCFI 200–6,000 points) ถือเป็นความล้มเหลวในการ parse

เวลา Drewry เปลี่ยนหน้าเว็บ แก้ที่ `src/lib/scraper-config.ts` ที่เดียว

### เวลารอเทียบท่าไม่มี API ฟรีที่เชื่อถือได้

ข้อมูลส่วนนี้มาจากการกรอกมือหรือ import CSV รายสัปดาห์ที่ `/admin/ports`
ท่าเรือที่ยังไม่มีข้อมูลจะยังแสดงอยู่ในตาราง เพราะถ้าซ่อนไป คนที่กวาดตามองจะอ่านว่า
"ท่านี้ไม่แออัด"

### AHP คำนวณสองที่ แต่เชื่อที่เดียว

`src/lib/ahp.ts` เป็น pure function ที่รันทั้งบน browser (คำนวณสดตอนเลื่อน slider)
และบน server (ตอนบันทึก) **ผลที่บันทึกลงฐานข้อมูลคำนวณใหม่ที่ server เสมอ**
ถ้ารับผลจาก client มาเก็บ decision log จะใช้เป็นหลักฐานอ้างอิงไม่ได้

คะแนนสายเรือใช้ ideal-mode normalization จากตัวเลขในใบเสนอราคาจริง ไม่ใช่ pairwise matrix
อีก 5 ชุด เพราะนั่นจะกลายเป็นอีก 50 คำถามที่ไม่มีใครกรอกจบ และตัวเลขที่กรอก
(USD, วัน, on-time %) อยู่บน ratio scale จริงอยู่แล้ว

### `benchmarkSnapshot` ถูก freeze ไว้โดยตั้งใจ

decision memo ที่ลูกค้าเปิดอ่านอีก 6 สัปดาห์ต้องบอกว่าตลาด **ณ วันที่ตัดสินใจ** เป็นอย่างไร
ถ้าคำนวณสดจาก `FreightIndex` ทุกครั้ง ประวัติการตัดสินใจจะถูกเขียนทับเงียบๆ

### ทำไมถึงเขียน auth เอง

คำเตือน "อย่าเขียน auth เอง" หมายถึงส่วนที่พลาดง่ายและพลาดแล้วเจ็บ — OAuth,
การยืนยันอีเมล, ลิงก์รีเซ็ตรหัสผ่าน, การกู้บัญชี ซึ่งโปรเจกต์นี้ไม่มีสักอย่าง
ทีมมีไม่กี่คน admin สร้างบัญชีให้ ไม่มีสมัครเอง เหลือแค่ตรวจรหัสผ่านแล้วออก session

ที่ยึดไว้:

- **scrypt จาก `node:crypto`** พารามิเตอร์ตามเกณฑ์ OWASP (N=2^14) เก็บพารามิเตอร์ไว้ในสตริงแฮช
  เพื่อขึ้น cost ภายหลังได้โดยไม่ต้องให้ทุกคนตั้งรหัสใหม่ ไม่ต้องลง dependency และไม่มีปัญหา native build
- **ตอบช้าเท่ากัน** กรณีไม่มี username กับกรณีรหัสผิด ไม่งั้นเวลาตอบจะบอกได้ว่าชื่อไหนมีอยู่จริง
- **เก็บแค่ SHA-256 ของ session token** ใน DB ถ้าฐานข้อมูลหลุด token ที่หลุดไปใช้ต่อไม่ได้
- **session เป็นแถวในตาราง ไม่ใช่ JWT ที่เราเซ็นเอง** เพราะต้องเพิกถอนได้จริง
  เปลี่ยนรหัสผ่านเมื่อไหร่ session เก่าถูกลบทั้งหมด
- **ผิดเกิน 5 ครั้งล็อก 15 นาที** นับรายบัญชี

**ไม่มีรีเซ็ตรหัสผ่านด้วยตัวเอง** ลืมรหัสต้องให้ admin สั่ง
`npm run user passwd <ชื่อผู้ใช้>` นี่คือข้อแลกเปลี่ยนที่รับไว้โดยตั้งใจ
เพื่อไม่ต้องมีระบบส่งอีเมลและ reset token ซึ่งเป็นส่วนที่เขียนพลาดง่ายที่สุดของงาน auth

### ค่าระวางที่ขึ้นคือสัญญาณเตือน ไม่ใช่สัญญาณดี

สีในหน้า index card กลับทางกับกระดานหุ้น — ราคาขึ้นคือต้นทุนของ forwarder เพิ่ม

---

## โครงสร้าง

```
prisma/
  schema.prisma          โมเดลทั้งหมด
  seed.ts                seed ท่าเรือ + ข้อมูลตัวอย่าง (--demo)
src/
  app/
    page.tsx             dashboard
    decisions/           รายการ รายละเอียด และ memo สำหรับพิมพ์
    admin/               กรอกค่าดัชนีและสถานะท่าเรือ
    api/                 cron, AHP, export, CRUD
  components/
    ahp/                 matrix, slider, ranking, radar, consistency
    market/ ports/ news/ ส่วนของ dashboard
  lib/
    ahp.ts               ★ เครื่องคำนวณ AHP (pure, มี test ครบ)
    ahp-presets.ts       preset ตามประเภทสินค้า ทุกตัวมี test ว่า CR < 0.1
    cost.ts              แปลงใบเสนอราคาเป็นเกณฑ์ AHP
    metrics.ts           WoW / MoM / moving average / spike
    benchmark.ts         เทียบราคากับตลาด
    scraper.ts           adapter + Zod validation
    scraper-config.ts    URL และ selector ทั้งหมดอยู่ที่นี่
docs/
  design-notes.md        ทิศทางการออกแบบและเหตุผล
```

---

## Deploy ขึ้น Vercel

1. ต่อ repo กับ Vercel
2. ใส่ environment variable ให้ครบตามตารางข้างบน รวม `CRON_SECRET`
3. ตั้ง build command เป็น `prisma generate && next build` หรือเพิ่ม `postinstall` script
4. รัน `npm run db:deploy` กับฐานข้อมูล production
5. Cron ใน `vercel.json` จะเริ่มทำงานเอง (ต้องใช้แพ็กเกจที่รองรับ cron)
