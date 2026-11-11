'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Camera, Trash2 } from 'lucide-react';
import { api, mediaUrl, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Loading';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 5;

/** Vérifie que le navigateur arrive vraiment à charger l'image envoyée. */
function canLoad(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

/**
 * Changer ou retirer sa photo de profil (JPEG, PNG ou WebP, 5 Mo au plus).
 * Le fichier se choisit par le bouton ou se dépose sur la photo. Après l'envoi, on
 * vérifie que l'image se charge : sans cela, un échec d'affichage laisserait les
 * initiales sans aucune explication.
 */
export function AvatarUpload() {
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  if (!user) return null;

  async function send(file: File | undefined) {
    if (!file) return;
    setError(null);
    setDone(null);
    if (!TYPES.includes(file.type)) {
      setError(
        file.type
          ? `Format non accepté (${file.type.replace('image/', '').toUpperCase()}). Choisissez une image JPEG, PNG ou WebP.`
          : 'Format non reconnu. Choisissez une image JPEG, PNG ou WebP.',
      );
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
      const shown = mediaUrl(url);
      if (shown && !(await canLoad(shown))) {
        setError(
          `La photo est enregistrée, mais le navigateur n'arrive pas à la charger depuis ${new URL(shown).host}. Vérifiez que le serveur est joignable, puis réessayez.`,
        );
      } else {
        setDone('Photo enregistrée.');
      }
      await refresh();
    } catch (e: any) {
      const detail = typeof e?.message === 'string' && e.message ? ` (${e.message})` : '';
      setError(`Le téléversement a échoué${detail}. Réessayez dans un instant.`);
    } finally {
      setBusy(false);
      setPreview(null);
      URL.revokeObjectURL(local);
    }
  }

  async function remove() {
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      await api.patch('/users/profile', { avatarUrl: null });
      await refresh();
      setDone('Photo retirée.');
    } catch {
      setError('La suppression a échoué. Réessayez dans un instant.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={clsx(
          'relative rounded-full ring-offset-2 ring-offset-surface transition-shadow',
          dragging && 'ring-4 ring-sun-400',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void send(e.dataTransfer.files?.[0]);
        }}
      >
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
          {/* Un vrai <label> autour du champ : le sélecteur s'ouvre sur tous les navigateurs. */}
          <label
            className={clsx(
              'btn-primary cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-risac-600',
              busy && 'pointer-events-none opacity-50',
            )}
          >
            <input
              type="file"
              accept={TYPES.join(',')}
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                void send(file);
              }}
            />
            <Camera className="h-4 w-4" aria-hidden="true" />
            {user.avatarUrl ? 'Changer la photo' : 'Ajouter une photo'}
          </label>
          {user.avatarUrl && (
            <button type="button" className="btn-outline" disabled={busy} onClick={remove}>
              <Trash2 className="h-4 w-4" />
              Retirer
            </button>
          )}
        </div>
        <p className="meta mt-2">
          JPEG, PNG ou WebP, {MAX_MB} Mo au plus. Vous pouvez aussi déposer l&apos;image sur la photo.
        </p>
        {busy && (
          <p role="status" className="mt-2 text-sm text-ink-600">
            Envoi en cours…
          </p>
        )}
        {done && !busy && (
          <p role="status" className="mt-2 text-sm text-success-700">
            {done}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
