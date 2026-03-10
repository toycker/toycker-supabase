# Paytm Gateway Migration Guide for `toycker-supabase`

## Goal
This document explains exactly how to replace **PayU** with **Paytm** in this project in the future, with minimum complexity and without touching unrelated code.

It is written for a **basic working prototype** first, with safe defaults.

---

## Before and After (Simple English)

### Before (Current Project)
- Checkout creates a **PayU payment session** in server code.
- Frontend submits a hidden HTML form to PayU.
- PayU callback route verifies hash and updates order/payment status.

### After (Target)
- Checkout creates a **Paytm transaction token** in server code.
- Frontend submits a hidden HTML form to Paytm hosted page.
- Paytm callback route verifies checksum, confirms final status via Paytm status API, then updates order/payment status.

---

## Current PayU Implementation (What Exists Today)

These files are currently PayU-coupled:

- `src/lib/data/cart.ts`
  - `initiatePaymentSession()` creates PayU hash and PayU form params.
- `src/lib/payu.ts`
  - PayU hash generation and callback hash verification helpers.
- `src/app/api/payu/callback/route.ts`
  - PayU callback handler.
- `src/modules/checkout/components/payment-button/index.tsx`
  - PayU button flow does form POST redirect.
- `src/lib/constants.tsx`
  - `pp_payu_payu` map + `isPayU()` helper.
- `src/lib/actions/complete-checkout.ts`
  - Gateway check currently uses `includes("payu")`.
- `src/proxy.ts`
  - Middleware bypass for `/api/payu/callback`.
- `src/lib/data/payment.ts`
  - Fallback payment provider currently returns PayU.

PayU references also exist in admin display and chatbot text:
- `src/app/admin/orders/page.tsx`
- `src/app/admin/orders/[id]/page.tsx`
- `src/modules/order/components/payment-details/index.tsx`
- `src/modules/chatbot/chatbot-flows.ts`
- `src/modules/chatbot/context/chatbot-context.tsx`

---

## Final Target Scope (Prototype, No Over-Engineering)

### Must change (core working flow)
1. Add Paytm server helper.
2. Add Paytm callback route.
3. Update cart payment-session initiation for Paytm.
4. Update checkout button/provider detection.
5. Update gateway check in checkout action.
6. Update middleware bypass.
7. Update env/docs.

### Should change (to avoid confusion)
1. Admin payment labels for Paytm.
2. Order payment details fallback for Paytm.
3. Chatbot text from PayU to Paytm.

### Do not change
- Supabase order RPC business logic (`create_order_with_payment`) unless strictly required.
- Cart/rewards/club logic unrelated to payment gateway transport.
- Product/catalog/storefront code.

---

## Recommended Migration Strategy

Use **Paytm Hosted Redirect flow** (same pattern as current PayU form-post flow):

1. Backend calls **Initiate Transaction API** and gets `txnToken`.
2. Frontend posts form with `mid`, `orderId`, `txnToken`.
3. Paytm redirects back to callback URL.
4. Callback verifies checksum.
5. Callback confirms final status using Paytm **Transaction Status API**.
6. Order status is updated only after successful verification.

This keeps implementation simple and closest to existing project design.

---

## Exact File-by-File Change Plan

## 1) Add new Paytm utility
- **Create:** `src/lib/paytm.ts`
- Add typed helpers (no `any`):
  - config/env reader (`PAYTM_MERCHANT_ID`, `PAYTM_MERCHANT_KEY`, `PAYTM_ENVIRONMENT`, `PAYTM_WEBSITE_NAME`)
  - initiate transaction request builder
  - checksum generate/verify helpers
  - transaction status API checker
  - typed callback payload interface

## 2) Update cart payment initiation
- **Edit:** `src/lib/data/cart.ts`
- In `initiatePaymentSession()`:
  - Add branch for provider id `pp_paytm_paytm`.
  - Create Paytm order id.
  - Call Paytm initiate API.
  - Store session data in `payment_collection.payment_sessions[0].data` as:
    - `payment_url`
    - `params: { mid, orderId, txnToken }`
- Keep PayU branch untouched temporarily if you want backward safety.

