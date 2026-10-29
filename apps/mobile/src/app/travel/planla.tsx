import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  estimateTrip,
  FUEL_TYPES,
  PREP_ITEMS,
  ROADSIDE_FEATURES,
  TRIP_MODES,
  type FuelType,
  type RoadsideFeature,
  type TripEstimate,
  type TripMode,
  type TripPlan,
} from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { CheckboxRow } from '@/components/checkbox-row';
import { GlossyIcon } from '@/components/glossy-icon';
import { HeroHeader } from '@/components/hero-header';
import { ProvincePicker } from '@/components/pickers';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { locationRepository as repo } from '@/lib/locations';
import { useRouteStops, useTravelPrices, useTripPlans } from '@/lib/trip-plan';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const MODE_LOOK: Record<TripMode, { icon: IconName; colors: readonly [string, string] }> = {
  araba: { icon: 'directions-car', colors: ['#FFB25C', '#EE6A24'] },
  otobus: { icon: 'directions-bus', colors: ['#6CB6FA', '#2165C9'] },
  ucak: { icon: 'flight', colors: ['#D59CF0', '#8B3FC8'] },
  tren: { icon: 'train', colors: ['#4FDCCB', '#11907F'] },
};
const FEATURE_ICON = Object.fromEntries(ROADSIDE_FEATURES.map((f) => [f.id, f.icon])) as Record<RoadsideFeature, IconName>;
/** TCDD Taşımacılık resmî bilet sitesi (tren seferleri ve hat bilgisi). */
const TCDD_URL = 'https://ebilet.tcddtasimacilik.gov.tr';

const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const newId = () => `p${Date.now().toString(36)}`;

/**
 * Seyahat > Planla (PROJE.md 5.2 "Yolculuk Planı"; tasarım: planlayici.html, rota.html; Eren: tek ekran). Nereden,
 * nereye, ne zaman, kaç kişi; araç türüne göre tahmini süre ve ücret (panelden girilen fiyatlarla), güzergâh çevresindeki
 * mola yerleri, varılan şehrin sayfaları, hazırlık listesi ve "Yola çık" (Yoldayım). Hiçbir şey satılmaz; planlar
 * yalnızca telefonda saklanır.
 */
