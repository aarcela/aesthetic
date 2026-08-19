'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { signIn, session, membership, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || !session) return;
    router.replace(membership ? '/app' : '/bootstrap');
  }, [loading, membership, router, session]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const me = await signIn(email, password);
      router.replace(me ? '/app' : '/bootstrap');
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message}. Revisa correo y contraseña, o pide ayuda a quien administra la clínica.`
          : 'No se pudo entrar. Revisa correo y contraseña.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && session) {
    return (
      <div className="atmosphere flex min-h-screen items-center justify-center px-4 text-muted">
        Cargando clínica…
      </div>
    );
  }

  return (
    <div className="atmosphere flex min-h-screen items-center justify-center px-4 py-10">
      <div className="panel w-full max-w-md p-8">
        <p className="brand-mark text-3xl text-botanical" translate="no">
          Aesthetic
        </p>
        <h1 className="mt-4 text-pretty text-xl font-semibold text-ink">Entrar a tu clínica</h1>
        <p className="mt-2 text-pretty text-muted">
          Usa el correo que te dieron en el equipo. Si no recuerdas la contraseña, pide una nueva
          a la persona que administra.
        </p>
        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          <div>
            <label className="label" htmlFor="email">
              Correo
            </label>
            <input
              id="email"
              name="email"
              className="field"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              placeholder="nombre@clinica.com…"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              className="field"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? (
            <p className="notice" data-tone="danger" role="alert">
              {error}
            </p>
          ) : null}
          <button className="btn btn-primary w-full" disabled={submitting} type="submit">
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link href="/" className="font-semibold text-botanical hover:underline">
            Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
