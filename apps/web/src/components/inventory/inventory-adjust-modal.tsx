'use client';

import { FormEvent, useEffect, useState } from 'react';

import { FormModal } from '@/components/form-modal';
import { formatPackage, formatQty } from '@/lib/clinic';

export type InventoryAdjustPayload = {
  quantityDelta: number;
  reason: string;
  movementType: 'PURCHASE' | 'ADJUSTMENT';
};

type Props = {
  open: boolean;
  itemName: string;
  unitOfMeasure: string;
  packageCapacity: string;
  currentStock: string;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (payload: InventoryAdjustPayload) => void;
};

export function InventoryAdjustModal({
  open,
  itemName,
  unitOfMeasure,
  packageCapacity,
  currentStock,
  pending,
  error,
  onClose,
  onSave,
}: Props) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [movementType, setMovementType] = useState<'PURCHASE' | 'ADJUSTMENT'>(
    'PURCHASE',
  );

  useEffect(() => {
    if (!open) return;
    setDelta('');
    setReason('');
    setMovementType('PURCHASE');
  }, [open]);

  const nextStock = Number(currentStock) + (Number(delta) || 0);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const quantityDelta = Number(delta);
    if (!quantityDelta || !reason.trim()) return;
    onSave({
      quantityDelta,
      reason: reason.trim(),
      movementType,
    });
  }

  return (
    <FormModal
      open={open}
      title="Ajuste de stock"
      subtitle={`${itemName} · ${formatPackage(packageCapacity, unitOfMeasure)} · hay ${formatQty(currentStock)} ${unitOfMeasure}`}
      pending={pending}
      error={error}
      submitLabel="Registrar ajuste"
      pendingLabel="Guardando…"
      submitDisabled={!Number(delta) || !reason.trim() || nextStock < 0}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="inv-adjust-delta">
            Cantidad (+ o −)
          </label>
          <input
            id="inv-adjust-delta"
            className="field tabular"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={delta}
            onChange={(e) => {
              const value = e.target.value;
              setDelta(value);
              const n = Number(value);
              if (n > 0) setMovementType('PURCHASE');
              else if (n < 0) setMovementType('ADJUSTMENT');
            }}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="inv-adjust-type">
            Tipo
          </label>
          <select
            id="inv-adjust-type"
            className="field"
            value={movementType}
            onChange={(e) =>
              setMovementType(e.target.value as 'PURCHASE' | 'ADJUSTMENT')
            }
          >
            <option value="PURCHASE">Compra / entrada</option>
            <option value="ADJUSTMENT">Ajuste</option>
          </select>
        </div>
      </div>
      <p className="text-sm text-muted">
        Quedaría {Number.isNaN(nextStock) ? '—' : formatQty(nextStock)} {unitOfMeasure}
        {nextStock < 0 ? ' · no puede quedar negativo' : ''}.
      </p>
      <div>
        <label className="label" htmlFor="inv-adjust-reason">
          Motivo
        </label>
        <input
          id="inv-adjust-reason"
          className="field"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Compra, merma, conteo…"
          required
        />
      </div>
    </FormModal>
  );
}
