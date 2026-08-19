'use client';

import { FormEvent, useEffect, useState } from 'react';

import { FormModal } from '@/components/form-modal';
import {
  formatPackage,
  formatQty,
  INVENTORY_KINDS,
  type InventoryItemKind,
} from '@/lib/clinic';

const UNIT_OPTIONS = ['ml', 'g', 'kg', 'U', 'L', 'cc', 'und'] as const;

export type InventoryItemFormPayload = {
  productName: string;
  itemKind: InventoryItemKind;
  unitOfMeasure: string;
  packageCapacity: number;
  currentStock?: number;
  minStockAlert: number;
  costPerUnitUsd: number;
  salePriceUsd: number;
};

export type InventoryItemFormInitial = {
  productName: string;
  itemKind?: string;
  unitOfMeasure: string;
  packageCapacity: string;
  currentStock: string;
  minStockAlert: string;
  costPerUnitUsd: string;
  salePriceUsd?: string;
};

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: InventoryItemFormInitial | null;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (payload: InventoryItemFormPayload) => void;
};

export function InventoryItemFormModal({
  open,
  mode,
  initial,
  pending,
  error,
  onClose,
  onSave,
}: Props) {
  const [productName, setProductName] = useState('');
  const [itemKind, setItemKind] = useState<InventoryItemKind>('MATERIAL');
  const [capacity, setCapacity] = useState('1');
  const [unit, setUnit] = useState('ml');
  const [stock, setStock] = useState('10');
  const [minAlert, setMinAlert] = useState('5');
  const [cost, setCost] = useState('20');
  const [salePrice, setSalePrice] = useState('0');

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setProductName(initial.productName);
      setItemKind(initial.itemKind === 'RETAIL' ? 'RETAIL' : 'MATERIAL');
      setCapacity(String(Number(initial.packageCapacity) || 1));
      setUnit(initial.unitOfMeasure);
      setStock(String(Number(initial.currentStock)));
      setMinAlert(String(Number(initial.minStockAlert)));
      setCost(String(Number(initial.costPerUnitUsd)));
      setSalePrice(String(Number(initial.salePriceUsd ?? 0)));
      return;
    }
    setProductName('');
    setItemKind('MATERIAL');
    setCapacity('1');
    setUnit('ml');
    setStock('10');
    setMinAlert('5');
    setCost('20');
    setSalePrice('0');
  }, [open, mode, initial]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    onSave({
      productName: productName.trim(),
      itemKind,
      unitOfMeasure: unit.trim(),
      packageCapacity: Number(capacity),
      currentStock: mode === 'create' ? Number(stock) : undefined,
      minStockAlert: Number(minAlert),
      costPerUnitUsd: Number(cost),
      salePriceUsd: itemKind === 'RETAIL' ? Number(salePrice) : 0,
    });
  }

  return (
    <FormModal
      open={open}
      title={mode === 'edit' ? 'Editar ítem' : 'Nuevo ítem'}
      subtitle={
        itemKind === 'RETAIL'
          ? 'Producto que se vende al paciente. El cobro va en Finanzas y descuenta stock.'
          : 'Material que se usa en la visita con el paciente (no se vende).'
      }
      pending={pending}
      error={error}
      submitLabel={mode === 'edit' ? 'Guardar cambios' : 'Agregar ítem'}
      pendingLabel={mode === 'edit' ? 'Guardando…' : 'Agregando…'}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div>
        <label className="label" htmlFor="inv-modal-name">
          Producto
        </label>
        <input
          id="inv-modal-name"
          className="field"
          placeholder={itemKind === 'RETAIL' ? 'Crema hidratante…' : 'Juvederm Ultra…'}
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          required
        />
      </div>
      <div>
        <p className="label" id="inv-kind-label">
          Tipo
        </p>
        <div className="seg mt-1" role="radiogroup" aria-labelledby="inv-kind-label">
          {INVENTORY_KINDS.map((kind) => (
            <button
              key={kind.value}
              type="button"
              role="radio"
              aria-checked={itemKind === kind.value}
              className="seg-btn"
              onClick={() => {
                setItemKind(kind.value);
                if (kind.value === 'RETAIL' && (unit === 'ml' || unit === 'g')) {
                  setUnit('und');
                }
              }}
            >
              {kind.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="inv-modal-capacity">
          Presentación
        </label>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <input
            id="inv-modal-capacity"
            className="field tabular"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            required
            aria-describedby="inv-modal-capacity-hint"
          />
          <input
            id="inv-modal-unit"
            className="field"
            list="inv-unit-options"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            aria-label="Unidad"
            required
          />
          <datalist id="inv-unit-options">
            {UNIT_OPTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>
        <p id="inv-modal-capacity-hint" className="mt-1 text-xs text-muted">
          Tamaño del envase: 1000 ml, 500 ml, 50 g, 1 ml. El stock se cuenta en esa
          unidad.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {mode === 'create' ? (
          <div>
            <label className="label" htmlFor="inv-modal-stock">
              Stock inicial
            </label>
            <input
              id="inv-modal-stock"
              className="field tabular"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </div>
        ) : (
          <div>
            <p className="label">Stock actual</p>
            <p className="tabular pt-2 text-botanical">
              {formatQty(initial?.currentStock ?? 0)} {unit || initial?.unitOfMeasure}
            </p>
          </div>
        )}
        <div>
          <label className="label" htmlFor="inv-modal-alert">
            Alerta mínima
          </label>
          <input
            id="inv-modal-alert"
            className="field tabular"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={minAlert}
            onChange={(e) => setMinAlert(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="inv-modal-cost">
            Costo USD / {unit || 'unidad'}
          </label>
          <input
            id="inv-modal-cost"
            className="field tabular"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            required
          />
        </div>
        {itemKind === 'RETAIL' ? (
          <div>
            <label className="label" htmlFor="inv-modal-sale">
              Precio venta USD / {unit || 'unidad'}
            </label>
            <input
              id="inv-modal-sale"
              className="field tabular"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              required
            />
          </div>
        ) : null}
      </div>
      {Number(capacity) > 0 && unit ? (
        <p className="text-xs text-muted">
          Se verá como {formatPackage(capacity, unit)}.
        </p>
      ) : null}
    </FormModal>
  );
}
