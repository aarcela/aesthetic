'use client';

import { useCallback, useState, useTransition } from 'react';

import { PaymentMethodsCard } from '@/components/settings/payment-methods-card';
import { TeamCard, type TeamMember } from '@/components/settings/team-card';
import { RoleGate } from '@/components/role-gate';
import { LiveMessage, PageHeader } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTabRefresh } from '@/lib/use-tab-refresh';
import type { ClinicPaymentMethod } from '@/lib/clinic';
import {
  canAccessSettings,
  tenantRoleLabel,
  type AssignableTenantRole,
} from '@aesthetic/shared';

type Plan = {
  planCode: 'starter' | 'pro';
  subscriptionStatus: string;
  name: string;
  defaultFxFuente: 'oficial' | 'paralelo';
};

type Clinic = {
  name: string;
  taxId: string | null;
  defaultFxFuente: 'oficial' | 'paralelo';
};

type FxView = {
  fuente: string;
  selectedRate: { vesPerUsd: string; fuente: string };
};

type Location = { id: string; name: string; isPrimary: boolean; timezone: string };

export default function SettingsPage() {
  const { token, membership } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [fx, setFx] = useState<FxView | null>(null);
  const [methods, setMethods] = useState<ClinicPaymentMethod[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [clinicName, setClinicName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [locationName, setLocationName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [methodsError, setMethodsError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canManage = membership ? canAccessSettings(membership.role) : false;

  const load = useCallback(async () => {
    if (!token) return;
    const [p, c, f, m, l, team] = await Promise.all([
      apiFetch<Plan>('/v1/tenant-settings/plan', { token }),
      apiFetch<Clinic>('/v1/tenant-settings/clinic', { token }),
      apiFetch<FxView>('/v1/tenant-settings/fx-source', { token }),
      apiFetch<ClinicPaymentMethod[]>('/v1/tenant-settings/payment-methods', { token }),
      apiFetch<Location[]>('/v1/locations', { token }),
      apiFetch<TeamMember[]>('/v1/team/members', { token }),
    ]);
    setPlan(p);
    setClinic(c);
    setClinicName(c.name);
    setTaxId(c.taxId ?? '');
    setFx(f);
    setMethods(m);
    setLocations(l);
    setMembers(team);
  }, [token]);

  useTabRefresh(
    '/app/settings',
    () => load().catch((err: Error) => setError(err.message)),
    Boolean(canManage && token),
  );

  function saveClinic() {
    if (!token) return;
    setError(null);
    startTransition(async () => {
      try {
        const saved = await apiFetch<Clinic>('/v1/tenant-settings/clinic', {
          method: 'PATCH',
          token,
          body: JSON.stringify({
            name: clinicName.trim(),
            taxId: taxId.trim() || null,
          }),
        });
        setClinic(saved);
        setMessage('Datos de la clínica guardados');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo guardar la clínica');
      }
    });
  }

  function setFuente(fuente: 'oficial' | 'paralelo') {
    if (!token) return;
    setError(null);
    startTransition(async () => {
      try {
        await apiFetch('/v1/tenant-settings/fx-source', {
          method: 'PUT',
          token,
          body: JSON.stringify({ fuente }),
        });
        setMessage(`Tasa activa: ${fuente}`);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cambiar la tasa');
      }
    });
  }

  function setPlanCode(planCode: 'starter' | 'pro') {
    if (!token) return;
    startTransition(async () => {
      try {
        await apiFetch('/v1/tenant-settings/plan', {
          method: 'PUT',
          token,
          body: JSON.stringify({ planCode, subscriptionStatus: 'active' }),
        });
        setMessage(`Plan actualizado a ${planCode}`);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cambiar el plan');
      }
    });
  }

  function onCreateMethod(payload: {
    label: string;
    nativeCurrency: 'USD' | 'VES' | 'USDT';
  }) {
    if (!token) return;
    setMethodsError(null);
    startTransition(async () => {
      try {
        await apiFetch('/v1/tenant-settings/payment-methods', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
        setMessage('Método agregado');
        const rows = await apiFetch<ClinicPaymentMethod[]>(
          '/v1/tenant-settings/payment-methods',
          { token },
        );
        setMethods(rows);
      } catch (err) {
        setMethodsError(err instanceof Error ? err.message : 'No se pudo agregar');
      }
    });
  }

  function onUpdateMethod(id: string, payload: { label?: string; isActive?: boolean }) {
    if (!token) return;
    setMethodsError(null);
    startTransition(async () => {
      try {
        await apiFetch(`/v1/tenant-settings/payment-methods/${id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(payload),
        });
        setMessage(payload.isActive === false ? 'Método oculto' : 'Método actualizado');
        const rows = await apiFetch<ClinicPaymentMethod[]>(
          '/v1/tenant-settings/payment-methods',
          { token },
        );
        setMethods(rows);
      } catch (err) {
        setMethodsError(err instanceof Error ? err.message : 'No se pudo actualizar');
      }
    });
  }

  function onInviteMember(payload: {
    email: string;
    fullName: string;
    role: AssignableTenantRole;
    locationIds: string[];
  }) {
    if (!token) return;
    setTeamError(null);
    setPasswordNotice(null);
    startTransition(async () => {
      try {
        const created = await apiFetch<TeamMember & { temporaryPassword?: string | null }>(
          '/v1/team/members',
          {
            method: 'POST',
            token,
            body: JSON.stringify(payload),
          },
        );
        setMessage(`${created.fullName} agregado al equipo`);
        if (created.temporaryPassword) {
          setPasswordNotice(
            `No se pudo enviar el correo. Contraseña temporal: ${created.temporaryPassword}`,
          );
        }
        setMembers(await apiFetch<TeamMember[]>('/v1/team/members', { token }));
      } catch (err) {
        setTeamError(err instanceof Error ? err.message : 'No se pudo invitar');
      }
    });
  }

  function onUpdateMemberRole(id: string, role: AssignableTenantRole) {
    if (!token) return;
    setTeamError(null);
    startTransition(async () => {
      try {
        await apiFetch(`/v1/team/members/${id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({ role }),
        });
        setMessage('Rol actualizado');
        setMembers(await apiFetch<TeamMember[]>('/v1/team/members', { token }));
      } catch (err) {
        setTeamError(err instanceof Error ? err.message : 'No se pudo cambiar el rol');
      }
    });
  }

  function onUpdateMemberLocations(id: string, locationIds: string[]) {
    if (!token) return;
    setTeamError(null);
    startTransition(async () => {
      try {
        await apiFetch(`/v1/team/members/${id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({ locationIds }),
        });
        setMessage('Sedes actualizadas');
        setMembers(await apiFetch<TeamMember[]>('/v1/team/members', { token }));
      } catch (err) {
        setTeamError(err instanceof Error ? err.message : 'No se pudieron guardar las sedes');
      }
    });
  }

  function onSetMemberActive(id: string, isActive: boolean) {
    if (!token) return;
    setTeamError(null);
    startTransition(async () => {
      try {
        await apiFetch(`/v1/team/members/${id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({ isActive }),
        });
        setMessage(isActive ? 'Miembro reactivado' : 'Miembro desactivado');
        setMembers(await apiFetch<TeamMember[]>('/v1/team/members', { token }));
      } catch (err) {
        setTeamError(err instanceof Error ? err.message : 'No se pudo actualizar');
      }
    });
  }

  function addLocation() {
    if (!token) return;
    const name = locationName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      try {
        await apiFetch('/v1/locations', {
          method: 'POST',
          token,
          body: JSON.stringify({ name, timezone: 'America/Caracas' }),
        });
        setLocationName('');
        setMessage('Sede agregada');
        setLocations(await apiFetch<Location[]>('/v1/locations', { token }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo agregar la sede');
      }
    });
  }

  return (
    <RoleGate allowed={canManage}>
      <div>
      <PageHeader
        title="Ajustes"
        subtitle="Nombre de la clínica, equipo, formas de pago, tasa y sedes."
      />

      <div className="grid gap-4">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-botanical">Clínica</h2>
          <p className="mt-1 text-sm text-muted">
            {membership?.fullName} · {membership ? tenantRoleLabel(membership.role) : '—'}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="clinic-name">
                Nombre
              </label>
              <input
                id="clinic-name"
                className="field"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                disabled={!canManage || pending}
              />
            </div>
            <div>
              <label className="label" htmlFor="clinic-rif">
                RIF (opcional)
              </label>
              <input
                id="clinic-rif"
                className="field"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="J-12345678-9"
                disabled={!canManage || pending}
              />
            </div>
          </div>
          {canManage ? (
            <button
              type="button"
              className="btn btn-primary mt-4"
              disabled={pending || !clinicName.trim()}
              onClick={saveClinic}
            >
              {pending ? 'Guardando…' : 'Guardar clínica'}
            </button>
          ) : null}
        </section>

        <TeamCard
          members={members}
          locations={locations}
          pending={pending}
          error={teamError}
          passwordNotice={passwordNotice}
          onInvite={onInviteMember}
          onUpdateRole={onUpdateMemberRole}
          onSetActive={onSetMemberActive}
          onUpdateLocations={onUpdateMemberLocations}
        />

        <PaymentMethodsCard
          methods={methods}
          canManage={canManage}
          pending={pending}
          error={methodsError}
          onCreate={onCreateMethod}
          onUpdate={onUpdateMethod}
        />

        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-botanical">Sedes</h2>
          <p className="mt-1 text-sm text-muted">
            Sucursales para agenda, caja e inventario.
          </p>
          <ul className="mt-3 space-y-2">
            {locations.map((loc) => (
              <li
                key={loc.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white/80 px-3 py-2"
              >
                <span className="font-medium text-botanical">{loc.name}</span>
                {loc.isPrimary ? (
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Principal
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {canManage ? (
            <form
              className="mt-4 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addLocation();
              }}
            >
              <label className="sr-only" htmlFor="location-name">
                Nombre de sede
              </label>
              <input
                id="location-name"
                className="field min-w-0 flex-1"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Nueva sede"
                disabled={pending}
              />
              <button className="btn btn-ghost" type="submit" disabled={pending}>
                Agregar sede
              </button>
            </form>
          ) : null}
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="panel p-5">
            <h2 className="text-lg font-semibold text-botanical">Tasa de caja</h2>
            <p className="mt-2 tabular text-sm text-muted">
              Activa: {fx?.fuente ?? clinic?.defaultFxFuente ?? '—'} ·{' '}
              {fx?.selectedRate?.vesPerUsd
                ? `${Number(fx.selectedRate.vesPerUsd).toFixed(2)} VES`
                : '—'}
            </p>
            {canManage ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={pending}
                  onClick={() => setFuente('oficial')}
                >
                  Oficial
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={pending}
                  onClick={() => setFuente('paralelo')}
                >
                  Paralelo
                </button>
              </div>
            ) : null}
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold text-botanical">Plan</h2>
            <p className="mt-2 text-muted">
              Actual: <strong>{plan?.planCode ?? '—'}</strong> · {plan?.subscriptionStatus}
            </p>
            {canManage ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={pending}
                  onClick={() => setPlanCode('starter')}
                >
                  Starter
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={pending}
                  onClick={() => setPlanCode('pro')}
                >
                  Activar Pro
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {error ? <LiveMessage tone="danger">{error}</LiveMessage> : null}
        {message ? <LiveMessage tone="ok">{message}</LiveMessage> : null}
      </div>
      </div>
    </RoleGate>
  );
}
