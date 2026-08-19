'use client';

import Link from 'next/link';
import { useCallback, useDeferredValue, useMemo, useState, useTransition } from 'react';

import {
  PatientCreateModal,
  type PatientCreatePayload,
} from '@/components/patients/patient-create-modal';
import { EmptyState, LiveMessage, PageHeader } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTabRefresh } from '@/lib/use-tab-refresh';

type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  nationalId: string | null;
  medicalAlerts: string | null;
};

export default function PatientsPage() {
  const { token, membership } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    if (!token) return;
    setPatients(await apiFetch<Patient[]>('/v1/patients', { token }));
  }, [token]);

  useTabRefresh('/app/patients', () => load().catch((err: Error) => setListError(err.message)), Boolean(token && membership?.tenantId));

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const haystack = [
        p.firstName,
        p.lastName,
        `${p.firstName} ${p.lastName}`,
        p.phoneNumber,
        p.nationalId ?? '',
        p.medicalAlerts ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [deferredQuery, patients]);

  function openCreate() {
    setFormError(null);
    setModalOpen(true);
  }

  function onCreate(payload: PatientCreatePayload) {
    if (!token) return;
    setFormError(null);
    startTransition(async () => {
      try {
        await apiFetch('/v1/patients', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
        setModalOpen(false);
        await load();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'No se pudo guardar el paciente');
      }
    });
  }

  return (
    <div>
      <PageHeader
        title="Pacientes"
        subtitle="Busca por nombre, teléfono o cédula. Toca una ficha para ver el historial."
        action={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Nuevo paciente
          </button>
        }
      />

      <div className="panel mb-6 p-5">
        <label className="label" htmlFor="patient-search">
          Buscar paciente
        </label>
        <input
          id="patient-search"
          className="field"
          type="search"
          name="q"
          autoComplete="off"
          spellCheck={false}
          placeholder="Ana Pérez, 0414… o cédula…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="hint">
          {filtered.length} de {patients.length} paciente{patients.length === 1 ? '' : 's'}
        </p>
      </div>

      {listError ? <LiveMessage tone="danger">{listError}</LiveMessage> : null}

      <div className="mt-4">
        {patients.length === 0 ? (
          <EmptyState title="Sin pacientes" body="Toca “Nuevo paciente” para registrar el primero." />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Sin resultados"
            body={`No hay pacientes que coincidan con “${query.trim()}”.`}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((p) => (
              <Link key={p.id} href={`/app/patients/${p.id}`} className="panel min-w-0 px-5 py-4">
                <p className="truncate text-lg font-semibold text-botanical">
                  {p.firstName} {p.lastName}
                </p>
                <p className="tabular mt-1 text-muted">{p.phoneNumber}</p>
                {p.nationalId ? <p className="mt-0.5 text-sm text-muted">Cédula {p.nationalId}</p> : null}
                {p.medicalAlerts ? (
                  <p className="mt-2 text-sm font-semibold text-danger">Alerta: {p.medicalAlerts}</p>
                ) : null}
                <p className="mt-3 text-sm font-semibold text-botanical">Abrir historial</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <PatientCreateModal
        open={modalOpen}
        pending={pending}
        error={formError}
        onClose={() => setModalOpen(false)}
        onSave={onCreate}
      />
    </div>
  );
}
