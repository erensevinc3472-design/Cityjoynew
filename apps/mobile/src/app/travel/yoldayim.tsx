import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Animated, Linking, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { distanceKm, openState, PROVINCE_CENTERS, rankRoadsideStops, ROADSIDE_FEATURES, type RoadsideFeature, type RoadsideStop } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { GlossyIcon } from '@/components/glossy-icon';
import { RoundButton } from '@/components/hero-header';
import { NightRoad, NIGHT_ROAD_HEIGHT } from '@/components/night-road';
import { locationRepository as repo } from '@/lib/locations';
import { useNearbyRoadside, useTrip } from '@/lib/trip';
import { fonts, radius, spacing } from '@/theme/tokens';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** Yolcunun ihtiyaçları ve karşılayan olanaklar (Yemek: restoran ya da kafe; Yakıt: akaryakıt ya da LPG). */
const NEEDS: { id: string; icon: IconName; colors: readonly [string, string]; features: RoadsideFeature[] }[] = [
  { id: 'tuvalet', icon: 'wc', colors: ['#6CB6FA', '#2165C9'], features: ['tuvalet'] },
  { id: 'yakit', icon: 'local-gas-station', colors: ['#FFB25C', '#EE6A24'], features: ['akaryakit', 'lpg'] },
  { id: 'yemek', icon: 'restaurant', colors: ['#F78FB6', '#D3336F'], features: ['restoran', 'kafe'] },
  { id: 'sarj', icon: 'ev-station', colors: ['#7FDB86', '#2E9B48'], features: ['sarj'] },
  { id: 'mescit', icon: 'mosque', colors: ['#4FDCCB', '#11907F'], features: ['mescit'] },
];
const FEATURE_ICON = Object.fromEntries(ROADSIDE_FEATURES.map((f) => [f.id, f.icon])) as Record<RoadsideFeature, IconName>;
/** Tahmini süre bu ortalama hızla hesaplanır (km/s). */
const AVG_KMH = 80;
/** Bu kadar süre yolda kalınca mola önerilir. */
const BREAK_AFTER_MS = 2 * 60 * 60 * 1000;

/** Mesafe: 10 km altında bir ondalık, dilin ondalık işaretiyle ("5,4 km"). */
const kmText = (km: number, lang: string) => km.toLocaleString(lang, { maximumFractionDigits: km < 10 ? 1 : 0 });

const N = { bg: '#0B2229', card: '#123038', cardHi: '#16404A', line: 'rgba(255,255,255,0.08)', text: '#FFFFFF', muted: 'rgba(255,255,255,0.68)', gold: '#D9A066', teal: '#25C6CF', ink: '#1A1408' };

/**
 * Yoldayım (Yol Arkadaşı, PROJE.md 5.2; Eren'in fikri): yolculuk sırasında tuvalet, yakıt, yemek, şarj ve mescit
 * ihtiyacına göre gidilen yöndeki en yakın yol üstü tesisler. Yol tarifi haritalar uygulamasında açılır. Konum
 * yalnızca ekran açıkken kullanılır.
 */
