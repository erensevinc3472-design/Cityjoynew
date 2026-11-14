import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  alternativesFor,
  buildPlan,
  canPlan,
  hhmm,
  moveToNextDay,
  nowInDay,
  placeImage,
  PLAN_INTERESTS,
  PLAN_MAX_DAYS,
  removeStop,
  replaceStop,
  weekdayOf,
  type Itinerary,
  type PlanPace,
  type TravelCategory,
  type TravelPlace,
} from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FilterChip, ListRow, ListSurface, SectionTitle, Tag } from '@/components/inner';
import { BLEED_STRIP, BLEED_STRIP_CONTENT, PageHead, PAGE_CONTENT, usePageBottom } from '@/components/page-head';
import { CoverArt, sceneSky } from '@/components/scene-art';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { locationRepository as repo } from '@/lib/locations';
import { CATEGORY_SCENES, useDurationText, useTravelCity, useTravelPlaces, useTravelRoutes } from '@/lib/travel';
import { clearTrip, loadTrip, nowLocal, saveTrip, useMoveText, useTripOrigin } from '@/lib/trip-plan';
import { fonts, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const INTERESTS = PLAN_INTERESTS.filter((x) => x !== 'lezzet');

/**
 * Gezimi planla (Karar, Eren, 12 Kasım 2026; Hazır Rotalar'ın yerine). Kişi gün sayısını, ilgi alanlarını ve temposunu
 * seçer; program kurallarla kurulur (yapay zekâ yok, istek başına ücret yok). Gün gün saatli program, yemek molaları,
 * cuma namazı saati, kapalı günler. Durağa dokununca değiştir, yarına taşı, çıkar. Bugünkü günde şu anki durak öne çıkar.
 * Program yalnızca bu cihazda saklanır. Belediyenin ve panelden girilen hazır rotalar "Hazır planlar" olarak kalır.
 */
export default function TravelPlanScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const bottom = usePageBottom();
  const duration = useDurationText();
  const moveText = useMoveText();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { value: city } = useTravelCity(code);
  const { value: places, failed, retry } = useTravelPlaces(code);
  const { value: routes } = useTravelRoutes(code);
  const { origin, source, loading: locating, locate } = useTripOrigin(code, false);
  const name = repo.getProvince(code)?.name ?? '';
  const cover = city?.cover ?? undefined;
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/travel/city/[code]', params: { code } }));
  const today = nowLocal();

  const [plan, setPlan] = useState<Itinerary | null>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [day, setDay] = useState(0);
  const [days, setDays] = useState(2);
  const [interests, setInterests] = useState<TravelCategory[]>([]);
  const [pace, setPace] = useState<PlanPace>('dolu');
  const [startTomorrow, setStartTomorrow] = useState(false);
  const [sheet, setSheet] = useState<{ placeId: string; swap: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    loadTrip(code).then((p) => {
      if (!live) return;
      if (p?.days.length) {
        setPlan(p);
        setDays(p.prefs.days);
        setInterests(p.prefs.interests);
        setPace(p.prefs.pace);
        const i = p.days.findIndex((d) => d.date === nowLocal().date);
        setDay(i >= 0 ? i : 0);
      }
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [code]);

  const byId = useMemo(() => new Map((places ?? []).map((p) => [p.id, p])), [places]);
  const update = (next: Itinerary) => {
    setPlan(next);
    saveTrip(next);
  };

  const build = () => {
    if (!places) return;
    const start = new Date();
    if (startTomorrow) start.setDate(start.getDate() + 1);
    const next = buildPlan(code, places, { days, interests, pace, startDate: nowLocal(start).date, ...(source === 'gps' && origin ? { from: origin } : {}) });
    update(next);
    setDay(0);
    setEditing(false);
  };

  const reset = async () => {
    await clearTrip(code);
    setPlan(null);
    setEditing(false);
  };

  const dateLabel = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' });

  const thumb = (p: TravelPlace, size = 48) => {
    const scene = CATEGORY_SCENES[p.category];
    return (
      <View style={[styles.thumb, { width: size, height: size, backgroundColor: sceneSky(scene) }]}>
        <CoverArt photo={placeImage(p)} kind={scene} still />
      </View>
    );
  };

  const loadingState =
    failed && !places ? <StateMessage kind="error" onRetry={retry} /> : places === null || !ready ? <StateMessage kind="loading" /> : null;

  // Hazır planlar: panelden ve belediyeden girilen rotalar.
  const ready_ = (routes ?? []).slice(0, 6);
  const readyPlans = ready_.length ? (
    <>
      <SectionTitle title={t('travel.readyPlans')} />
      <ListSurface>
        {ready_.map((r, i) => (
          <ListRow
            key={r.id}
            first={i === 0}
            title={r.title}
            subtitle={`${t('travel.stops', { count: r.stops.length })} · ${duration(r.durationMinutes)}`}
            onPress={() => router.push({ pathname: '/travel/route/[id]', params: { id: r.id } })}
            leading={<MaterialIcons name="route" size={22} color={c.accent} />}
          />
        ))}
      </ListSurface>
    </>
  ) : null;

  const showSetup = !plan || editing;
  const current = plan?.days[day];
  const placesIn = (plan?.days ?? []).flatMap((d) => d.items.filter((x) => x.kind === 'place'));
  const now = current && current.date === today.date ? nowInDay(current, today.minutes) : null;
  const friday = current && weekdayOf(current.date) === 5 && (places ?? []).some((p) => p.hours?.prayer);
  const sheetPlace = sheet ? byId.get(sheet.placeId) : undefined;

  return (
    <Screen bleed cover={cover}>
      <ScrollView contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false}>
        <PageHead
          cover={cover}
          extend={6}
          title={t('travel.planTitle')}
          subtitle={plan && !editing ? t('travel.planSummary', { name, days: plan.days.length, count: placesIn.length }) : name}
          onBack={editing && plan ? () => setEditing(false) : back}
        />

        {loadingState}

        {!loadingState && places && !canPlan(places) ? (
          <>
            <StateMessage kind="empty" message={t('travel.planNone')} />
            {readyPlans}
          </>
        ) : null}

        {!loadingState && places && canPlan(places) && showSetup ? (
          <>
            <AppText style={[styles.intro, { color: c.textMuted }]}>{t('travel.planIntro')}</AppText>

            <SectionTitle title={t('travel.planDays')} />
            <View style={styles.wrap}>
              {Array.from({ length: PLAN_MAX_DAYS }, (_, i) => i + 1).map((n) => (
                <FilterChip key={n} label={t('travel.dayCount', { count: n })} active={days === n} onPress={() => setDays(n)} />
              ))}
            </View>

            <SectionTitle title={t('travel.planStart')} />
            <View style={styles.wrap}>
              <FilterChip label={t('travel.today')} active={!startTomorrow} onPress={() => setStartTomorrow(false)} />
              <FilterChip label={t('travel.tomorrow')} active={startTomorrow} onPress={() => setStartTomorrow(true)} />
            </View>

            <SectionTitle title={t('travel.planInterests')} aside={t('travel.planInterestsHint')} />
            <View style={styles.wrap}>
              {INTERESTS.map((x) => (
                <FilterChip
                  key={x}
                  label={t(`travel.cats.${x}`)}
                  active={interests.includes(x)}
                  onPress={() => setInterests((s) => (s.includes(x) ? s.filter((y) => y !== x) : [...s, x]))}
                />
              ))}
            </View>

            <SectionTitle title={t('travel.planPace')} />
            <View style={styles.paceRow}>
              {(['sakin', 'dolu'] as PlanPace[]).map((p) => {
                const on = pace === p;
                return (
                  <Pressable
                    key={p}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    onPress={() => setPace(p)}
                    style={[styles.pace, { backgroundColor: on ? c.accentSoft : c.surface, borderColor: on ? c.accent : c.border }]}>
                    <MaterialIcons name={p === 'sakin' ? 'self-improvement' : 'bolt'} size={22} color={on ? c.accent : c.textMuted} />
                    <AppText style={[styles.paceTitle, { color: c.textStrong }]}>{t(`travel.pace.${p}`)}</AppText>
                    <AppText style={[styles.paceHint, { color: c.textMuted }]}>{t(`travel.pace.${p}Hint`)}</AppText>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.note, { backgroundColor: c.surface, borderColor: c.border }]}>
              <MaterialIcons name={source === 'gps' ? 'my-location' : 'location-city'} size={18} color={c.accent} />
              <AppText style={[styles.noteText, { color: c.textMuted }]}>
                {locating ? t('travel.nearbyLocating') : source === 'gps' ? t('travel.planFromMe') : t('travel.planFromCenter', { name })}
              </AppText>
              {!locating && source !== 'gps' ? (
                <Pressable accessibilityRole="button" onPress={locate} hitSlop={8}>
                  <AppText style={[styles.link, { color: c.accent }]}>{t('travel.useMyLocation')}</AppText>
                </Pressable>
              ) : null}
            </View>

            <AppButton title={plan ? t('travel.planRebuild') : t('travel.planBuild')} onPress={build} />
            {!plan ? readyPlans : null}
          </>
        ) : null}

        {!loadingState && plan && !editing && current ? (
          <>
            {plan.days.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={BLEED_STRIP} contentContainerStyle={[BLEED_STRIP_CONTENT, styles.wrap]}>
                {plan.days.map((d, i) => (
                  <FilterChip key={d.date} label={`${t('travel.dayN', { n: i + 1 })} · ${dateLabel(d.date)}`} active={i === day} onPress={() => setDay(i)} />
                ))}
              </ScrollView>
            ) : (
              <AppText style={[styles.intro, { color: c.textMuted }]}>{dateLabel(current.date)}</AppText>
            )}

            {friday ? (
              <View style={[styles.note, { backgroundColor: c.accentSoft, borderColor: c.accent }]}>
                <MaterialIcons name="mosque" size={18} color={c.accent} />
                <AppText style={[styles.noteText, { color: c.textStrong }]}>{t('travel.planFriday')}</AppText>
              </View>
            ) : null}

            <View style={styles.timeline}>
              {current.items.map((it, i) => {
                const isNow = now?.index === i;
                const mark = isNow ? <Tag label={now!.current ? t('travel.planNow') : t('travel.planNext')} tone="gold" /> : null;
                if (it.kind === 'meal') {
                  const food = it.foodId ? byId.get(it.foodId) : undefined;
                  return (
                    <View key={`meal-${it.meal}`} style={styles.step}>
                      <AppText style={[styles.time, { color: c.textSoft }]}>{hhmm(it.start)}</AppText>
                      <Pressable
                        accessibilityRole={food ? 'button' : undefined}
                        disabled={!food}
                        onPress={() => food && router.push({ pathname: '/travel/place/[id]', params: { id: food.id } })}
                        style={[styles.meal, { borderColor: isNow ? c.accent : c.border }]}>
                        <MaterialIcons name="restaurant" size={20} color={c.accent} />
                        <View style={styles.flex}>
                          <AppText style={[styles.itemTitle, { color: c.textStrong }]}>{t(`travel.meal.${it.meal}`)}</AppText>
                          <AppText style={[styles.itemSub, { color: c.textMuted }]} numberOfLines={1}>
                            {food ? t('travel.mealTry', { name: food.name }) : duration(it.end - it.start)}
                          </AppText>
                        </View>
                        {mark}
                      </Pressable>
                    </View>
                  );
                }
                const p = byId.get(it.placeId);
                if (!p) return null;
                return (
                  <View key={it.placeId}>
                    {it.move ? (
                      <View style={styles.move}>
                        <View style={[styles.moveLine, { backgroundColor: c.border }]} />
                        <MaterialIcons name={it.move.mode === 'yuruyus' ? 'directions-walk' : 'directions-car'} size={14} color={c.textSoft} />
                        <AppText style={[styles.moveText, { color: c.textSoft }]}>{moveText(it.move)}</AppText>
                      </View>
                    ) : null}
                    <View style={styles.step}>
                      <AppText style={[styles.time, { color: c.textStrong }]}>{hhmm(it.start)}</AppText>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${hhmm(it.start)}, ${p.name}`}
                        onPress={() => setSheet({ placeId: p.id, swap: false })}
                        style={({ pressed }) => [
                          styles.card,
                          { backgroundColor: c.surface, borderColor: isNow ? c.accent : c.border, borderWidth: isNow ? 1.5 : 1, opacity: pressed ? 0.85 : 1 },
                        ]}>
                        {thumb(p)}
                        <View style={styles.flex}>
                          <AppText style={[styles.itemTitle, { color: c.textStrong }]} numberOfLines={2}>{p.name}</AppText>
                          <AppText style={[styles.itemSub, { color: c.textMuted }]} numberOfLines={1}>
                            {`${hhmm(it.start)}–${hhmm(it.end)} · ${p.kind}`}
                          </AppText>
                          {it.warn ? <AppText style={[styles.warn, { color: c.danger }]}>{t(`travel.planWarn.${it.warn}`)}</AppText> : null}
                        </View>
                        {mark ?? <MaterialIcons name="more-horiz" size={20} color={c.textSoft} />}
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>

            {!current.items.some((x) => x.kind === 'place') ? <StateMessage kind="empty" message={t('travel.planDayEmpty')} /> : null}

            <AppText style={[styles.small, { color: c.textSoft }]}>{t('travel.planApprox')}</AppText>
            <View style={styles.actions}>
              <View style={styles.flex}>
                <AppButton variant="secondary" title={t('travel.planChange')} onPress={() => setEditing(true)} />
              </View>
              <View style={styles.flex}>
                <AppButton variant="ghost" title={t('travel.planClear')} onPress={reset} />
              </View>
            </View>
            {readyPlans}
          </>
        ) : null}
      </ScrollView>

      <StopSheet
        open={!!sheet && !!sheetPlace}
        onClose={() => setSheet(null)}
        title={sheetPlace?.name ?? ''}
        thumb={sheetPlace ? thumb(sheetPlace, 56) : null}
        subtitle={sheetPlace?.kind ?? ''}>
        {sheet && sheetPlace && plan ? (
          sheet.swap ? (
            <>
              <AppText style={[styles.sheetHint, { color: c.textMuted }]}>{t('travel.planSwapHint')}</AppText>
              <ListSurface>
                {alternativesFor(plan, day, sheet.placeId, places ?? []).map((a, i) => (
                  <ListRow
                    key={a.place.id}
                    first={i === 0}
                    title={a.place.name}
                    subtitle={[a.move ? moveText(a.move) : null, a.place.kind].filter(Boolean).join(' · ')}
                    leading={thumb(a.place, 44)}
                    trailing={a.fits ? null : <Tag label={t('travel.planWarn.kapali')} tone="red" />}
                    onPress={() => {
                      update(replaceStop(plan, day, sheet.placeId, a.place.id, places ?? []));
                      setSheet(null);
                    }}
                  />
                ))}
              </ListSurface>
            </>
          ) : (
            <ListSurface>
              <ListRow
                first
                title={t('travel.planOpen')}
                leading={<MaterialIcons name="info-outline" size={22} color={c.accent} />}
                onPress={() => {
                  setSheet(null);
                  router.push({ pathname: '/travel/place/[id]', params: { id: sheet.placeId } });
                }}
              />
              <ListRow title={t('travel.planSwap')} leading={<MaterialIcons name="swap-horiz" size={22} color={c.accent} />} onPress={() => setSheet({ ...sheet, swap: true })} />
              {plan.days[day + 1] ? (
                <ListRow
                  title={t('travel.planTomorrow')}
                  leading={<MaterialIcons name="event-repeat" size={22} color={c.accent} />}
                  onPress={() => {
                    const next = moveToNextDay(plan, day, sheet.placeId, places ?? []);
                    if (next) update(next);
                    setSheet(null);
                  }}
                />
              ) : null}
              <ListRow
                title={t('travel.planRemove')}
                leading={<MaterialIcons name="remove-circle-outline" size={22} color={c.danger} />}
                onPress={() => {
                  update(removeStop(plan, day, sheet.placeId, places ?? []));
                  setSheet(null);
                }}
              />
            </ListSurface>
          )
        ) : null}
      </StopSheet>
    </Screen>
  );
}

/** Alttan açılan küçük panel (durak işlemleri). */
function StopSheet({ open, onClose, title, subtitle, thumb, children }: { open: boolean; onClose(): void; title: string; subtitle: string; thumb: React.ReactNode; children: React.ReactNode }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: insets.bottom + spacing.md }]}>
        <View style={[styles.grabber, { backgroundColor: c.border }]} />
        <View style={styles.sheetHead}>
          {thumb}
          <View style={styles.flex}>
            <AppText style={[styles.sheetTitle, { color: c.textStrong }]} numberOfLines={2}>{title}</AppText>
            <AppText style={[styles.itemSub, { color: c.textMuted }]}>{subtitle}</AppText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={8} style={[styles.close, { backgroundColor: c.surfaceStrong }]}>
            <MaterialIcons name="close" size={20} color={c.textStrong} />
          </Pressable>
        </View>
        <ScrollView style={styles.sheetBody} contentContainerStyle={{ gap: spacing.sm }}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  intro: { fontSize: 13, lineHeight: 19 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  flex: { flex: 1 },
  paceRow: { flexDirection: 'row', gap: spacing.sm },
  pace: { flex: 1, gap: 4, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, minHeight: MIN_TOUCH + 50 },
  paceTitle: { fontFamily: fonts.bodySemi, fontSize: 14.5 },
  paceHint: { fontSize: 12, lineHeight: 16 },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 2, borderRadius: radius.lg, borderWidth: 1 },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  link: { fontSize: 12.5, fontFamily: fonts.bodySemi },
  timeline: { gap: spacing.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  time: { width: 44, fontFamily: fonts.bodySemi, fontSize: 13 },
  card: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, padding: spacing.sm, borderRadius: radius.lg },
  meal: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', minHeight: MIN_TOUCH },
  thumb: { borderRadius: 12, overflow: 'hidden' },
  itemTitle: { fontFamily: fonts.bodySemi, fontSize: 14.5, lineHeight: 19 },
  itemSub: { fontSize: 12, lineHeight: 16 },
  warn: { fontSize: 11.5, lineHeight: 15, marginTop: 2 },
  move: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingStart: 44 + spacing.sm + 22, marginBottom: spacing.sm },
  moveLine: { position: 'absolute', start: 44 + spacing.sm + 23, top: -spacing.sm, bottom: -spacing.sm, width: 1.5 },
  moveText: { fontSize: 11.5 },
  small: { fontSize: 11.5, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.md, maxHeight: '80%' },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginVertical: spacing.sm },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, marginBottom: spacing.md },
  sheetTitle: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24 },
  sheetHint: { fontSize: 12.5, lineHeight: 17 },
  sheetBody: { flexGrow: 0 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
