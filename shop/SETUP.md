# Shop Setup Guide

## 1. Database
Run `shop/supabase-schema.sql` in Supabase SQL Editor.

## 2. Supabase Edge Functions
Install the Supabase CLI and deploy:

```bash
npx supabase login
npx supabase link --project-ref vgipghqejzbcoighktij
npx supabase functions deploy create-razorpay-order
npx supabase functions deploy verify-payment
npx supabase functions deploy razorpay-webhook
npx supabase functions deploy send-pdf-email
```

Set secrets in Supabase Dashboard → Edge Functions:
- `RAZORPAY_KEY_ID` = your Razorpay key
- `RAZORPAY_KEY_SECRET` = your Razorpay secret
- `RAZORPAY_WEBHOOK_SECRET` = your webhook secret
- `RESEND_API_KEY` = your Resend API key
- `SITE_URL` = `https://snehaliteng.github.io`

## 3. Razorpay
1. Sign up at https://razorpay.com
2. Get API keys from Settings → API Keys
3. Configure webhook in Razorpay Dashboard → Settings → Webhooks:
   - URL: `https://vgipghqejzbcoighktij.supabase.co/functions/v1/razorpay-webhook`
   - Events: `payment.captured`
4. Update `RAZORPAY_KEY_ID` in `shop/js/shop.js` (line 6)

## 4. Resend (Email)
1. Sign up at https://resend.com
2. Verify your domain
3. Get API key from API Keys page

## 5. Frontend
All shop pages are at `/shop/`. The existing site's nav already links to `/shop/`.

## Flow
Login → Browse products → Add to cart → Cart → Razorpay checkout → Success → Email with PDF links
