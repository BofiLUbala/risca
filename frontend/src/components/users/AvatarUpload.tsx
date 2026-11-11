'use client';

import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { api, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Loading';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 5;

/** Changer ou retirer sa photo de profil (JPEG, PNG ou WebP, 5 Mo au plus). */
export function AvatarUpload() {
  const { user, refresh } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  if (!user) return null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (!TYPES.includes(file.type)) {
      setError('Format non accepté. Choisissez une image JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Image trop lourde (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum : ${MAX_MB} Mo.`);
      return;
    }
    const local = URL.createObjectURL(file);
    setPreview(local);
    setBusy(true);
    try {
      const { url } = await uploadFile(file);
      await api.patch('/users/profile', { avatarUrl: url });
      await refresh();
    } catch {
      setError('Le téléversement a échoué. Réessayez dans un instant.');
    } finally {
      setBusy(false);
      setPreview(null);
      URL.revokeObjectURL(local);
    }
  }

  async function remove() {
    setError(null);
    setBusy(true);
    try {
      await api.patch('/users/profile', { avatarUrl: null });
      await refresh();
    } catch {
      setError('La suppression a échoué. Réessayez dans un instant.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <Avatar src={user.avatarUrl} firstName={user.firstName} lastName={user.lastName} size="xl" />
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-white">
            <Spinner className="h-6 w-6" />
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-base font-semibold text-ink-900">
          {user.firstName} {user.lastName}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept={TYPES.join(',')}
            className="sr-only"
            onChange={onPick}
            aria-label="Choisir une photo de profil"
            tabIndex={-1}
          />
          <button type="button" className="btn-primary" disabled={busy} onClick={() => input.current?.click()}>
            <Camera className="h-4 w-4" />
            {user.avatarUrl ? 'Changer la photo' : 'Ajouter une photo'}
          </button>
          {user.avatarUrl && (
            <button type="button" className="btn-outline" disabled={busy} onClick={remove}>
              <Trash2 className="h-4 w-4" />
              Retirer
            </button>
          )}
        </div>
        <p className="meta mt-2">JPEG, PNG ou WebP, {MAX_MB} Mo au plus. Visible par les membres du réseau.</p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
