'use client';

import { formatDateTime, formatUsd, paymentLabel, type ClinicPaymentMethod } from '@/lib/clinic';

export type FinanceMovement = {
  id: string;
  direction: 'ingress' | 'egress';
  typeName: string;
  amountNative: string;
  nativeCurrency: string;
  amountUsdEquivalent: string;
  counterparty: string | null;
  notes: string | null;
  paymentMethod: string | null;
  occurredAt: string;
  quantity?: string | null;
  productName?: string | null;
  unitOfMeasure?: string | null;
};

type Props = {
  movements: FinanceMovement[];
  paymentMethods?: ClinicPaymentMethod[];
  canVoid?: boolean;
  onVoid?: (id: string) => void;
};

export function MovementList({ movements, paymentMethods, canVoid, onVoid }: Props) {
  if (movements.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <p className="brand-mark text-2xl text-botanical">Aún no hay movimientos</p>
        <p className="mt-2 text-pretty text-muted">
          Toca “Entró dinero” o “Salió dinero” para anotar algo que no sea un cobro de caja.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {movements.map((m) => {
        const entra = m.direction === 'ingress';
        return (
          <div
            key={m.id}
            className={`panel flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-l-4 ${
              entra ? 'border-l-[var(--ok,#2f7a5a)]' : 'border-l-danger'
            }`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide ${
                    entra
                      ? 'bg-[rgba(47,122,90,0.12)] text-ok'
                      : 'bg-[rgba(180,60,60,0.12)] text-danger'
                  }`}
                >
                  {entra ? 'Entra' : 'Sale'}
                </span>
                <p className="font-semibold text-botanical">{m.typeName}</p>
              </div>
              <p className="mt-1 text-sm text-muted">
                {formatDateTime(m.occurredAt)}
                {m.counterparty ? ` · ${m.counterparty}` : ''}
                {m.paymentMethod ? ` · ${paymentLabel(m.paymentMethod, paymentMethods)}` : ''}
              </p>
              {m.notes ? <p className="mt-1 text-sm text-muted">{m.notes}</p> : null}
              {m.productName ? (
                <p className="mt-1 text-sm text-botanical">
                  Producto · {m.productName}
                  {m.quantity ? ` · ${Number(m.quantity)} ${m.unitOfMeasure ?? ''}`.trim() : ''}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <p
                className={`tabular text-xl font-semibold ${
                  entra ? 'text-ok' : 'text-danger'
                }`}
              >
                {entra ? '+' : '−'}
                {formatUsd(m.amountUsdEquivalent)}
              </p>
              <p className="tabular text-xs text-muted">
                {m.amountNative} {m.nativeCurrency}
              </p>
              {canVoid && onVoid ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm mt-2"
                  onClick={() => onVoid(m.id)}
                >
                  Anular
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
