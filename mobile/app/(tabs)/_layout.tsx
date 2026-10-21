import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/lib/auth';
import { TabIcon } from '../../src/components/TabIcon';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  const { user } = useAuth();
  // Marge réelle de l'appareil (barre de gestes, encoche) : la barre d'onglets ne passe jamais dessous.
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  const isDonor = user?.role === 'DONOR' || user?.role === 'PARTNER';
  const isFieldRole = ['AMBASSADOR', 'ORPHANAGE_DIRECTOR', 'ORPHANAGE_STAFF', 'FIELD_AGENT', 'REGIONAL_MANAGER', 'NATIONAL_MANAGER', 'SUPER_ADMIN'].includes(
    user?.role ?? '',
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.risac[700],
        tabBarInactiveTintColor: colors.ink[500],
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.ink[200],
          // 64 et non 58 : l'icone (24) + les marges (4) + le libelle (13) ne tenaient pas dans
          // les 39 px restants et le libelle etait rogne a la moitie.
          height: 64 + bottomPad,
          paddingTop: 8,
          paddingBottom: bottomPad,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarIconStyle: { marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="fil"
        options={{
          title: 'Fil',
          tabBarIcon: ({ color }) => <TabIcon name="feed" color={color} />,
        }}
      />
      <Tabs.Screen
        name="enfants"
        options={{
          title: isDonor ? 'Soutenir' : 'Enfants',
          tabBarIcon: ({ color }) => <TabIcon name={isDonor ? 'heart' : 'children'} color={color} />,
        }}
      />
      <Tabs.Screen
        name="validations"
        options={{
          title: 'Validations',
          href: isFieldRole ? undefined : null,
          tabBarIcon: ({ color }) => <TabIcon name="validate" color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <TabIcon name="messages" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} />,
        }}
      />
    </Tabs>
  );
}