export default function OnTheRoadScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const trip = useTrip();
  // Planla'dan "Yola çık" ile gelindiyse varış ili: kalan yol (kuş uçuşu x 1,3, yaklaşık) ve varınca kutlama.
  const { to } = useLocalSearchParams<{ to?: string }>();
  const dest = to ? PROVINCE_CENTERS[to] : undefined;
  const leftKm = dest && trip.pos ? distanceKm(trip.pos, dest) * 1.3 : null;
  const arrived = leftKm !== null && leftKm < 15;
  const { list, failed, reload } = useNearbyRoadside(trip.pos);
  const [need, setNeed] = useState<string | null>(null);
  const [warned, setWarned] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const features = NEEDS.find((n) => n.id === need)?.features;
  const stops = useMemo(
    () => (trip.pos && list ? rankRoadsideStops(list, trip.pos, { need: features, heading: trip.heading }) : []),
    [list, trip.pos, trip.heading, features],
  );
  const elapsed = now - trip.startedAt;
  const breakStop = useMemo(
    () => (trip.pos && list && elapsed >= BREAK_AFTER_MS ? rankRoadsideStops(list, trip.pos, { need: ['kafe', 'restoran'], heading: trip.heading }).find((s) => s.where !== 'geride') : undefined),
    [list, trip.pos, trip.heading, elapsed],
  );

  const duration = (ms: number) => {
    const m = Math.floor(ms / 60_000);
    return m < 60 ? t('trip.minutes', { count: m }) : t('trip.hoursMinutes', { h: Math.floor(m / 60), m: m % 60 });
  };
  const compass = trip.heading == null ? '–' : t(`trip.dir.${['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'][Math.round(trip.heading / 45) % 8]}`);
  const directions = (s: RoadsideStop) => {
    const at = `${s.place.geo.lat},${s.place.geo.lng}`;
    Linking.openURL(Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${at}` : `https://www.google.com/maps/dir/?api=1&destination=${at}`).catch(() => {});
  };
  // Kayıtlı işletmenin sayfası açılır; OSM yerinin sayfası yok, yol tarifi açılır.
  const open = (s: RoadsideStop) => (s.place.business ? router.push({ pathname: '/business/[id]', params: { id: s.place.business.id } }) : directions(s));

  return (
    <View style={[styles.root, { backgroundColor: N.bg }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
        <View style={{ height: NIGHT_ROAD_HEIGHT + insets.top }}>
          <View style={{ position: 'absolute', bottom: 0 }}>
            <NightRoad width={width} moving={trip.state === 'ready'} />
          </View>
          <View style={[StyleSheet.absoluteFill, { height: insets.top, backgroundColor: '#071A22' }]} />
          <View style={[styles.header, { top: insets.top + spacing.sm }]}>
            <RoundButton icon="arrow-back" label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/travel' as Href))} />
            <View style={styles.brand}>
              <MaterialIcons name="route" size={17} color={N.teal} />
              <AppText accessibilityRole="header" style={styles.brandText}>{t('trip.title')}</AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('trip.call112')}
              onPress={() => Linking.openURL('tel:112').catch(() => {})}
              style={({ pressed }) => [styles.sos, { opacity: pressed ? 0.8 : 1 }]}>
              <AppText style={styles.sosText}>112</AppText>
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.stats}>
            {stat('schedule', t('trip.onRoad'), duration(elapsed))}
            {stat('add-road', t('trip.distance'), t('trip.km', { km: kmText(trip.km, i18n.language) }))}
            {stat('explore', t('trip.heading'), compass)}
          </View>

          {to && dest && leftKm !== null ? (
            arrived ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/travel/city/[code]', params: { code: to } })}
                style={({ pressed }) => [styles.arrived, { opacity: pressed ? 0.85 : 1 }]}>
                <AppText style={styles.breakEmoji}>🎉</AppText>
                <View style={styles.flex}>
                  <AppText style={styles.breakTitle}>{t('trip.arrivedTitle', { city: repo.getProvince(to)?.name ?? '' })}</AppText>
                  <AppText style={styles.breakText}>{t('trip.arrivedText')}</AppText>
                </View>
                <MaterialIcons name="arrow-forward" size={22} color={N.gold} />
              </Pressable>
            ) : (
              <View style={[styles.dest, { borderColor: N.line }]}>
                <MaterialIcons name="flag" size={20} color={N.teal} />
                <AppText style={styles.destText}>{t('trip.toCity', { city: repo.getProvince(to)?.name ?? '', km: kmText(leftKm, i18n.language) })}</AppText>
              </View>
            )
          ) : null}

          {warned ? (
            <View style={[styles.warn, { borderColor: N.line }]}>
              <MaterialIcons name="airline-seat-recline-normal" size={20} color={N.gold} />
              <AppText style={[styles.warnText, { color: N.muted }]}>{t('trip.passengerNote')}</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8} onPress={() => setWarned(false)}>
                <MaterialIcons name="close" size={18} color={N.muted} />
              </Pressable>
            </View>
          ) : null}

          <AppText style={styles.ask}>{t('trip.ask')}</AppText>
          <View style={styles.needs}>
            {NEEDS.map((n) => (
              <NeedButton key={n.id} label={t(`trip.needs.${n.id}`)} icon={n.icon} colors={n.colors} active={need === n.id} onPress={() => setNeed(need === n.id ? null : n.id)} />
            ))}
          </View>
          <AppText style={[styles.caption, { color: N.muted }]}>{need ? t('trip.tapAgain') : t('trip.showingAll')}</AppText>

          {breakStop ? (
            <Pressable accessibilityRole="button" onPress={() => open(breakStop)} style={({ pressed }) => [styles.break, { opacity: pressed ? 0.85 : 1 }]}>
              <AppText style={styles.breakEmoji}>☕</AppText>
              <View style={styles.flex}>
                <AppText style={styles.breakTitle}>{t('trip.breakTitle', { time: duration(elapsed) })}</AppText>
                <AppText style={styles.breakText}>{t('trip.breakText', { name: breakStop.place.name || t(`roadside.kinds.${breakStop.place.kind ?? 'yol-dinlenme-tesisi'}`), km: kmText(breakStop.km, i18n.language) })}</AppText>
              </View>
            </Pressable>
          ) : null}

          {trip.state === 'denied' || trip.state === 'unavailable' ? (
            <EmptyCard
              icon="location-off"
              title={t(trip.state === 'denied' ? 'trip.deniedTitle' : 'trip.unavailableTitle')}
              text={t(trip.state === 'denied' ? 'trip.deniedText' : 'trip.unavailableText')}
              action={t('trip.retry')}
              onAction={trip.retry}
            />
          ) : trip.state === 'waiting' || list === null ? (
            <EmptyCard icon="radar" title={t('trip.scanning')} text={t('trip.scanningText')} />
          ) : failed && !list.length ? (
            <EmptyCard icon="wifi-off" title={t('trip.loadError')} text={t('trip.loadErrorText')} action={t('trip.retry')} onAction={reload} />
          ) : stops.length === 0 ? (
            <EmptyCard
              icon="add-road"
              title={t(need ? 'trip.noneForNeed' : 'trip.none')}
              text={t('trip.noneText')}
              action={t('trip.addYours')}
              onAction={() => router.push('/business/edit')}
            />
          ) : (
            <>
              <StopHero stop={stops[0]} onDirections={() => directions(stops[0])} onOpen={() => open(stops[0])} />
              {stops.slice(1, 12).map((s) => (
                <StopRow key={s.place.id} stop={s} onDirections={() => directions(s)} onOpen={() => open(s)} />
              ))}
            </>
          )}
          <AppText style={[styles.footnote, { color: N.muted }]}>{t('trip.footnote', { kmh: AVG_KMH })} {t('trip.osmCredit')}</AppText>
        </View>
      </ScrollView>
    </View>
  );
}

