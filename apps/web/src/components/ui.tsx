import type { ReactNode } from 'react';

import { IconAlert, IconCheck } from '@/components/icons';
import { statusLabel } from '@/lib/clinic';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 max-w-2xl">
        <h1 className="brand-mark text-pretty text-[1.75rem] leading-tight text-botanical sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 text-pretty text-base leading-relaxed text-muted">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="header-actions">{action}</div> : null}
    </header>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel px-6 py-10 text-center">
      <p className="brand-mark text-2xl text-botanical">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-pretty text-muted">{body}</p>
    </div>
  );
}

export function StatChip({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel px-5 py-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold tracking-tight text-botanical">{value}</p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    ['POSTED', 'SENT', 'COMPLETED', 'CONFIRMED', 'CHECKED_IN'].includes(status)
      ? 'ok'
      : ['CANCELLED', 'FAILED', 'VOID', 'NO_SHOW'].includes(status)
        ? 'danger'
        : ['PENDING', 'DRAFT', 'SCHEDULED'].includes(status)
          ? 'warn'
          : undefined;

  return (
    <span className="status-pill" data-tone={tone}>
      {statusLabel(status)}
    </span>
  );
}

export function LiveMessage({
  tone,
  children,
}: {
  tone: 'ok' | 'danger';
  children: ReactNode;
}) {
  const Icon = tone === 'ok' ? IconCheck : IconAlert;
  return (
    <p className="notice" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'} aria-live="polite">
      <Icon className="notice-icon" />
      <span>{children}</span>
    </p>
  );
}

export function LoadingBlock({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="panel flex min-h-40 items-center justify-center p-8 text-muted">
      {label}
    </div>
  );
}
