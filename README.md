# BD Quote Tool (SaaS)

Báo giá phần mềm cho cá nhân và công ty: quotes, slideshow, Excel/PDF/DOCX, AI brief, billing SePay.

Một account = một role = một workspace (hoặc một platform role). Một portal `/app`.

## Stack

- Next.js 16 + TypeScript + Mantine
- Supabase (Auth, Postgres + RLS, Storage)
- Vercel (app + cron)
- SePay VietQR webhook + Payment Gateway IPN

## Local

1. Copy `.env.example` → `.env.local` (URL/key Supabase đã có trong `.env.example` mẫu).
2. Thêm `SUPABASE_SERVICE_ROLE_KEY` từ Supabase dashboard (cần cho webhook SePay, cron, bootstrap platform admin).
3. `npm install && npm run dev`

Project Supabase: `bd-tool` (`ap-southeast-1`), ref `eewoirdimfpfborwdbzx`. Schema trong `supabase/migrations/`.

## Bootstrap platform admin

Đặt `PLATFORM_BOOTSTRAP_EMAIL` trùng email bạn đăng ký đầu tiên (khi bảng `platform_admins` còn trống) và có service role key. Hoặc mời từ `/app/platform/plans`.

CSJ Tek: tạo workspace company tên CJTEK khi onboarding (settings mặc định lấy từ `src/lib/default-data.ts`). Dùng email BD riêng; email ops cho platform.

## Env

Xem `.env.example`. SePay: `SEPAY_BANK_ACCOUNT`, `SEPAY_BANK_NAME`, `SEPAY_WEBHOOK_SECRET`, Gateway `SEPAY_MERCHANT_ID` / `SEPAY_SECRET_KEY`.

Webhook: `POST /api/billing/sepay/webhook`
Cron: `GET /api/billing/cron` (Vercel `0 2 * * *`, header `Authorization: Bearer $CRON_SECRET`)

## Auth

- `/signup` → Owner + workspace personal|company
- Invite team: Admin/Member (company)
- Platform invite: super_admin/support
- Google OAuth: bật provider trên Supabase Auth
