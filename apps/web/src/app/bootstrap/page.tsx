'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function BootstrapPage() {
  const { token, membership, loading, refreshMembership } = useAuth();
  const router = useRouter();
  const [clinicName, setClinicName] = useState('');
  const [fullName, setFullName] = useState('');
  const [fx, setFx] = useState<'oficial' | 'paralelo'>('oficial');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    if (membership) {
      router.replace('/app');
    }
  }, [loading, membership, router, token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/v1/auth/bootstrap-tenant', {
        method: 'POST',
        token,
        body: JSON.stringify({
          clinicName,
          fullName,
          defaultFxFuente: fx,
        }),
      });
      await refreshMembership();
      router.replace('/app');
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message}. Revisa los datos e inténtalo de nuevo.`
          : 'No se pudo crear la clínica. Revisa los datos e inténtalo de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || membership) {
    return (
      <div className="atmosphere flex min-h-screen items-center justify-center px-4 text-muted">
        Cargando clínica…
      </div>
    );
  }

  return (
    <div className="atmosphere flex min-h-screen items-center justify-center px-4 py-10">
      <form className="panel w-full max-w-lg space-y-5 p-8" onSubmit={onSubmit}>
        <p className="brand-mark text-3xl text-botanical">Tu clínica</p>
        <p className="text-pretty text-muted">
          Completa estos tres datos. Después podrás cargar servicios, pacientes y abrir la caja.
        </p>
        <div>
          <label className="label" htmlFor="clinic">
            Nombre de la clínica
          </label>
          <input
            id="clinic"
            name="clinicName"
            className="field"
            autoComplete="organization"
            placeholder="Ej. Clínica Luz…"
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="name">
            Tu nombre
          </label>
          <input
            id="name"
            name="fullName"
            className="field"
            autoComplete="name"
            placeholder="Nombre y apellido…"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="fx">
            ¿Qué tasa usamos para pasar bolívares a dólares?
          </label>
          <select
            id="fx"
            name="fxFuente"
            className="field"
            autoComplete="off"
            value={fx}
            onChange={(e) => setFx(e.target.value as 'oficial' | 'paralelo')}
          >
            <option value="oficial">Oficial (BCV)</option>
            <option value="paralelo">Paralelo</option>
          </select>
          <p className="hint">Puedes cambiarla después en Ajustes.</p>
        </div>
        {error ? (
          <p className="notice" data-tone="danger" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn btn-primary w-full" disabled={submitting} type="submit">
          {submitting ? 'Creando…' : 'Crear clínica'}
        </button>
      </form>
    </div>
  );
}
