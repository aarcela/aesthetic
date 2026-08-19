-- Remove WhatsApp messaging outbox and patient opt-in.

drop policy if exists message_jobs_tenant_isolation on public.message_jobs;
drop table if exists public.message_jobs;

alter table public.patients drop column if exists whatsapp_opt_in;

drop type if exists public.message_job_status;
drop type if exists public.message_channel;
