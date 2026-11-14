import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/lib/auth';
import { View, type ColorValue } from 'react-native';
import { TabIcon } from '../../src/components/TabIcon';
import { colors } from '../../src/theme';

/** Icône d'onglet avec un repère jaune au-dessus de l'onglet actif. */
function ActiveIcon({ name, color, focused }: { name: string; color: ColorValue; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 22,
          height: 3,
          borderRadius: 2,
          marginBottom: 3,
          backgroundColor: focused ? colors.sun[400] : 'transparent',
        }}
      />
      <TabIcon name={name} color={color} />
    </View>
  );
}

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
    <Tabs id="tabs"
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
          tabBarIcon: ({ color, focused }) => <ActiveIcon name={"home"} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="fil"
        options={{
          title: 'Fil',
          tabBarIcon: ({ color, focused }) => <ActiveIcon name={"feed"} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="enfants"
        options={{
          title: isDonor ? 'Soutenir' : 'Enfants',
          tabBarIcon: ({ color, focused }) => <ActiveIcon name={isDonor ? 'heart' : 'children'} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="validations"
        options={{
          title: 'Validations',
          href: isFieldRole ? undefined : null,
          tabBarIcon: ({ color, focused }) => <ActiveIcon name={"validate"} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, focused }) => <ActiveIcon name={"messages"} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => <ActiveIcon name={"profile"} color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
