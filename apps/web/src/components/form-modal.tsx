'use client';

import { FormEvent, type ReactNode, useEffect, useId } from 'react';

import { IconClose } from '@/components/icons';

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  pending?: boolean;
  error?: string | null;
  submitLabel: string;
  pendingLabel?: string;
  submitDisabled?: boolean;
  maxWidthClass?: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  children: ReactNode;
};

export function FormModal({
  open,
  title,
  subtitle,
  pending,
  error,
  submitLabel,
  pendingLabel = 'Guardando…',
  submitDisabled,
  maxWidthClass = 'max-w-lg',
  onClose,
  onSubmit,
  children,
}: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, pending]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-botanical-deep/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onClick={() => {
        if (!pending) onClose();
      }}
    >
      <form
        className={`panel fade-up flex max-h-[100dvh] w-full ${maxWidthClass} flex-col overflow-hidden rounded-b-none rounded-t-3xl sm:max-h-[90dvh] sm:rounded-3xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        autoComplete="off"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="brand-mark text-2xl text-botanical sm:text-[1.75rem]">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon shrink-0"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={pending}
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {children}
          {error ? (
            <p className="text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <button
            className="btn btn-primary flex-1 sm:flex-none"
            type="submit"
            disabled={pending || submitDisabled}
          >
            {pending ? pendingLabel : submitLabel}
          </button>
          <button
            className="btn btn-ghost flex-1 sm:flex-none"
            type="button"
            onClick={onClose}
            disabled={pending}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
