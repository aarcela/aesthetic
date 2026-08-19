-- Phase 4: patient media, consents, WhatsApp outbox.

create type public.photo_type as enum ('BEFORE', 'AFTER', 'OTHER');
create type public.message_channel as enum ('WHATSAPP');
create type public.message_job_status as enum (
  'queued',
  'sending',
  'sent',
  'failed',
  'cancelled'
);

create table public.patient_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  photo_type public.photo_type not null,
  storage_path text not null,
  notes text,
  created_by uuid references public.tenant_memberships(id),
  created_at timestamptz not null default now()
);

create index patient_photos_tenant_patient_idx
  on public.patient_photos (tenant_id, patient_id, created_at desc);

create table public.digital_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  procedure_name text not null,
  signature_storage_path text not null,
  signed_at timestamptz not null default now(),
  created_by uuid references public.tenant_memberships(id),
  created_at timestamptz not null default now()
);

create index digital_consents_tenant_patient_idx
  on public.digital_consents (tenant_id, patient_id, signed_at desc);

create table public.message_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  channel public.message_channel not null default 'WHATSAPP',
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.message_job_status not null default 'queued',
  attempts integer not null default 0,
  provider_message_id text,
  last_error text,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index message_jobs_tenant_status_scheduled_idx
  on public.message_jobs (tenant_id, status, scheduled_for);

alter table public.patient_photos enable row level security;
alter table public.digital_consents enable row level security;
alter table public.message_jobs enable row level security;
alter table public.patient_photos force row level security;
alter table public.digital_consents force row level security;
alter table public.message_jobs force row level security;

create policy patient_photos_tenant_isolation on public.patient_photos
  for all
  using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

create policy digital_consents_tenant_isolation on public.digital_consents
  for all
  using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

create policy message_jobs_tenant_isolation on public.message_jobs
  for all
  using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
