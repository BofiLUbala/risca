import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Icones de la barre d onglets, dessinees en SVG pour rester nettes. */
export function TabIcon({ name, color, size = 24 }: { name: string; color: ColorValue; size?: number }) {
  const common = {
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  switch (name) {
    case 'home':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M3 10.5 12 3l9 7.5" {...common} />
          <Path d="M5 9.5V20h14V9.5" {...common} />
          <Path d="M9.5 20v-6h5v6" {...common} />
        </Svg>
      );
    case 'feed':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="3" y="4" width="18" height="16" rx="3" {...common} />
          <Path d="M7 9h6M7 13h10M7 17h8" {...common} />
        </Svg>
      );
    case 'children':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="9" cy="8" r="3.2" {...common} />
          <Path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" {...common} />
          <Circle cx="17" cy="9.5" r="2.4" {...common} />
          <Path d="M16 14.2c2.4.2 4.3 2 4.3 4.8" {...common} />
        </Svg>
      );
    case 'messages':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M21 11.5a8 8 0 0 1-8.5 8 9 9 0 0 1-3.6-.7L4 20.5l1.3-4.3A8 8 0 0 1 4 11.5a8 8 0 0 1 8.5-8 8 8 0 0 1 8.5 8Z" {...common} />
        </Svg>
      );
    case 'profile':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="8" r="3.6" {...common} />
          <Path d="M4.5 20c0-3.6 3.4-6.2 7.5-6.2s7.5 2.6 7.5 6.2" {...common} />
        </Svg>
      );
    case 'validate':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="9" {...common} />
          <Path d="m8.5 12.2 2.4 2.4 4.6-4.9" {...common} />
        </Svg>
      );
    case 'heart':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" {...common} />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="8" {...common} />
        </Svg>
      );
  }
}
