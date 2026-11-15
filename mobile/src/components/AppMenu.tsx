import { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import useSWR from 'swr';
import { fetcher } from '../lib/api';
import { ROLE_LABEL, useAuth, type Role } from '../lib/auth';
import { confirmAction } from '../lib/dialog';
import { colors, spacing } from '../theme';
import { Avatar } from './ui';
import { Logo } from './Logo';
import { TabIcon } from './TabIcon';

type Item = { href: string; label: string; icon: string; web?: boolean };
type Group = { title: string; items: Item[]; note?: string };

/** Site web RISAC : les fonctionnalités qui n'existent pas encore dans l'application s'y ouvrent. */
const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || 'https://risac-web.bofigauthier3.workers.dev').replace(/\/+$/, '');

/** Pages du site par rôle (mêmes règles que frontend/src/lib/nav.ts), hors celles déjà présentes dans l'application. */
const WEB_PAGES: { href: string; label: string; roles: Role[] }[] = [
  { href: '/projets', label: 'Projets', roles: ['SUPER_ADMIN', 'ADMIN_FINANCE', 'ETHICS_AUDITOR', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'AMBASSADOR', 'ORPHANAGE_DIRECTOR', 'DONOR', 'PARTNER'] },
  { href: '/orphelinats', label: 'Orphelinats', roles: ['SUPER_ADMIN', 'ADMIN_FINANCE', 'ETHICS_AUDITOR'] },
  { href: '/finance', label: 'Flux financiers', roles: ['SUPER_ADMIN', 'ADMIN_FINANCE', 'ETHICS_AUDITOR'] },
  { href: '/decaissements', label: 'Décaissements', roles: ['SUPER_ADMIN', 'ADMIN_FINANCE', 'ETHICS_AUDITOR', 'AMBASSADOR', 'ORPHANAGE_DIRECTOR', 'REGIONAL_MANAGER', 'NATIONAL_MANAGER'] },
  { href: '/mes-dons', label: 'Mes dons', roles: ['DONOR', 'PARTNER'] },
  { href: '/mes-parrainages', label: 'Mes parrainages', roles: ['DONOR', 'PARTNER'] },
  { href: '/moderation', label: 'Modération', roles: ['SUPER_ADMIN', 'MODERATOR', 'ETHICS_AUDITOR'] },
  { href: '/support', label: 'Support', roles: ['SUPER_ADMIN', 'MODERATOR', 'ADMIN_FINANCE', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'AMBASSADOR', 'ORPHANAGE_DIRECTOR', 'ORPHANAGE_STAFF', 'FIELD_AGENT', 'DONOR', 'PARTNER'] },
  { href: '/journal-audit', label: 'Journal d’audit', roles: ['SUPER_ADMIN', 'ETHICS_AUDITOR'] },
  { href: '/securite-acces', label: 'Sécurité des accès', roles: ['SUPER_ADMIN'] },
  { href: '/reprises', label: 'Reprises après promotion', roles: ['SUPER_ADMIN'] },
  { href: '/lettres', label: 'Lettres de promotion', roles: ['SUPER_ADMIN'] },
  { href: '/utilisateurs', label: 'Utilisateurs', roles: ['SUPER_ADMIN', 'MODERATOR', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'ORPHANAGE_DIRECTOR'] },
  { href: '/modeles-dossier', label: 'Modèles de dossier', roles: ['SUPER_ADMIN', 'NATIONAL_MANAGER'] },
  { href: '/parametres', label: 'Paramètres', roles: ['SUPER_ADMIN'] },
];

const FIELD_ROLES: Role[] = ['AMBASSADOR', 'ORPHANAGE_DIRECTOR', 'ORPHANAGE_STAFF', 'FIELD_AGENT', 'REGIONAL_MANAGER', 'NATIONAL_MANAGER', 'SUPER_ADMIN'];
const ORPHANAGE_ROLES: Role[] = ['NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'FIELD_AGENT', 'AMBASSADOR', 'ORPHANAGE_DIRECTOR'];

/** Toutes les fonctionnalités accessibles au rôle, y compris celles qui n'ont pas d'onglet. */
export function menuGroups(role: Role | undefined, hasOldSpace: boolean): Group[] {
  const r = role ?? ('DONOR' as Role);
  const isDonor = r === 'DONOR' || r === 'PARTNER';
  const main: Item[] = [
    { href: '/', label: 'Accueil', icon: 'home' },
    { href: '/fil', label: 'Fil d’actualité', icon: 'feed' },
    { href: '/enfants', label: isDonor ? 'Soutenir un enfant' : 'Enfants', icon: isDonor ? 'heart' : 'children' },
    ...(FIELD_ROLES.includes(r) ? [{ href: '/validations', label: 'Validations', icon: 'validate' }] : []),
    { href: '/messages', label: 'Messages', icon: 'messages' },
  ];
  const space: Item[] = [
    ...(ORPHANAGE_ROLES.includes(r) ? [{ href: '/orphelinats', label: 'Orphelinats', icon: 'orphanage' }] : []),
    ...(r === 'REGIONAL_MANAGER' ? [{ href: '/lettres', label: 'Lettres de promotion', icon: 'letter' }] : []),
    ...(r === 'REGIONAL_MANAGER' || r === 'NATIONAL_MANAGER' ? [{ href: '/reprises', label: 'Reprises après promotion', icon: 'transfer' }] : []),
    ...(hasOldSpace ? [{ href: '/ancien-espace', label: 'Mon ancien espace', icon: 'history' }] : []),
  ];
  const web: Item[] = WEB_PAGES.filter((p) => p.roles.includes(r)).map((p) => ({ href: p.href, label: p.label, icon: 'globe', web: true }));
  return [
    { title: 'Principal', items: main },
    ...(space.length ? [{ title: 'Mon espace', items: space }] : []),
    ...(web.length ? [{ title: 'Sur le site web', items: web, note: 'S’ouvre dans le navigateur' }] : []),
    { title: 'Compte', items: [{ href: '/profil', label: 'Profil et notifications', icon: 'profile' }] },
  ];
}

const TAB_PATHS = ['/', '/fil', '/enfants', '/validations', '/messages', '/profil'];

/** Barre du haut des onglets : bouton menu (trois traits) à gauche, logo au centre. */
export function AppTopBar() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return (
    <View style={[s.bar, { paddingTop: insets.top + 6 }]}>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [s.menuBtn, pressed && { backgroundColor: colors.ink[100] }]}
        accessibilityRole="button"
        accessibilityLabel="Ouvrir le menu"
        hitSlop={8}
      >
        <TabIcon name="menu" color={colors.risac[800]} size={26} />
      </Pressable>
      <Logo size={28} />
      <View style={{ width: 44 }} />
      <MenuDrawer open={open} onClose={() => setOpen(false)} />
    </View>
  );
}

