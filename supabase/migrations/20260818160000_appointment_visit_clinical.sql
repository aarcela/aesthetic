-- Per-visit clinical documentation: diagnosis and requested exams (separate from notes/indications).

alter table public.appointments
  add column if not exists visit_diagnosis text,
  add column if not exists requested_exams text;
