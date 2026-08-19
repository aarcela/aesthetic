'use client';

import { useCallback, useState, useTransition } from 'react';

import {
  ServiceFormModal,
  type ServiceFormPayload,
} from '@/components/services/service-create-modal';
import { EmptyState, LiveMessage, PageHeader } from '@/components/ui';
import { formatUsd } from '@/lib/clinic';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTabRefresh } from '@/lib/use-tab-refresh';
import { canManageOperations } from '@aesthetic/shared';

type Service = {
  id: string;
  name: string;
  basePriceUsd: string;
  estimatedDurationMinutes: number;
  isActive: boolean;
};

export default function ServicesPage() {
  const { token, membership } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<Service | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canManage = membership ? canManageOperations(membership.role) : false;

  const load = useCallback(async () => {
    if (!token) return;
    setServices(await apiFetch<Service[]>('/v1/services', { token }));
  }, [token]);

  useTabRefresh(
    '/app/services',
    () => load().catch((err: Error) => setListError(err.message)),
    Boolean(token && membership?.tenantId),
  );

  function openCreate() {
    setModalMode('create');
    setEditing(null);
    setFormError(null);
    setMessage(null);
    setModalOpen(true);
  }

  function openEdit(service: Service) {
    setModalMode('edit');
    setEditing(service);
    setFormError(null);
    setMessage(null);
    setModalOpen(true);
  }

  function onSave(payload: ServiceFormPayload) {
    if (!token) return;
    setFormError(null);
    startTransition(async () => {
      try {
        if (modalMode === 'create') {
          await apiFetch('/v1/services', {
            method: 'POST',
            token,
            body: JSON.stringify(payload),
          });
          setMessage('Servicio creado');
        } else if (editing) {
          await apiFetch(`/v1/services/${editing.id}`, {
            method: 'PATCH',
            token,
            body: JSON.stringify(payload),
          });
          setMessage('Servicio actualizado');
        }
        setModalOpen(false);
        setEditing(null);
        await load();
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : 'No se pudo guardar el servicio',
        );
      }
    });
  }

  function onDelete(service: Service) {
    if (!token) return;
    const ok = window.confirm(`¿Quitar “${service.name}” del catálogo?`);
    if (!ok) return;
    startTransition(async () => {
      try {
        await apiFetch(`/v1/services/${service.id}`, {
          method: 'DELETE',
          token,
        });
        if (editing?.id === service.id) {
          setModalOpen(false);
          setEditing(null);
        }
        setMessage('Servicio eliminado');
        await load();
      } catch (err) {
        setListError(err instanceof Error ? err.message : 'No se pudo eliminar');
      }
    });
  }

  return (
    <div>
      <PageHeader
        title="Servicios"
        subtitle="Lista de tratamientos con su precio en dólares."
        action={
          canManage ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Nuevo servicio
            </button>
          ) : null
        }
      />

      {listError ? <LiveMessage tone="danger">{listError}</LiveMessage> : null}
      {message ? <LiveMessage tone="ok">{message}</LiveMessage> : null}

      <div className="mt-4">
        {services.length === 0 ? (
          <EmptyState
            title="Sin servicios"
            body={
              canManage
                ? 'Crea Labios, Toxina u otros con “Nuevo servicio”.'
                : 'Aún no hay servicios en esta clínica.'
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {services.map((s) => (
              <div key={s.id} className="panel min-w-0 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-botanical">{s.name}</p>
                    <p className="tabular text-sm text-muted">
                      {formatUsd(s.basePriceUsd)} · {s.estimatedDurationMinutes} min
                    </p>
                    {s.isActive ? null : (
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">
                        Oculto
                      </p>
                    )}
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={pending}
                        onClick={() => openEdit(s)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={pending}
                        onClick={() => onDelete(s)}
                      >
                        Quitar
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ServiceFormModal
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
    </div>
  );
}