function stat(icon: IconName, label: string, value: string) {
  return (
    <View style={[styles.stat, { backgroundColor: N.card, borderColor: N.line }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <MaterialIcons name={icon} size={16} color={N.gold} />
      <AppText style={styles.statValue} numberOfLines={1}>{value}</AppText>
      <AppText style={[styles.statLabel, { color: N.muted }]} numberOfLines={1}>{label}</AppText>
    </View>
  );
}

/** Büyük, renkli ihtiyaç düğmesi; seçilince altın halka ve küçük bir zıplama. */
function NeedButton({ label, icon, colors, active, onPress }: { label: string; icon: IconName; colors: readonly [string, string]; active: boolean; onPress(): void }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.12, useNativeDriver: true, speed: 40, bounciness: 14 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }),
    ]).start();
  }, [active, scale]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={styles.need}>
      <Animated.View style={[styles.ring, { borderColor: active ? N.gold : 'transparent', transform: [{ scale }] }]}>
        <GlossyIcon icon={icon} colors={colors} size={52} dim={false} />
      </Animated.View>
      <AppText style={[styles.needLabel, { color: active ? N.gold : N.text }]} numberOfLines={1}>{label}</AppText>
    </Pressable>
  );
}

function useStopText(s: RoadsideStop) {
  const { t, i18n } = useTranslation();
  const p = s.place;
  const minutes = Math.max(1, Math.round((s.km / AVG_KMH) * 60));
  const kind = p.kind ? t(`roadside.kinds.${p.kind}`) : undefined;
  const state = p.business ? openState(p.business, new Date()) : null;
  return {
    // Adı olmayan OSM yerinde çeşidi yazılır ("Akaryakıt istasyonu").
    name: p.name || kind || t('roadside.title'),
    // OSM kaydı: markası ve "doğrulanmadı" notu.
    sub: [p.name ? kind : undefined, p.brand, p.source === 'osm' ? t('trip.osmNote') : undefined],
    km: s.km < 1 ? t('trip.meters', { m: Math.round(s.km * 100) * 10 }) : t('trip.km', { km: kmText(s.km, i18n.language) }),
    eta: minutes < 60 ? t('trip.eta', { time: t('trip.minutes', { count: minutes }) }) : t('trip.eta', { time: t('trip.hoursMinutes', { h: Math.floor(minutes / 60), m: minutes % 60 }) }),
    where: t(`trip.where.${s.where}`),
    kind,
    open: state ? (state.open ? t('trip.open') : t('trip.closed')) : null,
    isOpen: state?.open,
  };
}

