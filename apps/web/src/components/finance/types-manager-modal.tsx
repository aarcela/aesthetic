'use client';

import { FormEvent, useEffect, useId, useState } from 'react';

import { IconClose } from '@/components/icons';

import type { FinanceType } from './movement-form-modal';

type Props = {
  open: boolean;
  types: FinanceType[];
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onCreate: (payload: {
    direction: 'ingress' | 'egress';
    name: string;
  }) => void;
  onDeactivate: (id: string) => void;
};

export function TypesManagerModal({
  open,
  types,
  pending,
  error,
  onClose,
  onCreate,
  onDeactivate,
}: Props) {
  const titleId = useId();
  const [direction, setDirection] = useState<'ingress' | 'egress'>('ingress');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setDirection('ingress');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, pending]);

  if (!open) return null;

  const entra = types.filter((t) => t.direction === 'ingress');
  const sale = types.filter((t) => t.direction === 'egress');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate({ direction, name: trimmed });
    setName('');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-botanical-deep/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onClick={() => {
        if (!pending) onClose();
      }}
    >
      <div
        className="panel fade-up flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-b-none rounded-t-3xl sm:max-h-[90dvh] sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="brand-mark text-2xl text-botanical sm:text-3xl">
              Tipos de movimiento
            </h2>
            <p className="mt-1 text-sm text-muted">
              Categorías para Entra y Sale. Puedes agregar o desactivar.
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={onSubmit}>
            <div>
              <label className="label" htmlFor="type-dir">
                Dirección
              </label>
              <select
                id="type-dir"
                className="field"
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'ingress' | 'egress')}
              >
                <option value="ingress">Entra</option>
                <option value="egress">Sale</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="type-name">
                Nombre nuevo
              </label>
              <input
                id="type-name"
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Mantenimiento"
                required
              />
            </div>
            <div className="flex items-end">
              <button className="btn btn-primary w-full" type="submit" disabled={pending}>
                {pending ? '…' : 'Agregar'}
              </button>
            </div>
          </form>

          {error ? (
            <p className="text-danger" role="status" aria-live="polite">
              {error}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ok">
                Entra
              </h3>
              <ul className="space-y-2">
                {entra.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white/80 px-3 py-2"
                  >
                    <span className="font-medium text-botanical">{t.name}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={pending}
                      onClick={() => onDeactivate(t.id)}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-danger">
                Sale
              </h3>
              <ul className="space-y-2">
                {sale.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white/80 px-3 py-2"
                  >
                    <span className="font-medium text-botanical">{t.name}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={pending}
                      onClick={() => onDeactivate(t.id)}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
