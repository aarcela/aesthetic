'use client';

import { FormEvent, useEffect, useId, useState } from 'react';

import { IconClose } from '@/components/icons';

import { PatientClinicalForm } from '@/components/patients/patient-clinical-form';
import {
  emptyPatientForm,
  patientFormToPayload,
  type PatientClinicalFormValues,
} from '@/lib/patient-history';

export type PatientCreatePayload = ReturnType<typeof patientFormToPayload>;

type Props = {
  open: boolean;
  pending?: boolean;
  error?: string | null;
  /** Raise overlay when opened over another dialog. */
  stacked?: boolean;
  onClose: () => void;
  onSave: (payload: PatientCreatePayload) => void;
};

export function PatientCreateModal({
  open,
  pending,
  error,
  stacked,
  onClose,
  onSave,
}: Props) {
  const titleId = useId();
  const [values, setValues] = useState<PatientClinicalFormValues>(emptyPatientForm);
  const [phoneHint, setPhoneHint] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValues(emptyPatientForm());
    setPhoneHint(null);
    const id = window.setTimeout(() => {
      document.getElementById('patient-modal-first')?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape' || pending) return;
      event.stopImmediatePropagation();
      onClose();
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose, pending]);

  if (!open) return null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const digits = values.phoneNumber.replace(/\D/g, '');
    if (digits.length < 10) {
      setPhoneHint('Escribe el teléfono completo, no solo el prefijo (mín. 10 dígitos).');
      return;
    }
    setPhoneHint(null);
    onSave(patientFormToPayload(values));
  }

  return (
    <div
      className={`fixed inset-0 ${stacked ? 'z-[60]' : 'z-50'} flex items-end justify-center bg-botanical-deep/35 p-4 backdrop-blur-[2px] sm:items-center`}
      role="presentation"
      onClick={onClose}
    >
      <form
        className="panel fade-up max-h-[90vh] w-full max-w-3xl overflow-y-auto overscroll-contain p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        autoComplete="off"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="brand-mark text-3xl text-botanical">
              Nuevo paciente
            </h2>
            <p className="mt-1 text-sm text-muted">
              Historia clínica estética. Puedes completar el resto en el perfil.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar">
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <PatientClinicalForm
          idPrefix="patient-modal"
          values={values}
          phoneHint={phoneHint}
          onChange={(patch) => {
            setValues((current) => ({ ...current, ...patch }));
            if (patch.phoneNumber !== undefined) setPhoneHint(null);
          }}
        />

        {error ? (
          <p className="mt-3 text-danger" role="status" aria-live="polite">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar paciente'}
          </button>
          <button className="btn btn-ghost" type="button" onClick={onClose} disabled={pending}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
