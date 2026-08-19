'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

import { FormModal } from '@/components/form-modal';

export type PhotoUploadPayload = {
  photoType: 'BEFORE' | 'AFTER' | 'OTHER';
  notes?: string;
  file: File;
};

type Props = {
  open: boolean;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (payload: PhotoUploadPayload) => void;
};

export function PhotoUploadModal({ open, pending, error, onClose, onSave }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoType, setPhotoType] = useState<'BEFORE' | 'AFTER' | 'OTHER'>('BEFORE');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhotoType('BEFORE');
    setNotes('');
    setFile(null);
    setLocalError(null);
  }, [open]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setLocalError('Elige una imagen.');
      return;
    }
    onSave({
      photoType,
      notes: notes.trim() || undefined,
      file,
    });
  }

  return (
    <FormModal
      open={open}
      title="Subir foto"
      subtitle="Antes / después u otra de la sesión."
      pending={pending}
      error={error ?? localError}
      submitLabel="Subir foto"
      pendingLabel="Subiendo…"
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div>
        <label className="label" htmlFor="photo-modal-type">
          Tipo
        </label>
        <select
          id="photo-modal-type"
          className="field"
          value={photoType}
          onChange={(e) => setPhotoType(e.target.value as 'BEFORE' | 'AFTER' | 'OTHER')}
        >
          <option value="BEFORE">Antes</option>
          <option value="AFTER">Después</option>
          <option value="OTHER">Otra</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="photo-modal-notes">
          Notas
        </label>
        <input
          id="photo-modal-notes"
          className="field"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ángulo, luz, sesión…"
        />
      </div>
      <div>
        <label className="label" htmlFor="photo-modal-file">
          Archivo
        </label>
        <input
          ref={fileRef}
          id="photo-modal-file"
          className="field"
          type="file"
          accept="image/*"
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
