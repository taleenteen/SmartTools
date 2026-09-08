# Deploy ค้าง — ส่งต่อให้คนถัดไป

**สถานะ:** Git build ของ Worker `smart-tools` **ยังไม่ผ่าน**  
**หยุดแก้แล้ว** ตั้งแต่วันที่ 2026-09-08 (เวลาไทย) เพราะโควต้า build ใกล้หมด  
**อย่ากด Retry** ของ deployment ที่ fail และอย่า push ขึ้น `main` จนกว่าจะมีแพตช์ที่ตั้งใจแล้ว

Commit ล่าสุดบน `origin/main` ตอนเขียนเอกสารนี้: `373148b`  
(`fix: drop SPA _redirects that Workers reject as infinite loops`)

---

## จุดที่ค้างตอนนี้ (ต้องแก้ก่อน deploy จะผ่าน)

Build **ผ่าน** แล้ว (`bun run pages:build` บน CI สำเร็จ)  
ล้มที่ **ขั้น upload Worker version**

```
✘ [ERROR] A request to the Cloudflare API
  (/accounts/a4cd99cdfe4ec7b1b352413e4ca230c0/workers/scripts/smart-tools/versions)
  failed.

  Can't set compatibility date in the future: 2026-09-08
   [code: 10021]
```

Log บน CI: `wrangler-2026-09-07_19-52-50_141.log`  
เวลาในแดชบอร์ดไทยคือ `02:52:52` ของวันที่ 8 แต่ไฟล์ log ของ wrangler เป็น **2026-09-07 19:52 UTC**

### สาเหตุ

Cloudflare **ห้าม** ตั้ง `compatibility_date` เป็นวันในอนาคต และนับวันที่เป็น **UTC**

