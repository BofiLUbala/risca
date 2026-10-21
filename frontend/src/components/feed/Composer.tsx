'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AlertTriangle, ImagePlus, Loader2, Send, X } from 'lucide-react';
import { api, fetcher, mediaUrl, uploadFile } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/lib/auth-context';

const TYPES = [
  { value: 'NEWS', label: 'Nouvelle' },
  { value: 'URGENT_NEED', label: 'Besoin urgent' },
  { value: 'VIDEO_PROGRESS', label: 'Progres en video' },
  { value: 'THANKS', label: 'Remerciement' },
  { value: 'SPONSORSHIP_CALL', label: 'Appel au parrainage' },
];

/** Composer inspire des fils sociaux : texte, photos, verification avant publication. */
export function Composer({ onPublished }: { onPublished: () => void }) {
  const { user } = useAuth();
  const { data: myChildren } = useSWR<any[]>(
    user?.role === 'AMBASSADOR' ? '/users/my-children' : null,
    fetcher,
  );

  const [open, setOpen] = useState(false);
  const [type, setType] = useState('NEWS');
  const [content, setContent] = useState('');
  const [childId, setChildId] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const children = (myChildren ?? []).flatMap((g) => g.children);

  async function check(text: string) {
    setContent(text);
    if (text.length < 10) {
      setViolations([]);
      return;
    }
    try {
      const r = await api.post<any>('/posts/check', { content: text, childId: childId || undefined });
      setViolations(r.violations ?? []);
    } catch {
      /* verification silencieuse */
    }
  }

  async function addPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadFile(file);
      setPhotos((p) => [...p, up.url]);
    } catch (err: any) {
      setError(err?.message ?? 'Téléversement impossible');
    }
    setUploading(false);
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/posts', {
        type,
        content,
        childId: childId || undefined,
        photos,
      });
      setContent('');
      setPhotos([]);
      setChildId('');
      setViolations([]);
      setOpen(false);
      onPublished();
    } catch (err: any) {
      const v = err?.payload?.violations;
      if (v?.length) setViolations(v);
      setError(err?.payload?.message ?? err?.message ?? 'Publication impossible');
    }
    setBusy(false);
  }

  if (!user) return null;

  const canPublish = ['AMBASSADOR', 'ORPHANAGE_DIRECTOR', 'REGIONAL_MANAGER', 'NATIONAL_MANAGER', 'SUPER_ADMIN', 'MODERATOR'].includes(user.role);
  if (!canPublish) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="card flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:border-risac-200 sm:px-5"
      >
        <Avatar src={user.avatarUrl} firstName={user.firstName} lastName={user.lastName} size="sm" />
        <span className="flex-1 text-sm text-ink-400">Partager une nouvelle...</span>
        <span className="btn-soft h-9 px-3 text-xs">Publier</span>
      </button>
    );
  }

  return (
    <div className="card card-pad space-y-4">
      <div className="flex items-center gap-3">
        <Avatar src={user.avatarUrl} firstName={user.firstName} lastName={user.lastName} size="sm" />
        <p className="flex-1 text-sm font-medium text-ink-800">Nouvelle publication</p>
        <button onClick={() => setOpen(false)} className="btn-ghost h-8 w-8 p-0" aria-label="Fermer">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={type} onChange={(e) => setType(e.target.value)} className="input sm:w-56" aria-label="Type">
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {children.length > 0 && (
          <select
            value={childId}
            onChange={(e) => setChildId(e.target.value)}
            className="input flex-1"
            aria-label="Enfant concerne"
          >
            <option value="">Publication generale</option>
            {children.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.firstName} ({c.publicId})
              </option>
            ))}
          </select>
        )}
      </div>

      <textarea
        rows={4}
        value={content}
        onChange={(e) => check(e.target.value)}
        className="input resize-y"
        placeholder="Racontez la nouvelle. Le nom de famille, l’adresse exacte et les donnees medicales sont bloques automatiquement."
        aria-label="Contenu"
      />

      {violations.length > 0 && (
        <div role="alert" className="rounded-xl bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Vérification automatique
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-700">
            {violations.map((v, i) => (
              <li key={i}>
                {v.message}
                {v.match ? ` (${v.match})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(p) ?? ''} alt="" className="h-20 w-20 rounded-xl object-cover" />
              <button
                onClick={() => setPhotos((list) => list.filter((x) => x !== p))}
                className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink-900 text-white"
                aria-label="Retirer"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <label className="btn-outline cursor-pointer">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          Photo
          <input type="file" accept="image/*" onChange={addPhoto} className="sr-only" />
        </label>

        <button
          onClick={publish}
          disabled={busy || !content.trim() || violations.length > 0}
          className="btn-primary"
        >
          <Send className="h-4 w-4" />
          Publier
        </button>
      </div>

      {photos.length > 0 && (
        <p className="text-xs text-ink-400">
          Le consentement photo de l’enfant doit etre signe, sinon la publication sera refusee.
        </p>
      )}
    </div>
  );
}
