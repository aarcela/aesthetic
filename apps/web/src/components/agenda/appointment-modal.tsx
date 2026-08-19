'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

import { IconClose } from '@/components/icons';

import { fromDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/agenda-dates';
import { canMarkAttendance, formatUsd, isAttendedVisit } from '@/lib/clinic';

export type AgendaPatient = {
  id: string;
  firstName: string;
  lastName: string;
};

export type AgendaService = {
  id: string;
  name: string;
  basePriceUsd: string;
};

export type AgendaLocation = {
  id: string;
  name: string;
};

export type AgendaAppointment = {
  id: string;
  scheduledAt: string;
  status: string;
  patientId: string;
  locationId?: string;
  notes?: string | null;
  items: Array<{ id?: string; serviceId: string; unitPriceUsd: string }>;
};

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  initialAt: Date;
  appointment?: AgendaAppointment | null;
  patients: AgendaPatient[];
  services: AgendaService[];
  locations: AgendaLocation[];
  pending?: boolean;
  onClose: () => void;
  onAddPatient?: () => void;
  focusPatientId?: string | null;
  onDocumentSession?: () => void;
  onSave: (
    payload: {
      patientId: string;
      serviceId: string;
      locationId: string;
      scheduledAt: string;
      status?: string;
      notes?: string;
    },
    options?: { openVisit?: boolean },
  ) => void;
};

const STATUSES = [
  { value: 'SCHEDULED', label: 'Agendada' },
  { value: 'CONFIRMED', label: 'Confirmada' },
  { value: 'COMPLETED', label: 'Completada' },
  { value: 'CANCELLED', label: 'Cancelada' },
  { value: 'NO_SHOW', label: 'No asistió' },
] as const;

export function AppointmentModal({
  open,
  mode,
  initialAt,
  appointment,
  patients,
  services,
  locations,
  pending,
  onClose,
  onAddPatient,
  focusPatientId,
  onDocumentSession,
  onSave,
}: Props) {
  const [patientId, setPatientId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [status, setStatus] = useState('SCHEDULED');
  const [notes, setNotes] = useState('');
  const catalogRef = useRef({ patients, services, locations });
  catalogRef.current = { patients, services, locations };

  useEffect(() => {
    if (!open) return;
    const catalog = catalogRef.current;
    if (mode === 'edit' && appointment) {
      setPatientId(appointment.patientId);
      setServiceId(appointment.items[0]?.serviceId ?? catalog.services[0]?.id ?? '');
      setLocationId(appointment.locationId ?? catalog.locations[0]?.id ?? '');
      setScheduledAt(toDatetimeLocalValue(new Date(appointment.scheduledAt)));
      setStatus(appointment.status);
      setNotes(appointment.notes ?? '');
      return;
    }
    setPatientId(catalog.patients[0]?.id ?? '');
    setServiceId(catalog.services[0]?.id ?? '');
    setLocationId(catalog.locations[0]?.id ?? '');
    setScheduledAt(toDatetimeLocalValue(initialAt));
    setStatus('SCHEDULED');
    setNotes('');
  }, [open, mode, appointment, initialAt]);

  useEffect(() => {
    if (!open) return;
    if (focusPatientId && patients.some((p) => p.id === focusPatientId)) {
      setPatientId(focusPatientId);
      return;
    }
    setPatientId((current) => current || patients[0]?.id || '');
    // Hydration on open is handled above; this follows a new patient or late catalog.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omit `open` to avoid clobbering the reset
  }, [patients, focusPatientId]);

  useEffect(() => {
    if (!open) return;
    setServiceId((current) => current || services[0]?.id || '');
    setLocationId((current) => current || locations[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omit `open` to avoid clobbering the reset
  }, [services, locations]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    onSave({
      patientId,
      serviceId,
      locationId,
      scheduledAt: fromDatetimeLocalValue(scheduledAt),
      status: mode === 'edit' ? status : undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-botanical-deep/35 p-4 backdrop-blur-[2px] sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <form
        className="panel fade-up max-h-[90vh] w-full max-w-lg overflow-y-auto overscroll-contain p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appt-modal-title"
        autoComplete="off"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 id="appt-modal-title" className="brand-mark text-3xl text-botanical">
              {mode === 'edit' ? 'Editar cita' : 'Nueva cita'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {mode === 'edit'
                ? 'La visita se abre cuando el paciente asiste (cita completada).'
                : 'Reserva de agenda. La visita nace al marcar asistencia.'}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar">
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="modal-when">
              Fecha y hora
            </label>
            <input
              id="modal-when"
              className="field"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="modal-patient">
              Paciente
            </label>
            <div className="flex items-stretch gap-2">
              <select
                id="modal-patient"
                className="field min-w-0 flex-1"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
              >
                {patients.length === 0 ? (
                  <option value="">Crea un paciente para agendar</option>
                ) : null}
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
              {onAddPatient ? (
                <button
                  type="button"
                  className="btn btn-ghost shrink-0"
                  aria-haspopup="dialog"
                  onClick={onAddPatient}
                  disabled={pending}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Nuevo
                </button>
              ) : null}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="modal-service">
              Servicio
            </label>
            <select
              id="modal-service"
              className="field"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              required
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatUsd(s.basePriceUsd)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="modal-location">
              Sede
            </label>
            <select
              id="modal-location"
              className="field"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              required
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          {mode === 'edit' ? (
            <div>
              <label className="label" htmlFor="modal-status">
                Estado
              </label>
              <select
                id="modal-status"
                className="field"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className="label" htmlFor="modal-notes">
              Notas
            </label>
            <textarea
              id="modal-notes"
              className="field min-h-20 resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Indicaciones, alergias visibles…"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {mode === 'edit' && canMarkAttendance(appointment?.status ?? status) ? (
            <button
              className="btn btn-primary"
              type="button"
              disabled={pending}
              onClick={() =>
                onSave(
                  {
                    patientId,
                    serviceId,
                    locationId,
                    scheduledAt: fromDatetimeLocalValue(scheduledAt),
                    status: 'COMPLETED',
                    notes: notes.trim() || undefined,
                  },
                  { openVisit: true },
                )
              }
            >
              {pending ? 'Guardando…' : 'Paciente asistió'}
            </button>
          ) : (
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? 'Guardando…' : mode === 'edit' ? 'Guardar cambios' : 'Agendar'}
            </button>
          )}
          {mode === 'edit' && canMarkAttendance(appointment?.status ?? status) ? (
            <button className="btn btn-ghost" type="submit" disabled={pending}>
              Guardar cambios
            </button>
          ) : null}
          {mode === 'edit' && isAttendedVisit(appointment?.status ?? '') && onDocumentSession ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending}
              onClick={onDocumentSession}
            >
              Documentar visita
            </button>
          ) : null}
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
