-- MANAGER: operational access (agenda, caja, patients, services, inventory)
-- without clinic configuration or the Finanzas cash book.

ALTER TYPE public.tenant_role ADD VALUE IF NOT EXISTS 'MANAGER' AFTER 'ADMIN';
