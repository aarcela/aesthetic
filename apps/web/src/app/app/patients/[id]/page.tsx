'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';

import { ConsentUploadModal } from '@/components/patients/consent-upload-modal';
import { PatientClinicalForm } from '@/components/patients/patient-clinical-form';
import { PhotoUploadModal } from '@/components/patients/photo-upload-modal';
import { VisitSessionModal } from '@/components/patients/visit-session-modal';
import { EmptyState, LiveMessage, PageHeader, StatChip, StatusPill } from '@/components/ui';
import { formatDateTime, formatUsd, paymentLabel, canMarkAttendance, isAttendedVisit } from '@/lib/clinic';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { uploadToSignedUrl } from '@/lib/upload-media';
import {
  ageFromBirthDate,
  EMPTY_PATIENT_CLINICAL_FORM,
  optionLabel,
  PATIENT_MARITAL_OPTIONS,
  PATIENT_PHOTOTYPE_OPTIONS,
  PATIENT_SEX_OPTIONS,
  PATIENT_SKIN_BIOTYPE_OPTIONS,
  patientFormToPayload,
  patientRecordToForm,
  type PatientClinicalFormValues,
  type PatientClinicalRecord,
} from '@/lib/patient-history';
import {
  printVisitPrescription,
  visitHasPrintableContent,
  type VisitPrescriptionKind,
} from '@/lib/visit-prescription-print';

type Patient = PatientClinicalRecord & {
  id: string;
  medicalAlerts: string | null;
};

type SessionPhoto = {
  id: string;
  photoType: 'BEFORE' | 'AFTER' | 'OTHER';
  notes: string | null;
  createdAt: string;
  viewUrl: string | null;
  appointmentId?: string | null;
};

type VisitAppointment = {
  id: string;
  patientId: string;
  locationId?: string;
  scheduledAt: string;
  status: string;
  notes: string | null;
  visitDiagnosis: string | null;
  requestedExams: string | null;
  items: Array<{
    serviceId: string;
    serviceName: string | null;
    specialistName: string | null;
    unitPriceUsd: string;
    quantity: string;
  }>;
  photos: SessionPhoto[];
  materials: Array<{
    id: string;
    productName: string;
    unitOfMeasure: string;
    quantityUsed: number;
  }>;
};

type HistoryResponse = {
  patient: Patient;
  summary: {
    appointmentCount: number;
    visitCount?: number;
    saleCount: number;
    totalSpentUsd: string;
    photoCount: number;
    consentCount: number;
    lastVisitAt: string | null;
  };
  timeline: Array<
    | {
        kind: 'appointment';
        at: string;
        appointment: VisitAppointment;
      }
    | {
        kind: 'sale';
        at: string;
        sale: {
          id: string;
          status: string;
          amountUsd: string;
          postedAt: string | null;
          lines: Array<{
            serviceName: string | null;
            specialistName: string | null;
            lineTotalUsd: string;
          }>;
          payments: Array<{
            paymentMethod: string;
            amountNative: string;
            amountUsdEquivalent: string;
          }>;
        };
      }
  >;
  materials: Array<{
    id: string;
    createdAt: string;
    productName: string;
    unitOfMeasure: string;
    quantityUsed: number;
    unitCostUsdSnapshot: string;
    serviceName: string | null;
    source?: 'sale' | 'visit';
  }>;
  photos: SessionPhoto[];
  consents: Array<{
    id: string;
    procedureName: string;
    signedAt: string;
    viewUrl: string | null;
  }>;
};

type CatalogService = { id: string; name: string; basePriceUsd: string };
type CatalogLocation = { id: string; name: string };
type ClinicInfo = { name: string; taxId: string | null };

function photoTypeLabel(type: string) {
  if (type === 'BEFORE') return 'Antes';
  if (type === 'AFTER') return 'Después';
  return 'Otra';
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-botanical">{value}</p>
    </div>
  );
}

