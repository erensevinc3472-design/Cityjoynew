import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isPostListed, type Post } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { StateMessage } from '@/components/state-message';
import { TravelHeader } from '@/components/travel-header';
import { locationRepository as repo } from '@/lib/locations';
import { postRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { GUTTER, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const COLUMNS = 3;
const GAP = 3;
const MAX_WIDTH = 640;

/**
 * "{Şehir} kareleri" (PROJE.md 13. madde 34, Eren onayladı): Keşfet'te o ilde fotoğrafla, Genel'e paylaşılan ve
 * "Karelerde de görünsün" işaretlenen gönderiler; ek yükleme ya da kopya yok. Üstte CityJoy'un öne çıkardıkları, sonra
 * yeniden eskiye 30'ar küçük önizleme (aşağı kaydırdıkça). Kareye dokununca Keşfet'teki gönderi açılır. Şikâyetle
 * düşen gönderi burada da görünmez.
 */
export default function TravelFramesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const { user } = useSession();
  const { code } = useLocalSearchParams<{ code: string }>();
  const name = repo.getProvince(code)?.name ?? '';
  const [items, setItems] = useState<(Post & { featured?: boolean })[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/travel/city/[code]', params: { code } }));

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const page = await postRepository.frames(code);
      const featured = page.featured.filter(isPostListed).map((p) => ({ ...p, featured: true }));
      const seen = new Set(featured.map((p) => p.id));
      setItems([...featured, ...page.posts.filter((p) => isPostListed(p) && !seen.has(p.id))]);
      setCursor(page.cursor);
    } catch {
      setFailed(true);
    }
  }, [code]);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const more = async () => {
    if (!cursor || loadingMore || !items) return;
    setLoadingMore(true);
    try {
      const page = await postRepository.frames(code, cursor);
      const seen = new Set(items.map((p) => p.id));
      setItems([...items, ...page.posts.filter((p) => isPostListed(p) && !seen.has(p.id))]);
      setCursor(page.cursor);
    } catch {
      // Sonraki sayfa okunamadıysa aşağı kaydırınca yeniden denenir.
    } finally {
      setLoadingMore(false);
    }
  };

  const inner = Math.min(width, MAX_WIDTH) - GUTTER * 2;
  const size = Math.floor((inner - GAP * (COLUMNS - 1)) / COLUMNS);

  const empty = !user ? (
    <StateMessage kind="empty" message={t('travel.framesSignIn')} />
  ) : failed ? (
    <StateMessage kind="error" onRetry={load} />
  ) : items === null ? (
    <StateMessage kind="loading" />
  ) : (
    <View style={styles.empty}>
      <StateMessage kind="empty" message={t('travel.framesEmpty', { name })} />
      <AppButton variant="secondary" title={t('travel.framesShare')} onPress={() => router.push({ pathname: '/explore/new', params: { target: 'genel' } })} />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      <TravelHeader subtitle={name} title={t('travel.frames', { name })} onBack={back} />
      <FlatList
        data={user && !failed ? items ?? [] : []}
        keyExtractor={(p) => p.id}
        numColumns={COLUMNS}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={[styles.list, { width: inner + GUTTER * 2 }]}
        ListHeaderComponent={<AppText variant="caption" muted style={styles.intro}>{t('travel.framesIntro')}</AppText>}
        ListEmptyComponent={empty}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={c.accent} style={styles.more} /> : undefined}
        onEndReached={more}
        onEndReachedThreshold={0.6}
        renderItem={({ item, index }) => {
          const photo = item.photos?.[0];
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={[t('travel.frameN', { n: index + 1 }), item.featured ? t('travel.framesFeatured') : null, item.authorName].filter(Boolean).join(', ')}
              onPress={() => router.push({ pathname: '/explore/[id]', params: { id: item.id } })}
              style={({ pressed }) => [{ width: size, height: size, marginBottom: GAP, backgroundColor: c.surfaceStrong, opacity: pressed ? 0.85 : 1 }]}>
              {photo ? <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={photo.path} accessibilityIgnoresInvertColors /> : null}
              {item.featured ? (
                <View style={styles.star}>
                  <MaterialIcons name="star" size={14} color="#E0B07A" />
                </View>
              ) : null}
              {(item.photos?.length ?? 0) > 1 ? (
                <View style={styles.multi}>
                  <MaterialIcons name="collections" size={14} color="#FFFFFF" />
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { alignSelf: 'center', paddingHorizontal: GUTTER, paddingTop: spacing.md, paddingBottom: spacing.xl },
  intro: { marginBottom: spacing.md },
  empty: { gap: spacing.md },
  more: { marginVertical: spacing.md },
  star: { position: 'absolute', top: 4, start: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  multi: { position: 'absolute', top: 4, end: 4 },
});
