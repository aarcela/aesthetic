'use client';

import { FormEvent, useEffect, useId, useRef, useState } from 'react';

import { IconClose } from '@/components/icons';

import { fromDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/agenda-dates';
import { ApiError, apiFetch } from '@/lib/api';
import { formatDateTime, formatPackage, formatUsd } from '@/lib/clinic';
import { resizeImageFile } from '@/lib/resize-image';
import { uploadToSignedUrl } from '@/lib/upload-media';
import {
  printVisitPrescription,
  visitHasPrintableContent,
  type VisitPrescriptionKind,
} from '@/lib/visit-prescription-print';

export type VisitService = {
  id: string;
  name: string;
  basePriceUsd: string;
};

export type VisitLocation = {
  id: string;
  name: string;
};

export type VisitPatient = {
  id: string;
  firstName: string;
  lastName: string;
};

export type VisitExistingPhoto = {
  id: string;
  photoType: 'BEFORE' | 'AFTER' | 'OTHER';
  viewUrl: string | null;
  notes?: string | null;
};

export type VisitMaterial = {
  id: string;
  productName: string;
  unitOfMeasure: string;
  quantityUsed: number;
};

export type VisitAppointment = {
  id: string;
  patientId: string;
  locationId?: string;
  scheduledAt: string;
  status: string;
  notes?: string | null;
  visitDiagnosis?: string | null;
  requestedExams?: string | null;
  items: Array<{ serviceId: string; unitPriceUsd?: string; serviceName?: string | null }>;
  photos?: VisitExistingPhoto[];
  materials?: VisitMaterial[];
};

type InventoryItem = {
  id: string;
  productName: string;
  unitOfMeasure: string;
  packageCapacity?: string;
  currentStock: string;
};

type MaterialDraft = {
  id: string;
  inventoryItemId: string;
  quantity: string;
};

type SessionPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  photoType: 'BEFORE' | 'AFTER' | 'OTHER';
  originalBytes: number;
};

const STATUSES = [
  { value: 'SCHEDULED', label: 'Agendada' },
  { value: 'CONFIRMED', label: 'Confirmada' },
  { value: 'COMPLETED', label: 'Completada' },
  { value: 'CANCELLED', label: 'Cancelada' },
  { value: 'NO_SHOW', label: 'No asistió' },
] as const;

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  token: string;
  specialistId: string;
  specialistName?: string;
  clinicName?: string;
  clinicTaxId?: string | null;
  patientNationalId?: string | null;
  patientAge?: number | null;
  /** Locked patient (historial). Omit to choose from `patients`. */
  patientId?: string;
  patientLabel?: string;
  patients?: VisitPatient[];
  services: VisitService[];
  locations: VisitLocation[];
  appointment?: VisitAppointment | null;
  onClose: () => void;
  onSaved: (result: { appointmentId: string; patientId: string }) => void;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function photoTypeLabel(type: string) {
  if (type === 'BEFORE') return 'Antes';
  if (type === 'AFTER') return 'Después';
  return 'Otra';
}

