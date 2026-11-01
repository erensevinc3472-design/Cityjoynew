import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import type { Photo } from '@cityjoy/shared';

import { useProfilePhoto } from '@/lib/profile-photos';

/**
 * Yuvarlak avatarın içinde, baş harfin üstüne profil fotoğrafı. Fotoğraf yoksa hiçbir şey çizmez (baş harf görünür).
 * `photo` verilmezse kişinin fotoğrafı `uid` ile okunur.
 */
export function AvatarPhoto({ uid, photo, size }: { uid?: string; photo?: Photo; size: number }) {
  const fetched = useProfilePhoto(photo ? undefined : uid);
  const p = photo ?? fetched;
  if (!p) return null;
  return (
    <Image
      source={{ uri: p.url }}
      recyclingKey={p.path}
      style={[StyleSheet.absoluteFill, { width: size, height: size, borderRadius: size / 2 }]}
      contentFit="cover"
      accessibilityIgnoresInvertColors
    />
  );
}
