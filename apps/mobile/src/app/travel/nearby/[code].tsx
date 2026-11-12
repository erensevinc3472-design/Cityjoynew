import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { hhmm, moveBetween, openNow, placeImage, type PlanMove, type TravelPlace } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { ListRow, ListSurface, SectionTitle, Tag } from '@/components/inner';
import { PageHead, PAGE_CONTENT, usePageBottom } from '@/components/page-head';
import { CoverArt, sceneSky } from '@/components/scene-art';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { locationRepository as repo } from '@/lib/locations';
import { CATEGORY_SCENES, useTravelCity, useTravelPlaces } from '@/lib/travel';
import { nowLocal, useMoveText, useTripOrigin } from '@/lib/trip-plan';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Yakınımda (Karar, Eren, 12 Kasım 2026): kişinin konumuna göre en yakın gezilecek yerler; uzaklık, yürüme ya da araba
 * süresi (yaklaşık), şu an açık mı. Konum izni yoksa ya da kişi o ilde değilse ilin merkezine göre sıralanır.
 * Konumu girilmemiş yer listede yok (panelde "Konum" alanı). Yoldayım (yol ihtiyaçları) ayrı kalır.
 */
export default function TravelNearbyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const bottom = usePageBottom();
  const moveText = useMoveText();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { value: city } = useTravelCity(code);
  const { value: places, failed, retry } = useTravelPlaces(code);
  const { origin, source, loading, locate } = useTripOrigin(code);
  const name = repo.getProvince(code)?.name ?? '';
  const cover = city?.cover ?? undefined;
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/travel/city/[code]', params: { code } }));
  const { date, minutes } = nowLocal();

  const rows: { p: TravelPlace; move: PlanMove }[] =
    origin && places
      ? places
          .filter((p) => p.location && p.category !== 'lezzet')
          .map((p) => ({ p, move: moveBetween(origin, p.location!) }))
          .sort((a, b) => a.move.km - b.move.km)
      : [];
  const walk = rows.filter((r) => r.move.mode === 'yuruyus');
  const further = rows.filter((r) => r.move.mode === 'araba');

  const status = (p: TravelPlace) => {
    const s = openNow(p, date, minutes);
    if (!s) return null;
    if (!s.open) return <Tag label={t('travel.closedNow')} tone="red" />;
    return <Tag label={s.closes != null ? t('travel.closesAt', { time: hhmm(s.closes) }) : t('travel.alwaysOpen')} tone="green" />;
  };

  const list = (items: typeof rows) => (
    <ListSurface>
      {items.map(({ p, move }, i) => {
        const scene = CATEGORY_SCENES[p.category];
        return (
          <ListRow
            key={p.id}
            first={i === 0}
            title={p.name}
            subtitle={`${moveText(move)} · ${p.kind}`}
            onPress={() => router.push({ pathname: '/travel/place/[id]', params: { id: p.id } })}
            leading={
              <View style={[styles.thumb, { backgroundColor: sceneSky(scene) }]}>
                <CoverArt photo={placeImage(p)} kind={scene} still />
              </View>
            }
            trailing={status(p)}
          />
        );
      })}
    </ListSurface>
  );

  const note =
    source === 'gps' ? t('travel.nearbyIntro') : source === 'far' ? t('travel.nearbyFar', { name }) : t('travel.nearbyCenter', { name });

  return (
    <Screen bleed cover={cover}>
      <ScrollView contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false}>
        <PageHead cover={cover} extend={6} title={t('travel.nearbyTitle')} subtitle={name} onBack={back} />
        <View style={[styles.note, { backgroundColor: c.surface, borderColor: c.border }]}>
          <MaterialIcons name={source === 'gps' ? 'my-location' : 'location-city'} size={18} color={c.accent} />
          <AppText style={[styles.noteText, { color: c.textMuted }]}>{loading ? t('travel.nearbyLocating') : note}</AppText>
          {!loading && source !== 'gps' ? (
            <Pressable accessibilityRole="button" onPress={locate} hitSlop={8}>
              <AppText style={[styles.link, { color: c.accent }]}>{t('travel.useMyLocation')}</AppText>
            </Pressable>
          ) : null}
        </View>

        {failed && !places ? <StateMessage kind="error" onRetry={retry} /> : places === null ? <StateMessage kind="loading" /> : null}
        {places && !rows.length ? <StateMessage kind="empty" message={t('travel.nearbyNone')} /> : null}

        {walk.length ? (
          <>
            <SectionTitle title={t('travel.nearbyWalk')} />
            {list(walk)}
          </>
        ) : null}
        {further.length ? (
          <>
            <SectionTitle title={walk.length ? t('travel.nearbyFurther') : t('travel.nearbyAll')} />
            {list(further)}
          </>
        ) : null}
        {rows.length ? <AppText style={[styles.small, { color: c.textSoft }]}>{t('travel.approxNote')}</AppText> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 2, borderRadius: radius.lg, borderWidth: 1 },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  link: { fontSize: 12.5, fontWeight: '600' },
  thumb: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden' },
  small: { fontSize: 11.5, lineHeight: 16 },
});
