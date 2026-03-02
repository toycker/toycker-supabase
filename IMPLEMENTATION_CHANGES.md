# Implementation Changes Summary

## 1) What I Added

### A) Centralized primary contact constants
I added reusable constants in:
- `src/modules/contact/contact.constants.ts`

Added constants:
- `PRIMARY_CONTACT_NUMBER = "9925819695"`
- `PRIMARY_CONTACT_COUNTRY_CODE = "91"`
- `PRIMARY_CONTACT_DISPLAY = "+91 9925819695"`
- `PRIMARY_CONTACT_E164 = "+919925819695"`
- `PRIMARY_CONTACT_WHATSAPP = "919925819695"`

### B) Retry helper for transient upstream failures
I added retry/backoff logic in:
- `src/lib/data/products.ts`

Added:
- transient error detection (`502/503/504`, bad gateway, cloudflare, timeout, fetch-failed patterns)
- retry wrapper for product list queries
- small backoff delay between retries

---

## 2) What I Modified / Updated

### Contact number update implementation
I replaced old main number usage (`9925819694`) with centralized constants in:
- `src/modules/layout/config/footer.ts`
- `src/modules/layout/components/header/index.tsx`
- `src/modules/layout/components/contact-hub/index.tsx`
- `src/modules/layout/components/whatsapp-button/index.tsx`
- `src/modules/chatbot/context/chatbot-context.tsx`
- `src/app/(main)/policies/[slug]/page.tsx`
- `src/modules/contact/contact.constants.ts` (main office + contact info)

Important scope rule followed:
- Branch 2 number (`+91 90991 44170`) was kept unchanged.

### Service worker files restore
I restored:
- `public/sw.js`
- `public/sw.js.map`

These were restored so they are not deleted from the project.

---

## 3) Exact Before vs After Comparisons

## A) Contact number architecture

### Before
- Main number was hardcoded in multiple files.
- WhatsApp number was duplicated in separate components.
- Policy and chatbot text manually contained the old number.

### After
- One source of truth for main contact number in `contact.constants.ts`.
- All key UI/UX locations now reference shared constants.
- Main number changed to `9925819695` consistently.

---

## B) Header / Footer / Contact / WhatsApp

### Before
- Header default: `+91 9925819694`
- Footer phone label/value/href used old literal
- Contact hub + WhatsApp button used old `wa.me` number `919925819694`

### After
- Header uses `PRIMARY_CONTACT_DISPLAY`
- Footer uses `PRIMARY_CONTACT_DISPLAY` + `PRIMARY_CONTACT_E164`
- Contact hub + WhatsApp button use `PRIMARY_CONTACT_WHATSAPP`

---

## C) Chatbot and Policies

### Before
- Chatbot “Call Us” and “Store Locations” strings included old main office number.
- Policy paragraphs included old main number text in multiple places.

### After
- Chatbot strings now interpolate `PRIMARY_CONTACT_DISPLAY` for main office.
- Policy text now interpolates `PRIMARY_CONTACT_DISPLAY`.
- Branch 2 number remains unchanged.

---

## D) Build-time product fetch resilience

### Before
- On transient upstream failure (example: Supabase/Cloudflare 502), product list query failed immediately and returned empty data fallback.

### After
- Product list queries now retry up to 3 attempts before fallback.
- Temporary upstream issues are less likely to degrade page data generation.
- Existing fallback behavior is still preserved if all retries fail.

---

## 4) What Work I Did (Implementation Actions)

1. Analyzed all contact-number occurrences in runtime source.
2. Centralized main contact values in one constants module.
3. Updated all scoped consumer modules to use shared constants.
4. Preserved branch-specific number intentionally.
5. Restored `public/sw.js` and `public/sw.js.map` files.
6. Added retry/backoff for transient upstream product-query failures.
7. Ran TypeScript validation (`tsc --noEmit`) after retry implementation.

---

## 5) What Exactly Will Happen Because of These Changes

1. Main contact number now appears consistently as `9925819695` across primary customer touchpoints.
2. Future main contact updates are simpler (single constants file update).
3. Risk of missing one hardcoded number in UI text is significantly reduced.
4. Transient upstream failures during build are less likely to immediately produce empty product lists.
5. Existing order/payment/cart behavior remains unchanged because no mutation logic was modified.
6. Service worker files are present again and not left deleted.

---

## Conclusion

These changes improve consistency, maintainability, and reliability without over-engineering the project.  
The contact-number update is now centralized, so future edits are faster and safer.  
The retry logic adds resilience to temporary upstream outages (like 502 errors) during product data fetching.  
Core business flows (orders, checkout, payments) were not altered, so functional risk is low.  
Overall, this implementation keeps the prototype simple while making it more production-safe and less error-prone.  

