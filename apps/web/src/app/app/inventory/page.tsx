'use client';

import { useCallback, useState, useTransition } from 'react';

import {
  InventoryAdjustModal,
  type InventoryAdjustPayload,
} from '@/components/inventory/inventory-adjust-modal';
import {
  InventoryItemFormModal,
  type InventoryItemFormPayload,
} from '@/components/inventory/inventory-item-create-modal';
import { EmptyState, LiveMessage, PageHeader } from '@/components/ui';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTabRefresh } from '@/lib/use-tab-refresh';
import { canManageOperations } from '@aesthetic/shared';
import { formatPackage, formatQty, formatUsd, inventoryKindLabel } from '@/lib/clinic';

type Item = {
  id: string;
  productName: string;
  itemKind?: 'MATERIAL' | 'RETAIL';
  unitOfMeasure: string;
  packageCapacity: string;
  currentStock: string;
  minStockAlert: string;
  costPerUnitUsd: string;
  salePriceUsd?: string;
};

export default function InventoryPage() {
  const { token, membership } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<Item | null>(null);
  const [adjusting, setAdjusting] = useState<Item | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<'all' | 'MATERIAL' | 'RETAIL'>('all');
  const [upgrade, setUpgrade] = useState(false);
  const [pending, startTransition] = useTransition();

  const canManage = membership ? canManageOperations(membership.role) : false;
  const visibleItems =
    kindFilter === 'all'
      ? items
      : items.filter((item) => (item.itemKind ?? 'MATERIAL') === kindFilter);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await apiFetch<Item[]>('/v1/inventory/items', { token }));
      setUpgrade(false);
      setListError(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PLAN_UPGRADE_REQUIRED') {
        setUpgrade(true);
        setItems([]);
      } else {
        setListError(err instanceof Error ? err.message : 'Error al cargar inventario');
      }
    }
  }, [token]);

  useTabRefresh('/app/inventory', load, Boolean(token && membership?.tenantId));

  function openCreate() {
    setModalMode('create');
    setEditing(null);
    setFormError(null);
    setMessage(null);
    setModalOpen(true);
  }

  function openEdit(item: Item) {
    setModalMode('edit');
    setEditing(item);
    setFormError(null);
    setMessage(null);
    setModalOpen(true);
  }

  function onSave(payload: InventoryItemFormPayload) {
    if (!token) return;
    setFormError(null);
    startTransition(async () => {
      try {
        if (modalMode === 'create') {
          await apiFetch('/v1/inventory/items', {
            method: 'POST',
            token,
            body: JSON.stringify(payload),
          });
          setMessage('Ítem agregado');
        } else if (editing) {
          await apiFetch(`/v1/inventory/items/${editing.id}`, {
            method: 'PATCH',
            token,
            body: JSON.stringify({
              productName: payload.productName,
              itemKind: payload.itemKind,
              unitOfMeasure: payload.unitOfMeasure,
              packageCapacity: payload.packageCapacity,
              minStockAlert: payload.minStockAlert,
              costPerUnitUsd: payload.costPerUnitUsd,
              salePriceUsd: payload.salePriceUsd,
            }),
          });
          setMessage('Ítem actualizado');
        }
        setModalOpen(false);
        setEditing(null);
        await load();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'No se pudo guardar el ítem');
      }
    });
  }

  function onAdjust(payload: InventoryAdjustPayload) {
    if (!token || !adjusting) return;
    setAdjustError(null);
    startTransition(async () => {
      try {
        await apiFetch(`/v1/inventory/items/${adjusting.id}/adjust`, {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
        setAdjusting(null);
        setMessage('Stock actualizado');
        await load();
      } catch (err) {
        setAdjustError(err instanceof Error ? err.message : 'No se pudo ajustar el stock');
      }
    });
  }

  function onDelete(item: Item) {
    if (!token) return;
    const ok = window.confirm(`¿Quitar “${item.productName}” del inventario?`);
    if (!ok) return;
    startTransition(async () => {
      try {
        await apiFetch(`/v1/inventory/items/${item.id}`, {
          method: 'DELETE',
          token,
        });
        if (editing?.id === item.id) {
          setModalOpen(false);
          setEditing(null);
        }
        if (adjusting?.id === item.id) setAdjusting(null);
        setMessage('Ítem eliminado');
        await load();
      } catch (err) {
        setListError(err instanceof Error ? err.message : 'No se pudo eliminar');
      }
    });
  }

  if (upgrade) {
    return (
      <div>
        <PageHeader title="Inventario" subtitle="Disponible en plan Pro." />
        <EmptyState
          title="Plan Pro requerido"
          body="Activa Pro en Ajustes para controlar el stock de cada procedimiento."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Inventario"
        subtitle="Productos que usas en la visita y los que se venden en recepción."
        action={
          canManage ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Nuevo ítem
            </button>
          ) : null
        }
      />

      {listError ? <LiveMessage tone="danger">{listError}</LiveMessage> : null}
      {message ? <LiveMessage tone="ok">{message}</LiveMessage> : null}

      {items.length > 0 ? (
        <div className="seg mt-4" role="tablist" aria-label="Tipo de inventario">
          {(
            [
              ['all', 'Todos'],
              ['MATERIAL', 'Materiales'],
              ['RETAIL', 'Productos'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={kindFilter === id}
              className="seg-btn"
              onClick={() => setKindFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            title="Sin inventario"
            body={
              canManage
                ? 'Carga materiales de visita o productos para venta con “Nuevo ítem”.'
                : 'Aún no hay insumos en esta clínica.'
            }
          />
        ) : visibleItems.length === 0 ? (
          <EmptyState
            title={kindFilter === 'RETAIL' ? 'Sin productos de venta' : 'Sin materiales'}
            body={
              kindFilter === 'RETAIL'
                ? 'Los productos se venden en Finanzas y descuentan stock. Los materiales se usan en la visita.'
                : 'Los materiales se descuentan al registrarlos en la visita del paciente.'
            }
          />
        ) : (
          <div className="space-y-3">
            {visibleItems.map((item) => {
              const low = Number(item.currentStock) <= Number(item.minStockAlert);
              const kind = item.itemKind ?? 'MATERIAL';
              return (
                <div key={item.id} className="panel px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-botanical">
                        {item.productName}
                      </p>
                      <p className="tabular text-sm text-muted">
                        {inventoryKindLabel(kind)}
                        {' · '}
                        {formatPackage(item.packageCapacity ?? 1, item.unitOfMeasure)}
                        {' · stock '}
                        {formatQty(item.currentStock)} {item.unitOfMeasure}
                        {kind === 'RETAIL' && item.salePriceUsd
                          ? ` · venta ${formatUsd(item.salePriceUsd)}`
                          : item.costPerUnitUsd
                            ? ` · costo ${formatUsd(item.costPerUnitUsd)}`
                            : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {low ? (
                        <span className="status-pill" data-tone="danger">
                          Bajo
                        </span>
                      ) : null}
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={pending}
                            onClick={() => {
                              setAdjustError(null);
                              setAdjusting(item);
                            }}
                          >
                            Ajuste
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={pending}
                            onClick={() => openEdit(item)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={pending}
                            onClick={() => onDelete(item)}
                          >
                            Quitar
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <InventoryItemFormModal
        open={modalOpen}
        mode={modalMode}
        initial={editing}
        pending={pending}
        error={formError}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={onSave}
      />

      <InventoryAdjustModal
        open={Boolean(adjusting)}
        itemName={adjusting?.productName ?? ''}
        unitOfMeasure={adjusting?.unitOfMeasure ?? ''}
        packageCapacity={adjusting?.packageCapacity ?? '1'}
        currentStock={adjusting?.currentStock ?? '0'}
        pending={pending}
        error={adjustError}
        onClose={() => setAdjusting(null)}
        onSave={onAdjust}
      />
    </div>
  );
}