/** Panneau latéral : toutes les fonctionnalités, la page ouverte en surbrillance, la déconnexion en bas. */
export function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(320, Math.round(width * 0.84));
  const x = useRef(new Animated.Value(-panelWidth)).current;
  const [visible, setVisible] = useState(open);
  const { data: transition } = useSWR<unknown | null>(user ? '/transitions/mine' : null, fetcher);

  useEffect(() => {
    if (open) {
      setVisible(true);
      x.setValue(-panelWidth);
      Animated.timing(x, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    } else if (visible) {
      Animated.timing(x, { toValue: -panelWidth, duration: 160, useNativeDriver: true }).start(() => setVisible(false));
    }
  }, [open]);

  if (!user) return null;
  const groups = menuGroups(user.role, !!transition);

  function go(it: Item) {
    const href = it.href;
    onClose();
    if (it.web) {
      void Linking.openURL(WEB_URL + href);
      return;
    }
    if (href === pathname) return;
    // Un onglet se remplace ; un autre écran s'ouvre par-dessus, avec son bouton retour.
    if (TAB_PATHS.includes(href)) router.navigate(href as never);
    else router.push(href as never);
  }

  function signOut() {
    onClose();
    confirmAction({
      title: 'Se déconnecter',
      message: 'Voulez-vous vous déconnecter de RISAC sur cet appareil ?',
      confirmLabel: 'Se déconnecter',
      destructive: true,
      onConfirm: () => void logout(),
    });
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Fermer le menu" />
      <Animated.View
        style={[
          s.panel,
          { width: panelWidth, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md, transform: [{ translateX: x }] },
        ]}
        accessibilityViewIsModal
      >
        <View style={s.panelHead}>
          <Avatar uri={user.avatarUrl} firstName={user.firstName} lastName={user.lastName} size={48} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name} numberOfLines={1}>
              {user.firstName} {user.lastName}
            </Text>
            <Text style={s.role} numberOfLines={1}>
              {ROLE_LABEL[user.role]}
            </Text>
          </View>
          <Pressable onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="Fermer le menu" hitSlop={8}>
            <TabIcon name="close" color={colors.risac[100]} size={22} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingVertical: spacing.sm }}>
          {groups.map((g) => (
            <View key={g.title} style={{ marginTop: spacing.md }}>
              <Text style={s.groupTitle}>{g.title}</Text>
              {g.note ? <Text style={s.groupNote}>{g.note}</Text> : null}
              {g.items.map((it) => {
                const active = !it.web && it.href === pathname;
                return (
                  <Pressable
                    key={(it.web ? 'web:' : '') + it.href}
                    onPress={() => go(it)}
                    accessibilityHint={it.web ? 'Ouvre la page sur le site web RISAC' : undefined}
                    style={({ pressed }) => [s.item, active && s.itemActive, pressed && !active && s.itemPressed]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <TabIcon name={it.icon} color={active ? colors.risac[900] : colors.risac[100]} size={22} />
                    <Text style={[s.itemText, active && s.itemTextActive]}>{it.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>

        <Pressable onPress={signOut} style={({ pressed }) => [s.item, s.logout, pressed && s.itemPressed]} accessibilityRole="button">
          <TabIcon name="logout" color={colors.risac[100]} size={22} />
          <Text style={s.itemText}>Se déconnecter</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: 6,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink[200],
  },
  menuBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(11,39,64,0.45)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.risac[900],
    paddingHorizontal: spacing.md,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  name: { color: colors.white, fontSize: 16, fontWeight: '700' },
  role: { color: colors.sun[300], fontSize: 13, marginTop: 2, fontWeight: '600' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  groupTitle: {
    color: colors.risac[300],
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
    paddingHorizontal: spacing.sm,
  },
  groupNote: { color: colors.risac[300], fontSize: 12, marginTop: -2, marginBottom: 4, paddingHorizontal: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: 12 },
  itemPressed: { backgroundColor: 'rgba(255,255,255,0.08)' },
  itemActive: { backgroundColor: colors.sun[400] },
  itemText: { color: colors.white, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  itemTextActive: { color: colors.risac[900] },
  logout: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)', borderRadius: 0, marginTop: spacing.sm },
});
