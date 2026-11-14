import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export function HeartIcon({ filled, color, size = 22 }: { filled?: boolean; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CommentIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M21 11.5a8 8 0 0 1-8.5 8 9 9 0 0 1-3.6-.7L4 20.5l1.3-4.3A8 8 0 0 1 4 11.5a8 8 0 0 1 8.5-8 8 8 0 0 1 8.5 8Z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CameraIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.2-2h7.2l1.2 2h1.7A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-9Z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" fill="none" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

export function CloseIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="m6 6 12 12M18 6 6 18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function BackIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M15 19l-7-7 7-7"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Œil ouvert (afficher) ou barré (masquer), pour le champ de mot de passe. */
export function EyeIcon({ off = false, color, size = 20 }: { off?: boolean; color: ColorValue; size?: number }) {
  const common = {
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {off ? (
        <>
          <Path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" {...common} />
          <Path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" {...common} />
          <Path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" {...common} />
          <Path d="M2 2l20 20" {...common} />
        </>
      ) : (
        <>
          <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" {...common} />
          <Circle cx={12} cy={12} r={3} {...common} />
        </>
      )}
    </Svg>
  );
}

/** Coche blanche de la case « Se souvenir de moi ». */
export function CheckIcon({ color, size = 14 }: { color: ColorValue; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 13l4 4L19 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