## 3) Add Paytm callback route
- **Create:** `src/app/api/paytm/callback/route.ts`
- Flow:
  - Parse `application/x-www-form-urlencoded` payload.
  - Verify `CHECKSUMHASH`.
  - Call status API with `ORDERID` to confirm final status.
  - On success:
    - set `orders.status = order_placed`
    - set `orders.payment_status = captured`
    - run post-order logic (`handlePostOrderLogic`)
    - log timeline event
    - redirect to confirmation
  - On failure:
    - set payment failed/cancelled
    - log timeline event
    - redirect to checkout payment step with error
  - On pending:
    - keep pending, show clear pending state message

## 4) Update middleware bypass
- **Edit:** `src/proxy.ts`
- Add `/api/paytm/callback` to bypass rules and matcher exclusion.
- Keep `/api/payu/callback` bypass during transition release.

## 5) Switch checkout UI/provider logic
- **Edit:** `src/lib/constants.tsx`
  - Add/replace map entry for `pp_paytm_paytm`.
  - Add `isPaytm()` helper.
- **Edit:** `src/modules/checkout/components/payment-button/index.tsx`
  - Replace PayU branch with Paytm branch.
  - Keep same form-submit UX.
- **Edit:** `src/lib/actions/complete-checkout.ts`
  - Gateway detection should include Paytm.
  - Do not run post-order logic immediately for gateway methods.
- **Edit:** `src/lib/data/payment.ts`
  - Fallback method should be Paytm (not PayU).

## 6) Update project docs and env templates
- **Edit:** `.env.example`
  - Add:
    - `PAYTM_MERCHANT_ID`
    - `PAYTM_MERCHANT_KEY`
    - `PAYTM_ENVIRONMENT` (`test` or `production`)
    - `PAYTM_WEBSITE_NAME` (for staging/prod)
- **Edit:** `README.md`
  - Replace PayU mentions with Paytm.
- **Edit:** `API.md`
  - Replace callback endpoint docs with `/api/paytm/callback`.

## 7) Update admin/payment display (recommended)
- **Edit:** `src/app/admin/orders/page.tsx`
- **Edit:** `src/app/admin/orders/[id]/page.tsx`
- **Edit:** `src/modules/order/components/payment-details/index.tsx`
- Add Paytm detection/display so internal team sees correct payment method and transaction labels.

## 8) Update chatbot copy (optional but recommended)
- **Edit:** `src/modules/chatbot/chatbot-flows.ts`
- **Edit:** `src/modules/chatbot/context/chatbot-context.tsx`
- Replace PayU wording with Paytm wording.

---

## Database / Payment Provider Setup

Make sure `payment_providers` has active Paytm provider id expected by code.

Recommended values:
- `id = pp_paytm_paytm`
- `name = Paytm`
- `is_active = true`

Deactivate PayU provider in admin after migration is validated.

---

## TypeScript Rule (Important)

For all migration changes:
- **Do not use `any`**.
- Add explicit interfaces for callback payload, status response, and session data.
- If existing files contain old `any`, do not spread it further in new code.

---

## Quality Checks (Must Run)

After implementation, run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

If any of these fail, do not deploy until fixed.

---

## Manual Test Checklist

1. Select Paytm on checkout.
2. Place order and confirm redirect to Paytm page.
3. Complete successful payment:
   - callback hits `/api/paytm/callback`
   - order becomes `order_placed`
   - payment becomes `captured`
   - order confirmation page opens
4. Test failed payment:
   - payment marked failed/cancelled
   - user returns to checkout payment step with error
5. Test pending state:
   - order/payment remains pending
   - user sees pending message
6. Confirm COD/Stripe/manual paths still work unchanged.

---

## Safe Rollout Suggestion

For one transition release:
- Keep old PayU callback route alive (`/api/payu/callback`) for in-flight old payments.
- Move new checkout traffic to Paytm.
- After stable period, clean PayU code.

---

## Official References

- Paytm Initiate Transaction API  
  https://business.paytm.com/docs/api/initiate-transaction-api/
- Paytm Show Payment Page  
  https://business.paytm.com/docs/api/show-payment-page/
- Paytm Transaction Status API  
  https://business.paytm.com/docs/api/get-transaction-status-api/
- Paytm Checksum Implementation  
  https://business.paytm.com/docs/checksum-implementation/
- Paytm Checksum Verification  
  https://business.paytm.com/docs/checksum/
- Paytm Callback and Webhook  
  https://business.paytm.com/docs/callback-and-webhook/
- Paytm Payment Status callback fields  
  https://business.paytm.com/docs/payment-status/
- Next.js Route Handlers  
  https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Supabase API keys and backend key safety  
  https://supabase.com/docs/guides/api/api-keys