- [Compatibility dates](https://developers.cloudflare.com/workers/configuration/compatibility-dates/) — ตั้งเป็นวันที่ปัจจุบัน (ของ Cloudflare) ไม่ใช่ของ timezone ผู้พัฒนา
- [Validation errors 10021](https://developers.cloudflare.com/workers/observability/errors/#validation-errors-10021)
- [workers-sdk#5453](https://github.com/cloudflare/workers-sdk/issues/5453) — เคสเดียวกัน: หลังเที่ยงคืนตามเวลาท้องถิ่น แต่ UTC ยังเป็นวันก่อนหน้า → API บอกว่าวันที่ “อนาคต”
- [Cloudflare blog](https://blog.cloudflare.com/backwards-compatibility-in-cloudflare-workers/) — compatibility date **must be a date in the past**

ใน repo ตอนนี้วันที่ถูกฮาร์ดโค้ดเป็น `2026-09-08` สองที่:

| ไฟล์ | บรรทัด |
|---|---|
| `wrangler.toml` | `compatibility_date = "2026-09-07"` |
| `scripts/pages-build.ts` | `--compatibility-date`, `'2026-09-07'` |

**แพตช์ที่ทำแล้ว:** ปรับทั้งสองที่ให้เป็นวันที่ UTC ในอดีต (`2026-09-07`) เพื่อแก้ Error 10021 เรียบร้อยแล้ว

อย่าตั้งเป็น “วันนี้ตามเวลาไทย” อีก

---

## สิ่งที่แก้ไปแล้วในรอบนี้ — อย่าย้อน

ลำดับ error จริงบน CI (ใหม่สุดอยู่ล่าง):

| อาการ | สาเหตุจริง | สิ่งที่ทำแล้ว |
|---|---|---|
| `Missing entry-point to Worker script` ตอน `wrangler deploy` | โปรเจกต์บนแดชบอร์ดชุดใหม่เป็น **Worker + static assets** ไม่ใช่ Pages แบบเก่า | `wrangler.toml` มี `name`, `main`, `[assets]` |
| Authentication error **10000** ตอน `wrangler pages deploy` | คำสั่งผิดผลิตภัณฑ์ — ยิง Pages API ทั้งที่เป็น Worker | Deploy command ต้องเป็น `npx wrangler deploy` **ห้าม** `wrangler pages deploy` |
| `Could not find anything to build` จาก `functions/` ใต้ `web/` | `pages:build` รัน wrangler จาก cwd `web/` โดยไม่ส่ง path ของ `functions/` | `scripts/pages-build.ts` ส่ง `join(root,'functions')` และ `--build-output-directory dist` |
| `_redirects` Line 14 infinite loop **100324** | กฎ `/* /index.html 200` ชน `html_handling` ที่ strip `.html`/`/index` แล้ววน splat | ลบ catch-all และกฎที่ชี้ไป `/index.html` แล้ว เหลือแค่ `/@:slug /u/:slug 200` — SPA ใช้ `[assets] not_found_handling = "single-page-application"` |

หลักฐานของ 100324:

- [Workers SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [html_handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)
- [Walshy: ลบ `/* /index.html 200`](https://community.cloudflare.com/t/308-redirect-loop/501165)
- [developer-platform#14](https://github.com/cloudflare/developer-platform/issues/14) — error เดียวกันบน `wrangler deploy`

**ห้ามใส่ `/* /index.html 200` กลับเข้า `_redirects`**

---

## สถาปัตยกรรมที่ต้องรู้ก่อนแตะ deploy

แดชบอร์ดชุดใหม่เชื่อม Git แล้วรัน **Worker** ชื่อ `smart-tools` ไม่ใช่ Cloudflare Pages แบบคลาสสิก

| ช่องในแดชบอร์ด | ค่าที่ใช้อยู่ |
|---|---|
| Build command | `bun run pages:build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | ว่าง (ราก repo) |
| Worker name | `smart-tools` |

`bun run pages:build` (`scripts/pages-build.ts`) ทำอะไร:

1. build Vue ที่ `web/` → คัดลอกไป `dist/`
2. คัดลอกไฟล์ static (`config.html`, `about.html`, `data.js`, `tools/`, `_redirects`, …) เข้า `dist/`
3. `wrangler pages functions build <repo>/functions --outdir worker-build --build-output-directory dist`
4. จากนั้น CI เรียก `npx wrangler deploy` อ่าน `wrangler.toml`

`wrangler.toml` ที่ตั้งใจไว้:

```toml
name = "smart-tools"
main = "./worker-build/index.js"
compatibility_date = "2026-09-07"

[assets]
directory = "./dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*", "/u/*"]
```

KV binding ที่แอปต้องการ: **`FAV_KV`**  
Secrets: `ADMIN_USER`, `ADMIN_PASS`, `AUTH_SECRET`  
วิธีผูกอยู่ใน `USAGE.md`

Worker ที่เคยขึ้นสำเร็จรอบหนึ่ง **ยังไม่มีโดเมน** (ไม่มี `*.workers.dev` / custom domain) — ต้องผูกหลัง deploy ผ่าน

---

## สิ่งที่ยังไม่ตรวจหลังจุดนี้

ยังไม่ได้ยืนยันบน production เพราะ upload version ล้ม:

- `/` `/t` `/settings` ได้ Vue shell หรือไม่
- `/api/*` และ `/u/*` เข้า Functions หรือไม่
- `/@slug` rewrite ใน `_redirects` ทำงานกับ `run_worker_first` หรือไม่
- ไฟล์จริง `config.html` `about.html` `tools/*.html` ยังเสิร์ฟเป็น static หรือไม่
- workers.dev / custom domain
- KV + secrets หลัง deploy ผ่าน

อย่าสมมติว่า “build เขียว = เว็บใช้ได้”

---

## ข้อห้ามตอนแก้ต่อ

- อย่าสลับกลับไป `wrangler pages deploy`
- อย่าใส่ SPA catch-all ใน `_redirects`
- อย่าเดาผลิตภัณฑ์จากชื่อเมนูเก่า “Workers & Pages”
- อย่า Retry deployment ที่ fail เพื่อประหยัดโควต้า — push แพตช์ใหม่รอบเดียว
- อย่า Vue-ify `tools/*.html` หรือเพิ่มฟีเจอร์ใน `config.html` (rollback เท่านั้น)
