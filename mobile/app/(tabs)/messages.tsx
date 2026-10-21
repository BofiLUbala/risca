import { useEffect, useRef, useState } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useSWR from 'swr';
import { api, fetcher } from '../../src/lib/api';
import { getSocket } from '../../src/lib/socket';
import { useAuth } from '../../src/lib/auth';
import { Avatar, Empty, Loading } from '../../src/components/ui';
import { BackIcon } from '../../src/components/icons';
import { relative } from '../../src/lib/format';
import { colors, radius, spacing, typography } from '../../src/theme';

const CHANNEL_LABEL: Record<string, string> = {
  GENERAL: 'Général',
  AMBASSADOR_REGIONAL: 'Ambassadeurs de la région',
  AMBASSADOR_NATIONAL: 'Ambassadeurs du pays',
  AMBASSADOR_ORPHANAGE: 'Orphelinat',
  DONOR_AMBASSADOR: 'Parrainage',
  REGIONAL: 'Région',
  PARTNERS: 'Partenaires',
};

export default function MessagesScreen() {
  const { user } = useAuth();
  const { data: channels, isLoading, mutate } = useSWR<any[]>('/channels', fetcher);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const active = channels?.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    if (!activeId) return;
    setError(null);
    api
      .get<any[]>(`/channels/${activeId}/messages?take=60`)
      .then(setMessages)
      .catch(() => setMessages([]));
    api.post(`/channels/${activeId}/read`, {}).then(() => mutate());
  }, [activeId]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    getSocket().then((socket) => {
      const onNew = (m: any) => {
        if (m.channelId === activeId) {
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
        mutate();
      };
      socket.on('message:new', onNew);
      cleanup = () => socket.off('message:new', onNew);
    });
    return () => cleanup?.();
  }, [activeId]);

  async function send() {
    if (!draft.trim() || !activeId) return;
    setError(null);
    try {
      await api.post(`/channels/${activeId}/messages`, { content: draft });
      setDraft('');
    } catch (e: any) {
      const v = e?.payload?.violations?.[0];
      setError(v ? v.message : (e?.payload?.message ?? e?.message ?? 'Envoi impossible'));
    }
  }

  if (!activeId) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Text style={s.title}>Messagerie</Text>
        <FlatList
          data={channels ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={isLoading ? <Loading /> : <Empty title="Aucun canal" />}
          renderItem={({ item }) => (
            <Pressable onPress={() => setActiveId(item.id)} style={s.channel} accessibilityRole="button">
              <View style={s.channelIcon}>
                <Text style={s.channelIconText}>{item.name[0]}</Text>
              </View>
              <View style={s.channelBody}>
                <Text style={s.channelName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={s.channelLast} numberOfLines={1}>
                  {item.lastMessage
                    ? `${item.lastMessage.author.firstName}: ${item.lastMessage.content}`
                    : CHANNEL_LABEL[item.type]}
                </Text>
              </View>
              {item.unread > 0 ? (
                <View style={s.unread}>
                  <Text style={s.unreadText}>{item.unread}</Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.chatHeader}>
        <Pressable onPress={() => setActiveId(null)} hitSlop={10} accessibilityRole="button">
          <BackIcon color={colors.ink[700]} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.chatTitle} numberOfLines={1}>
            {active?.name}
          </Text>
          <Text style={s.chatMeta} numberOfLines={1}>
            {CHANNEL_LABEL[active?.type]} {active?.moderated ? '- modere' : ''}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={s.chatList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const mine = item.authorId === user?.id;
            return (
              <View style={[s.msgRow, mine && s.msgRowMine]}>
                <Avatar firstName={item.author?.firstName} lastName={item.author?.lastName} size={28} />
                <View style={[s.bubbleWrap, mine && { alignItems: 'flex-end' }]}>
                  <Text style={s.msgMeta}>
                    {item.author?.firstName} - {relative(item.createdAt)}
                  </Text>
                  <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther]}>
                    <Text style={[s.msgText, mine && { color: colors.white }]}>{item.content}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <View style={s.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={active?.canWrite === false ? 'Canal en lecture seule' : 'Votre message...'}
            placeholderTextColor={colors.ink[400]}
            editable={active?.canWrite !== false}
            style={s.chatInput}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <Pressable onPress={send} style={s.sendBtn} accessibilityRole="button">
            <Text style={s.sendText}>Envoyer</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink[50] },
  title: { ...typography.title, color: colors.ink[950], paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing['4xl'] },
  channel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.ink[200],
    padding: spacing.md,
  },
  channelIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.risac[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelIconText: { ...typography.heading, color: colors.risac[700] },
  channelBody: { flex: 1, minWidth: 0 },
  channelName: { ...typography.bodyMedium, color: colors.ink[900] },
  channelLast: { ...typography.caption, color: colors.ink[400], marginTop: 2 },
  unread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { fontSize: 11, fontWeight: '600', color: colors.white },

  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[100],
  },
  chatTitle: { ...typography.bodyMedium, color: colors.ink[900] },
  chatMeta: { ...typography.caption, color: colors.ink[400], marginTop: 2 },
  chatList: { padding: spacing.lg, gap: spacing.md },
  msgRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  msgRowMine: { flexDirection: 'row-reverse' },
  bubbleWrap: { maxWidth: '78%' },
  msgMeta: { ...typography.caption, color: colors.ink[400], marginBottom: 3 },
  bubble: { borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: 9 },
  bubbleMine: { backgroundColor: colors.risac[600] },
  bubbleOther: { backgroundColor: colors.ink[100] },
  msgText: { ...typography.small, color: colors.ink[800], lineHeight: 19 },
  error: {
    ...typography.caption,
    color: colors.coralText,
    backgroundColor: colors.coralSoft,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  composer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.ink[100],
  },
  chatInput: {
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
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  sendText: { ...typography.small, fontWeight: '500', color: colors.white },
});
