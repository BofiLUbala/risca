'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, BellOff, Bookmark, EyeOff, Heart, Link2, MessageCircle, MoreHorizontal, ShieldAlert } from 'lucide-react';
import { api, mediaUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui/Avatar';
import { SafeImage } from '@/components/ui/SafeImage';
import { relative, money, percent } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/roles';

const TYPE_LABEL: Record<string, string> = {
  NEWS: 'Nouvelle',
  URGENT_NEED: 'Besoin urgent',
  VIDEO_PROGRESS: 'Progres en video',
  THANKS: 'Remerciement',
  SPONSORSHIP_CALL: 'Appel au parrainage',
  ORPHANAGE_NEWS: 'Nouvelle de la structure',
};

export function PostCard({ post, onChange }: { post: any; onChange?: () => void }) {
  const { user } = useAuth();
  const canModerate = ['MODERATOR', 'SUPER_ADMIN'].includes(user?.role ?? '');
  const [reacted, setReacted] = useState(false);
  const [favorited, setFavorited] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [shared, setShared] = useState(false);
  const [count, setCount] = useState(post.reactionCount ?? 0);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState(post.comments ?? []);
  const [showComment, setShowComment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function react() {
    try {
      const r = await api.post<{ reacted: boolean }>(`/posts/${post.id}/react`, {});
      setReacted(r.reacted);
      setCount((c: number) => c + (r.reacted ? 1 : -1));
    } catch {
      /* ignore */
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const c = await api.post<any>(`/posts/${post.id}/comment`, { content: comment });
      setComments((list: any[]) => [...list, c]);
      setComment('');
    } catch (err: any) {
      const v = err?.payload?.violations?.[0];
      setError(v ? v.message : (err?.message ?? 'Commentaire refuse'));
    }
  }

  /** Ajout ou retrait des favoris (enfant ou projet de la publication). */
  async function toggleFavorite() {
    try {
      const r = await api.post<{ favorited: boolean }>('/posts/favorite', {
        childId: post.child?.id,
        projectId: post.child ? undefined : post.project?.id,
      });
      setFavorited(r.favorited);
    } catch (e: any) {
      setError(e?.message ?? 'Le favori n’a pas pu être enregistré.');
    }
  }

  /** Abonnement aux nouvelles de l’enfant. */
  async function toggleSubscribe() {
    if (!post.child?.id) return;
    try {
      const r = await api.post<{ subscribed: boolean }>(`/posts/subscribe/${post.child.id}`, {});
      setSubscribed(r.subscribed);
    } catch (e: any) {
      setError(e?.message ?? 'L’abonnement a échoué.');
    }
  }

  /** Copie du lien public de l’enfant ou du projet concerne. */
  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } catch {
      setError('Le lien n’a pas pu être copié.');
    }
  }

  /** Masquage d’un commentaire par le modérateur. */
  async function hideComment(id: string) {
    if (!window.confirm('Masquer ce commentaire ?')) return;
    try {
      await api.post(`/posts/comments/${id}/hide`, {});
      setComments((list: any[]) => list.filter((c) => c.id !== id));
    } catch (e: any) {
      setError(e?.message ?? 'Le commentaire n’a pas pu être masqué.');
    }
  }

  async function report() {
    const reason = window.prompt('Motif du signalement ?');
    if (!reason) return;
    await api.post('/moderation/reports', { targetType: 'POST', targetId: post.id, reason });
    onChange?.();
  }

  const photo = mediaUrl(post.photos?.[0]);

  // Lien public partageable : l'enfant, sinon le projet. Sans l'un des deux, pas de bouton.
  const sharePath = post.child?.id
    ? `/enfants-a-soutenir/${post.child.id}`
    : post.project?.id
      ? `/projets-ouverts/${post.project.id}`
      : null;
  const shareUrl = sharePath && typeof window !== 'undefined' ? window.location.origin + sharePath : null;
  const canFavorite = !!(post.child?.id || post.project?.id);

  return (
    <article className="card overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <Avatar
          src={post.child?.publicPhotoUrl ?? post.author?.avatarUrl}
          firstName={post.child?.firstName ?? post.author?.firstName}
          lastName={post.author?.lastName}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900">
            {post.child ? (
              <Link href={`/enfants-a-soutenir/${post.child.id}`} className="hover:text-risac-700">
                {post.child.firstName}
              </Link>
            ) : (
              (post.orphanage?.name ?? `${post.author?.firstName} ${post.author?.lastName}`)
            )}
          </p>
          <p className="truncate text-xs text-ink-400">
            {post.author ? ROLE_LABEL[post.author.role as keyof typeof ROLE_LABEL] : ''}
            {' - '}
            {relative(post.createdAt)}
          </p>
        </div>
        <span className="chip bg-risac-50 text-risac-700">{TYPE_LABEL[post.type] ?? post.type}</span>
        <button onClick={report} className="btn-ghost h-8 w-8 p-0" aria-label="Signaler">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </header>

      {photo && <SafeImage src={photo} className="aspect-[4/3] w-full object-cover" />}

      <div className="px-4 py-3 sm:px-5">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-800">{post.content}</p>

        {post.project && (
          <Link
            href={`/projets-ouverts/${post.project.id}`}
            className="mt-4 block rounded-xl border border-risac-200 bg-risac-50/60 p-4 transition-colors hover:bg-risac-50"
          >
            <p className="text-sm font-semibold text-risac-800">{post.project.title}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-gradient-to-r from-risac-400 to-risac-600"
                style={{ width: `${percent(post.project.collectedAmount, post.project.targetAmount)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-risac-700">
              {money(post.project.collectedAmount, post.project.currency)} sur{' '}
              {money(post.project.targetAmount, post.project.currency)}
            </p>
          </Link>
        )}

        <div className="mt-4 flex items-center gap-1 border-t border-ink-100 pt-3">
          <button
            onClick={react}
            className={`btn-ghost h-9 gap-1.5 px-2.5 ${reacted ? 'text-accent-coral' : ''}`}
            aria-pressed={reacted}
          >
            <Heart className={`h-4 w-4 ${reacted ? 'fill-current' : ''}`} />
            <span className="text-xs">{count}</span>
          </button>
          <button
            onClick={() => setShowComment((s) => !s)}
            className="btn-ghost h-9 gap-1.5 px-2.5"
            aria-expanded={showComment}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs">{comments.length}</span>
          </button>
          {canFavorite && (
            <button
              onClick={toggleFavorite}
              className={`btn-ghost h-9 gap-1.5 px-2.5 ${favorited ? 'text-risac-700' : ''}`}
              aria-pressed={favorited ?? false}
              aria-label={favorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Bookmark className={`h-4 w-4 ${favorited ? 'fill-current' : ''}`} />
            </button>
          )}
          {post.child?.id && (
            <button
              onClick={toggleSubscribe}
              className={`btn-ghost h-9 gap-1.5 px-2.5 ${subscribed ? 'text-risac-700' : ''}`}
              aria-pressed={subscribed ?? false}
              aria-label={subscribed ? 'Se désabonner des nouvelles' : 'Suivre les nouvelles'}
            >
              {subscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            </button>
          )}
          {shareUrl && (
            <button
              onClick={copyLink}
              className="btn-ghost h-9 gap-1.5 px-2.5"
              aria-label="Copier le lien public"
            >
              <Link2 className="h-4 w-4" />
              {shared && <span className="text-xs">Copie</span>}
            </button>
          )}
          {post.child && (
            <Link href={`/enfants-a-soutenir/${post.child.id}`} className="btn-soft ml-auto h-9">
              Soutenir
            </Link>
          )}
        </div>

        {showComment && (
          <div className="mt-3 space-y-3 border-t border-ink-100 pt-3">
            {comments.map((c: any) => (
              <div key={c.id} className="flex gap-2.5">
                <Avatar
                  src={c.author?.avatarUrl}
                  firstName={c.author?.firstName}
                  lastName={c.author?.lastName}
                  size="xs"
                />
                <div className="min-w-0 flex-1 rounded-xl bg-ink-50 px-3 py-2">
                  <p className="text-xs font-medium text-ink-800">
                    {c.author?.firstName} {c.author?.lastName}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-700">{c.content}</p>
                </div>
                {canModerate && (
                  <button
                    onClick={() => hideComment(c.id)}
                    className="btn-ghost h-8 w-8 shrink-0 p-0"
                    aria-label={`Masquer le commentaire de ${c.author?.firstName ?? 'cet utilisateur'}`}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}

            <form onSubmit={send} className="flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Écrire un commentaire..."
                className="input flex-1"
                aria-label="Commentaire"
              />
              <button type="submit" disabled={!comment.trim()} className="btn-primary px-4">
                Envoyer
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}