export function VisitSessionModal({
  open,
  mode,
  token,
  specialistId,
  specialistName = 'Profesional',
  clinicName = 'Clínica',
  clinicTaxId,
  patientNationalId,
  patientAge,
  patientId: lockedPatientId,
  patientLabel,
  patients = [],
  services,
  locations,
  appointment,
  onClose,
  onSaved,
}: Props) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initKeyRef = useRef<string | null>(null);
  const [patientId, setPatientId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [locationId, setLocationId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [notes, setNotes] = useState('');
  const [visitDiagnosis, setVisitDiagnosis] = useState('');
  const [requestedExams, setRequestedExams] = useState('');
  const [previousNotes, setPreviousNotes] = useState('');
  const [previousDiagnosis, setPreviousDiagnosis] = useState('');
  const [previousExams, setPreviousExams] = useState('');
  const autoFilledNotesRef = useRef('');
  const autoFilledDiagnosisRef = useRef('');
  const autoFilledExamsRef = useRef('');
  const [status, setStatus] = useState('SCHEDULED');
  const [photoType, setPhotoType] = useState<'BEFORE' | 'AFTER' | 'OTHER'>('BEFORE');
  const [photos, setPhotos] = useState<SessionPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<VisitExistingPhoto[]>([]);
  const [existingMaterials, setExistingMaterials] = useState<VisitMaterial[]>([]);
  const [materialDrafts, setMaterialDrafts] = useState<MaterialDraft[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryAvailable, setInventoryAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const photosRef = useRef<SessionPhoto[]>([]);
  photosRef.current = photos;

  const patientLocked = Boolean(lockedPatientId) || mode === 'edit';
  const isEdit = mode === 'edit';

  useEffect(() => {
    if (!open) {
      initKeyRef.current = null;
      return;
    }

    const key = `${mode}:${appointment?.id ?? 'new'}:${lockedPatientId ?? 'pick'}`;
    if (initKeyRef.current === key) return;

    if (!locations.length || !services.length) return;
    if (!patientLocked && !patients.length && !lockedPatientId) return;

    initKeyRef.current = key;
    autoFilledNotesRef.current = '';
    autoFilledDiagnosisRef.current = '';
    autoFilledExamsRef.current = '';
    setPreviousNotes('');
    setPreviousDiagnosis('');
    setPreviousExams('');

    for (const p of photosRef.current) URL.revokeObjectURL(p.previewUrl);

    if (isEdit && appointment) {
      setPatientId(appointment.patientId);
      setScheduledAt(toDatetimeLocalValue(new Date(appointment.scheduledAt)));
      setLocationId(appointment.locationId ?? locations[0]?.id ?? '');
      setServiceId(appointment.items[0]?.serviceId ?? services[0]?.id ?? '');
      setNotes(appointment.notes ?? '');
      setVisitDiagnosis(appointment.visitDiagnosis ?? '');
      setRequestedExams(appointment.requestedExams ?? '');
      setStatus(appointment.status || 'SCHEDULED');
      setExistingPhotos(appointment.photos ?? []);
      setExistingMaterials(appointment.materials ?? []);
    } else {
      const now = new Date();
      now.setSeconds(0, 0);
      setPatientId(lockedPatientId ?? patients[0]?.id ?? '');
      setScheduledAt(toDatetimeLocalValue(now));
      setLocationId(locations[0]?.id ?? '');
      setServiceId(services[0]?.id ?? '');
      setNotes('');
      setVisitDiagnosis('');
      setRequestedExams('');
      setStatus('COMPLETED');
      setExistingPhotos([]);
      setExistingMaterials([]);
    }
    setPhotos([]);
    setMaterialDrafts([]);
    setPhotoType('BEFORE');
    setError(null);
    setPending(false);
    setCompressing(false);
  }, [
    open,
    mode,
    isEdit,
    appointment,
    locations,
    services,
    lockedPatientId,
    patients,
    patientLocked,
  ]);

  useEffect(() => {
    if (!open || !token || !patientId) return;
    let cancelled = false;
    const params = new URLSearchParams({ patientId });
    if (isEdit && appointment?.id) params.set('excludeId', appointment.id);

    void apiFetch<{
      notes: string | null;
      visitDiagnosis: string | null;
      requestedExams: string | null;
    }>(`/v1/appointments/latest-notes?${params}`, {
      token,
    })
      .then((result) => {
        if (cancelled) return;
        const prevNotes = result.notes?.trim() ?? '';
        const prevDiagnosis = result.visitDiagnosis?.trim() ?? '';
        const prevExams = result.requestedExams?.trim() ?? '';
        setPreviousNotes(prevNotes);
        setPreviousDiagnosis(prevDiagnosis);
        setPreviousExams(prevExams);

        const existingNotes = isEdit ? (appointment?.notes?.trim() ?? '') : '';
        const existingDiagnosis = isEdit ? (appointment?.visitDiagnosis?.trim() ?? '') : '';
        const existingExams = isEdit ? (appointment?.requestedExams?.trim() ?? '') : '';

        if (!existingNotes) {
          setNotes((current) => {
            if (!current.trim() || current === autoFilledNotesRef.current) {
              autoFilledNotesRef.current = prevNotes;
              return prevNotes;
            }
            return current;
          });
        }
        if (!existingDiagnosis) {
          setVisitDiagnosis((current) => {
            if (!current.trim() || current === autoFilledDiagnosisRef.current) {
              autoFilledDiagnosisRef.current = prevDiagnosis;
              return prevDiagnosis;
            }
            return current;
          });
        }
        if (!existingExams) {
          setRequestedExams((current) => {
            if (!current.trim() || current === autoFilledExamsRef.current) {
              autoFilledExamsRef.current = prevExams;
              return prevExams;
            }
            return current;
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviousNotes('');
          setPreviousDiagnosis('');
          setPreviousExams('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, token, patientId, isEdit, appointment?.id, appointment?.notes, appointment?.visitDiagnosis, appointment?.requestedExams]);

  useEffect(() => {
    return () => {
      for (const p of photosRef.current) URL.revokeObjectURL(p.previewUrl);
    };
  }, []);

  useEffect(() => {
    if (!open || !token) return;
    void apiFetch<InventoryItem[]>('/v1/inventory/items?kind=MATERIAL', { token })
      .then((items) => {
        setInventoryItems(items);
        setInventoryAvailable(true);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.code === 'PLAN_UPGRADE_REQUIRED') {
          setInventoryAvailable(false);
          setInventoryItems([]);
          return;
        }
        // Soft-fail: visit can still save without materials.
        setInventoryAvailable(false);
      });
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending && !compressing) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, pending, compressing]);

  if (!open) return null;

  const selectedPatient = patients.find((p) => p.id === patientId);
  const headingPatient =
    patientLabel ??
    (selectedPatient
      ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
      : 'Paciente');

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setCompressing(true);
    setError(null);
    try {
      const next: SessionPhoto[] = [];
      for (const original of Array.from(fileList)) {
        const file = await resizeImageFile(original, { maxEdge: 1600, quality: 0.82 });
        next.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          photoType,
          originalBytes: original.size,
        });
      }
      setPhotos((prev) => [...prev, ...next]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron procesar las fotos');
    } finally {
      setCompressing(false);
    }
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!patientId || !locationId || !serviceId) {
      setError('Completa paciente, sede y procedimiento.');
      return;
    }

    const service = services.find((s) => s.id === serviceId);
    setPending(true);
    setError(null);

    try {
      let appointmentId = appointment?.id;

      if (mode === 'create') {
        const created = await apiFetch<{ id: string }>('/v1/appointments', {
          method: 'POST',
          token,
          body: JSON.stringify({
            locationId,
            patientId,
            scheduledAt: fromDatetimeLocalValue(scheduledAt),
            notes: notes.trim() || undefined,
            visitDiagnosis: visitDiagnosis.trim() || undefined,
            requestedExams: requestedExams.trim() || undefined,
            status: 'COMPLETED',
            items: [
              {
                serviceId,
                specialistId,
                quantity: 1,
                unitPriceUsd: Number(service?.basePriceUsd ?? 0),
              },
            ],
          }),
        });
        appointmentId = created.id;
      } else if (appointmentId) {
        await apiFetch(`/v1/appointments/${appointmentId}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({
            locationId,
            patientId,
            scheduledAt: fromDatetimeLocalValue(scheduledAt),
            notes: notes.trim() || null,
            visitDiagnosis: visitDiagnosis.trim() || null,
            requestedExams: requestedExams.trim() || null,
            status,
            items: [
              {
                serviceId,
                specialistId,
                quantity: 1,
                unitPriceUsd: Number(
                  service?.basePriceUsd ?? appointment?.items[0]?.unitPriceUsd ?? 0,
                ),
              },
            ],
          }),
        });
      }

      if (!appointmentId) {
        throw new Error('No se pudo guardar la visita');
      }

      for (const photo of photos) {
        const result = await apiFetch<{ uploadUrl: string }>('/v1/media/photos/upload-url', {
          method: 'POST',
          token,
          body: JSON.stringify({
            patientId,
            appointmentId,
            photoType: photo.photoType,
            fileName: photo.file.name,
          }),
        });
        await uploadToSignedUrl(result.uploadUrl, photo.file);
      }

      const materialsPayload = materialDrafts
        .map((row) => ({
          inventoryItemId: row.inventoryItemId,
          quantity: Number(row.quantity),
        }))
        .filter((row) => row.inventoryItemId && row.quantity > 0);

      if (materialsPayload.length > 0) {
        await apiFetch(`/v1/appointments/${appointmentId}/materials`, {
          method: 'POST',
          token,
          body: JSON.stringify({ materials: materialsPayload }),
        });
      }

      onSaved({ appointmentId, patientId });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la visita');
    } finally {
      setPending(false);
    }
  }

  const busy = pending || compressing;
  const hasAnyPhotos = existingPhotos.length > 0 || photos.length > 0;
  const selectedLocation = locations.find((l) => l.id === locationId);
  const selectedService = services.find((s) => s.id === serviceId);

  function handlePrint(kind: VisitPrescriptionKind) {
    const ok = printVisitPrescription({
      kind,
      clinicName,
      clinicTaxId,
      locationName: selectedLocation?.name ?? null,
      specialistName,
      patientName: headingPatient,
      patientNationalId,
      patientAge,
      visitDate: formatDateTime(fromDatetimeLocalValue(scheduledAt)),
      serviceName: selectedService?.name ?? appointment?.items[0]?.serviceName ?? null,
      visitDiagnosis: visitDiagnosis.trim() || null,
      indications: notes.trim() || null,
      requestedExams: requestedExams.trim() || null,
    });
    if (!ok) {
      setError('No hay contenido para imprimir o el navegador bloqueó la ventana.');
    }
  }

  const canPrintFull = visitHasPrintableContent({
    kind: 'full',
    visitDiagnosis,
    indications: notes,
    requestedExams,
  });
  const canPrintIndications = visitHasPrintableContent({
    kind: 'indications',
    visitDiagnosis,
    indications: notes,
    requestedExams,
  });
  const canPrintExams = visitHasPrintableContent({
    kind: 'exams',
    visitDiagnosis,
    indications: notes,
    requestedExams,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-botanical-deep/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="panel fade-up flex max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden rounded-b-none rounded-t-3xl sm:max-h-[90dvh] sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        autoComplete="off"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="brand-mark text-2xl text-botanical sm:text-3xl">
              {isEdit ? 'Documentar visita' : 'Visita walk-in'}
            </h2>
            <p className="mt-1 truncate text-sm text-muted">
              {isEdit
                ? `Ligada a la cita · ${appointment ? formatDateTime(appointment.scheduledAt) : headingPatient}`
                : `${headingPatient} · sin cita previa, queda como visita completada`}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon shrink-0"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={busy}
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {!patientLocked ? (
              <div className="sm:col-span-2">
                <label className="label" htmlFor="visit-patient">
                  Paciente
                </label>
                <select
                  id="visit-patient"
                  className="field"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  required
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <label className="label" htmlFor="visit-when">
                Fecha y hora
              </label>
              <input
                id="visit-when"
                className="field"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="visit-location">
                Sede
              </label>
              <select
                id="visit-location"
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

            <div className="sm:col-span-2">
              <label className="label" htmlFor="visit-service">
                Procedimiento / servicio
              </label>
              <select
                id="visit-service"
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

            {isEdit ? (
              <div>
                <label className="label" htmlFor="visit-status">
                  Estado
                </label>
                <select
                  id="visit-status"
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
            ) : (
              <div>
                <p className="label">Estado</p>
                <p className="pt-2 text-sm text-botanical">Completada · el paciente asistió</p>
              </div>
            )}

            <div className="sm:col-span-2 rounded-2xl border border-line bg-white/60 p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-botanical">Documentación clínica</p>
                  <p className="text-xs text-muted">
                    Diagnóstico, exámenes e indicaciones por separado. Imprimible en formato receta.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy || !canPrintIndications}
                    onClick={() => handlePrint('indications')}
                  >
                    Imprimir receta
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy || !canPrintExams}
                    onClick={() => handlePrint('exams')}
                  >
                    Imprimir exámenes
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy || !canPrintFull}
                    onClick={() => handlePrint('full')}
                  >
                    Imprimir todo
                  </button>
                </div>
              </div>

              <div className="grid gap-3">
                <div>
                  <label className="label" htmlFor="visit-diagnosis">
                    Diagnóstico
                  </label>
                  <textarea
                    id="visit-diagnosis"
                    name="visitDiagnosis"
                    className="field min-h-24 resize-y"
                    rows={3}
                    value={visitDiagnosis}
                    onChange={(e) => setVisitDiagnosis(e.target.value)}
                    placeholder="Diagnóstico de esta visita…"
                    autoComplete="off"
                  />
                  {previousDiagnosis && visitDiagnosis.trim() !== previousDiagnosis ? (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setVisitDiagnosis(previousDiagnosis);
                          autoFilledDiagnosisRef.current = previousDiagnosis;
                        }}
                      >
                        Usar diagnóstico anterior
                      </button>
                    </div>
                  ) : null}
                </div>

                <div>
                  <label className="label" htmlFor="visit-exams">
                    Exámenes solicitados
                  </label>
                  <textarea
                    id="visit-exams"
                    name="requestedExams"
                    className="field min-h-24 resize-y"
                    rows={3}
                    value={requestedExams}
                    onChange={(e) => setRequestedExams(e.target.value)}
                    placeholder="Laboratorio, imagenología, otros estudios…"
                    autoComplete="off"
                  />
                  {previousExams && requestedExams.trim() !== previousExams ? (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setRequestedExams(previousExams);
                          autoFilledExamsRef.current = previousExams;
                        }}
                      >
                        Usar exámenes anteriores
                      </button>
                    </div>
                  ) : null}
                </div>

                <div>
                  <label className="label" htmlFor="visit-notes">
                    Indicaciones / Receta
                  </label>
                  <textarea
                    id="visit-notes"
                    name="notes"
                    className="field min-h-36 resize-y"
                    rows={6}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Medicamentos, rutina, cuidados en casa, reposo laboral…"
                    autoComplete="off"
                  />
                  {previousNotes ? (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted">
                        {notes.trim() === previousNotes
                          ? 'Se copió la indicación de la visita anterior. Puedes mantenerla o cambiarla.'
                          : 'Hay una indicación anterior para este paciente.'}
                      </p>
                      {notes.trim() !== previousNotes ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setNotes(previousNotes);
                            autoFilledNotesRef.current = previousNotes;
                          }}
                        >
                          Usar indicación anterior
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted">
                      Para farmacia o reposo. Si ya hay indicación previa, se copia al abrir la visita.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {inventoryAvailable ? (
            <div className="mt-4 rounded-2xl border border-line bg-white/60 p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-botanical">Materiales usados</p>
                  <p className="text-xs text-muted">
                    Solo insumos de la visita. Los productos de venta se cobran en Finanzas.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy || inventoryItems.length === 0}
                  onClick={() =>
                    setMaterialDrafts((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        inventoryItemId: inventoryItems[0]?.id ?? '',
                        quantity: '1',
                      },
                    ])
                  }
                >
                  + Material
                </button>
              </div>

              {existingMaterials.length > 0 ? (
                <ul className="mb-3 space-y-2">
                  {existingMaterials.map((mat) => (
                    <li
                      key={mat.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white/80 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-botanical">{mat.productName}</span>
                      <span className="tabular text-muted">
                        {mat.quantityUsed} {mat.unitOfMeasure}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {materialDrafts.length === 0 && existingMaterials.length === 0 ? (
                <p className="text-sm text-muted">
                  {inventoryItems.length === 0
                    ? 'No hay materiales de visita. Agrégalos en Inventario como “Material de visita”.'
                    : 'Opcional. Agrega lo que usaste en esta sesión.'}
                </p>
              ) : null}

              {materialDrafts.length > 0 ? (
                <ul className="space-y-2">
                  {materialDrafts.map((draft) => {
                    const item = inventoryItems.find((i) => i.id === draft.inventoryItemId);
                    return (
                      <li
                        key={draft.id}
                        className="grid gap-2 rounded-xl border border-line bg-white/80 p-3 sm:grid-cols-[1fr_7rem_auto]"
                      >
                        <select
                          className="field"
                          value={draft.inventoryItemId}
                          onChange={(e) =>
                            setMaterialDrafts((prev) =>
                              prev.map((row) =>
                                row.id === draft.id
                                  ? { ...row, inventoryItemId: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          aria-label="Producto"
                        >
                          {inventoryItems.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.productName}{' '}
                              {formatPackage(inv.packageCapacity ?? 1, inv.unitOfMeasure)}{' '}
                              (stock {inv.currentStock} {inv.unitOfMeasure})
                            </option>
                          ))}
                        </select>
                        <input
                          className="field tabular"
                          type="number"
                          inputMode="decimal"
                          min="0.01"
                          step="0.01"
                          value={draft.quantity}
                          onChange={(e) =>
                            setMaterialDrafts((prev) =>
                              prev.map((row) =>
                                row.id === draft.id
                                  ? { ...row, quantity: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          aria-label="Cantidad"
                          placeholder={item?.unitOfMeasure ?? 'qty'}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setMaterialDrafts((prev) => prev.filter((row) => row.id !== draft.id))
                          }
                        >
                          Quitar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Materiales por visita requieren plan Pro e inventario cargado.
            </p>
          )}

          <div className="mt-4 rounded-2xl border border-line bg-white/60 p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-botanical">Fotos de la sesión</p>
                <p className="text-xs text-muted">
                  Se reducen automáticamente (máx. 1600px) antes de subir.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  id="visit-photo-type"
                  className="field field-sm w-auto min-w-28"
                  value={photoType}
                  onChange={(e) =>
                    setPhotoType(e.target.value as 'BEFORE' | 'AFTER' | 'OTHER')
                  }
                  aria-label="Tipo al agregar"
                >
                  <option value="BEFORE">Antes</option>
                  <option value="AFTER">Después</option>
                  <option value="OTHER">Otra</option>
                </select>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  {compressing ? 'Reduciendo…' : 'Agregar'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => {
                    void addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            {!hasAnyPhotos ? (
              <p className="text-sm text-muted">Opcional. Puedes agregar varias ahora o después.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {existingPhotos.map((photo) => (
                  <li
                    key={photo.id}
                    className="overflow-hidden rounded-xl border border-line bg-white/90"
                  >
                    {photo.viewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.viewUrl}
                        alt={photoTypeLabel(photo.photoType)}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center text-[10px] text-muted">
                        Sin vista
                      </div>
                    )}
                    <p className="px-1.5 py-1 text-center text-[11px] font-semibold text-botanical">
                      {photoTypeLabel(photo.photoType)}
                    </p>
                  </li>
                ))}
                {photos.map((photo) => (
                  <li
                    key={photo.id}
                    className="overflow-hidden rounded-xl border border-line bg-white/90"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.previewUrl}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
                    <div className="space-y-1 p-1.5">
                      <select
                        className="field field-sm"
                        value={photo.photoType}
                        onChange={(e) => {
                          const value = e.target.value as SessionPhoto['photoType'];
                          setPhotos((prev) =>
                            prev.map((p) =>
                              p.id === photo.id ? { ...p, photoType: value } : p,
                            ),
                          );
                        }}
                        aria-label="Tipo de foto"
                      >
                        <option value="BEFORE">Antes</option>
                        <option value="AFTER">Después</option>
                        <option value="OTHER">Otra</option>
                      </select>
                      <p className="truncate text-[10px] text-muted">
                        {formatBytes(photo.file.size)}
                        {photo.file.size < photo.originalBytes
                          ? ` · era ${formatBytes(photo.originalBytes)}`
                          : ''}
                      </p>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm w-full"
                        onClick={() => removePhoto(photo.id)}
                      >
                        Quitar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error ? (
            <p className="mt-3 text-danger" role="status" aria-live="polite">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-line bg-white/80 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <button className="btn btn-primary flex-1 sm:flex-none" type="submit" disabled={busy}>
            {pending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Registrar visita'}
          </button>
          <button
            className="btn btn-ghost flex-1 sm:flex-none"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
