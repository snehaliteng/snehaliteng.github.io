# Shop Setup Guide

## 1. Database
Run `shop/supabase-schema.sql` in Supabase SQL Editor.

## 2. Edge Functions (deployed)
The following functions are already deployed:

| Function | Purpose |
|---|---|
| `create-order` | Creates order from cart, clears cart (uses service_role) |
| `send-pdf-email` | Sends email with PDF links (requires Resend API key) |

### Set secrets in Supabase Dashboard → Edge Functions:
- `RESEND_API_KEY` = your Resend API key (for email delivery)
- `SITE_URL` = `https://snehaliteng.github.io`

Other deployed functions (`create-razorpay-order`, `verify-payment`, `razorpay-webhook`) are reserved for future Razorpay integration.

## 3. Payment Methods (currently active)

### UPI (GPay / PhonePe / Paytm)
- UPI ID: `snehaliteng@okaxis`
- Phone: `+919974031480`
- User pays via any UPI app and enters the transaction ID

### Net Banking / NEFT / IMPS
- **Update `shop/cart.html`** — replace `[Your Account Number]` and `[Your IFSC Code]` with your actual bank details (search for `bank-account` and `bank-ifsc` IDs)

## 4. Admin Payment Verification
Orders are stored with `payment_status = 'pending'`. To verify and confirm orders:
1. Check your bank/UPI app for the payment
2. Run in Supabase SQL Editor:
   ```sql
   UPDATE shop_orders SET payment_status = 'confirmed' WHERE id = <order_id>;
   ```
3. (Optional) Trigger email delivery by calling the `send-pdf-email` function

## 5. Resend (Email)
1. Sign up at https://resend.com
2. Verify your domain
3. Set `RESEND_API_KEY` in Supabase Edge Function secrets

## 6. Frontend
All shop pages are at `/shop/`. The site nav links to `/shop/` from all pages.

## Flow
Login → Browse products → Add to cart → Checkout → Select UPI/Bank → Pay externally → Enter transaction ID → Order pending → Admin confirms → Email with PDF
