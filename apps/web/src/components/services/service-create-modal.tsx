'use client';

import { FormEvent, useEffect, useState } from 'react';

import { FormModal } from '@/components/form-modal';

export type ServiceFormPayload = {
  name: string;
  basePriceUsd: number;
  estimatedDurationMinutes: number;
  isActive?: boolean;
};

export type ServiceFormInitial = {
  name: string;
  basePriceUsd: string;
  estimatedDurationMinutes: number;
  isActive: boolean;
};

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: ServiceFormInitial | null;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (payload: ServiceFormPayload) => void;
};

export function ServiceFormModal({
  open,
  mode,
  initial,
  pending,
  error,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('100');
  const [minutes, setMinutes] = useState('30');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setName(initial.name);
      setPrice(String(Number(initial.basePriceUsd)));
      setMinutes(String(initial.estimatedDurationMinutes));
      setIsActive(initial.isActive);
      return;
    }
    setName('');
    setPrice('100');
    setMinutes('30');
    setIsActive(true);
  }, [open, mode, initial]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    onSave({
      name: name.trim(),
      basePriceUsd: Number(price),
      estimatedDurationMinutes: Number(minutes),
      isActive,
    });
  }

  return (
    <FormModal
      open={open}
      title={mode === 'edit' ? 'Editar servicio' : 'Nuevo servicio'}
      subtitle="Precio en USD y duración estimada para la agenda."
      pending={pending}
      error={error}
      submitLabel={mode === 'edit' ? 'Guardar cambios' : 'Crear servicio'}
      pendingLabel={mode === 'edit' ? 'Guardando…' : 'Creando…'}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div>
        <label className="label" htmlFor="service-modal-name">
          Nombre
        </label>
        <input
          id="service-modal-name"
          className="field"
          placeholder="Labios 1ml…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="service-modal-price">
            Precio USD
          </label>
          <input
            id="service-modal-price"
            className="field tabular"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="service-modal-minutes">
            Duración (min)
          </label>
          <input
            id="service-modal-minutes"
            className="field tabular"
            type="number"
            inputMode="numeric"
            min="1"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            required
          />
        </div>
      </div>
      {mode === 'edit' ? (
        <label className="flex items-center gap-3 text-sm text-botanical">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--botanical)]"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Visible en agenda y caja
        </label>
      ) : null}
    </FormModal>
  );
}
