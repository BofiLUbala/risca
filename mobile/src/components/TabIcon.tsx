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
    case 'menu':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 7h16M4 12h16M4 17h16" {...common} strokeWidth={2} />
        </Svg>
      );
    case 'close':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M6 6l12 12M18 6 6 18" {...common} strokeWidth={2} />
        </Svg>
      );
    case 'orphanage':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M3 11 12 4l9 7" {...common} />
          <Path d="M5 10v10h14V10" {...common} />
          <Circle cx="12" cy="13.5" r="2" {...common} />
          <Path d="M8.5 20c.4-2 1.8-3.2 3.5-3.2s3.1 1.2 3.5 3.2" {...common} />
        </Svg>
      );
    case 'letter':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="3" y="5" width="18" height="14" rx="2.5" {...common} />
          <Path d="m4 7 8 6 8-6" {...common} />
        </Svg>
      );
    case 'transfer':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" {...common} />
        </Svg>
      );
    case 'history':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" {...common} />
          <Path d="M3.5 4v4h4M12 8v4.5l3 2" {...common} />
        </Svg>
      );
    case 'globe':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="9" {...common} />
          <Path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" {...common} />
        </Svg>
      );
    case 'logout':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" {...common} />
          <Path d="M10 8 6 12l4 4M6 12h10" {...common} />
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
