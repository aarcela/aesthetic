'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  assignableTenantRoles,
  tenantRoleLabel,
  type AssignableTenantRole,
  type TenantRole,
} from '@aesthetic/shared';

export type TeamMember = {
  id: string;
  fullName: string;
  role: TenantRole;
  isActive: boolean;
  email: string | null;
  locationIds: string[];
  isSelf?: boolean;
};

export type TeamLocation = { id: string; name: string; isPrimary?: boolean };

type Props = {
  members: TeamMember[];
  locations: TeamLocation[];
  pending?: boolean;
  error?: string | null;
  passwordNotice?: string | null;
  onInvite: (payload: {
    email: string;
    fullName: string;
    role: AssignableTenantRole;
    locationIds: string[];
  }) => void;
  onUpdateRole: (id: string, role: AssignableTenantRole) => void;
  onSetActive: (id: string, isActive: boolean) => void;
  onUpdateLocations: (id: string, locationIds: string[]) => void;
};

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}

function SedeChecks({
  name,
  locations,
  selected,
  disabled,
  onChange,
}: {
  name: string;
  locations: TeamLocation[];
  selected: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  if (locations.length === 0) {
    return <p className="text-sm text-muted">Crea una sede para asignarla al equipo.</p>;
  }

  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">{name}</legend>
      {locations.map((location) => {
        const checked = selected.includes(location.id);
        return (
          <label
            key={location.id}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 py-1.5 text-sm ${
              checked ? 'border-botanical bg-white text-botanical' : 'border-line text-muted'
            }`}
          >
            <input
              type="checkbox"
              className="size-4 accent-current"
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(toggleId(selected, location.id))}
            />
            {location.name}
          </label>
        );
      })}
    </fieldset>
  );
}

export function TeamCard({
  members,
  locations,
  pending,
  error,
  passwordNotice,
  onInvite,
  onUpdateRole,
  onSetActive,
  onUpdateLocations,
}: Props) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AssignableTenantRole>('MANAGER');
  const [inviteLocationIds, setInviteLocationIds] = useState<string[]>([]);

  useEffect(() => {
    setInviteLocationIds((current) => {
      const valid = new Set(locations.map((location) => location.id));
      const kept = current.filter((id) => valid.has(id));
      if (kept.length > 0) return kept;
      return locations.map((location) => location.id);
    });
  }, [locations]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();
    if (!trimmedEmail || !trimmedName || inviteLocationIds.length === 0) return;
    onInvite({
      email: trimmedEmail,
      fullName: trimmedName,
      role,
      locationIds: inviteLocationIds,
    });
    setEmail('');
    setFullName('');
  }

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold text-botanical">Equipo</h2>
      <p className="mt-1 text-sm text-muted">
        Cada persona trabaja en una o más sedes. Admin ve todas; el resto solo las asignadas.
      </p>

      <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_10rem_auto]" onSubmit={onSubmit}>
        <div>
          <label className="label" htmlFor="team-name">
            Nombre
          </label>
          <input
            id="team-name"
            className="field"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ana Pérez"
            autoComplete="name"
            required
            disabled={pending}
          />
        </div>
        <div>
          <label className="label" htmlFor="team-email">
            Correo
          </label>
          <input
            id="team-email"
            className="field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ana@clinica.com"
            autoComplete="email"
            required
            disabled={pending}
          />
        </div>
        <div>
          <label className="label" htmlFor="team-role">
            Rol
          </label>
          <select
            id="team-role"
            className="field"
            value={role}
            onChange={(e) => setRole(e.target.value as AssignableTenantRole)}
            disabled={pending}
          >
            {assignableTenantRoles.map((value) => (
              <option key={value} value={value}>
                {tenantRoleLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            className="btn btn-ghost w-full sm:w-auto"
            type="submit"
            disabled={pending || inviteLocationIds.length === 0}
          >
            Invitar
          </button>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <p className="label mb-2">Sedes</p>
          <SedeChecks
            name="Sedes del nuevo miembro"
            locations={locations}
            selected={inviteLocationIds}
            disabled={pending}
            onChange={setInviteLocationIds}
          />
        </div>
      </form>

      {passwordNotice ? (
        <p className="mt-3 rounded-xl border border-line bg-white/80 px-3 py-2 text-sm text-botanical">
          {passwordNotice}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-danger">{error}</p> : null}

      <ul className="mt-4 space-y-2">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex flex-col gap-3 rounded-xl border border-line bg-white/80 px-3 py-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-botanical">
                  {member.fullName}
                  {member.isSelf ? (
                    <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      Tú
                    </span>
                  ) : null}
                  {!member.isActive ? (
                    <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-danger">
                      Inactivo
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-sm text-muted">{member.email ?? 'Sin correo'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {member.role === 'OWNER' || member.isSelf ? (
                  <span className="text-sm font-semibold text-botanical">
                    {tenantRoleLabel(member.role)}
                  </span>
                ) : (
                  <>
                    <label className="sr-only" htmlFor={`role-${member.id}`}>
                      Rol de {member.fullName}
                    </label>
                    <select
                      id={`role-${member.id}`}
                      className="field py-1"
                      value={member.role}
                      disabled={pending || !member.isActive}
                      onChange={(e) =>
                        onUpdateRole(member.id, e.target.value as AssignableTenantRole)
                      }
                    >
                      {assignableTenantRoles.map((value) => (
                        <option key={value} value={value}>
                          {tenantRoleLabel(value)}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {member.isSelf || member.role === 'OWNER' ? null : (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={pending}
                    onClick={() => onSetActive(member.id, !member.isActive)}
                  >
                    {member.isActive ? 'Desactivar' : 'Reactivar'}
                  </button>
                )}
              </div>
            </div>
            <SedeChecks
              name={`Sedes de ${member.fullName}`}
              locations={locations}
              selected={member.locationIds ?? []}
              disabled={pending || !member.isActive}
              onChange={(next) => {
                if (next.length === 0) return;
                onUpdateLocations(member.id, next);
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
