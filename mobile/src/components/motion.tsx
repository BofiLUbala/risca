import { ReactNode, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, ViewStyle } from 'react-native';

/**
 * Apparition douce d'un bloc (fondu + montée de 8 px, 240 ms), jouée une seule fois à l'affichage.
 * Elle ne s'anime pas si le téléphone demande de réduire les animations.
 */
export function FadeIn({
  children, delay = 0, style,
}: { children: ReactNode; delay?: number; style?: ViewStyle }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          progress.setValue(1);
          return;
        }
        Animated.timing(progress, {
          toValue: 1,
          duration: 240,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    return () => {
      cancelled = true;
    };
  }, [delay, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
