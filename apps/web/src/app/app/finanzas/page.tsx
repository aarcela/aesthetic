'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';

import { MoneySummary } from '@/components/finance/money-summary';
import {
  MovementFormModal,
  type FinanceType,
  type RetailProduct,
} from '@/components/finance/movement-form-modal';
import {
  MovementList,
  type FinanceMovement,
} from '@/components/finance/movement-list';
import { TypesManagerModal } from '@/components/finance/types-manager-modal';
import { EmptyState, LiveMessage, PageHeader } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTabRefresh } from '@/lib/use-tab-refresh';
import type { ClinicPaymentMethod } from '@/lib/clinic';
import { canAccessFinance } from '@aesthetic/shared';
import { RoleGate } from '@/components/role-gate';

type Period = 'hoy' | 'semana' | 'mes';

type Summary = {
  entraUsd: string;
  saleUsd: string;
  netoUsd: string;
  byType: Array<{
    typeId: string;
    typeName: string;
    direction: string;
    totalUsd: string;
  }>;
};

function startOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function periodRange(period: Period): { from: string; to: string } {
  const now = new Date();
  if (period === 'hoy') {
    return {
      from: startOfLocalDay(now).toISOString(),
      to: endOfLocalDay(now).toISOString(),
    };
  }
  if (period === 'semana') {
    const start = startOfLocalDay(now);
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + mondayOffset);
    return { from: start.toISOString(), to: endOfLocalDay(now).toISOString() };
  }
  const start = startOfLocalDay(new Date(now.getFullYear(), now.getMonth(), 1));
  return { from: start.toISOString(), to: endOfLocalDay(now).toISOString() };
}

