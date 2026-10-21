import { Image, StyleSheet, View } from 'react-native';

const FULL_LOGO = require('../../assets/risac-logo.png');
const EMBLEM = require('../../assets/risac-emblem.png');

// Proportions du fichier fourni : 574 x 369.
const FULL_RATIO = 574 / 369;

/**
 * Marque officielle RISAC (logo fourni par Congo Meilleur).
 * `size` est la hauteur de l'emblème ; le logo complet est plus haut pour que le mot RISAC reste lisible.
 * Le fichier a un fond blanc : à poser sur une surface claire.
 */
export function Logo({ size = 40, showText = true }: { size?: number; showText?: boolean }) {
  const label = 'RISAC, Réseau International des Structures d’Accueil du Congo';

  if (!showText) {
    return (
      <View style={s.wrap}>
        <Image source={EMBLEM} style={{ width: size, height: size }} accessibilityLabel={label} resizeMode="contain" />
      </View>
    );
  }

  const height = Math.round(size * 1.7);
  return (
    <View style={s.wrap}>
      <Image
        source={FULL_LOGO}
        style={{ width: Math.round(height * FULL_RATIO), height }}
        accessibilityLabel={label}
        resizeMode="contain"
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
});
