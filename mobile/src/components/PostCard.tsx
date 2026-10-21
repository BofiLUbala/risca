import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, mediaUrl } from '../lib/api';
import { Avatar, Badge, Progress } from './ui';
import { CommentIcon, HeartIcon } from './icons';
import { money, relative } from '../lib/format';
import { ROLE_LABEL } from '../lib/auth';
import { colors, radius, spacing, typography } from '../theme';

const TYPE_LABEL: Record<string, string> = {
  NEWS: 'Nouvelle',
  URGENT_NEED: 'Besoin urgent',
  VIDEO_PROGRESS: 'Progres',
  THANKS: 'Remerciement',
  SPONSORSHIP_CALL: 'Appel au parrainage',
  ORPHANAGE_NEWS: 'Structure',
};

export function PostCard({ post, onSupport }: { post: any; onSupport?: (childId: string) => void }) {
  const [reacted, setReacted] = useState(false);
  const [count, setCount] = useState(post.reactionCount ?? 0);
  const [comments, setComments] = useState<any[]>(post.comments ?? []);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const photo = mediaUrl(post.photos?.[0]);

  async function react() {
    try {
      const r = await api.post<{ reacted: boolean }>(`/posts/${post.id}/react`, {});
      setReacted(r.reacted);
      setCount((c) => c + (r.reacted ? 1 : -1));
    } catch {
      /* ignore */
    }
  }

  async function send() {
    if (!draft.trim()) return;
    setError(null);
    try {
      const c = await api.post<any>(`/posts/${post.id}/comment`, { content: draft });
      setComments((list) => [...list, c]);
      setDraft('');
    } catch (e: any) {
      const v = e?.payload?.violations?.[0];
      setError(v ? v.message : (e?.message ?? 'Commentaire refuse'));
    }
  }

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Avatar
          uri={post.child?.publicPhotoUrl ?? post.author?.avatarUrl}
          firstName={post.child?.firstName ?? post.author?.firstName}
          lastName={post.author?.lastName}
          size={38}
        />
        <View style={s.headerText}>
          <Text style={s.name} numberOfLines={1}>
            {post.child?.firstName ??
              post.orphanage?.name ??
              `${post.author?.firstName} ${post.author?.lastName}`}
          </Text>
          <Text style={s.meta} numberOfLines={1}>
            {post.author ? ROLE_LABEL[post.author.role as keyof typeof ROLE_LABEL] : ''} -{' '}
            {relative(post.createdAt)}
          </Text>
        </View>
        <Badge text={TYPE_LABEL[post.type] ?? post.type} status="PENDING" />
      </View>

      {photo ? <Image source={{ uri: photo }} style={s.photo} resizeMode="cover" /> : null}

      <View style={s.body}>
        <Text style={s.content}>{post.content}</Text>

        {post.project ? (
          <View style={s.project}>
            <Text style={s.projectTitle}>{post.project.title}</Text>
            <View style={{ marginTop: 8 }}>
              <Progress value={post.project.collectedAmount} total={post.project.targetAmount} />
            </View>
            <Text style={s.projectMeta}>
              {money(post.project.collectedAmount, post.project.currency)} sur{' '}
              {money(post.project.targetAmount, post.project.currency)}
            </Text>
          </View>
        ) : null}

        <View style={s.actions}>
          <Pressable onPress={react} style={s.action} accessibilityRole="button">
            <HeartIcon filled={reacted} color={reacted ? colors.coral : colors.ink[500]} />
            <Text style={s.actionText}>{count}</Text>
          </Pressable>

          <Pressable
            onPress={() => setShowComments((v) => !v)}
            style={s.action}
            accessibilityRole="button"
          >
            <CommentIcon color={colors.ink[500]} />
            <Text style={s.actionText}>{comments.length}</Text>
          </Pressable>

          {post.child && onSupport ? (
            <Pressable
              onPress={() => onSupport(post.child.id)}
              style={s.support}
              accessibilityRole="button"
            >
              <Text style={s.supportText}>Soutenir</Text>
            </Pressable>
          ) : null}
        </View>

        {showComments ? (
          <View style={s.comments}>
            {comments.map((c) => (
              <View key={c.id} style={s.comment}>
                <Avatar firstName={c.author?.firstName} lastName={c.author?.lastName} size={28} />
                <View style={s.commentBubble}>
                  <Text style={s.commentAuthor}>
                    {c.author?.firstName} {c.author?.lastName}
                  </Text>
                  <Text style={s.commentText}>{c.content}</Text>
                </View>
              </View>
            ))}

            {error ? <Text style={s.error}>{error}</Text> : null}

            <View style={s.commentForm}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Écrire un commentaire..."
                placeholderTextColor={colors.ink[400]}
                style={s.commentInput}
                onSubmitEditing={send}
                returnKeyType="send"
              />
              <Pressable onPress={send} style={s.sendBtn} accessibilityRole="button">
                <Text style={s.sendText}>Envoyer</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.ink[200],
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  headerText: { flex: 1, minWidth: 0 },
  name: { ...typography.bodyMedium, color: colors.ink[900] },
  meta: { ...typography.caption, color: colors.ink[400], marginTop: 2 },
  photo: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.ink[100] },
  body: { padding: spacing.md },
  content: { ...typography.body, color: colors.ink[800], lineHeight: 21 },
  project: {
    marginTop: spacing.md,
    backgroundColor: colors.risac[50],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  projectTitle: { ...typography.bodyMedium, color: colors.risac[800] },
  projectMeta: { ...typography.caption, color: colors.risac[700], marginTop: 8 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.ink[100],
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { ...typography.small, color: colors.ink[500] },
  support: {
    marginLeft: 'auto',
    backgroundColor: colors.risac[50],
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.lg,
  },
  supportText: { ...typography.small, fontWeight: '500', color: colors.risac[700] },
  comments: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.ink[100],
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  comment: { flexDirection: 'row', gap: spacing.sm },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.ink[50],
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  commentAuthor: { ...typography.caption, color: colors.ink[800] },
  commentText: { ...typography.small, color: colors.ink[700], marginTop: 2 },
  commentForm: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink[900],
  },
  sendBtn: {
    backgroundColor: colors.risac[600],
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
  },
  sendText: { ...typography.small, fontWeight: '500', color: colors.white },
  error: {
    ...typography.caption,
    color: colors.coralText,
    backgroundColor: colors.coralSoft,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
});
