import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { SceneArt, sceneSky } from '@/components/scene-art';
import { StateMessage } from '@/components/state-message';
import { TravelHeader } from '@/components/travel-header';
import { locationRepository as repo } from '@/lib/locations';
import { CATEGORY_SCENES, cityMunicipalities, MODE_ICONS, NEARBY_ICONS, ROUTE_THEME_ICONS, ROUTE_THEME_SCENES, useDurationText, useTravelPlaces, useTravelRoute } from '@/lib/travel';
import { fonts, GUTTER, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Rota (tasarım: bursa-rota-sinematik.html): önce özet (duraklar, ipuçları, "Rotayı başlat"), sonra durak durak ilerleme:
 * "Durak 2 / 6", ilerleme çubuğu, durağın notu, önerilen kalış; durak gezilecek yerlerden biriyse saat, ücret, ulaşım,
 * yakındaki hizmetler ve ipuçları da gösterilir; sonraki durağa nasıl gidilir. Konum takibi ve harita 3. aşamada.
 */
export default function TravelRouteScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const duration = useDurationText();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { value: route, failed, retry } = useTravelRoute(id);
  const { value: places } = useTravelPlaces(route?.cityId);
  const [step, setStep] = useState(-1);
  const city = route ? repo.getProvince(route.cityId)?.name ?? '' : '';
  const back = () => {
    if (step >= 0) return setStep(-1);
    if (router.canGoBack()) router.back();
    else if (route) router.replace({ pathname: '/travel/routes/[code]', params: { code: route.cityId } });
    else router.replace('/travel/explore');
  };

  if (!route) {
    return (
      <View style={[styles.root, { backgroundColor: c.background }]}>
        <TravelHeader subtitle={t('travel.routesTitle')} onBack={back} />
        {failed ? <StateMessage kind="error" onRetry={retry} /> : route === null && id ? <StateMessage kind="loading" /> : <StateMessage kind="empty" message={t('travel.routeNotFound')} />}
      </View>
    );
  }

  const total = route.stops.length;
  const municipality = route.municipalityId
    ? cityMunicipalities(route.cityId).find((m) => m.id === route.municipalityId)?.name
    : undefined;
  const scene = ROUTE_THEME_SCENES[route.theme];
  const stop = step >= 0 && step < total ? route.stops[step] : null;
  const place = stop?.placeId ? places?.find((p) => p.id === stop.placeId) : undefined;
  const done = step >= total;

  const info = (icon: IconName, label: string, value?: string) =>
    value ? (
      <View key={label} style={[styles.info, { backgroundColor: c.surface, borderColor: c.border }]}>
        <MaterialIcons name={icon} size={18} color={c.accent} />
        <View style={styles.flex}>
          <AppText style={[styles.infoLabel, { color: c.textMuted }]}>{label}</AppText>
          <AppText style={[styles.infoValue, { color: c.textStrong }]}>{value}</AppText>
        </View>
      </View>
    ) : null;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      <TravelHeader
        subtitle={stop ? t('travel.stopOf', { n: step + 1, total }) : city}
        title={route.title}
        onBack={back}
        right={
          step >= 0 && !done ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('travel.stopList')} onPress={() => setStep(-1)} style={styles.listBtn} hitSlop={8}>
              <MaterialIcons name="format-list-bulleted" size={22} color={c.heroText} />
            </Pressable>
          ) : undefined
        }
      />
      {step >= 0 ? (
        <View accessibilityRole="progressbar" accessibilityLabel={t('travel.progress')} accessibilityValue={{ min: 0, max: total, now: Math.min(step + 1, total) }} style={[styles.track, { backgroundColor: c.surfaceStrong }]}>
          <View style={[styles.bar, { width: `${(Math.min(step + 1, total) / total) * 100}%`, backgroundColor: c.accent }]} />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 96 }]}>
        {step < 0 ? (
          <>
            <View style={[styles.hero, { backgroundColor: sceneSky(scene) }]}>
              <View style={StyleSheet.absoluteFill}>
                <SceneArt kind={scene} />
              </View>
              <View style={[StyleSheet.absoluteFill, styles.shade]} />
              <View style={styles.heroText}>
                <View style={styles.tags}>
                  <View style={styles.tag}>
                    <MaterialIcons name={ROUTE_THEME_ICONS[route.theme]} size={12} color="#E0B07A" />
                    <AppText style={styles.tagText}>{t(`travel.routeThemes.${route.theme}`).toLocaleUpperCase(i18n.language)}</AppText>
                  </View>
                  {municipality ? (
                    <View style={styles.tag}>
                      <AppText style={styles.tagText}>{t('travel.municipalTag').toLocaleUpperCase(i18n.language)}</AppText>
                    </View>
                  ) : null}
                </View>
                <AppText accessibilityRole="header" style={styles.heroTitle}>{route.title}</AppText>
                <AppText style={styles.heroMeta}>
                  {[t('travel.stops', { count: total }), duration(route.durationMinutes), t(`travel.lengths.${route.length}`)].join(' · ')}
                </AppText>
              </View>
            </View>
            <View style={styles.pad}>
              {municipality ? <AppText style={[styles.small, { color: c.textMuted }]}>{t('travel.preparedBy', { name: municipality })}</AppText> : null}
              <AppText style={[styles.desc, { color: c.text }]}>{route.summary}</AppText>
              <AppText accessibilityRole="header" style={[styles.h2, { color: c.textStrong }]}>{t('travel.stopList')}</AppText>
              {route.stops.map((s, i) => (
                <Pressable
                  key={`${s.name}-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('travel.stopOf', { n: i + 1, total })}. ${s.name}`}
                  onPress={() => setStep(i)}
                  style={({ pressed }) => [styles.stopRow, { opacity: pressed ? 0.85 : 1 }]}>
                  <View style={styles.rail}>
                    <View style={[styles.dot, { backgroundColor: c.accent }]}>
                      <AppText style={[styles.dotText, { color: c.onPrimary }]}>{i + 1}</AppText>
                    </View>
                    {i < total - 1 ? <View style={[styles.line, { backgroundColor: c.accentBorder }]} /> : null}
                  </View>
                  <View style={styles.stopBody}>
                    <AppText style={[styles.stopName, { color: c.textStrong }]}>{s.name}</AppText>
                    {s.note ? <AppText style={[styles.small, { color: c.textMuted }]}>{s.note}</AppText> : null}
                    {s.stayMinutes ? <AppText style={[styles.small, { color: c.textSoft }]}>{t('travel.stay', { value: duration(s.stayMinutes) })}</AppText> : null}
                    {s.next && i < total - 1 ? (
                      <View style={styles.nextRow}>
                        <MaterialIcons name={MODE_ICONS[s.next.mode]} size={14} color={c.accent} />
                        <AppText style={[styles.small, { color: c.textMuted }]}>{s.next.text}</AppText>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              ))}
              {route.tips.length ? (
                <View style={[styles.tips, { backgroundColor: c.accentSoft, borderColor: c.accentBorder }]}>
                  <AppText style={[styles.h3, { color: c.textStrong }]}>{t('travel.tipsTitle')}</AppText>
                  {route.tips.map((x) => (
                    <View key={x} style={styles.tipRow}>
                      <MaterialIcons name="lightbulb-outline" size={14} color={c.accent} />
                      <AppText style={[styles.small, styles.flex, { color: c.text }]}>{x}</AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </>
        ) : done ? (
          <View style={styles.pad}>
            <StateMessage kind="empty" message={t('travel.finished')} />
          </View>
        ) : stop ? (
          <>
            <View style={[styles.stopHero, { backgroundColor: sceneSky(place ? CATEGORY_SCENES[place.category] : scene) }]}>
              <View style={StyleSheet.absoluteFill}>
                <SceneArt kind={place ? CATEGORY_SCENES[place.category] : scene} />
              </View>
              <View style={[StyleSheet.absoluteFill, styles.shade]} />
              <View style={styles.heroText}>
                <AppText style={styles.tagText}>{t('travel.stopOf', { n: step + 1, total }).toLocaleUpperCase(i18n.language)}</AppText>
                <AppText accessibilityRole="header" style={styles.heroTitle}>{stop.name}</AppText>
                {place ? <AppText style={styles.heroMeta}>{place.kind}</AppText> : null}
              </View>
            </View>
            <View style={styles.pad}>
              {stop.note ? <AppText style={[styles.desc, { color: c.text }]}>{stop.note}</AppText> : null}
              {place ? <AppText style={[styles.small, { color: c.textMuted }]}>{place.summary}</AppText> : null}
              <View style={styles.infos}>
                {info('schedule', t('travel.stayLabel'), stop.stayMinutes ? duration(stop.stayMinutes) : undefined)}
                {info('access-time', t('travel.visitingHours'), place?.visitingHours)}
                {info('confirmation-number', t('travel.entranceFee'), place?.entranceFee)}
                {info('accessible', t('travel.accessibility'), place?.accessibility)}
              </View>
              {place?.visitingHours || place?.entranceFee ? <AppText style={[styles.note, { color: c.textSoft }]}>{t('travel.checkNote')}</AppText> : null}
              {place?.howToGet.length ? (
                <View style={styles.block}>
                  <AppText style={[styles.h3, { color: c.textStrong }]}>{t('travel.howToGet')}</AppText>
                  {place.howToGet.map((s, i) => (
                    <View key={i} style={styles.tipRow}>
                      <MaterialIcons name={MODE_ICONS[s.mode]} size={15} color={c.accent} />
                      <AppText style={[styles.small, styles.flex, { color: c.text }]}>{s.text}</AppText>
                    </View>
                  ))}
                </View>
              ) : null}
              {place?.nearby.length ? (
                <View style={styles.block}>
                  <AppText style={[styles.h3, { color: c.textStrong }]}>{t('travel.nearby')}</AppText>
                  {place.nearby.map((n, i) => (
                    <View key={i} style={styles.tipRow}>
                      <MaterialIcons name={NEARBY_ICONS[n.kind]} size={15} color={c.accent} />
                      <AppText style={[styles.small, styles.flex, { color: c.text }]}>{n.text}</AppText>
                    </View>
                  ))}
                </View>
              ) : null}
              {place?.tips.length ? (
                <View style={styles.block}>
                  <AppText style={[styles.h3, { color: c.textStrong }]}>{t('travel.tips')}</AppText>
                  {place.tips.map((x) => (
                    <View key={x} style={styles.tipRow}>
                      <MaterialIcons name="lightbulb-outline" size={15} color={c.accent} />
                      <AppText style={[styles.small, styles.flex, { color: c.text }]}>{x}</AppText>
                    </View>
                  ))}
                </View>
              ) : null}
              {place ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push({ pathname: '/travel/place/[id]', params: { id: place.id } })}
                  style={({ pressed }) => [styles.placeLink, { borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 }]}>
                  <AppText style={[styles.linkText, { color: c.accent }]}>{t('travel.placeDetail')}</AppText>
                  <MaterialIcons name="arrow-forward" size={16} color={c.accent} />
                </Pressable>
              ) : null}
              {stop.next && step < total - 1 ? (
                <View style={[styles.nextCard, { backgroundColor: c.hero }]}>
                  <MaterialIcons name={MODE_ICONS[stop.next.mode]} size={22} color={c.heroAccent} />
                  <View style={styles.flex}>
                    <AppText style={[styles.infoLabel, { color: c.heroMuted }]}>{t('travel.nextStop', { name: route.stops[step + 1]!.name })}</AppText>
                    <AppText style={[styles.infoValue, { color: c.heroText }]}>{stop.next.text}</AppText>
                  </View>
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Alt düğmeler */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm, backgroundColor: c.background, borderTopColor: c.border }]}>
        {step < 0 ? (
          <Pressable accessibilityRole="button" onPress={() => setStep(0)} style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.88 : 1 }]}>
            <MaterialIcons name="play-arrow" size={22} color="#081F24" />
            <AppText style={styles.primaryText}>{t('travel.startRoute')}</AppText>
          </Pressable>
        ) : done ? (
          <Pressable accessibilityRole="button" onPress={() => setStep(-1)} style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.88 : 1 }]}>
            <AppText style={styles.primaryText}>{t('travel.backToRoute')}</AppText>
          </Pressable>
        ) : (
          <View style={styles.navRow}>
            <Pressable
              accessibilityRole="button"
              disabled={step === 0}
              onPress={() => setStep(step - 1)}
              style={({ pressed }) => [styles.secondary, { borderColor: c.border, opacity: step === 0 ? 0.4 : pressed ? 0.85 : 1 }]}>
              <MaterialIcons name="arrow-back" size={18} color={c.textStrong} />
              <AppText style={[styles.secondaryText, { color: c.textStrong }]}>{t('travel.prev')}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setStep(step + 1)} style={({ pressed }) => [styles.primary, styles.flex, { opacity: pressed ? 0.88 : 1 }]}>
              <AppText style={styles.primaryText}>{step === total - 1 ? t('travel.finish') : t('travel.next')}</AppText>
              <MaterialIcons name={step === total - 1 ? 'flag' : 'arrow-forward'} size={18} color="#081F24" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const gold = '#E0B07A';
const navy = '#081F24';
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: {},
  listBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, width: '100%' },
  bar: { height: 4 },
  hero: { height: 220, justifyContent: 'flex-end', overflow: 'hidden' },
  stopHero: { height: 200, justifyContent: 'flex-end', overflow: 'hidden' },
  shade: { backgroundColor: 'rgba(8,31,36,0.45)' },
  heroText: { padding: GUTTER + 4, gap: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(8,31,36,0.6)', borderWidth: 1, borderColor: 'rgba(224,176,122,0.4)' },
  tagText: { color: gold, fontFamily: fonts.bodySemi, fontSize: 9, letterSpacing: 1.5 },
  heroTitle: { color: '#FFFFFF', fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
  heroMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  pad: { paddingHorizontal: GUTTER, paddingTop: spacing.md, gap: spacing.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
  desc: { fontSize: 15, lineHeight: 22 },
  h2: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 24 },
  h3: { fontFamily: fonts.headingSemi, fontSize: 15, lineHeight: 20 },
  small: { fontSize: 13, lineHeight: 18 },
  note: { fontSize: 11, lineHeight: 15 },
  stopRow: { flexDirection: 'row', gap: spacing.sm, minHeight: MIN_TOUCH },
  rail: { alignItems: 'center', width: 26 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dotText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  line: { width: 2, flex: 1, marginVertical: 2 },
  stopBody: { flex: 1, paddingBottom: spacing.md, gap: 2 },
  stopName: { fontFamily: fonts.headingSemi, fontSize: 15, lineHeight: 20 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  tips: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  infos: { gap: spacing.sm },
  info: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 2, borderRadius: radius.md, borderWidth: 1 },
  infoLabel: { fontSize: 11, lineHeight: 14 },
  infoValue: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 19 },
  block: { gap: spacing.sm },
  placeLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: MIN_TOUCH, borderRadius: radius.pill, borderWidth: 1 },
  linkText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: spacing.sm, paddingHorizontal: GUTTER, borderTopWidth: StyleSheet.hairlineWidth },
  navRow: { flexDirection: 'row', gap: spacing.sm, width: '100%', maxWidth: 640, alignSelf: 'center' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 50, borderRadius: radius.pill, backgroundColor: gold, paddingHorizontal: spacing.lg },
  primaryText: { color: navy, fontFamily: fonts.heading, fontSize: 15 },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 50, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.lg },
  secondaryText: { fontFamily: fonts.bodySemi, fontSize: 14 },
});
