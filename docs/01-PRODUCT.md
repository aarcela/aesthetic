# Product Specification

## Vision

Become the operating system for aesthetic clinic floors in LatAm: cash + inventory + agenda + commissions in one place, designed for inflation, parallel FX, and WhatsApp-first patients.

## Personas

### Owner / Admin

- Cares about: daily caja totals by method, stock shrinkage, specialist payouts, no-shows.  
- Success: closes the day knowing USD/VES/crypto positions and who is owed what.

### Receptionist

- Cares about: booking, confirming deposits, checking patients in, taking payments.  
- Success: checkout in under 60 seconds with mixed payment methods.

### Specialist / Doctor

- Cares about: their schedule, patient photos/history, consent signed, fair commission.  
- Success: sees today’s list and can capture before/after without leaving the chair.

## Jobs to be done

1. When a patient pays with half Zelle and half cash VES, log both legs at today’s BCV rate in one sale.  
2. When a filler session finishes, deduct the exact ml recipe and flag low stock.  
3. When an appointment is booked, send WhatsApp confirmation and optionally require a deposit.  
4. When the month ends, export each specialist’s commission after material cost.  
5. When a procedure needs liability protection, capture on-screen signature and store it with the visit.

## UX principles (clinic floor)

- **Tablet-first for floor flows** (photos, consents, checkout); desktop for admin reports.  
- **Spanish-first UI** (Venezuela); currency labels always explicit (`USD`, `VES`, `USDT`).  
- **One primary action per screen** on mobile (book / pay / capture / sign).  
- **Offline-tolerant later** — MVP may require connectivity; design APIs idempotent for future sync.  
- Avoid dashboard clutter on first login: today’s agenda + caja shortcut + low-stock alerts.

## Core user stories (MVP)

### Tenancy & access

- As an owner, I can create a clinic tenant, invite staff by email, and assign roles (`OWNER`, `ADMIN`, `SPECIALIST`, `RECEPTIONIST`).  
- As staff, I only ever see my clinic’s data.

### Patients & agenda

- As reception, I can create/find a patient by phone or CI and book **one or more services** (line items) with specialists and a time.  
- As reception, I can check out a **walk-in** (no appointment) with multiple line items and mixed payments.  
- As reception, I can mark status: scheduled → confirmed → completed / cancelled / no-show.

### Caja

- As reception, I can checkout a visit with one or more **line items** and one or more payment legs (method, amount in paid currency, reference), using DolarApi oficial/paralelo for VES.  
- As owner, I can see day’s totals grouped by payment method and equivalent USD.

### Inventory

- As admin, I define services and recipes (e.g., “Labios 1ml” → 1.0 ml Juvederm).  
- As system, completing a visit deducts recipe quantities and writes movement rows.  
- As admin, I receive low-stock alerts when below `min_stock_alert`.

### Photos & consents

- As specialist, I attach BEFORE/AFTER photos to a patient (optionally to an appointment).  
- As specialist, I present a consent for a procedure and store signature image + timestamp.

### Commissions

- As owner, I configure per-specialist or per-service commission rules.  
- As owner, I generate a period report: gross − materials = commission base × rate.

### Messaging

- As system, I enqueue WhatsApp messages for booking created, reminder T-24h, deposit received.  
- As admin, I see delivery status (queued / sent / failed).

## Success metrics (post-MVP pilots)

| Metric | Target (pilot clinics) |
|--------|-------------------------|
| Time to close mixed payment | < 60s |
| No-show rate vs baseline | −20% with deposits |
| Inventory variance vs physical count | < 5% after 30 days |
| Owner weekly active use | ≥ 4 days/week |

## Competitive framing (positioning)

Not a hospital EMR. Not a generic “beauty booking” widget.  
**Position:** “Caja + inventario por procedimiento + comisiones” for aesthetic SMBs that live in WhatsApp and multi-currency cash.
