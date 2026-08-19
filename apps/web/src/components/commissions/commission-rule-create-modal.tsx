'use client';

import { FormEvent, useEffect, useState } from 'react';

import { FormModal } from '@/components/form-modal';

export type CommissionRuleCreatePayload = {
  ratePercent: number;
};

type Props = {
  open: boolean;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (payload: CommissionRuleCreatePayload) => void;
};

export function CommissionRuleCreateModal({ open, pending, error, onClose, onSave }: Props) {
  const [rate, setRate] = useState('30');

  useEffect(() => {
    if (!open) return;
    setRate('30');
  }, [open]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    onSave({ ratePercent: Number(rate) });
  }

  return (
    <FormModal
      open={open}
      title="Nueva regla"
      subtitle="% sobre (precio − materiales) para tu membresía."
      pending={pending}
      error={error}
      submitLabel="Crear regla"
      pendingLabel="Creando…"
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div>
        <label className="label" htmlFor="comm-modal-rate">
          % neto materiales
        </label>
        <input
          id="comm-modal-rate"
          className="field tabular"
          type="number"
          inputMode="decimal"
          min="0"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          required
        />
      </div>
    </FormModal>
  );
}