function routineLines(routine?: Record<string, string> | null) {
  if (!routine) return [];
  const labels: Record<string, string> = {
    cleanser: 'Limpiador',
    toner: 'Tónico',
    eyeContour: 'Contorno de ojos',
    serum: 'Suero',
    moisturizer: 'Hidratante',
    sunscreen: 'Protector solar',
    lipProtection: 'Protector de labios',
    doubleCleanser: 'Doble limpiador',
    notes: 'Notas',
  };
  return Object.entries(routine).flatMap(([key, value]) =>
    value ? [`${labels[key] ?? key}: ${value}`] : [],
  );
}

type Tab = 'resumen' | 'visitas' | 'materiales' | 'fotos' | 'consentimientos' | 'perfil';

export default function PatientHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, membership } = useAuth();
  const [tab, setTab] = useState<Tab>('resumen');
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [locations, setLocations] = useState<CatalogLocation[]>([]);
  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [visitOpen, setVisitOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<VisitAppointment | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PatientClinicalFormValues>(EMPTY_PATIENT_CLINICAL_FORM);

  const load = useCallback(async () => {
    if (!token || !id) return;
    const history = await apiFetch<HistoryResponse>(`/v1/patients/${id}/history`, {
      token,
    });
    setData(history);
    setProfile(patientRecordToForm(history.patient));
  }, [id, token]);

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [load]);

  useEffect(() => {
    if (!token || !membership?.tenantId) return;
    void Promise.all([
      apiFetch<CatalogService[]>('/v1/services', { token }),
      apiFetch<CatalogLocation[]>('/v1/locations', { token }),
      apiFetch<ClinicInfo>('/v1/tenant-settings/clinic', { token }),
    ])
      .then(([s, l, c]) => {
        setServices(s);
        setLocations(l);
        setClinic(c);
      })
      .catch((err: Error) => setError(err.message));
  }, [membership?.tenantId, token]);

  function openCreateVisit() {
    setEditingVisit(null);
    setVisitOpen(true);
    setError(null);
    setMessage(null);
  }

  function openEditVisit(appointment: VisitAppointment) {
    setEditingVisit(appointment);
    setVisitOpen(true);
    setTab('visitas');
    setError(null);
    setMessage(null);
  }

  function markAttendedAndOpenVisit(appointment: VisitAppointment) {
    if (!token) return;
    startTransition(async () => {
      try {
        await apiFetch(`/v1/appointments/${appointment.id}/status`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({ status: 'COMPLETED' }),
        });
        setMessage('Asistencia registrada');
        await load();
        openEditVisit({ ...appointment, status: 'COMPLETED' });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo marcar la asistencia');
      }
    });
  }

  function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!token || !id) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await apiFetch(`/v1/patients/${id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(patientFormToPayload(profile, { clearEmpty: true })),
        });
        setMessage('Perfil actualizado');
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo guardar');
      }
    });
  }

  function onPhotoUpload(payload: {
    photoType: 'BEFORE' | 'AFTER' | 'OTHER';
    notes?: string;
    file: File;
  }) {
    if (!token || !id) return;
    setMediaError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await apiFetch<{ uploadUrl: string }>('/v1/media/photos/upload-url', {
          method: 'POST',
          token,
          body: JSON.stringify({
            patientId: id,
            photoType: payload.photoType,
            fileName: payload.file.name,
            notes: payload.notes,
          }),
        });
        await uploadToSignedUrl(result.uploadUrl, payload.file);
        setPhotoOpen(false);
        setMessage('Foto agregada');
        await load();
      } catch (err) {
        setMediaError(err instanceof Error ? err.message : 'Error al subir foto');
      }
    });
  }

  function onConsentUpload(payload: { procedureName: string; file: File }) {
    if (!token || !id) return;
    setMediaError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await apiFetch<{ uploadUrl: string }>('/v1/media/consents/upload-url', {
          method: 'POST',
          token,
          body: JSON.stringify({
            patientId: id,
            procedureName: payload.procedureName,
            fileName: payload.file.name,
          }),
        });
        await uploadToSignedUrl(result.uploadUrl, payload.file);
        setConsentOpen(false);
        setMessage('Consentimiento registrado');
        await load();
      } catch (err) {
        setMediaError(err instanceof Error ? err.message : 'Error al subir consentimiento');
      }
    });
  }

  if (!data && !error) {
    return (
      <div className="flex min-h-40 items-center justify-center text-muted">
        Cargando historial…
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Paciente" subtitle="No se pudo cargar el historial." />
        <LiveMessage tone="danger">{error ?? 'Error'}</LiveMessage>
        <button type="button" className="btn btn-ghost mt-4" onClick={() => router.push('/app/patients')}>
          Volver
        </button>
      </div>
    );
  }

  const { patient, summary } = data;
  const patientAge = ageFromBirthDate(patient.dateOfBirth);
  const patientFullName = `${patient.firstName} ${patient.lastName}`;
  const locationNameById = Object.fromEntries(locations.map((location) => [location.id, location.name]));

  function printSavedVisit(
    appointment: VisitAppointment,
    kind: VisitPrescriptionKind,
  ) {
    const specialist =
      appointment.items.find((item) => item.specialistName)?.specialistName ??
      membership?.fullName ??
      'Profesional';
    const ok = printVisitPrescription({
      kind,
      clinicName: clinic?.name ?? 'Clínica',
      clinicTaxId: clinic?.taxId,
      locationName: appointment.locationId
        ? (locationNameById[appointment.locationId] ?? null)
        : null,
      specialistName: specialist,
      patientName: patientFullName,
      patientNationalId: patient.nationalId,
      patientAge,
      visitDate: formatDateTime(appointment.scheduledAt),
      serviceName: appointment.items[0]?.serviceName ?? null,
      visitDiagnosis: appointment.visitDiagnosis,
      indications: appointment.notes,
      requestedExams: appointment.requestedExams,
    });
    if (!ok) {
      setError('No hay contenido para imprimir o el navegador bloqueó la ventana.');
    }
  }

  const visits = data.timeline.filter(
    (entry): entry is Extract<HistoryResponse['timeline'][number], { kind: 'appointment' }> =>
      entry.kind === 'appointment' && isAttendedVisit(entry.appointment.status),
  );
  const upcomingAppointments = data.timeline.filter(
    (entry): entry is Extract<HistoryResponse['timeline'][number], { kind: 'appointment' }> =>
      entry.kind === 'appointment' && canMarkAttendance(entry.appointment.status),
  );
  const tabs: Array<[Tab, string]> = [
    ['resumen', 'Resumen'],
    ['visitas', 'Visitas'],
    ['materiales', 'Materiales'],
    ['fotos', 'Fotos'],
    ['consentimientos', 'Consentimientos'],
    ['perfil', 'Historia'],
  ];

  return (
    <div>
      <PageHeader
        title={`${patient.firstName} ${patient.lastName}`}
        subtitle="La visita se abre cuando la persona asiste. Si llegó sin agendar, regístrala como visita del día."
        action={
          <>
            <button type="button" className="btn btn-primary" onClick={openCreateVisit}>
              Llegó sin cita
            </button>
            <Link href="/app/patients" className="btn btn-ghost">
              ← Pacientes
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3 text-sm text-muted">
        <span className="tabular">{patient.phoneNumber}</span>
        {patient.nationalId ? <span>· CI {patient.nationalId}</span> : null}
        {patientAge !== null ? <span>· {patientAge} años</span> : null}
        {optionLabel(PATIENT_SEX_OPTIONS, patient.sex) ? (
          <span>· {optionLabel(PATIENT_SEX_OPTIONS, patient.sex)}</span>
        ) : null}
        {patient.medicalAlerts ? (
          <span className="status-pill" data-tone="danger">
            Alerta médica
          </span>
        ) : null}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatChip label="Citas" value={String(summary.appointmentCount)} />
        <StatChip label="Visitas" value={String(summary.visitCount ?? 0)} />
        <StatChip label="Gastado" value={formatUsd(summary.totalSpentUsd)} />
        <StatChip
          label="Última visita"
          value={
            summary.lastVisitAt
              ? new Date(summary.lastVisitAt).toLocaleDateString('es-VE')
              : '—'
          }
        />
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

      <div
        className="seg mb-5"
        role="tablist"
        aria-label="Secciones del historial"
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className="seg-btn"
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'resumen' ? (
        <div className="space-y-4">
          {patient.medicalAlerts ? (
            <section className="panel border-l-4 border-l-danger p-5">
              <h2 className="text-lg font-semibold text-botanical">Alertas médicas</h2>
              <p className="mt-2 whitespace-pre-wrap text-muted">{patient.medicalAlerts}</p>
            </section>
          ) : null}

          <section className="panel p-5">
            <h2 className="mb-3 text-lg font-semibold text-botanical">Historia clínica</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail label="Motivo de consulta" value={patient.consultationReason} />
              <Detail label="Diagnóstico" value={patient.diagnosis} />
              <Detail
                label="Estado civil"
                value={optionLabel(PATIENT_MARITAL_OPTIONS, patient.maritalStatus)}
              />
              <Detail label="Ocupación" value={patient.occupation} />
              <Detail label="Actividad física" value={patient.physicalActivity} />
              <Detail label="Alimentación" value={patient.diet} />
              <Detail label="Sueño" value={patient.sleep} />
              <Detail label="Antecedentes estéticos" value={patient.aestheticHistory} />
              <Detail
                label="Biotipo cutáneo"
                value={optionLabel(PATIENT_SKIN_BIOTYPE_OPTIONS, patient.skinBiotype)}
              />
              <Detail
                label="Fototipo"
                value={optionLabel(PATIENT_PHOTOTYPE_OPTIONS, patient.phototype)}
              />
              <Detail label="Envejecimiento" value={patient.aging} />
              <Detail label="Lesiones" value={patient.lesions} />
              <Detail label="Cicatrices" value={patient.scars} />
            </div>
            {routineLines(patient.homeRoutineAm).length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Rutina AM
                </p>
                <p className="mt-1 text-sm text-botanical">
                  {routineLines(patient.homeRoutineAm).join(' · ')}
                </p>
              </div>
            ) : null}
            {routineLines(patient.homeRoutinePm).length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Rutina PM
                </p>
                <p className="mt-1 text-sm text-botanical">
                  {routineLines(patient.homeRoutinePm).join(' · ')}
                </p>
              </div>
            ) : null}
          </section>

          {upcomingAppointments.length > 0 ? (
            <section className="panel p-5">
              <h2 className="mb-3 text-lg font-semibold text-botanical">Citas pendientes</h2>
              <div className="space-y-3">
                {upcomingAppointments.map((entry) => (
                  <div
                    key={`u-${entry.appointment.id}`}
                    className="rounded-2xl border border-line bg-white/70 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-botanical">
                        {formatDateTime(entry.appointment.scheduledAt)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={entry.appointment.status} />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={pending}
                          onClick={() => markAttendedAndOpenVisit(entry.appointment)}
                        >
                          Paciente asistió
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {entry.appointment.items
                        .map((item) => item.serviceName ?? 'Servicio')
                        .join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="panel p-5">
            <h2 className="mb-3 text-lg font-semibold text-botanical">Línea de tiempo</h2>
            {data.timeline.length === 0 ? (
              <EmptyState
                title="Sin actividad aún"
                body="Agenda una cita. La visita aparece cuando el paciente asiste, o registra un walk-in."
              />
            ) : (
              <div className="space-y-3">
                {data.timeline.slice(0, 8).map((entry) =>
                  entry.kind === 'appointment' ? (
                    <div
                      key={`a-${entry.appointment.id}`}
                      className="rounded-2xl border border-line bg-white/70 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-botanical">
                          {isAttendedVisit(entry.appointment.status) ? 'Visita' : 'Cita'}
                          {' · '}
                          {formatDateTime(entry.appointment.scheduledAt)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill status={entry.appointment.status} />
                          {canMarkAttendance(entry.appointment.status) ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={pending}
                              onClick={() => markAttendedAndOpenVisit(entry.appointment)}
                            >
                              Paciente asistió
                            </button>
                          ) : isAttendedVisit(entry.appointment.status) ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => openEditVisit(entry.appointment)}
                            >
                              Documentar
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {entry.appointment.items
                          .map((item) => item.serviceName ?? 'Servicio')
                          .join(', ')}
                      </p>
                    </div>
                  ) : (
                    <div
                      key={`s-${entry.sale.id}`}
                      className="rounded-2xl border border-line bg-white/70 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-botanical">
                          Cobro · {formatDateTime(String(entry.at))}
                        </p>
                        <StatusPill status={entry.sale.status.toUpperCase()} />
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {entry.sale.lines
                          .map((line) => line.serviceName ?? 'Servicio')
                          .join(', ')}{' '}
                        · {formatUsd(entry.sale.amountUsd)}
                      </p>
                    </div>
                  ),
                )}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'visitas' ? (
        <div className="space-y-4">
          <section className="panel p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-botanical">Visitas</h2>
              <button type="button" className="btn btn-primary btn-sm" onClick={openCreateVisit}>
                Llegó sin cita
              </button>
            </div>
            {visits.length === 0 ? (
              <p className="text-muted">
                Aún no hay visitas. Aparecen al marcar asistencia en una cita, o con un walk-in.
              </p>
            ) : (
              <div className="space-y-3">
                {visits.map((entry) => (
                      <div
                        key={entry.appointment.id}
                        className="rounded-2xl border border-line bg-white/70 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-botanical">
                            {formatDateTime(entry.appointment.scheduledAt)}
                          </p>
                          <StatusPill status={entry.appointment.status} />
                        </div>
                        <ul className="mt-2 space-y-1 text-sm text-muted">
                          {entry.appointment.items.map((item, index) => (
                            <li key={`${entry.appointment.id}-${index}`}>
                              {item.serviceName ?? 'Servicio'}
                              {item.specialistName ? ` · ${item.specialistName}` : ''}
                              {' · '}
                              {formatUsd(item.unitPriceUsd)}
                            </li>
                          ))}
                        </ul>
                        {entry.appointment.visitDiagnosis ? (
                          <div className="mt-3 rounded-xl bg-mist/50 px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                              Diagnóstico
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-botanical">
                              {entry.appointment.visitDiagnosis}
                            </p>
                          </div>
                        ) : null}
                        {entry.appointment.requestedExams ? (
                          <div className="mt-3 rounded-xl bg-mist/50 px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                              Exámenes solicitados
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-botanical">
                              {entry.appointment.requestedExams}
                            </p>
                          </div>
                        ) : null}
                        {entry.appointment.notes ? (
                          <div className="mt-3 rounded-xl bg-mist/50 px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                              Indicaciones / Receta
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-botanical">
                              {entry.appointment.notes}
                            </p>
                          </div>
                        ) : null}
                        {entry.appointment.materials?.length ? (
                          <ul className="mt-2 space-y-1 text-sm text-muted">
                            {entry.appointment.materials.map((mat) => (
                              <li key={mat.id}>
                                Material · {mat.productName} · {mat.quantityUsed}{' '}
                                {mat.unitOfMeasure}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-muted">Sin materiales registrados.</p>
                        )}
                        {entry.appointment.photos?.length ? (
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {entry.appointment.photos.map((photo) => (
                              <a
                                key={photo.id}
                                href={photo.viewUrl ?? undefined}
                                target="_blank"
                                rel="noreferrer"
                                className="block overflow-hidden rounded-xl border border-line bg-mist/40"
                              >
                                {photo.viewUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={photo.viewUrl}
                                    alt={photoTypeLabel(photo.photoType)}
                                    className="aspect-square w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex aspect-square items-center justify-center text-xs text-muted">
                                    Sin vista
                                  </div>
                                )}
                                <p className="px-2 py-1 text-xs font-semibold text-botanical">
                                  {photoTypeLabel(photo.photoType)}
                                </p>
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-muted">Sin fotos de sesión aún.</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => openEditVisit(entry.appointment)}
                          >
                            Documentar visita
                          </button>
                          {visitHasPrintableContent({
                            kind: 'indications',
                            visitDiagnosis: entry.appointment.visitDiagnosis,
                            indications: entry.appointment.notes,
                            requestedExams: entry.appointment.requestedExams,
                          }) ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => printSavedVisit(entry.appointment, 'indications')}
                            >
                              Imprimir receta
                            </button>
                          ) : null}
                          {visitHasPrintableContent({
                            kind: 'exams',
                            visitDiagnosis: entry.appointment.visitDiagnosis,
                            indications: entry.appointment.notes,
                            requestedExams: entry.appointment.requestedExams,
                          }) ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => printSavedVisit(entry.appointment, 'exams')}
                            >
                              Imprimir exámenes
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
              </div>
            )}
          </section>

          <section className="panel p-5">
            <h2 className="mb-3 text-lg font-semibold text-botanical">Cobrados</h2>
            {data.timeline.filter((t) => t.kind === 'sale').length === 0 ? (
              <p className="text-muted">Sin ventas asociadas.</p>
            ) : (
              <div className="space-y-3">
                {data.timeline
                  .filter((t) => t.kind === 'sale')
                  .map((entry) =>
                    entry.kind === 'sale' ? (
                      <div
                        key={entry.sale.id}
                        className="rounded-2xl border border-line bg-white/70 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-botanical">
                            {formatUsd(entry.sale.amountUsd)} ·{' '}
                            {formatDateTime(String(entry.at))}
                          </p>
                          <StatusPill status={entry.sale.status.toUpperCase()} />
                        </div>
                        <ul className="mt-2 space-y-1 text-sm text-muted">
                          {entry.sale.lines.map((line, index) => (
                            <li key={`${entry.sale.id}-l-${index}`}>
                              {line.serviceName ?? 'Servicio'}
                              {line.specialistName ? ` · ${line.specialistName}` : ''}
                              {' · '}
                              {formatUsd(line.lineTotalUsd)}
                            </li>
                          ))}
                        </ul>
                        {entry.sale.payments.length > 0 ? (
                          <p className="mt-2 text-sm text-muted">
                            Pagos:{' '}
                            {entry.sale.payments
                              .map(
                                (p) =>
                                  `${paymentLabel(p.paymentMethod)} ${p.amountNative}`,
                              )
                              .join(' · ')}
                          </p>
                        ) : null}
                      </div>
                    ) : null,
                  )}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'materiales' ? (
        <section className="panel p-5">
          <h2 className="mb-1 text-lg font-semibold text-botanical">Materiales usados</h2>
          <p className="mb-4 text-sm text-muted">
            Desde visitas (Pro) o al postear ventas con receta.
          </p>
          {data.materials.length === 0 ? (
            <EmptyState
              title="Sin materiales"
              body="Agrégalos al editar una visita, o aparecerán al cobrar con receta Pro."
            />
          ) : (
            <div className="space-y-3">
              {data.materials.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-white/70 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-botanical">{row.productName}</p>
                    <p className="text-sm text-muted">
                      {row.serviceName ?? 'Procedimiento'}
                      {row.source === 'visit' ? ' · visita' : row.source === 'sale' ? ' · cobro' : ''}
                      {' · '}
                      {formatDateTime(row.createdAt)}
                    </p>
                  </div>
                  <p className="tabular text-sm font-semibold text-botanical">
                    {row.quantityUsed} {row.unitOfMeasure}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === 'fotos' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setMediaError(null);
                setPhotoOpen(true);
              }}
            >
              Subir foto
            </button>
          </div>
          <section className="panel p-5">
            <h2 className="mb-3 text-lg font-semibold text-botanical">Galería</h2>
            {data.photos.length === 0 ? (
              <EmptyState title="Sin fotos" body="Sube antes/después con “Subir foto”." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.photos.map((photo) => (
                  <figure
                    key={photo.id}
                    className="overflow-hidden rounded-2xl border border-line bg-white/70"
                  >
                    {photo.viewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.viewUrl}
                        alt={photo.photoType}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center text-sm text-muted">
                        Sin vista previa
                      </div>
                    )}
                    <figcaption className="px-3 py-2 text-sm">
                      <p className="font-semibold text-botanical">
                        {photoTypeLabel(photo.photoType)}
                      </p>
                      <p className="text-muted">{formatDateTime(photo.createdAt)}</p>
                      {photo.notes ? <p className="mt-1 text-muted">{photo.notes}</p> : null}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'consentimientos' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setMediaError(null);
                setConsentOpen(true);
              }}
            >
              Registrar consentimiento
            </button>
          </div>
          <section className="panel p-5">
            <h2 className="mb-3 text-lg font-semibold text-botanical">Firmados</h2>
            {data.consents.length === 0 ? (
              <EmptyState
                title="Sin consentimientos"
                body="Guarda la firma o documento con “Registrar consentimiento”."
              />
            ) : (
              <div className="space-y-3">
                {data.consents.map((consent) => (
                  <div
                    key={consent.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white/70 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-botanical">{consent.procedureName}</p>
                      <p className="text-sm text-muted">
                        {formatDateTime(consent.signedAt)}
                      </p>
                    </div>
                    {consent.viewUrl ? (
                      <a
                        href={consent.viewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost btn-sm"
                      >
                        Ver
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'perfil' ? (
        <form className="panel p-5" onSubmit={saveProfile} autoComplete="off">
          <PatientClinicalForm
            idPrefix="hist"
            values={profile}
            onChange={(patch) => setProfile((current) => ({ ...current, ...patch }))}
          />
          <div className="mt-6">
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar perfil'}
            </button>
          </div>
        </form>
      ) : null}

      {token && membership && id ? (
        <VisitSessionModal
          open={visitOpen}
          mode={editingVisit ? 'edit' : 'create'}
          token={token}
          specialistId={membership.membershipId}
          specialistName={membership.fullName}
          clinicName={clinic?.name}
          clinicTaxId={clinic?.taxId}
          patientNationalId={patient.nationalId}
          patientAge={patientAge}
          patientId={id}
          patientLabel={patientFullName}
          services={services}
          locations={locations}
          appointment={editingVisit}
          onClose={() => {
            setVisitOpen(false);
            setEditingVisit(null);
          }}
          onSaved={async () => {
            setMessage(editingVisit ? 'Visita de la cita actualizada' : 'Visita walk-in registrada');
            setTab('visitas');
            await load();
          }}
        />
      ) : null}

      <PhotoUploadModal
        open={photoOpen}
        pending={pending}
        error={mediaError}
        onClose={() => setPhotoOpen(false)}
        onSave={onPhotoUpload}
      />

      <ConsentUploadModal
        open={consentOpen}
        pending={pending}
        error={mediaError}
        onClose={() => setConsentOpen(false)}
        onSave={onConsentUpload}
      />
    </div>
  );
}
