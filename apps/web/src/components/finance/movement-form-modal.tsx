'use client';

import { FormEvent, useEffect, useId, useState } from 'react';

import { IconClose } from '@/components/icons';

import { type ClinicPaymentMethod } from '@/lib/clinic';

export type FinanceType = {
  id: string;
  direction: 'ingress' | 'egress';
  name: string;
};

export type RetailProduct = {
  id: string;
  productName: string;
  unitOfMeasure: string;
  currentStock: string;
  salePriceUsd?: string;
};

type Props = {
  open: boolean;
  direction: 'ingress' | 'egress';
  types: FinanceType[];
  paymentMethods: ClinicPaymentMethod[];
  retailProducts?: RetailProduct[];
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (payload: {
    typeId: string;
    amountNative: number;
    nativeCurrency: 'USD' | 'VES' | 'USDT';
    paymentMethod?: string;
    counterparty?: string;
    notes?: string;
    occurredAt?: string;
    inventoryItemId?: string;
    quantity?: number;
  }) => void;
};

export function MovementFormModal({
  open,
  direction,
  types,
  paymentMethods,
  retailProducts = [],
  pending,
  error,
  onClose,
  onSave,
}: Props) {
  const titleId = useId();
  const filtered = types.filter((t) => t.direction === direction);
  const [typeId, setTypeId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'VES' | 'USDT'>('USD');
  const [method, setMethod] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [notes, setNotes] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');

  useEffect(() => {
    if (!open) return;
    setTypeId(filtered[0]?.id ?? '');
    setAmount('');
    setCurrency('USD');
    setMethod('');
    setCounterparty('');
    setNotes('');
    setProductId('');
    setQuantity('1');
  }, [open, direction]); // eslint-disable-line react-hooks/exhaustive-deps -- reset once per open/direction

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, pending]);

  if (!open) return null;

  const entra = direction === 'ingress';

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const amountNative = Number(amount);
    if (!(amountNative > 0) || !typeId) return;
    onSave({
      typeId,
      amountNative,
      nativeCurrency: currency,
      paymentMethod: method || undefined,
      counterparty: counterparty.trim() || undefined,
      notes: notes.trim() || undefined,
      inventoryItemId: entra && productId ? productId : undefined,
      quantity: entra && productId ? Number(quantity) : undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-botanical-deep/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onClick={() => {
        if (!pending) onClose();
      }}
    >
      <form
        className="panel fade-up flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-b-none rounded-t-3xl sm:max-h-[90dvh] sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        autoComplete="off"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="brand-mark text-2xl text-botanical sm:text-3xl">
              {entra ? 'Entró dinero' : 'Salió dinero'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {entra
                ? 'Registra plata que llegó. Si vendiste un producto de inventario, elígilo para descontar stock.'
                : 'Registra plata que se fue de la clínica.'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={pending}
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
          <div>
            <label className="label" htmlFor="fin-type">
              Tipo
            </label>
            <select
              id="fin-type"
              className="field"
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              required
            >
              {filtered.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {entra && retailProducts.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <div>
                <label className="label" htmlFor="fin-product">
                  Producto vendido (opcional)
                </label>
                <select
                  id="fin-product"
                  className="field"
                  value={productId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setProductId(next);
                    const product = retailProducts.find((p) => p.id === next);
                    const saleType = filtered.find((t) =>
                      t.name.toLowerCase().includes('venta de productos'),
                    );
                    if (saleType) setTypeId(saleType.id);
                    if (product && currency === 'USD') {
                      const qty = Number(quantity) || 1;
                      const price = Number(product.salePriceUsd ?? 0);
                      if (price > 0) setAmount(String(price * qty));
                    }
                  }}
                >
                  <option value="">— Sin producto / cobro varios —</option>
                  {retailProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.productName} · stock {p.currentStock} {p.unitOfMeasure}
                    </option>
                  ))}
                </select>
              </div>
              {productId ? (
                <div>
                  <label className="label" htmlFor="fin-qty">
                    Cantidad
                  </label>
                  <input
                    id="fin-qty"
                    className="field tabular"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => {
                      setQuantity(e.target.value);
                      const product = retailProducts.find((p) => p.id === productId);
                      if (product && currency === 'USD') {
                        const qty = Number(e.target.value) || 0;
                        const price = Number(product.salePriceUsd ?? 0);
                        if (price > 0) setAmount(String(price * qty));
                      }
                    }}
                    required
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          {entra && productId ? (
            <p className="text-xs text-muted">
              Esta venta descuenta stock del producto. Los materiales de visita no se venden aquí.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="fin-amount">
                Monto
              </label>
              <input
                id="fin-amount"
                className="field"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label" htmlFor="fin-currency">
                Moneda
              </label>
              <select
                id="fin-currency"
                className="field"
                value={currency}
                onChange={(e) =>
                  setCurrency(e.target.value as 'USD' | 'VES' | 'USDT')
                }
                disabled={Boolean(method)}
              >
                <option value="USD">USD</option>
                <option value="VES">VES</option>
                <option value="USDT">USDT</option>
              </select>
            </div>
          </div>

          {currency === 'VES' ? (
            <p className="text-sm text-muted">
              Lo convertimos a dólares con la tasa del día (oficial/paralelo de la clínica).
            </p>
          ) : null}

          <div>
            <label className="label" htmlFor="fin-method">
              Cómo se movió (opcional)
            </label>
            <select
              id="fin-method"
              className="field"
              value={method}
              onChange={(e) => {
                const next = e.target.value;
                setMethod(next);
                const selected = paymentMethods.find((m) => m.code === next);
                if (selected) setCurrency(selected.nativeCurrency);
              }}
            >
              <option value="">—</option>
              {paymentMethods.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="fin-who">
              De / para quién (opcional)
            </label>
            <input
              id="fin-who"
              className="field"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="Proveedor, paciente, banco…"
            />
          </div>

          <div>
            <label className="label" htmlFor="fin-notes">
              Nota (opcional)
            </label>
            <textarea
              id="fin-notes"
              className="field min-h-20 resize-y"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalle breve…"
            />
          </div>

          {error ? (
            <p className="text-danger" role="status" aria-live="polite">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <button
            className="btn btn-primary flex-1 sm:flex-none"
            type="submit"
            disabled={pending || filtered.length === 0}
          >
            {pending ? 'Guardando…' : entra ? 'Registrar entrada' : 'Registrar salida'}
          </button>
          <button
            className="btn btn-ghost flex-1 sm:flex-none"
            type="button"
            onClick={onClose}
            disabled={pending}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
