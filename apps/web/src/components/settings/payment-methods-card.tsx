'use client';

import { FormEvent, useEffect, useState } from 'react';

import type { ClinicPaymentMethod } from '@/lib/clinic';

const CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'VES', label: 'VES' },
  { value: 'USDT', label: 'USDT' },
] as const;

type Props = {
  methods: ClinicPaymentMethod[];
  canManage: boolean;
  pending?: boolean;
  error?: string | null;
  onCreate: (payload: { label: string; nativeCurrency: 'USD' | 'VES' | 'USDT' }) => void;
  onUpdate: (
    id: string,
    payload: { label?: string; isActive?: boolean },
  ) => void;
};

export function PaymentMethodsCard({
  methods,
  canManage,
  pending,
  error,
  onCreate,
  onUpdate,
}: Props) {
  const [label, setLabel] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'VES' | 'USDT'>('USD');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(methods.map((m) => [m.id, m.label])));
  }, [methods]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    onCreate({ label: trimmed, nativeCurrency: currency });
    setLabel('');
  }

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold text-botanical">Métodos de pago</h2>
      <p className="mt-1 text-sm text-muted">
        Caja y Finanzas usan esta lista. La moneda define si se convierte con la tasa
        del día (VES) o se cuenta 1:1 (USD / USDT).
      </p>

      {canManage ? (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_8rem_auto]"
          onSubmit={onSubmit}
        >
          <div>
            <label className="label" htmlFor="pm-label">
              Nombre nuevo
            </label>
            <input
              id="pm-label"
              className="field"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej. Transferencia Banesco"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="pm-currency">
              Moneda
            </label>
            <select
              id="pm-currency"
              className="field"
              value={currency}
              onChange={(e) =>
                setCurrency(e.target.value as 'USD' | 'VES' | 'USDT')
              }
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn btn-primary w-full" type="submit" disabled={pending}>
              {pending ? '…' : 'Agregar'}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted">Solo dueño o admin puede editar métodos.</p>
      )}

      {error ? (
        <p className="mt-3 text-danger" role="status" aria-live="polite">
          {error}
        </p>
      ) : null}

      <ul className="mt-4 space-y-2">
        {methods.map((method) => {
          const draft = drafts[method.id] ?? method.label;
          const dirty = draft.trim() !== method.label;
          return (
            <li
              key={method.id}
              className={`flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white/80 px-3 py-2 ${
                method.isActive ? '' : 'opacity-60'
              }`}
            >
              {canManage ? (
                <input
                  className="field min-w-0 flex-1"
                  aria-label={`Nombre de ${method.label}`}
                  value={draft}
                  disabled={pending}
                  onChange={(e) =>
                    setDrafts((current) => ({ ...current, [method.id]: e.target.value }))
                  }
                  onBlur={() => {
                    const next = draft.trim();
                    if (next && next !== method.label) {
                      onUpdate(method.id, { label: next });
                    }
                  }}
                />
              ) : (
                <span className="min-w-0 flex-1 font-medium text-botanical">
                  {method.label}
                </span>
              )}
              <span className="rounded-lg bg-[rgba(22,63,59,0.08)] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-botanical">
                {method.nativeCurrency}
              </span>
              {canManage ? (
                <>
                  {dirty ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={pending}
                      onClick={() => onUpdate(method.id, { label: draft.trim() })}
                    >
                      Guardar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={pending}
                    onClick={() => onUpdate(method.id, { isActive: !method.isActive })}
                  >
                    {method.isActive ? 'Ocultar' : 'Activar'}
                  </button>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