export default function FinanzasPage() {
  const { token, membership } = useAuth();
  const pathname = usePathname();
  const [period, setPeriod] = useState<Period>('hoy');
  const [types, setTypes] = useState<FinanceType[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<ClinicPaymentMethod[]>([]);
  const [retailProducts, setRetailProducts] = useState<RetailProduct[]>([]);
  const [movements, setMovements] = useState<FinanceMovement[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [typesError, setTypesError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [formOpen, setFormOpen] = useState(false);
  const [formDirection, setFormDirection] = useState<'ingress' | 'egress'>('ingress');
  const [typesOpen, setTypesOpen] = useState(false);

  const range = useMemo(() => periodRange(period), [period]);
  const canManageTypes = membership ? canAccessFinance(membership.role) : false;
  const canVoid = canManageTypes;

  const loadCatalog = useCallback(async () => {
    if (!token || !canManageTypes) return;
    const [t, methods, products] = await Promise.all([
      apiFetch<FinanceType[]>('/v1/finance/types', { token }),
      apiFetch<ClinicPaymentMethod[]>('/v1/payment-methods', { token }),
      apiFetch<RetailProduct[]>('/v1/inventory/items?kind=RETAIL', { token }).catch(
        () => [] as RetailProduct[],
      ),
    ]);
    setTypes(t);
    setPaymentMethods(methods);
    setRetailProducts(products);
  }, [canManageTypes, token]);

  const loadPeriod = useCallback(async () => {
    if (!token || !canManageTypes) return;
    const qs = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
    const [m, s] = await Promise.all([
      apiFetch<FinanceMovement[]>(`/v1/finance/movements?${qs}`, { token }),
      apiFetch<Summary>(`/v1/finance/summary?${qs}`, { token }),
    ]);
    setMovements(m);
    setSummary(s);
  }, [canManageTypes, token, range.from, range.to]);

  const load = useCallback(async () => {
    await Promise.all([loadCatalog(), loadPeriod()]);
  }, [loadCatalog, loadPeriod]);

  useTabRefresh(
    '/app/finanzas',
    () => load().catch((err: Error) => setError(err.message)),
    Boolean(token && canManageTypes),
  );

  useEffect(() => {
    if (pathname !== '/app/finanzas') return;
    void loadPeriod().catch((err: Error) => setError(err.message));
  }, [loadPeriod, pathname]);

  function openForm(direction: 'ingress' | 'egress') {
    setFormDirection(direction);
    setFormError(null);
    setFormOpen(true);
    setMessage(null);
    setError(null);
  }

  function onSaveMovement(payload: {
    typeId: string;
    amountNative: number;
    nativeCurrency: 'USD' | 'VES' | 'USDT';
    paymentMethod?: string;
    counterparty?: string;
    notes?: string;
    inventoryItemId?: string;
    quantity?: number;
  }) {
    if (!token) return;
    setFormError(null);
    startTransition(async () => {
      try {
        await apiFetch('/v1/finance/movements', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
        setFormOpen(false);
        setMessage(
          formDirection === 'ingress' ? 'Entrada registrada' : 'Salida registrada',
        );
        await load();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'No se pudo guardar');
      }
    });
  }

  function onCreateType(payload: { direction: 'ingress' | 'egress'; name: string }) {
    if (!token) return;
    setTypesError(null);
    startTransition(async () => {
      try {
        await apiFetch('/v1/finance/types', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
        setMessage('Tipo agregado');
        await load();
      } catch (err) {
        setTypesError(err instanceof Error ? err.message : 'No se pudo crear el tipo');
      }
    });
  }

  function onDeactivateType(id: string) {
    if (!token) return;
    setTypesError(null);
    startTransition(async () => {
      try {
        await apiFetch(`/v1/finance/types/${id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({ isActive: false }),
        });
        setMessage('Tipo desactivado');
        await load();
      } catch (err) {
        setTypesError(err instanceof Error ? err.message : 'No se pudo quitar');
      }
    });
  }

  function onVoid(id: string) {
    if (!token) return;
    startTransition(async () => {
      try {
        await apiFetch(`/v1/finance/movements/${id}/void`, {
          method: 'POST',
          token,
        });
        setMessage('Registro anulado');
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo anular');
      }
    });
  }

  return (
    <RoleGate allowed={canManageTypes}>
    <div>
      <PageHeader
        title="Dinero"
        subtitle="Aquí anotas lo que entra y lo que sale, aparte de los cobros de caja. Elige Hoy, Semana o Mes."
        action={
          <>
            {canManageTypes ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setTypesError(null);
                  setTypesOpen(true);
                }}
              >
                Tipos de movimiento
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openForm('ingress')}
            >
              Entró dinero
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => openForm('egress')}
            >
              Salió dinero
            </button>
          </>
        }
      />

      <div
        className="seg mb-6"
        role="tablist"
        aria-label="Periodo"
      >
        {(
          [
            ['hoy', 'Hoy'],
            ['semana', 'Semana'],
            ['mes', 'Mes'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={period === id}
            className="seg-btn"
            onClick={() => setPeriod(id)}
          >
            {label}
          </button>
        ))}
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

      {summary ? (
        <div className="mb-6">
          <MoneySummary
            entraUsd={summary.entraUsd}
            saleUsd={summary.saleUsd}
            netoUsd={summary.netoUsd}
          />
        </div>
      ) : (
        <EmptyState title="Cargando…" body="Sumando entradas y salidas." />
      )}

      {summary && summary.byType.length > 0 ? (
        <section className="panel mb-6 p-5">
          <h2 className="mb-4 text-xl font-semibold text-botanical">Por qué entró o salió</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {summary.byType.map((row) => (
              <li
                key={row.typeId}
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white/70 px-3 py-2 text-sm"
              >
                <span>
                  <span
                    className={`mr-2 text-xs font-bold uppercase ${
                      row.direction === 'ingress' ? 'text-ok' : 'text-danger'
                    }`}
                  >
                    {row.direction === 'ingress' ? 'Entra' : 'Sale'}
                  </span>
                  {row.typeName}
                </span>
                <span className="tabular font-semibold text-botanical">
                  ${Number(row.totalUsd).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 text-xl font-semibold text-botanical">Lista de movimientos</h2>
        <MovementList
          movements={movements}
          paymentMethods={paymentMethods}
          canVoid={canVoid}
          onVoid={pending ? undefined : onVoid}
        />
      </section>

      <MovementFormModal
        open={formOpen}
        direction={formDirection}
        types={types}
        paymentMethods={paymentMethods}
        retailProducts={retailProducts}
        pending={pending}
        error={formError}
        onClose={() => setFormOpen(false)}
        onSave={onSaveMovement}
      />

      {canManageTypes ? (
        <TypesManagerModal
          open={typesOpen}
          types={types}
          pending={pending}
          error={typesError}
          onClose={() => setTypesOpen(false)}
          onCreate={onCreateType}
          onDeactivate={onDeactivateType}
        />
      ) : null}
    </div>
    </RoleGate>
  );
}
