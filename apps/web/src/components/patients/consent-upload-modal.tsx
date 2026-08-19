'use client';

import { FormEvent, useEffect, useState } from 'react';

import { FormModal } from '@/components/form-modal';

export type ConsentUploadPayload = {
  procedureName: string;
  file: File;
};

type Props = {
  open: boolean;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (payload: ConsentUploadPayload) => void;
};

export function ConsentUploadModal({ open, pending, error, onClose, onSave }: Props) {
  const [procedureName, setProcedureName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setProcedureName('');
    setFile(null);
    setLocalError(null);
  }, [open]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!procedureName.trim()) {
      setLocalError('Indica el procedimiento.');
      return;
    }
    if (!file) {
      setLocalError('Elige la firma o PDF.');
      return;
    }
    onSave({ procedureName: procedureName.trim(), file });
  }

  return (
    <FormModal
      open={open}
      title="Registrar consentimiento"
      subtitle="Firma o PDF del procedimiento."
      pending={pending}
      error={error ?? localError}
      submitLabel="Subir consentimiento"
      pendingLabel="Subiendo…"
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div>
        <label className="label" htmlFor="consent-modal-proc">
          Procedimiento
        </label>
        <input
          id="consent-modal-proc"
          className="field"
          value={procedureName}
          onChange={(e) => {
            setProcedureName(e.target.value);
            setLocalError(null);
          }}
          placeholder="Labios 1ml, Toxina…"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="consent-modal-file">
          Firma / PDF
        </label>
        <input
          id="consent-modal-file"
          className="field"
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setLocalError(null);
          }}
          required
        />
      </div>
    </FormModal>
  );
}
