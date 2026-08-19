'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import { FormModal } from '@/components/form-modal';
import {
  formatUsd,
  isVesCurrency,
  type ClinicPaymentMethod,
} from '@/lib/clinic';

type Service = { id: string; name: string; basePriceUsd: string };
type Patient = { id: string; firstName: string; lastName: string };
type Location = { id: string; name: string; isPrimary: boolean };

export type CheckoutPayload = {
  patientId: string;
  serviceId: string;
  locationId: string;
  payments: Array<{ paymentMethod: string; amountNative: number }>;
};

type Props = {
  open: boolean;
  pending?: boolean;
  error?: string | null;
  services: Service[];
  patients: Patient[];
  locations: Location[];
  paymentMethods: ClinicPaymentMethod[];
  fxRate: number;
  onClose: () => void;
  onSave: (payload: CheckoutPayload) => void;
};

export function CheckoutModal({
  open,
  pending,
  error,
  services,
  patients,
  locations,
  paymentMethods,
  fxRate,
  onClose,
  onSave,
}: Props) {
  const [serviceId, setServiceId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [methodA, setMethodA] = useState('');
  const [amountA, setAmountA] = useState('');
  const [methodB, setMethodB] = useState('');
  const [amountB, setAmountB] = useState('');

  const methodByCode = useMemo(
    () => Object.fromEntries(paymentMethods.map((m) => [m.code, m])),
    [paymentMethods],
  );

  useEffect(() => {
    if (!open) return;
    setServiceId(services[0]?.id ?? '');
    setPatientId(patients[0]?.id ?? '');
    const primary = locations.find((l) => l.isPrimary) ?? locations[0];
    setLocationId(primary?.id ?? '');
    const usd = paymentMethods.find((m) => !isVesCurrency(m.nativeCurrency));
    const ves = paymentMethods.find((m) => isVesCurrency(m.nativeCurrency));
    setMethodA(usd?.code ?? paymentMethods[0]?.code ?? '');
    setAmountA('');
    setMethodB(ves?.code ?? paymentMethods[1]?.code ?? '');
    setAmountB('');
  }, [open, services, patients, locations, paymentMethods]);

  const selectedService = services.find((s) => s.id === serviceId);
  const totalUsd = Number(selectedService?.basePriceUsd ?? 0);

  const preview = useMemo(() => {
    const legs = [
      { method: methodA, amount: Number(amountA) || 0 },
      { method: methodB, amount: Number(amountB) || 0 },
    ].filter((leg) => leg.amount > 0 && leg.method);

    const usd = legs.reduce((sum, leg) => {
      const currency = methodByCode[leg.method]?.nativeCurrency;
      if (currency && isVesCurrency(currency)) {
        return sum + (fxRate > 0 ? leg.amount / fxRate : 0);
      }
      return sum + leg.amount;
    }, 0);

    return { legs, usd: Math.round(usd * 100) / 100 };
  }, [amountA, amountB, methodA, methodB, fxRate, methodByCode]);

  const balanced =
    Math.abs(preview.usd - totalUsd) <= 0.01 &&
    preview.legs.length > 0 &&
    paymentMethods.length > 0;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!balanced || !serviceId || !patientId || !locationId) return;
    onSave({
      patientId,
      serviceId,
      locationId,
      payments: preview.legs.map((leg) => ({
        paymentMethod: leg.method,
        amountNative: leg.amount,
      })),
    });
  }

  return (
    <FormModal
      open={open}
      title="Cobrar ahora"
      subtitle="Puedes combinar formas de pago. La tasa del bolívar queda fijada al confirmar."
      pending={pending}
      error={error}
      submitLabel={balanced ? 'Cobrar y postear' : 'Ajusta los montos'}
      pendingLabel="Posteando…"
      submitDisabled={!balanced}
      maxWidthClass="max-w-2xl"
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="caja-modal-patient">
            Paciente
          </label>
          <select
            id="caja-modal-patient"
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
        <div>
          <label className="label" htmlFor="caja-modal-service">
            Servicio
          </label>
          <select
            id="caja-modal-service"
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
        <div className="sm:col-span-2">
          <label className="label" htmlFor="caja-modal-location">
            Sede
          </label>
          <select
            id="caja-modal-location"
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
      </div>

      {paymentMethods.length === 0 ? (
        <p className="text-sm text-danger">
          No hay formas de pago activas. Actívalas en Ajustes.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="caja-modal-method-a">
              Método 1
            </label>
            <select
              id="caja-modal-method-a"
              className="field"
              value={methodA}
              onChange={(e) => setMethodA(e.target.value)}
            >
              {paymentMethods.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="caja-modal-amount-a">
              Monto 1
            </label>
            <input
              id="caja-modal-amount-a"
              className="field tabular"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amountA}
              onChange={(e) => setAmountA(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="caja-modal-method-b">
              Método 2
            </label>
            <select
              id="caja-modal-method-b"
              className="field"
              value={methodB}
              onChange={(e) => setMethodB(e.target.value)}
            >
              <option value="">Opcional</option>
              {paymentMethods.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="caja-modal-amount-b">
              Monto 2
            </label>
            <input
              id="caja-modal-amount-b"
              className="field tabular"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amountB}
              onChange={(e) => setAmountB(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-white/70 p-4">
        <p className="text-sm text-muted">Total servicio</p>
        <p className="tabular text-2xl font-semibold text-botanical">{formatUsd(totalUsd)}</p>
        <p className="mt-2 text-sm text-muted">
          Suma pagos ≈ {formatUsd(preview.usd)}
          {balanced ? ' · listo para cobrar' : ' · ajusta montos'}
        </p>
      </div>
    </FormModal>
  );
}
