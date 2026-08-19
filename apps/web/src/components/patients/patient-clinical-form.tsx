'use client';

import type { ReactNode } from 'react';

import {
  ageFromBirthDate,
  PATIENT_MARITAL_OPTIONS,
  PATIENT_PHOTOTYPE_OPTIONS,
  PATIENT_SEX_OPTIONS,
  PATIENT_SKIN_BIOTYPE_OPTIONS,
  type HomeRoutineAmValues,
  type HomeRoutinePmValues,
  type PatientClinicalFormValues,
} from '@/lib/patient-history';

type Props = {
  idPrefix: string;
  values: PatientClinicalFormValues;
  onChange: (patch: Partial<PatientClinicalFormValues>) => void;
  phoneHint?: string | null;
};

const AM_FIELDS: Array<[keyof HomeRoutineAmValues, string]> = [
  ['cleanser', 'Limpiador'],
  ['toner', 'Tónico'],
  ['eyeContour', 'Contorno de ojos'],
  ['serum', 'Suero'],
  ['moisturizer', 'Hidratante'],
  ['sunscreen', 'Protector solar'],
  ['lipProtection', 'Protector de labios'],
];

const PM_FIELDS: Array<[keyof HomeRoutinePmValues, string]> = [
  ['cleanser', 'Limpiador'],
  ['toner', 'Tónico'],
  ['eyeContour', 'Contorno de ojos'],
  ['serum', 'Suero'],
  ['moisturizer', 'Hidratante'],
  ['lipProtection', 'Protector de labios'],
  ['doubleCleanser', 'Doble limpiador'],
];

function Field({
  id,
  label,
  required,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function CheckField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-botanical">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-line pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-botanical">{title}</h3>
      {children}
    </section>
  );
}

