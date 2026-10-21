import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import useSWR from 'swr';
import { api, fetcher, mediaUrl, uploadImage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Avatar, Button } from './ui';
import { CameraIcon, CloseIcon } from './icons';
import { composerStyles as s } from './composer-styles';
import { colors } from '../theme';

const TYPES = [
  { value: 'NEWS', label: 'Nouvelle' },
  { value: 'URGENT_NEED', label: 'Besoin urgent' },
  { value: 'VIDEO_PROGRESS', label: 'Progres' },
  { value: 'THANKS', label: 'Remerciement' },
  { value: 'SPONSORSHIP_CALL', label: 'Appel au parrainage' },
];

const PUBLISHERS = [
  'AMBASSADOR',
  'ORPHANAGE_DIRECTOR',
  'REGIONAL_MANAGER',
  'NATIONAL_MANAGER',
  'SUPER_ADMIN',
  'MODERATOR',
];

/** Composer inspire des fils sociaux, avec verification avant publication. */
export function Composer({ onPublished }: { onPublished: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('NEWS');
  const [content, setContent] = useState('');
  const [childId, setChildId] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canPublish = PUBLISHERS.includes(user?.role ?? '');

  const { data: groups } = useSWR<any[]>(
    open && user?.role === 'AMBASSADOR' ? '/users/my-children' : null,
    fetcher,
  );
  const children = (groups ?? []).flatMap((g) => g.children);

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

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Autorisation refusee pour acceder aux photos.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      const up = await uploadImage(res.assets[0].uri, res.assets[0].fileName ?? 'photo.jpg');
      setPhotos((p) => [...p, up.url]);
    } catch (e: any) {
      setError(e?.message ?? 'Téléversement impossible');
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/posts', { type, content, childId: childId || undefined, photos });
      setContent('');
      setPhotos([]);
      setChildId('');
      setViolations([]);
      setOpen(false);
      onPublished();
    } catch (e: any) {
      const v = e?.payload?.violations;
      if (v?.length) setViolations(v);
      setError(e?.payload?.message ?? e?.message ?? 'Publication impossible');
    }
    setBusy(false);
  }

  if (!canPublish || !user) return null;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={s.trigger} accessibilityRole="button">
        <Avatar uri={user.avatarUrl} firstName={user.firstName} lastName={user.lastName} size={34} />
        <Text style={s.triggerText}>Partager une nouvelle...</Text>
        <View style={s.triggerBtn}>
          <Text style={s.triggerBtnText}>Publier</Text>
        </View>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" hitSlop={10}>
              <CloseIcon color={colors.ink[600]} />
            </Pressable>
            <Text style={s.modalTitle}>Nouvelle publication</Text>
            <View style={{ width: 20 }} />
          </View>

          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
            <View style={s.chipRow}>
              {TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  onPress={() => setType(t.value)}
                  style={[s.chip, type === t.value && s.chipActive]}
                >
                  <Text style={[s.chipText, type === t.value && s.chipTextActive]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            {children.length > 0 ? (
              <View style={s.chipRow}>
                <Pressable onPress={() => setChildId('')} style={[s.chip, childId === '' && s.chipActive]}>
                  <Text style={[s.chipText, childId === '' && s.chipTextActive]}>Générale</Text>
                </Pressable>
                {children.map((c: any) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setChildId(c.id)}
                    style={[s.chip, childId === c.id && s.chipActive]}
                  >
                    <Text style={[s.chipText, childId === c.id && s.chipTextActive]}>{c.firstName}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <TextInput
              value={content}
              onChangeText={check}
              placeholder="Racontez la nouvelle. Le nom de famille, l’adresse exacte et les donnees medicales sont bloques automatiquement."
              placeholderTextColor={colors.ink[400]}
              multiline
              style={s.textarea}
            />

            {violations.length > 0 ? (
              <View style={s.warn} accessibilityRole="alert">
                <Text style={s.warnTitle}>Vérification automatique</Text>
                {violations.map((v, i) => (
                  <Text key={i} style={s.warnText}>
                    {v.message}
                    {v.match ? ` (${v.match})` : ''}
                  </Text>
                ))}
              </View>
            ) : null}

            {photos.length > 0 ? (
              <View style={s.photoRow}>
                {photos.map((p) => (
                  <View key={p}>
                    <Image source={{ uri: mediaUrl(p) ?? '' }} style={s.thumb} />
                    <Pressable
                      onPress={() => setPhotos((l) => l.filter((x) => x !== p))}
                      style={s.thumbRemove}
                      accessibilityRole="button"
                    >
                      <CloseIcon color={colors.white} size={12} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {error ? <Text style={s.error}>{error}</Text> : null}

            <View style={s.modalActions}>
              <Button
                title="Photo"
                variant="outline"
                onPress={pickPhoto}
                icon={<CameraIcon color={colors.ink[700]} />}
                style={{ flex: 1 }}
              />
              <Button
                title="Publier"
                onPress={publish}
                loading={busy}
                disabled={!content.trim() || violations.length > 0}
                style={{ flex: 1 }}
              />
            </View>

            {photos.length > 0 ? (
              <Text style={s.hint}>
                Le consentement photo de l’enfant doit etre signe, sinon la publication sera refusee.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
