-- Aesthetic clinical history fields on patients (datos personales, antecedentes,
-- examen facial, rutina domiciliar). Tratamientos realizados stay in appointments.

create type public.patient_sex as enum ('FEMALE', 'MALE');
create type public.patient_marital_status as enum (
  'SINGLE',
  'MARRIED',
  'COMMON_LAW',
  'DIVORCED',
  'WIDOWED'
);
create type public.patient_skin_biotype as enum (
  'DRY',
  'OILY',
  'COMBINATION',
  'SENSITIVE',
  'NORMAL'
);
create type public.patient_phototype as enum ('I', 'II', 'III', 'IV', 'V', 'VI');

alter table public.patients
  add column if not exists date_of_birth date,
  add column if not exists sex public.patient_sex,
  add column if not exists marital_status public.patient_marital_status,
  add column if not exists occupation text,
  add column if not exists consultation_reason text,
  add column if not exists diagnosis text,
  add column if not exists physical_activity text,
  add column if not exists diet text,
  add column if not exists sleep text,
  add column if not exists aesthetic_history text,
  add column if not exists illness_notes text,
  add column if not exists diabetes boolean not null default false,
  add column if not exists insulin_resistance boolean not null default false,
  add column if not exists heart_problems boolean not null default false,
  add column if not exists smokes boolean not null default false,
  add column if not exists drinks_alcohol boolean not null default false,
  add column if not exists medication_allergy text,
  add column if not exists current_medications text,
  add column if not exists skin_biotype public.patient_skin_biotype,
  add column if not exists phototype public.patient_phototype,
  add column if not exists aging text,
  add column if not exists lesions text,
  add column if not exists scars text,
  add column if not exists home_routine_am jsonb not null default '{}'::jsonb,
  add column if not exists home_routine_pm jsonb not null default '{}'::jsonb;
