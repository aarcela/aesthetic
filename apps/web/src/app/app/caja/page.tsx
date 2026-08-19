'use client';

import { useCallback, useState, useTransition } from 'react';

import {
  CheckoutModal,
  type CheckoutPayload,
} from '@/components/caja/checkout-modal';
import { EmptyState, LiveMessage, PageHeader, StatChip } from '@/components/ui';
import { formatUsd, paymentLabel, todayIsoDate, type ClinicPaymentMethod } from '@/lib/clinic';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTabRefresh } from '@/lib/use-tab-refresh';

type Service = { id: string; name: string; basePriceUsd: string };
type Patient = { id: string; firstName: string; lastName: string };
type Location = { id: string; name: string; isPrimary: boolean };
type Sale = { id: string; amountUsd: string; status: string };
type CajaReport = {
  totalUsd: string;
  saleCount: number;
  byMethod: Array<{ paymentMethod: string; totalUsd: string; totalNative: string }>;
};

export default function CajaPage() {
  const { token, membership } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<ClinicPaymentMethod[]>([]);
  const [fx, setFx] = useState<{
    selectedFuente: string;
    rates: Record<string, { vesPerUsd: string }>;
  } | null>(null);
  const [report, setReport] = useState<CajaReport | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rate = Number(fx?.rates?.[fx.selectedFuente]?.vesPerUsd ?? 0);

  const load = useCallback(async () => {
    if (!token) return;
    const date = todayIsoDate();
    const [s, p, l, f, r, methods] = await Promise.all([
      apiFetch<Service[]>('/v1/services', { token }),
      apiFetch<Patient[]>('/v1/patients', { token }),
      apiFetch<Location[]>('/v1/locations', { token }),
      apiFetch<{
        selectedFuente: string;
        rates: Record<string, { vesPerUsd: string }>;
      }>('/v1/fx/rates', { token }),
      apiFetch<CajaReport>(`/v1/reports/caja/daily?date=${date}`, { token }),
      apiFetch<ClinicPaymentMethod[]>('/v1/payment-methods', { token }),
    ]);
    setServices(s);
    setPatients(p);
    setLocations(l);
    setFx(f);
    setReport(r);
    setPaymentMethods(methods);
  }, [token]);

  useTabRefresh(
    '/app/caja',
    () => load().catch((err: Error) => setError(err.message)),
    Boolean(token && membership?.tenantId),
  );

  function onCheckout(payload: CheckoutPayload) {
    if (!token || !membership) return;
    const selectedService = services.find((s) => s.id === payload.serviceId);
    if (!selectedService) return;
    setFormError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const sale = await apiFetch<Sale>('/v1/sales', {
          method: 'POST',
          token,
          body: JSON.stringify({
            locationId: payload.locationId,
            patientId: payload.patientId,
            lines: [
              {
                serviceId: payload.serviceId,
                specialistId: membership.membershipId,
                quantity: 1,
                unitPriceUsd: Number(selectedService.basePriceUsd),
              },
            ],
          }),
        });

        await apiFetch(`/v1/sales/${sale.id}/post`, {
          method: 'POST',
          token,
          headers: {
            'Idempotency-Key': `caja-${sale.id}`,
          },
          body: JSON.stringify({ payments: payload.payments }),
        });

        setModalOpen(false);
        setMessage(`Venta posteada · ${formatUsd(sale.amountUsd)}`);
        await load();
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : 'No se pudo cobrar. Revisa montos y tasa.',
        );
      }
    });
  }

  return (
    <div>
      <PageHeader
        title="Caja"
        subtitle="Cobra un tratamiento. Puedes mezclar dólares, bolívares u otros métodos en el mismo cobro."
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setFormError(null);
              setModalOpen(true);
            }}
          >
            Cobrar ahora
          </button>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatChip label="Cobrado hoy" value={formatUsd(report?.totalUsd ?? 0)} hint="Suma en dólares" />
        <StatChip label="Número de cobros" value={String(report?.saleCount ?? 0)} />
        <StatChip
          label="Tasa del bolívar"
          value={rate ? `${rate.toFixed(2)} Bs.` : '—'}
          hint="Se usa al cobrar en bolívares"
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

      {report && report.byMethod.length > 0 ? (
        <section className="panel p-6">
          <h2 className="mb-4 text-xl font-semibold text-botanical">Cómo pagaron hoy</h2>
          <div className="space-y-3">
            {report.byMethod.map((row) => (
              <div key={row.paymentMethod} className="list-row text-base">
                <span className="min-w-0 truncate">
                  {paymentLabel(row.paymentMethod, paymentMethods)}
                </span>
                <span className="tabular shrink-0 font-semibold text-botanical">
                  {formatUsd(row.totalUsd)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          title="Aún no hay cobros"
          body="Toca “Cobrar ahora” cuando una persona pague en recepción."
        />
      )}

      <CheckoutModal
        open={modalOpen}
        pending={pending}
        error={formError}
        services={services}
        patients={patients}
        locations={locations}
        paymentMethods={paymentMethods}
        fxRate={rate}
        onClose={() => setModalOpen(false)}
        onSave={onCheckout}
      />
    </div>
  );
}
