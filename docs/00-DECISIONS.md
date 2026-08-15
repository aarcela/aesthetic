# Locked Decisions Log

Decisions below supersede earlier “open questions” in older draft wording.

| Date | Topic | Decision | Notes |
|------|-------|----------|-------|
| 2026-08-13 | ORM | **Drizzle** | NestJS + Supabase Postgres |
| 2026-08-13 | Walk-ins | **Yes** | Sale without appointment |
| 2026-08-13 | Visit structure | **Line items** | Multiple services per appointment and per sale |
| 2026-08-13 | FX provider | **DolarApi VE** | Base `https://ve.dolarapi.com` — see domain FX section |
| 2026-08-13 | Photos on Starter | **Yes** | Photo vault on both tiers |
| 2026-08-13 | Pro gates | Inventory recipes + commissions + WhatsApp | Consents + photos on Starter too |

## DolarApi integration (locked)

- Docs: https://dolarapi.com/docs/venezuela/  
- Base URL: `https://ve.dolarapi.com`  
- Endpoints:
  - `GET /v1/dolares` — all USD sources  
  - `GET /v1/dolares/oficial` — BCV / oficial  
  - `GET /v1/dolares/paralelo` — paralelo  
- Field to persist: `promedio` (VES per 1 USD). `compra` / `venta` may be `null`.  
- Also store: `fuente`, `fechaActualizacion`, fetch timestamp.  
- Tenant default: which `fuente` to use for VES conversion (`oficial` default; allow `paralelo`).  
- Cache in Redis; refresh on a schedule; always **snapshot onto the sale** at post time.  
- **USDT:** not provided by DolarApi → MVP treats `BINANCE_USDT` amounts as USD equivalents for balancing the sale.