export function PatientClinicalForm({ idPrefix, values, onChange, phoneHint }: Props) {
  const age = ageFromBirthDate(values.dateOfBirth);
  const fid = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">Los campos con * son obligatorios.</p>

      <Section title="Datos personales">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={fid('first')} label="Nombre" required>
            <input
              id={fid('first')}
              name="firstName"
              className="field"
              autoComplete="given-name"
              value={values.firstName}
              onChange={(event) => onChange({ firstName: event.target.value })}
              required
              aria-required="true"
            />
          </Field>
          <Field id={fid('last')} label="Apellido" required>
            <input
              id={fid('last')}
              name="lastName"
              className="field"
              autoComplete="family-name"
              value={values.lastName}
              onChange={(event) => onChange({ lastName: event.target.value })}
              required
              aria-required="true"
            />
          </Field>
          <Field
            id={fid('phone')}
            label="Teléfono"
            required
            hint={phoneHint ?? 'Ejemplo: +584121234567'}
          >
            <input
              id={fid('phone')}
              name="phone"
              className="field"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+58412…"
              value={values.phoneNumber}
              onChange={(event) => onChange({ phoneNumber: event.target.value })}
              required
              aria-required="true"
              aria-invalid={phoneHint ? true : undefined}
            />
          </Field>
          <Field id={fid('ci')} label="Cédula de identidad">
            <input
              id={fid('ci')}
              className="field"
              value={values.nationalId}
              onChange={(event) => onChange({ nationalId: event.target.value })}
            />
          </Field>
          <Field
            id={fid('dob')}
            label="Fecha de nacimiento"
            hint={age !== null ? `Edad: ${age} años` : 'La edad se calcula sola.'}
          >
            <input
              id={fid('dob')}
              className="field"
              type="date"
              value={values.dateOfBirth}
              onChange={(event) => onChange({ dateOfBirth: event.target.value })}
            />
          </Field>
          <Field id={fid('sex')} label="Sexo">
            <select
              id={fid('sex')}
              className="field"
              value={values.sex}
              onChange={(event) =>
                onChange({ sex: event.target.value as PatientClinicalFormValues['sex'] })
              }
            >
              <option value="">Seleccionar…</option>
              {PATIENT_SEX_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id={fid('marital')} label="Estado civil">
            <select
              id={fid('marital')}
              className="field"
              value={values.maritalStatus}
              onChange={(event) =>
                onChange({
                  maritalStatus: event.target.value as PatientClinicalFormValues['maritalStatus'],
                })
              }
            >
              <option value="">Seleccionar…</option>
              {PATIENT_MARITAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id={fid('occupation')} label="Ocupación">
            <input
              id={fid('occupation')}
              className="field"
              value={values.occupation}
              onChange={(event) => onChange({ occupation: event.target.value })}
            />
          </Field>
          <Field id={fid('reason')} label="Motivo de consulta" className="sm:col-span-2">
            <textarea
              id={fid('reason')}
              className="field min-h-24 resize-y"
              value={values.consultationReason}
              onChange={(event) => onChange({ consultationReason: event.target.value })}
            />
          </Field>
          <Field id={fid('diagnosis')} label="Diagnóstico" className="sm:col-span-2">
            <textarea
              id={fid('diagnosis')}
              className="field min-h-24 resize-y"
              value={values.diagnosis}
              onChange={(event) => onChange({ diagnosis: event.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Antecedentes médicos">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={fid('activity')} label="Actividad física">
            <input
              id={fid('activity')}
              className="field"
              value={values.physicalActivity}
              onChange={(event) => onChange({ physicalActivity: event.target.value })}
            />
          </Field>
          <Field id={fid('diet')} label="Alimentación">
            <input
              id={fid('diet')}
              className="field"
              value={values.diet}
              onChange={(event) => onChange({ diet: event.target.value })}
            />
          </Field>
          <Field id={fid('sleep')} label="Sueño">
            <input
              id={fid('sleep')}
              className="field"
              value={values.sleep}
              onChange={(event) => onChange({ sleep: event.target.value })}
            />
          </Field>
          <Field id={fid('aesthetic')} label="Antecedentes estéticos" className="sm:col-span-2">
            <textarea
              id={fid('aesthetic')}
              className="field min-h-24 resize-y"
              value={values.aestheticHistory}
              onChange={(event) => onChange({ aestheticHistory: event.target.value })}
            />
          </Field>
          <Field
            id={fid('illness')}
            label="¿Sufre de alguna enfermedad?"
            className="sm:col-span-2"
          >
            <textarea
              id={fid('illness')}
              className="field min-h-24 resize-y"
              value={values.illnessNotes}
              onChange={(event) => onChange({ illnessNotes: event.target.value })}
            />
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="label">Condiciones</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              <CheckField
                id={fid('diabetes')}
                label="Diabetes"
                checked={values.diabetes}
                onChange={(checked) => onChange({ diabetes: checked })}
              />
              <CheckField
                id={fid('insulin')}
                label="Resistencia a la insulina"
                checked={values.insulinResistance}
                onChange={(checked) => onChange({ insulinResistance: checked })}
              />
              <CheckField
                id={fid('heart')}
                label="Problemas cardiacos"
                checked={values.heartProblems}
                onChange={(checked) => onChange({ heartProblems: checked })}
              />
              <CheckField
                id={fid('smokes')}
                label="Fuma"
                checked={values.smokes}
                onChange={(checked) => onChange({ smokes: checked })}
              />
              <CheckField
                id={fid('alcohol')}
                label="Bebidas alcohólicas"
                checked={values.drinksAlcohol}
                onChange={(checked) => onChange({ drinksAlcohol: checked })}
              />
            </div>
          </fieldset>
          <Field id={fid('allergy')} label="Alergia a algún medicamento" className="sm:col-span-2">
            <textarea
              id={fid('allergy')}
              className="field min-h-24 resize-y"
              value={values.medicationAllergy}
              onChange={(event) => onChange({ medicationAllergy: event.target.value })}
            />
          </Field>
          <Field id={fid('meds')} label="¿Toma algún medicamento?" className="sm:col-span-2">
            <textarea
              id={fid('meds')}
              className="field min-h-24 resize-y"
              value={values.currentMedications}
              onChange={(event) => onChange({ currentMedications: event.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Examen físico facial">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={fid('biotype')} label="Biotipo cutáneo">
            <select
              id={fid('biotype')}
              className="field"
              value={values.skinBiotype}
              onChange={(event) =>
                onChange({
                  skinBiotype: event.target.value as PatientClinicalFormValues['skinBiotype'],
                })
              }
            >
              <option value="">Seleccionar…</option>
              {PATIENT_SKIN_BIOTYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id={fid('phototype')} label="Fototipo">
            <select
              id={fid('phototype')}
              className="field"
              value={values.phototype}
              onChange={(event) =>
                onChange({
                  phototype: event.target.value as PatientClinicalFormValues['phototype'],
                })
              }
            >
              <option value="">Seleccionar…</option>
              {PATIENT_PHOTOTYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id={fid('aging')} label="Envejecimiento">
            <input
              id={fid('aging')}
              className="field"
              value={values.aging}
              onChange={(event) => onChange({ aging: event.target.value })}
            />
          </Field>
          <Field id={fid('lesions')} label="Lesiones">
            <input
              id={fid('lesions')}
              className="field"
              value={values.lesions}
              onChange={(event) => onChange({ lesions: event.target.value })}
            />
          </Field>
          <Field id={fid('scars')} label="Cicatrices" className="sm:col-span-2">
            <input
              id={fid('scars')}
              className="field"
              value={values.scars}
              onChange={(event) => onChange({ scars: event.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Rutina domiciliar AM">
        <div className="grid gap-3 sm:grid-cols-2">
          {AM_FIELDS.map(([key, label]) => (
            <Field key={key} id={fid(`am-${key}`)} label={label}>
              <input
                id={fid(`am-${key}`)}
                className="field"
                value={values.routineAm[key]}
                onChange={(event) =>
                  onChange({
                    routineAm: { ...values.routineAm, [key]: event.target.value },
                  })
                }
              />
            </Field>
          ))}
          <Field id={fid('am-notes')} label="Notas" className="sm:col-span-2">
            <textarea
              id={fid('am-notes')}
              className="field min-h-24 resize-y"
              value={values.routineAm.notes}
              onChange={(event) =>
                onChange({
                  routineAm: { ...values.routineAm, notes: event.target.value },
                })
              }
            />
          </Field>
        </div>
      </Section>

      <Section title="Rutina domiciliar PM">
        <div className="grid gap-3 sm:grid-cols-2">
          {PM_FIELDS.map(([key, label]) => (
            <Field key={key} id={fid(`pm-${key}`)} label={label}>
              <input
                id={fid(`pm-${key}`)}
                className="field"
                value={values.routinePm[key]}
                onChange={(event) =>
                  onChange({
                    routinePm: { ...values.routinePm, [key]: event.target.value },
                  })
                }
              />
            </Field>
          ))}
          <Field id={fid('pm-notes')} label="Notas" className="sm:col-span-2">
            <textarea
              id={fid('pm-notes')}
              className="field min-h-24 resize-y"
              value={values.routinePm.notes}
              onChange={(event) =>
                onChange({
                  routinePm: { ...values.routinePm, notes: event.target.value },
                })
              }
            />
          </Field>
        </div>
      </Section>
    </div>
  );
}
