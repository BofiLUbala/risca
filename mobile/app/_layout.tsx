import { useEffect, useRef, useState } from 'react';
import { Slot, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { lastRouteFor, saveLastRoute } from '../src/lib/remember';
import { colors } from '../src/theme';

/** Onglets accessibles directement ; tout autre écran (fiche enfant…) s'ouvre par-dessus l'accueil. */
const TAB_PATHS = ['/', '/fil', '/enfants', '/validations', '/messages', '/profil'];

function Gate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  // La session est restaurée une seule fois par ouverture de l'application, puis l'écran courant est mémorisé.
  const restored = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!user) {
      restored.current = false;
      setReady(false);
      if (!inAuth) router.replace('/(auth)/connexion');
      return;
    }
    if (!restored.current) {
      restored.current = true;
      void lastRouteFor(user.id).then((last) => {
        if (last && last !== '/') {
          if (TAB_PATHS.includes(last)) router.replace(last as never);
          else {
            router.replace('/(tabs)');
            router.push(last as never);
          }
        } else if (inAuth) {
          router.replace('/(tabs)');
        }
        setReady(true);
      });
      return;
    }
    if (inAuth) router.replace('/(tabs)');
  }, [user, loading, segments]);

  // Dernier écran visité : on y revient à la réouverture de l'application.
  useEffect(() => {
    if (user && ready && segments[0] !== '(auth)') void saveLastRoute(user.id, pathname);
  }, [user?.id, ready, pathname]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.risac[500]} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Gate />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink[50] },
});
