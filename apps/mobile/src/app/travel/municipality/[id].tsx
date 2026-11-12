import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { videoEmbedUrl } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { BottomShade } from '@/components/city-tiles';
import { Tag } from '@/components/inner';
import { PageHead, PAGE_CONTENT, usePageBottom } from '@/components/page-head';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { ThumbImage } from '@/components/thumb-image';
import { VideoModal } from '@/components/video-modal';
import { locationRepository as repo } from '@/lib/locations';
import { cityMunicipalities, ROUTE_THEME_ICONS, useDurationText, useTravelMunicipal, useTravelRoutes } from '@/lib/travel';
import { fonts, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const GOLD = '#E2B277';
const NAVY = '#081F24';

/**
 * Belediye tanıtım sayfası (Karar, Eren, 12 Kasım 2026: kart içinde açılmak yerine ayrı sayfa; başkanın ve ilçenin
 * görünürlüğü için, paylaşılabilir). Üstte başkan (fotoğraf, ad, unvan; seçim döneminde gizli), ilçenin büyük
 * fotoğrafı ve sloganı, tanıtım yazısı, belediyenin rotaları, tanıtım videosu. Puan yok (Karar, Eren).
 * Belediye kendi panelinden doldurur (Seyahat > Başkanlarla Keşif), admin onaylar.
 */
export default function MunicipalityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const bottom = usePageBottom();
  const duration = useDurationText();
  const { id } = useLocalSearchParams<{ id: string }>();
  const code = /^bld-(\d{2})/.exec(id ?? '')?.[1] ?? '';
  const { value: intros, failed, retry } = useTravelMunicipal(code);
  const { value: routes } = useTravelRoutes(code);
  const [playing, setPlaying] = useState<{ src: string; title: string } | null>(null);
  const m = cityMunicipalities(code).find((x) => x.id === id);
  const intro = intros?.find((x) => x.id === id);
  const city = repo.getProvince(code)?.name ?? '';
  const place = !m ? '' : m.scope.level === 'ilce' ? repo.getDistrict(m.scope.districtId)?.name ?? m.name : m.name.replace(/ Belediyesi$/, '');
  const own = (routes ?? []).filter((r) => r.municipalityId === id);
  const mayor = intro?.showMayor && intro.mayorName ? intro.mayorName : undefined;
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/travel/mayors/[code]', params: { code } }));

  const share = () =>
    Share.share({ message: [`${m?.name ?? place} · ${t('travel.mayorsTitle')}`, intro?.slogan, mayor, 'CityJoy · TravelJoy'].filter(Boolean).join('\n') }).catch(() => {});
  const play = (url: string) => {
    const embed = videoEmbedUrl(url);
    if (embed) setPlaying({ src: embed, title: `${place} · ${t('travel.video')}` });
    else WebBrowser.openBrowserAsync(url).catch(() => {});
  };

  const ratio = intro?.cover ? Math.min(2, Math.max(1.2, intro.cover.width / intro.cover.height)) : 1.5;

  return (
    <Screen bleed>
      <ScrollView contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false}>
        <PageHead title={place || t('travel.mayorsTitle')} subtitle={city} onBack={back} right={intro ? { icon: 'share', label: t('travel.share'), onPress: share } : undefined} />

        {failed && !intros ? <StateMessage kind="error" onRetry={retry} /> : intros === null ? <StateMessage kind="loading" /> : null}
        {intros && (!m || !intro) ? <StateMessage kind="empty" message={t('travel.introPreparing')} /> : null}

        {m && intro ? (
          <>
            {/* Başkan: fotoğraf, ad, unvan. Seçim döneminde yalnızca belediye adı. */}
            <View style={[styles.mayor, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={[styles.avatar, { borderColor: GOLD, backgroundColor: c.accentSoft }]}>
                {mayor && intro.mayorPhoto ? (
                  <ThumbImage photo={intro.mayorPhoto} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
                ) : (
                  <MaterialIcons name={mayor ? 'person' : 'account-balance'} size={34} color={c.accent} />
                )}
              </View>
              <View style={styles.flex}>
                <AppText accessibilityRole="header" style={[styles.mayorName, { color: c.textStrong }]} numberOfLines={2}>{mayor ?? m.name}</AppText>
                {mayor ? (
                  <AppText style={[styles.mayorRole, { color: c.textMuted }]} numberOfLines={2}>
                    {t(intro.mayorActing ? 'travel.mayorActingTitle' : 'travel.mayorTitle', { name: place })}
                  </AppText>
                ) : null}
                <View style={styles.tagRow}>
                  <Tag label={t('travel.municipalTag')} />
                </View>
              </View>
            </View>

            {/* İlçenin büyük fotoğrafı ve sloganı. */}
            {intro.cover || intro.slogan ? (
              <View style={[styles.hero, { aspectRatio: ratio, backgroundColor: c.surfaceStrong }]}>
                {intro.cover ? <ThumbImage photo={intro.cover} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
                {intro.cover ? <BottomShade top={0.35} bottom={0.92} /> : null}
                <View>
                  <AppText style={[styles.heroTitle, !intro.cover && { color: c.textStrong }]}>{place}</AppText>
                  {intro.slogan ? <AppText style={[styles.heroSlogan, !intro.cover && { color: c.textMuted }]}>{intro.slogan}</AppText> : null}
                </View>
              </View>
            ) : null}

            {intro.description ? <AppText style={[styles.text, { color: c.text }]}>{intro.description}</AppText> : null}

            {intro.videoUrl ? (
              <Pressable accessibilityRole="button" onPress={() => play(intro.videoUrl!)} style={({ pressed }) => [styles.video, { opacity: pressed ? 0.85 : 1 }]}>
                <MaterialIcons name="play-circle-filled" size={22} color={NAVY} />
                <AppText style={styles.videoText}>{t('travel.video')}</AppText>
              </Pressable>
            ) : null}

            {own.length ? <AppText accessibilityRole="header" style={[styles.h2, { color: c.textStrong }]}>{t('travel.municipalRoutes')}</AppText> : null}
            {own.map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={`${r.title}. ${r.stops.map((s) => s.name).join(', ')}. ${duration(r.durationMinutes)}`}
                onPress={() => router.push({ pathname: '/travel/route/[id]', params: { id: r.id } })}
                style={({ pressed }) => [styles.route, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}>
                <View style={[styles.routeIcon, { backgroundColor: c.accentSoft }]}>
                  <MaterialIcons name={ROUTE_THEME_ICONS[r.theme]} size={20} color={c.accent} />
                </View>
                <View style={styles.flex}>
                  <AppText style={[styles.routeTitle, { color: c.textStrong }]} numberOfLines={1}>{r.title}</AppText>
                  <AppText style={[styles.sub, { color: c.textMuted }]} numberOfLines={1}>{r.stops.map((s) => s.name).join(' → ')}</AppText>
                </View>
                <AppText style={[styles.sub, { color: c.accent }]}>{duration(r.durationMinutes)}</AppText>
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>
      <VideoModal src={playing?.src ?? null} title={playing?.title ?? ''} onClose={() => setPlaying(null)} />
    </Screen>
  );
}

const white = '#FFFFFF';
const styles = StyleSheet.create({
  content: { gap: spacing.md },
  flex: { flex: 1 },
  mayor: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1 },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  mayorName: { fontFamily: fonts.display, fontSize: 21, lineHeight: 26 },
  mayorRole: { fontSize: 13.5, lineHeight: 18, marginTop: 1 },
  tagRow: { flexDirection: 'row', marginTop: spacing.xs + 2 },
  hero: { width: '100%', borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'flex-end', padding: spacing.md },
  heroTitle: { color: white, fontFamily: fonts.display, fontSize: 26, lineHeight: 31 },
  heroSlogan: { color: 'rgba(255,255,255,0.88)', fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19, marginTop: 2 },
  text: { fontSize: 14.5, lineHeight: 22 },
  h2: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, marginTop: spacing.xs },
  route: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, minHeight: MIN_TOUCH + 20 },
  routeIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  routeTitle: { fontFamily: fonts.bodySemi, fontSize: 15 },
  sub: { fontSize: 12.5, lineHeight: 17 },
  video: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: GOLD, paddingVertical: spacing.sm + 4, borderRadius: radius.pill, minHeight: MIN_TOUCH + 4 },
  videoText: { color: NAVY, fontFamily: fonts.heading, fontSize: 14 },
});
