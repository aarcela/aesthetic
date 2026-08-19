'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';

import { AppointmentModal, type AgendaAppointment } from '@/components/agenda/appointment-modal';
import { MonthCalendar } from '@/components/agenda/month-calendar';
import { WeekCalendar } from '@/components/agenda/week-calendar';
import {
  PatientCreateModal,
  type PatientCreatePayload,
} from '@/components/patients/patient-create-modal';
import { VisitSessionModal } from '@/components/patients/visit-session-modal';
import { EmptyState, LiveMessage, PageHeader, StatusPill } from '@/components/ui';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  formatMonthHeading,
  formatWeekRange,
  startOfMonth,
  startOfWeek,
} from '@/lib/agenda-dates';
import { formatDateTime, formatUsd } from '@/lib/clinic';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTabRefresh } from '@/lib/use-tab-refresh';

type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
};

type Service = {
  id: string;
  name: string;
  basePriceUsd: string;
};

type Location = { id: string; name: string; isPrimary: boolean };

type ViewMode = 'week' | 'month' | 'list';

export default function AgendaPage() {
  const { token, membership } = useAuth();
  const pathname = usePathname();
  const [view, setView] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [appointments, setAppointments] = useState<AgendaAppointment[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [patientPending, startPatientTransition] = useTransition();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalAt, setModalAt] = useState(() => new Date());
  const [editing, setEditing] = useState<AgendaAppointment | null>(null);
  const [visitOpen, setVisitOpen] = useState(false);
  const [visitAppointment, setVisitAppointment] = useState<AgendaAppointment | null>(null);
  const [patientCreateOpen, setPatientCreateOpen] = useState(false);
  const [patientFormError, setPatientFormError] = useState<string | null>(null);
  const [focusPatientId, setFocusPatientId] = useState<string | null>(null);

  const patientMap = useMemo(
    () => Object.fromEntries(patients.map((p) => [p.id, p])),
    [patients],
  );
  const serviceMap = useMemo(
    () => Object.fromEntries(services.map((s) => [s.id, s])),
    [services],
  );

  const range = useMemo(() => {
    if (view === 'month') {
      return { from: startOfWeek(startOfMonth(anchor)), to: endOfWeek(endOfMonth(anchor)) };
    }
    if (view === 'week') {
      return { from: startOfWeek(anchor), to: endOfWeek(anchor) };
    }
    return { from: addDays(new Date(), -1), to: addDays(new Date(), 30) };
  }, [anchor, view]);

  const loadCatalog = useCallback(async () => {
    if (!token) return;
    const [p, s, l] = await Promise.all([
      apiFetch<Patient[]>('/v1/patients', { token }),
      apiFetch<Service[]>('/v1/services', { token }),
      apiFetch<Location[]>('/v1/locations', { token }),
    ]);
    setPatients(p);
    setServices(s);
    setLocations(l);
  }, [token]);

  const loadAppointments = useCallback(async () => {
    if (!token) return;
    const rows = await apiFetch<AgendaAppointment[]>(
      `/v1/appointments?from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}`,
      { token },
    );
    setAppointments(rows);
  }, [range.from, range.to, token]);

  useTabRefresh(
    '/app/agenda',
    async () => {
      try {
        await Promise.all([loadCatalog(), loadAppointments()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar la agenda');
      }
    },
    Boolean(token && membership?.tenantId),
  );

  useEffect(() => {
    if (pathname !== '/app/agenda') return;
    void loadAppointments().catch((err: Error) => setError(err.message));
  }, [loadAppointments, pathname]);

  function openCreate(at: Date) {
    setModalMode('create');
    setEditing(null);
    setModalAt(at);
    setModalOpen(true);
    setFocusPatientId(null);
    setPatientCreateOpen(false);
    setPatientFormError(null);
    setError(null);
    setMessage(null);
  }

  function openEdit(appointment: AgendaAppointment) {
    setModalMode('edit');
    setEditing(appointment);
    setModalAt(new Date(appointment.scheduledAt));
    setModalOpen(true);
    setFocusPatientId(null);
    setPatientCreateOpen(false);
    setPatientFormError(null);
    setError(null);
    setMessage(null);
  }

  function openDocumentSession(appointment: AgendaAppointment) {
    setVisitAppointment(appointment);
    setVisitOpen(true);
    setModalOpen(false);
    setError(null);
    setMessage(null);
  }

  function openCreateVisit() {
    setVisitAppointment(null);
    setVisitOpen(true);
    setError(null);
    setMessage(null);
  }

  function shiftAnchor(direction: -1 | 1) {
    if (view === 'month') {
      setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1));
    } else {
      setAnchor(addDays(anchor, direction * 7));
    }
  }

  function onCreatePatient(payload: PatientCreatePayload) {
    if (!token) return;
    setPatientFormError(null);
    startPatientTransition(async () => {
      try {
        const created = await apiFetch<Patient>('/v1/patients', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
        setPatients((current) =>
          current.some((p) => p.id === created.id) ? current : [created, ...current],
        );
        setFocusPatientId(created.id);
        setPatientCreateOpen(false);
      } catch (err) {
        setPatientFormError(err instanceof Error ? err.message : 'No se pudo guardar el paciente');
      }
    });
  }

  function onSave(
    payload: {
      patientId: string;
      serviceId: string;
      locationId: string;
      scheduledAt: string;
      status?: string;
      notes?: string;
    },
    options?: { openVisit?: boolean },
  ) {
    if (!token || !membership) return;
    const service = services.find((s) => s.id === payload.serviceId);
    const becameVisit =
      Boolean(options?.openVisit) ||
      (payload.status === 'COMPLETED' && editing?.status !== 'COMPLETED');
    startTransition(async () => {
      try {
        let saved: AgendaAppointment | null = null;
        if (modalMode === 'create') {
          saved = await apiFetch<AgendaAppointment>('/v1/appointments', {
            method: 'POST',
            token,
            body: JSON.stringify({
              locationId: payload.locationId,
              patientId: payload.patientId,
              scheduledAt: payload.scheduledAt,
              notes: payload.notes,
              items: [
                {
                  serviceId: payload.serviceId,
                  specialistId: membership.membershipId,
                  quantity: 1,
                  unitPriceUsd: Number(service?.basePriceUsd ?? 0),
                },
              ],
            }),
          });
          setMessage('Cita creada');
        } else if (editing) {
          saved = await apiFetch<AgendaAppointment>(`/v1/appointments/${editing.id}`, {
            method: 'PATCH',
            token,
            body: JSON.stringify({
              locationId: payload.locationId,
              patientId: payload.patientId,
              scheduledAt: payload.scheduledAt,
              notes: payload.notes ?? null,
              status: payload.status,
              items: [
                {
                  serviceId: payload.serviceId,
                  specialistId: membership.membershipId,
                  quantity: 1,
                  unitPriceUsd: Number(service?.basePriceUsd ?? 0),
                },
              ],
            }),
          });
          setMessage(becameVisit ? 'Asistencia registrada' : 'Cita actualizada');
        }
        setModalOpen(false);
        await loadAppointments();
        if (becameVisit && saved) {
          openDocumentSession(saved);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo guardar la cita');
      }
    });
  }

  const heading =
    view === 'month'
      ? formatMonthHeading(anchor)
      : view === 'week'
        ? formatWeekRange(anchor)
        : 'Próximas citas';

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Elige un hueco para citar. Cuando la persona llega, marca asistencia para abrir la visita."
        action={
          <>
            <button type="button" className="btn btn-ghost" onClick={openCreateVisit}>
              Llegó sin cita
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const at = new Date();
                at.setMinutes(0, 0, 0);
                at.setHours(Math.max(9, at.getHours() + 1));
                openCreate(at);
              }}
            >
              Nueva cita
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          className="seg"
          role="tablist"
          aria-label="Vista de agenda"
        >
          {(
            [
              ['week', 'Semana'],
              ['month', 'Mes'],
              ['list', 'Lista'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              className="seg-btn"
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {view !== 'list' ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => shiftAnchor(-1)}>
              ←
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setAnchor(new Date())}
            >
              Hoy
            </button>
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => shiftAnchor(1)}>
              →
            </button>
            <p className="min-w-40 text-sm font-semibold capitalize text-botanical">{heading}</p>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mb-3">
          <LiveMessage tone="danger">{error}</LiveMessage>
        </div>
      ) : null}
      {message ? (
        <div className="mb-3">
          <LiveMessage tone="ok">{message}</LiveMessage>
        </div>
      ) : null}

      {view === 'week' ? (
        <WeekCalendar
          anchor={anchor}
          appointments={appointments}
          patients={patientMap}
          services={serviceMap}
          onSlotClick={openCreate}
          onEventClick={openEdit}
        />
      ) : null}

      {view === 'month' ? (
        <MonthCalendar
          anchor={anchor}
          appointments={appointments}
          patients={patientMap}
          services={serviceMap}
          onDayClick={openCreate}
          onEventClick={openEdit}
        />
      ) : null}

      {view === 'list' ? (
        <div className="mt-1">
          {appointments.length === 0 ? (
            <EmptyState
              title="Sin citas"
              body="Cambia a Semana o Mes y haz clic en un hueco para agendar."
            />
          ) : (
            <div className="space-y-3">
              {appointments.map((a) => {
                const patient = patientMap[a.patientId];
                const service = serviceMap[a.items[0]?.serviceId ?? ''];
                return (
                  <button
                    key={a.id}
                    type="button"
                    className="panel w-full px-4 py-3 text-left transition hover:bg-white/90"
                    onClick={() => openEdit(a)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 font-semibold text-botanical">
                        {formatDateTime(a.scheduledAt)}
                      </p>
                      <StatusPill status={a.status} />
                    </div>
                    <p className="mt-1 truncate text-sm text-muted">
                      {patient
                        ? `${patient.firstName} ${patient.lastName}`
                        : 'Paciente'}
                      {service
                        ? ` · ${service.name} · ${formatUsd(service.basePriceUsd)}`
                        : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      <AppointmentModal
        open={modalOpen}
        mode={modalMode}
        initialAt={modalAt}
        appointment={editing}
        patients={patients}
        services={services}
        locations={locations}
        pending={pending}
        focusPatientId={focusPatientId}
        onClose={() => {
          if (patientCreateOpen) return;
          setModalOpen(false);
        }}
        onAddPatient={() => {
          setPatientFormError(null);
          setPatientCreateOpen(true);
        }}
        onDocumentSession={
          editing ? () => openDocumentSession(editing) : undefined
        }
        onSave={onSave}
      />

      <PatientCreateModal
        open={patientCreateOpen}
        stacked
        pending={patientPending}
        error={patientFormError}
        onClose={() => {
          if (patientPending) return;
          setPatientCreateOpen(false);
        }}
        onSave={onCreatePatient}
      />

      {token && membership ? (
        <VisitSessionModal
          open={visitOpen}
          mode={visitAppointment ? 'edit' : 'create'}
          token={token}
          specialistId={membership.membershipId}
          patients={patients}
          services={services}
          locations={locations}
          appointment={visitAppointment}
          onClose={() => {
            setVisitOpen(false);
            setVisitAppointment(null);
          }}
          onSaved={() => {
            setMessage(
              visitAppointment
                ? 'Visita de la cita actualizada'
                : 'Visita walk-in registrada (sin cita previa)',
            );
            void loadAppointments();
          }}
        />
      ) : null}
    </div>
  );
}