export default function PlanScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const params = useLocalSearchParams<{ id?: string }>();
  const { location } = useUserLocation();
  const prices = useTravelPrices();
  const { plans, save, remove } = useTripPlans();
  const [plan, setPlan] = useState<TripPlan>(() => ({
    id: newId(),
    from: location?.provinceCode ?? '',
    to: '',
    date: isoDay(0),
    people: 1,
    mode: 'araba',
    fuel: 'benzin',
    checked: [],
    createdAt: new Date().toISOString(),
  }));
  const saved = !!plans?.some((p) => p.id === plan.id);

  // Kayıtlı plan açıldıysa (Seyahat girişindeki "Son planın") onu yükle.
  useEffect(() => {
    const p = params.id ? plans?.find((x) => x.id === params.id) : undefined;
    if (p) setPlan(p);
  }, [params.id, plans]);

  const set = (patch: Partial<TripPlan>) =>
    setPlan((p) => {
      const next = { ...p, ...patch };
      // Kayıtlı planda değişiklik (ör. hazırlık işaretleri) hemen saklanır.
      if (saved) save(next);
      return next;
    });

  const ready = !!plan.from && !!plan.to && plan.from !== plan.to;
  const estimates = useMemo(
    () => (ready ? TRIP_MODES.map((m) => estimateTrip(plan.from, plan.to, m, prices ?? null, plan.fuel)) : []),
    [ready, plan.from, plan.to, plan.fuel, prices],
  );
  const current = estimates.find((e) => e.mode === plan.mode);
  const stops = useRouteStops(ready && plan.mode === 'araba' ? plan.from : undefined, ready && plan.mode === 'araba' ? plan.to : undefined);
  const name = (code: string) => repo.getProvince(code)?.name ?? '';
  const short = (code: string) => name(code).slice(0, 3).toLocaleUpperCase('tr');

  const duration = (min: number) => {
    const h = Math.floor(min / 60);
    return h ? t('trip.hoursMinutes', { h, m: min % 60 }) : t('trip.minutes', { count: min });
  };
  const money = (n: number) => n.toLocaleString(i18n.language);
  const costText = (e: TripEstimate) =>
    e.cost ? t('plan.costRange', { min: money(e.cost.min), max: money(e.cost.max) }) : e.mode === 'ucak' || e.mode === 'tren' ? t('plan.seeOfficial') : t('plan.noPrice');

  const days = [0, 1, 2, 3, 4, 5, 6].map((o) => ({ iso: isoDay(o), label: o === 0 ? t('plan.today') : o === 1 ? t('plan.tomorrow') : new Date(isoDay(o)).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric' }) }));

  // "Yola çık": plan saklanır, Yoldayım varış iliyle açılır.
  const go = () => {
    if (!saved) save(plan);
    router.push({ pathname: '/travel/yoldayim', params: { to: plan.to } });
  };

  const header = (
    <HeroHeader title={t('plan.title')} subtitle={t('plan.subtitle')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/travel' as Href))} />
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Kayıtlı planlar (yeni plan boşken). */}
        {!ready && plans?.length ? (
          <View style={styles.section}>
            <AppText variant="label" accessibilityRole="header">{t('plan.savedPlans')}</AppText>
            {plans.map((p) => (
              <View key={p.id} style={[styles.savedRow, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Pressable accessibilityRole="button" onPress={() => setPlan(p)} style={styles.flexRow}>
                  <MaterialIcons name={MODE_LOOK[p.mode].icon} size={20} color={c.accent} />
                  <View style={styles.flex}>
                    <AppText style={[styles.savedTitle, { color: c.textStrong }]}>{`${name(p.from)} → ${name(p.to)}`}</AppText>
                    <AppText variant="caption" muted>{new Date(p.date).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', weekday: 'long' })}</AppText>
                  </View>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={t('plan.delete')} hitSlop={8} onPress={() => remove(p.id)}>
                  <MaterialIcons name="delete-outline" size={20} color={c.textSoft} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {/* Nereden - nereye. */}
        <View style={[styles.routeCard, { backgroundColor: c.surface, borderColor: c.accentBorder }]}>
          <ProvincePicker label={t('plan.from')} value={plan.from || undefined} onChange={(from) => set({ from })} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('plan.swap')}
            onPress={() => set({ from: plan.to, to: plan.from })}
            style={({ pressed }) => [styles.swap, { backgroundColor: c.accent, opacity: pressed ? 0.8 : 1 }]}>
            <MaterialIcons name="swap-vert" size={22} color={c.onPrimary} />
          </Pressable>
          <ProvincePicker label={t('plan.to')} value={plan.to || undefined} onChange={(to) => set({ to })} />
          {plan.from && plan.from === plan.to ? <AppText variant="caption" style={{ color: c.danger }}>{t('plan.sameCity')}</AppText> : null}
        </View>

        {/* Ne zaman, kaç kişi. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {days.map((d) => {
            const on = plan.date === d.iso;
            return (
              <Pressable
                key={d.iso}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => set({ date: d.iso })}
                style={[styles.chip, on ? { backgroundColor: c.accent, borderColor: c.accent } : { backgroundColor: c.surface, borderColor: c.border }]}>
                <AppText style={[styles.chipText, { color: on ? c.onPrimary : c.textStrong }]}>{d.label}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={[styles.people, { backgroundColor: c.surface, borderColor: c.border }]}>
          <MaterialIcons name="group" size={20} color={c.accent} />
          <AppText style={[styles.flex, { color: c.textStrong }]}>{t('plan.people', { count: plan.people })}</AppText>
          {stepper('remove', t('plan.fewer'), plan.people <= 1, () => set({ people: plan.people - 1 }))}
          {stepper('add', t('plan.more'), plan.people >= 9, () => set({ people: plan.people + 1 }))}
        </View>

        {!ready ? (
          <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.border }]}>
            <GlossyIcon icon="map" colors={['#4FDCCB', '#11907F']} size={56} />
            <AppText style={[styles.emptyTitle, { color: c.textStrong }]}>{t('plan.emptyTitle')}</AppText>
            <AppText variant="caption" muted style={styles.center}>{t('plan.emptyText')}</AppText>
          </View>
        ) : (
          <>
            <AppText variant="label" accessibilityRole="header">{t('plan.how')}</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modes}>
              {estimates.map((e) => {
                const on = plan.mode === e.mode;
                return (
                  <Pressable
                    key={e.mode}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on, disabled: !e.available }}
                    disabled={!e.available}
                    onPress={() => set({ mode: e.mode, checked: [] })}
                    style={({ pressed }) => [
                      styles.mode,
                      { backgroundColor: on ? c.accentSoft : c.surface, borderColor: on ? c.accent : c.border, opacity: !e.available ? 0.45 : pressed ? 0.85 : 1 },
                    ]}>
                    <GlossyIcon icon={MODE_LOOK[e.mode].icon} colors={MODE_LOOK[e.mode].colors} size={44} />
                    <AppText style={[styles.modeName, { color: c.textStrong }]}>{t(`plan.modes.${e.mode}`)}</AppText>
                    <AppText style={[styles.modeTime, { color: c.textStrong }]}>{!e.available ? t('plan.noAirport') : e.minutes ? duration(e.minutes) : '–'}</AppText>
                    <AppText variant="caption" muted numberOfLines={2}>{e.available ? costText(e) : ' '}</AppText>
                    {on ? <MaterialIcons name="check-circle" size={18} color={c.accent} style={styles.modeCheck} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            {plan.mode === 'araba' ? (
              <View style={styles.chipsWrap}>
                {FUEL_TYPES.map((f) => {
                  const on = plan.fuel === f;
                  return (
                    <Pressable
                      key={f}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => set({ fuel: f as FuelType })}
                      style={[styles.chip, on ? { backgroundColor: c.accent, borderColor: c.accent } : { backgroundColor: c.surface, borderColor: c.border }]}>
                      <AppText style={[styles.chipText, { color: on ? c.onPrimary : c.textStrong }]}>{t(`plan.fuel.${f}`)}</AppText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {/* Yolculuk planı kartı. */}
            {current ? (
              <View style={styles.planCard}>
                <View style={styles.planTop}>
                  <View style={styles.cityCode}>
                    <AppText style={styles.code}>{short(plan.from)}</AppText>
                    <AppText style={styles.codeName} numberOfLines={1}>{name(plan.from)}</AppText>
                  </View>
                  <View style={styles.line}>
                    <View style={styles.dash} />
                    <View style={styles.lineIcon}>
                      <MaterialIcons name={MODE_LOOK[plan.mode].icon} size={20} color="#1A1408" />
                    </View>
                    <View style={styles.dash} />
                  </View>
                  <View style={[styles.cityCode, styles.alignEnd]}>
                    <AppText style={styles.code}>{short(plan.to)}</AppText>
                    <AppText style={styles.codeName} numberOfLines={1}>{name(plan.to)}</AppText>
                  </View>
                </View>
                <View style={styles.planStats}>
                  {planStat('schedule', t('plan.duration'), current.minutes ? duration(current.minutes) : '–')}
                  {planStat('straighten', current.mode === 'ucak' ? t('plan.airKm') : t('plan.distance'), t('trip.km', { km: money(current.km) }))}
                  {planStat('payments', current.mode === 'otobus' ? t('plan.perPerson') : t('plan.cost'), current.cost ? `${money(current.cost.min)}–${money(current.cost.max)} TL` : '–')}
                </View>
                <AppText style={styles.planNote}>{t(`plan.notes.${current.mode}`)}</AppText>
                {current.cost && prices?.month ? <AppText style={styles.planNote}>{t('plan.priceMonth', { month: new Date(`${prices.month}-01`).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' }) })}</AppText> : null}
                {current.mode === 'tren' ? <AppButton variant="secondary" title={t('plan.tcdd')} onPress={() => Linking.openURL(TCDD_URL).catch(() => {})} /> : null}
              </View>
            ) : null}

            {/* Güzergâh çevresindeki mola yerleri (araba). */}
            {plan.mode === 'araba' ? (
              <View style={styles.section}>
                <AppText variant="label" accessibilityRole="header">{t('plan.stopsTitle')}</AppText>
                {stops === null ? (
                  <StateMessage kind="loading" />
                ) : stops.length === 0 ? (
                  <AppText variant="caption" muted>{t('plan.noStops')}</AppText>
                ) : (
                  <View style={styles.timeline}>
                    {stops.map((s, i) => (
                      <View key={s.place.id} style={styles.stop}>
                        <View style={styles.rail}>
                          <View style={[styles.dot, { backgroundColor: c.accent }]} />
                          {i < stops.length - 1 ? <View style={[styles.railLine, { backgroundColor: c.border }]} /> : null}
                        </View>
                        <View style={[styles.stopBody, { backgroundColor: c.surface, borderColor: c.border }]}>
                          <AppText style={[styles.stopKm, { color: c.accent }]}>{t('plan.atKm', { km: s.atKm })}</AppText>
                          <AppText style={[styles.stopName, { color: c.textStrong }]} numberOfLines={1}>
                            {s.place.name || (s.place.kind ? t(`roadside.kinds.${s.place.kind}`) : t('roadside.title'))}
                          </AppText>
                          {s.place.roadside.length ? (
                            <View style={styles.features}>
                              {s.place.roadside.map((f) => (
                                <MaterialIcons key={f} name={FEATURE_ICON[f]} size={16} color={c.textMuted} accessibilityLabel={t(`roadside.features.${f}`)} />
                              ))}
                            </View>
                          ) : null}
                          {s.place.source === 'osm' ? <AppText variant="caption" muted>{t('trip.osmNote')}</AppText> : null}
                        </View>
                      </View>
                    ))}
                    <AppText variant="caption" muted>{t('plan.stopsNote')}</AppText>
                  </View>
                )}
              </View>
            ) : null}

            {/* Varınca. */}
            <View style={styles.section}>
              <AppText variant="label" accessibilityRole="header">{t('plan.arrive', { city: name(plan.to) })}</AppText>
              <View style={styles.arriveGrid}>
                {arrive('explore', t('plan.cityPage'), () => router.push({ pathname: '/travel/city/[code]', params: { code: plan.to } }))}
                {arrive('diversity-3', t('plan.local'), () => router.push({ pathname: '/travel/local/[code]', params: { code: plan.to } }))}
                {arrive('record-voice-over', t('plan.mayors'), () => router.push({ pathname: '/travel/mayors/[code]', params: { code: plan.to } }))}
              </View>
            </View>

            {/* Hazırlık listesi. */}
            <View style={styles.section}>
              <AppText variant="label" accessibilityRole="header">{t('plan.prepTitle')}</AppText>
              {PREP_ITEMS[plan.mode].map((id) => (
                <CheckboxRow
                  key={id}
                  checked={plan.checked.includes(id)}
                  label={t(`plan.prep.${id}`)}
                  onToggle={() => set({ checked: plan.checked.includes(id) ? plan.checked.filter((x) => x !== id) : [...plan.checked, id] })}
                />
              ))}
            </View>

            <View style={styles.buttons}>
              {plan.mode === 'araba' ? (
                <AppButton title={t('plan.go')} onPress={go} />
              ) : null}
              <AppButton variant={plan.mode === 'araba' ? 'secondary' : 'primary'} title={saved ? t('plan.savedDone') : t('plan.save')} disabled={saved} onPress={() => save(plan)} />
              {saved ? <AppButton variant="ghost" title={t('plan.newPlan')} onPress={() => setPlan({ ...plan, id: newId(), to: '', checked: [], createdAt: new Date().toISOString() })} /> : null}
            </View>
            <AppText variant="caption" muted style={styles.center}>{t('plan.disclaimer')}</AppText>
          </>
        )}
      </ScrollView>
    </Screen>
  );

  function stepper(icon: IconName, label: string, disabled: boolean, onPress: () => void) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={4} style={[styles.step, { borderColor: c.border, opacity: disabled ? 0.4 : 1 }]}>
        <MaterialIcons name={icon} size={20} color={c.textStrong} />
      </Pressable>
    );
  }

  function planStat(icon: IconName, label: string, value: string) {
    return (
      <View style={styles.planStat} accessible accessibilityLabel={`${label}: ${value}`}>
        <MaterialIcons name={icon} size={16} color="#D9A066" />
        <AppText style={styles.planStatValue} numberOfLines={1}>{value}</AppText>
        <AppText style={styles.planStatLabel} numberOfLines={1}>{label.toLocaleUpperCase(i18n.language)}</AppText>
      </View>
    );
  }

  function arrive(icon: IconName, label: string, onPress: () => void) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.arrive, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}>
        <MaterialIcons name={icon} size={24} color={c.accent} />
        <AppText style={[styles.arriveText, { color: c.textStrong }]} numberOfLines={2}>{label}</AppText>
      </Pressable>
    );
  }
}

const NIGHT = '#0F3239';
const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  flexRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
  alignEnd: { alignItems: 'flex-end' },
  section: { gap: spacing.sm },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 4, borderRadius: radius.lg, borderWidth: 1 },
  savedTitle: { fontFamily: fonts.bodySemi, fontSize: 15 },
  routeCard: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1 },
  swap: { alignSelf: 'center', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginVertical: -spacing.xs },
  chips: { gap: spacing.xs + 2, paddingVertical: 2 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  chip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  people: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 2, paddingStart: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  step: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 17, textAlign: 'center' },
  modes: { gap: spacing.sm, paddingVertical: 2 },
  mode: { width: 132, gap: 4, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1.5 },
  modeName: { fontFamily: fonts.bodySemi, fontSize: 14, marginTop: 4 },
  modeTime: { fontFamily: fonts.heading, fontSize: 17 },
  modeCheck: { position: 'absolute', top: 10, right: 10 },
  planCard: { gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, backgroundColor: NIGHT },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cityCode: { width: 84 },
  code: { color: '#FFFFFF', fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
  codeName: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  line: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dash: { flex: 1, height: 2, backgroundColor: 'rgba(217,160,102,0.6)', borderRadius: 1 },
  lineIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D9A066', alignItems: 'center', justifyContent: 'center', marginHorizontal: 6 },
  planStats: { flexDirection: 'row', gap: spacing.sm },
  planStat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.07)' },
  planStatValue: { color: '#FFFFFF', fontFamily: fonts.heading, fontSize: 14 },
  planStatLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, letterSpacing: 0.8 },
  planNote: { color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 17 },
  timeline: { gap: 0 },
  stop: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: 16, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 16 },
  railLine: { width: 2, flex: 1 },
  stopBody: { flex: 1, gap: 2, padding: spacing.sm + 2, borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.sm },
  stopKm: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.5 },
  stopName: { fontFamily: fonts.bodySemi, fontSize: 15 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  arriveGrid: { flexDirection: 'row', gap: spacing.sm },
  arrive: { flex: 1, alignItems: 'center', gap: 6, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, minHeight: 92 },
  arriveText: { fontFamily: fonts.bodySemi, fontSize: 12, textAlign: 'center' },
  buttons: { gap: spacing.sm },
});
