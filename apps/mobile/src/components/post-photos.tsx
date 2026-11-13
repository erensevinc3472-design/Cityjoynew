import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
// Hareket kütüphanesinin kaydırma alanı: Keşfet'in yana kayan sekmelerinin içinde parmak fotoğraftayken fotoğraf kayar,
// sekme değil (iç içe yatay kaydırmada içteki önceliklidir).
import { ScrollView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import type { MediaEdit, PostPhoto } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { MediaOverlay } from '@/components/media-overlay';
import { useThemeColors } from '@/theme/use-theme';

/** Fotoğrafın oranı Instagram'daki gibi sınırlanır: en uzun 4:5 dik, en geniş 1.91:1 yatay. */
const ratioOf = (p: PostPhoto) => Math.min(1.91, Math.max(0.8, p.width / p.height));

/**
 * Gönderi fotoğrafları, ekran genişliğinde. Birden çoksa yana kaydırılır; sağ üstte "2/3" ve altta noktalar. Yükseklik
 * ilk fotoğrafın oranından gelir, diğerleri bu çerçeveye sığdırılır.
 */
export function PostPhotos({ photos, maxWidth, onTap, edits }: { photos: readonly PostPhoto[]; maxWidth: number; /** Dokunma (iki kez: beğeni). */ onTap?(): void; /** Düzenleyicinin yazı ve çıkartmaları (fotoğraf sırasına göre). */ edits?: readonly (MediaEdit | null)[] }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { width: screen } = useWindowDimensions();
  const width = Math.min(screen, maxWidth);
  const height = Math.round(width / ratioOf(photos[0]));
  const [page, setPage] = useState(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const image = (p: PostPhoto, i: number) => (
    <Pressable key={p.path} onPress={onTap} disabled={!onTap} accessible={false}>
    <Image
      source={{ uri: p.url }}
      style={{ width, height, backgroundColor: c.surfaceStrong }}
      contentFit="cover"
      transition={150}
      recyclingKey={p.path}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('explore.photos.label', { n: i + 1, total: photos.length })}
    />
    <MediaOverlay edit={edits?.[i]} frameW={width} frameH={height} mediaW={p.width} mediaH={p.height} fit="cover" />
    </Pressable>
  );

  if (photos.length === 1) return image(photos[0], 0);
  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}>
        {photos.map(image)}
      </ScrollView>
      <View style={[styles.badge, { backgroundColor: 'rgba(0,0,0,0.55)' }]} pointerEvents="none">
        <AppText style={styles.badgeText}>{`${page + 1}/${photos.length}`}</AppText>
      </View>
      <View style={styles.dots} pointerEvents="none">
        {photos.map((p, i) => (
          <View key={p.path} style={[styles.dot, { backgroundColor: i === page ? c.accent : c.border }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: 10, end: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
