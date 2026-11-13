import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { POST_CATEGORIES, type Post } from '@cityjoy/shared';

import { ThumbImage } from '@/components/thumb-image';
import { fonts, spacing } from '@/theme/tokens';
import { AppText } from './app-text';
import { StateMessage } from './state-message';

/** Izgara karelerinin zemini: kategoriye göre, iki modda da beyaz yazıyla okunur. Fotoğraflı gönderide ilk fotoğraf. */
const TILE_COLORS = ['#1F5C63', '#7A5A1E', '#5B3F6E', '#2F5D3A', '#7A3B3B', '#34506B', '#5E5A2A', '#3E4A57'];
const tileColor = (p: Post) => TILE_COLORS[Math.max(0, POST_CATEGORIES.indexOf(p.category)) % TILE_COLORS.length];

/** Profil ve işletme sayfasındaki üçlü gönderi ızgarası (Instagram düzeni); kareye dokununca gönderi açılır. */
export function PostGrid({ list, empty, onLongPress, longPressHint }: { list: Post[] | null; empty: string; /** Uzun basınca (ör. Kaydettiklerim: klasöre taşı). */ onLongPress?(p: Post): void; longPressHint?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const size = Math.floor((Math.min(width, 640) - 4) / 3);

  if (list === null) return <StateMessage kind="loading" />;
  if (list.length === 0) return <AppText variant="caption" muted style={styles.empty}>{empty}</AppText>;
  return (
    <View style={styles.grid}>
      {list.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={[t(`explore.categories.${p.category}`), p.photos?.length ? t('explore.photos.count', { count: p.photos.length }) : p.video ? t('explore.video.label') : '', p.text.slice(0, 100)].filter(Boolean).join('. ')}
          accessibilityHint={onLongPress ? longPressHint : undefined}
          accessibilityActions={onLongPress ? [{ name: 'longpress', label: longPressHint }] : undefined}
          onAccessibilityAction={onLongPress ? () => onLongPress(p) : undefined}
          onPress={() => router.push({ pathname: '/explore/[id]', params: { id: p.id } })}
          onLongPress={onLongPress ? () => onLongPress(p) : undefined}
          style={({ pressed }) => [styles.tile, { width: size, height: size, backgroundColor: tileColor(p), opacity: pressed ? 0.85 : 1 }]}>
          {p.photos?.length ? (
            <>
              <ThumbImage photo={p.photos[0]} style={StyleSheet.absoluteFill} contentFit="cover" />
              {p.photos.length > 1 ? <MaterialIcons name="collections" size={16} color="#FFFFFF" style={styles.multi} /> : <View />}
            </>
          ) : p.video ? (
            <>
              {p.video.poster ? <Image source={{ uri: p.video.poster }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={p.video.poster} /> : (
                <View style={styles.videoTile}>
                  <MaterialIcons name="play-circle-outline" size={36} color="#FFFFFF" />
                </View>
              )}
              <MaterialIcons name="videocam" size={16} color="#FFFFFF" style={styles.multi} />
            </>
          ) : (
            <AppText numberOfLines={5} style={styles.text}>{p.text}</AppText>
          )}
          <View style={styles.foot}>
            <MaterialIcons name="favorite" size={12} color="rgba(255,255,255,0.85)" />
            <AppText style={styles.count}>{p.likeCount}</AppText>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  videoTile: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: '#0B1F24', alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingTop: 2 },
  tile: { padding: 8, justifyContent: 'space-between', overflow: 'hidden' },
  text: { color: '#FFFFFF', fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  count: { color: 'rgba(255,255,255,0.85)', fontSize: 11, lineHeight: 14, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  multi: { alignSelf: 'flex-end', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  empty: { textAlign: 'center', padding: spacing.xl },
});
