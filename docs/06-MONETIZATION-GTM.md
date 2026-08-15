# Monetization & Go-To-Market

## Pricing (working)

| Plan | Price | Includes |
|------|-------|----------|
| **Starter** | $29/month | 1 location, 2 specialist calendars, multi-currency caja, patients, appointments, digital consents, **photo vault** |
| **Pro** | $59/month | Starter + WhatsApp reminders, procedure-level inventory deduction, commission reports |

- **Onboarding fee:** $100–$200 one-time (data load, inventory setup, staff training).  
- **Annual prepay:** 15–20% discount for cash-flow (Zelle / Pago Móvil / USDT / cash).  

Plans and limits must be encoded on `tenants.plan_code` + enforced in API (calendar seats, locations).

## What each tier gates (product)

| Feature | Starter | Pro |
|---------|---------|-----|
| Caja multi-moneda | ✓ | ✓ |
| Appointments / patients / line items | ✓ | ✓ |
| Walk-in sales | ✓ | ✓ |
| Digital consents | ✓ | ✓ |
| Photo vault | ✓ | ✓ |
| Recipe inventory | — | ✓ |
| Commissions | — | ✓ |
| WhatsApp automation | — | ✓ |

Pro differentiators (locked): **inventory recipes + commissions + WhatsApp**.

## SaaS fee collection (reality in Venezuela)

- Do **not** depend on Stripe-only for local SMBs initially.  
- Manual/assisted collection: invoice → Zelle / Pago Móvil / USDT → mark tenant `active` in admin.  
- Later: local payment links or crypto gateway automation.  
- Suspension policy: grace period after `past_due`, then read-only or login block.

## Ideal customer profile (ICP)

- 1–3 chairs / specialists  
- High consumable spend (fillers, toxins)  
- Already using WhatsApp for booking  
- Owner feels inventory theft or caja confusion weekly  

## GTM motion

1. **Direct Instagram DM** to clinics in target zones.  
2. **Boots on the ground** demos in:
   - Caracas: Las Mercedes, Chacao, El Hatillo  
   - Valencia, Maracaibo  
3. **Concierge onboarding** (justifies setup fee): load services, recipes, staff in one session.  
4. Ask for referrals after first clean monthly close.

## Pilot success criteria

- 3–5 design-partner clinics  
- 30 days with daily caja usage  
- At least one inventory physical count matching system within 5%  
- Written testimonial or case note on no-show/deposit impact  

## Positioning message (ES sketch)

> Controla tu caja multi-moneda, tu inventario por procedimiento y las comisiones de tu equipo — pensado para clínicas estéticas en Venezuela.

## Non-goals for GTM

- Broad LatAm paid ads before Venezuela retention is proven.  
- Selling as “expediente médico completo.”  
- Discounting below floor that kills onboarding economics.