function Features({ list, size = 16 }: { list: RoadsideFeature[]; size?: number }) {
  const { t } = useTranslation();
  return (
    <View style={styles.features}>
      {list.map((f) => (
        <View key={f} accessible accessibilityLabel={t(`roadside.features.${f}`)} style={[styles.feature, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
          <MaterialIcons name={FEATURE_ICON[f]} size={size} color={N.text} />
        </View>
      ))}
    </View>
  );
}

function StopHero({ stop, onDirections, onOpen }: { stop: RoadsideStop; onDirections(): void; onOpen(): void }) {
  const { t } = useTranslation();
  const x = useStopText(stop);
  return (
    <View style={[styles.hero, { backgroundColor: N.cardHi, borderColor: N.gold }]}>
      <View style={styles.heroTop}>
        <View style={[styles.badge, { backgroundColor: N.gold }]}>
          <AppText style={styles.badgeText}>{t('trip.nearest')}</AppText>
        </View>
        <AppText style={[styles.where, { color: stop.where === 'geride' ? N.muted : N.teal }]}>{x.where}</AppText>
      </View>
      <View style={styles.heroMain}>
        <View style={styles.flex}>
          <AppText style={styles.heroKm}>{x.km}</AppText>
          <AppText style={[styles.eta, { color: N.muted }]}>{x.eta}</AppText>
        </View>
        <MaterialIcons name="near-me" size={34} color={N.gold} />
      </View>
      <Pressable accessibilityRole="button" onPress={onOpen}>
        <AppText style={styles.heroName} numberOfLines={2}>{x.name}</AppText>
        <AppText style={[styles.meta, { color: N.muted }]} numberOfLines={1}>
          {[...x.sub, x.open].filter(Boolean).join(' · ')}
        </AppText>
      </Pressable>
      <Features list={stop.place.roadside} size={18} />
      <View style={styles.heroButtons}>
        <Pressable accessibilityRole="button" onPress={onDirections} style={({ pressed }) => [styles.go, { opacity: pressed ? 0.85 : 1 }]}>
          <MaterialIcons name="directions" size={20} color={N.ink} />
          <AppText style={styles.goText}>{t('roadside.directions')}</AppText>
        </Pressable>
        {stop.place.business ? (
          <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.more, { opacity: pressed ? 0.7 : 1 }]}>
            <AppText style={styles.moreText}>{t('trip.details')}</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function StopRow({ stop, onDirections, onOpen }: { stop: RoadsideStop; onDirections(): void; onOpen(): void }) {
  const { t } = useTranslation();
  const x = useStopText(stop);
  return (
    // Satır ve yol tarifi yan yana iki ayrı düğme (iç içe düğme olmaz).
    <View style={[styles.row, { backgroundColor: N.card, borderColor: N.line }]}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.rowMain, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={styles.rowKm}>
          <AppText style={styles.rowKmText}>{x.km}</AppText>
          <AppText style={[styles.rowWhere, { color: stop.where === 'geride' ? N.muted : N.teal }]}>{x.where}</AppText>
        </View>
        <View style={styles.flex}>
          <AppText style={styles.rowName} numberOfLines={1}>{x.name}</AppText>
          {stop.place.roadside.length ? <Features list={stop.place.roadside} size={14} /> : null}
          {x.sub.some(Boolean) ? <AppText style={[styles.rowSub, { color: N.muted }]} numberOfLines={1}>{x.sub.filter(Boolean).join(' · ')}</AppText> : null}
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t('roadside.directions')}: ${x.name}`} hitSlop={6} onPress={onDirections} style={styles.rowGo}>
        <MaterialIcons name="directions" size={22} color={N.gold} />
      </Pressable>
    </View>
  );
}

function EmptyCard({ icon, title, text, action, onAction }: { icon: IconName; title: string; text: string; action?: string; onAction?(): void }) {
  return (
    <View style={[styles.empty, { backgroundColor: N.card, borderColor: N.line }]}>
      <View style={styles.emptyIcon}>
        <MaterialIcons name={icon} size={30} color={N.gold} />
      </View>
      <AppText style={styles.emptyTitle}>{title}</AppText>
      <AppText style={[styles.emptyText, { color: N.muted }]}>{text}</AppText>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.more, { opacity: pressed ? 0.7 : 1, alignSelf: 'center' }]}>
          <AppText style={styles.moreText}>{action}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: { position: 'absolute', left: spacing.lg, right: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  brandText: { color: N.text, fontFamily: fonts.heading, fontSize: 16 },
  sos: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#D63A3A', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  sosText: { color: N.text, fontFamily: fonts.heading, fontSize: 14 },
  body: { paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: -18 },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1 },
  statValue: { color: N.text, fontFamily: fonts.heading, fontSize: 15 },
  statLabel: { fontSize: 10, letterSpacing: 0.5 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 2, borderRadius: radius.lg, borderWidth: 1 },
  warnText: { flex: 1, fontSize: 12, lineHeight: 17 },
  ask: { color: N.text, fontFamily: fonts.display, fontSize: 22, marginTop: spacing.xs },
  needs: { flexDirection: 'row', justifyContent: 'space-between' },
  need: { alignItems: 'center', gap: 6, minWidth: 60 },
  ring: { padding: 3, borderRadius: 22, borderWidth: 2 },
  needLabel: { fontFamily: fonts.bodySemi, fontSize: 12 },
  caption: { fontSize: 11, textAlign: 'center', marginTop: -spacing.xs },
  break: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, backgroundColor: '#3A2A12', borderWidth: 1, borderColor: N.gold },
  breakEmoji: { fontSize: 30 },
  breakTitle: { color: N.gold, fontFamily: fonts.heading, fontSize: 15 },
  breakText: { color: N.text, fontSize: 13, lineHeight: 18 },
  dest: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 4, borderRadius: radius.lg, borderWidth: 1, backgroundColor: N.card },
  destText: { flex: 1, color: N.text, fontFamily: fonts.heading, fontSize: 15 },
  arrived: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, backgroundColor: '#123F3A', borderWidth: 1, borderColor: N.teal },
  hero: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1.5 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { color: N.ink, fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.5 },
  where: { fontFamily: fonts.bodySemi, fontSize: 12 },
  heroMain: { flexDirection: 'row', alignItems: 'center' },
  heroKm: { color: N.text, fontFamily: fonts.display, fontSize: 40, lineHeight: 46 },
  eta: { fontSize: 13 },
  heroName: { color: N.text, fontFamily: fonts.heading, fontSize: 18, lineHeight: 23 },
  meta: { fontSize: 12, marginTop: 2 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  feature: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  heroButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  go: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: radius.pill, backgroundColor: N.gold },
  goText: { color: N.ink, fontFamily: fonts.heading, fontSize: 15 },
  more: { minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  moreText: { color: N.text, fontFamily: fonts.bodySemi, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm + 4, borderRadius: radius.lg, borderWidth: 1 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowKm: { width: 66, alignItems: 'center' },
  rowKmText: { color: N.text, fontFamily: fonts.heading, fontSize: 17 },
  rowWhere: { fontSize: 10, fontFamily: fonts.bodySemi },
  rowSub: { fontSize: 11, marginTop: 2 },
  rowName: { color: N.text, fontFamily: fonts.bodySemi, fontSize: 14, marginBottom: 4 },
  rowGo: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(217,160,102,0.14)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: N.text, fontFamily: fonts.heading, fontSize: 16, textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  footnote: { fontSize: 11, textAlign: 'center' },
});
