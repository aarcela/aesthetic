'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

import { EmptyState, LiveMessage, LoadingBlock, PageHeader, StatChip, StatusPill } from '@/components/ui';
import { formatTime, formatUsd, todayIsoDate } from '@/lib/clinic';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTabRefresh } from '@/lib/use-tab-refresh';

type Appointment = {
  id: string;
  scheduledAt: string;
  status: string;
  patientId: string;
  items: Array<{ serviceId: string; unitPriceUsd: string }>;
};

type Patient = { id: string; firstName: string; lastName: string };

type CajaReport = {
  totalUsd: string;
  saleCount: number;
};

export default function TodayPage() {
  const { token, membership } = useAuth();
  const tenantId = membership?.tenantId;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Record<string, Patient>>({});
  const [caja, setCaja] = useState<CajaReport | null>(null);
  const [fx, setFx] = useState<{
    selectedFuente: string;
    rates: Record<string, { vesPerUsd: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !tenantId) return;
    const today = new Date();
    const from = new Date(today);
    from.setHours(0, 0, 0, 0);
    const to = new Date(today);
    to.setHours(23, 59, 59, 999);
    const date = todayIsoDate();

    try {
      const [a, c, f, p] = await Promise.all([
        apiFetch<Appointment[]>(
          `/v1/appointments?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
          { token },
        ),
        apiFetch<CajaReport>(`/v1/reports/caja/daily?date=${date}`, { token }),
        apiFetch<{
          selectedFuente: string;
          rates: Record<string, { vesPerUsd: string }>;
        }>('/v1/fx/rates', { token }),
        apiFetch<Patient[]>('/v1/patients', { token }),
      ]);
      setAppointments(a);
      setCaja(c);
      setFx(f);
      setPatients(Object.fromEntries(p.map((row) => [row.id, row])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el día');
    } finally {
      setLoading(false);
    }
  }, [tenantId, token]);

  useTabRefresh('/app', load, Boolean(token && tenantId));

  const selectedRate = fx?.rates?.[fx.selectedFuente]?.vesPerUsd;

  return (
    <div>
      <PageHeader
        title="Hoy"
        subtitle="Esto es lo que hay en la sala ahora: citas, lo cobrado y la tasa del día."
        action={
          <Link href="/app/caja" className="btn btn-primary">
            Cobrar
          </Link>
        }
      />

      {error ? <LiveMessage tone="danger">{error}</LiveMessage> : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatChip label="Citas de hoy" value={String(appointments.length)} hint="Personas en agenda" />
        <StatChip label="Cobrado hoy" value={formatUsd(caja?.totalUsd ?? 0)} hint="En dólares" />
        <StatChip
          label="Tasa del bolívar"
          value={selectedRate ? `${Number(selectedRate).toFixed(2)} Bs.` : '—'}
          hint={fx?.selectedFuente === 'paralelo' ? 'Tasa paralelo' : 'Tasa oficial BCV'}
        />
      </div>

      <section className="panel p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-botanical">Próximas citas</h2>
          <Link href="/app/agenda" className="btn btn-ghost btn-sm">
            Ver agenda
          </Link>
        </div>
        {loading ? (
          <LoadingBlock label="Cargando citas…" />
        ) : appointments.length === 0 ? (
          <EmptyState
            title="No hay citas hoy"
            body="Cuando agendes a alguien, aparecerá aquí. Toca Agenda para crear una cita."
          />
        ) : (
          <div className="space-y-3">
            {appointments.map((item) => {
              const patient = patients[item.patientId];
              return (
                <div key={item.id} className="list-row">
                  <p className="min-w-0 font-semibold text-botanical">
                    <span className="tabular">{formatTime(item.scheduledAt)}</span>
                    {' · '}
                    {patient
                      ? `${patient.firstName} ${patient.lastName}`
                      : `${item.items.length} servicio(s)`}
                  </p>
                  <StatusPill status={item.status} />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
