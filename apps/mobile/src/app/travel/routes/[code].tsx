import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ROUTE_LENGTHS, type RouteLength } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { SceneArt, sceneSky } from '@/components/scene-art';
import { StateMessage } from '@/components/state-message';
import { TravelHeader } from '@/components/travel-header';
import { locationRepository as repo } from '@/lib/locations';
import { ROUTE_THEME_ICONS, ROUTE_THEME_SCENES, useDurationText, useTravelRoutes } from '@/lib/travel';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Filter = 'all' | RouteLength;

/**
 * Hazır Rotalar (tasarım: bursa-hazir-rotalar.html): temalı rotalar, süre filtresi (2-3 saat, yarım gün, 1 gün). Kartta
 * tema, durak ve süre, ilk duraklar. Puan ve "keşfeden" sayısı yok (Karar, Eren). Belediyenin rotası "Belediye tanıtımı".
 */
export default function TravelRoutesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const duration = useDurationText();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { value: routes, failed, retry } = useTravelRoutes(code);
  const [filter, setFilter] = useState<Filter>('all');
  const name = repo.getProvince(code)?.name ?? '';
  const own = (routes ?? []).filter((r) => !r.municipalityId);
  const shown = own.filter((r) => filter === 'all' || r.length === filter);
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/travel/city/[code]', params: { code } }));

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      <TravelHeader subtitle={name} title={t('travel.routesTitle')} onBack={back} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.pad}>
          <AppText accessibilityRole="header" style={[styles.h1, { color: c.textStrong }]}>{t('travel.routesHeading', { name })}</AppText>
          <AppText style={{ color: c.textMuted }}>{t('travel.routesIntro')}</AppText>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
          {(['all', ...ROUTE_LENGTHS] as Filter[]).map((f) => {
            const selected = f === filter;
            return (
              <Pressable
                key={f}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setFilter(f)}
                style={[styles.filter, selected ? { backgroundColor: c.primary, borderColor: c.primary } : { borderColor: c.border, backgroundColor: c.surface }]}>
                <AppText style={[styles.filterText, { color: selected ? c.onPrimary : c.text }]}>{f === 'all' ? t('travel.all') : t(`travel.lengths.${f}`)}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.pad}>
          {failed && !routes ? <StateMessage kind="error" onRetry={retry} /> : routes === null ? <StateMessage kind="loading" /> : null}
          {routes && !own.length ? <StateMessage kind="empty" message={t('travel.noRoutes')} /> : null}
          {routes && own.length > 0 && !shown.length ? <StateMessage kind="empty" message={t('travel.noRoutesLength')} /> : null}
          {shown.map((r) => {
            const scene = ROUTE_THEME_SCENES[r.theme];
            const first = r.stops.slice(0, 3);
            const more = r.stops.length - first.length;
            const meta = `${t('travel.stops', { count: r.stops.length })} · ${duration(r.durationMinutes)}`;
            return (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={`${r.title}. ${t(`travel.routeThemes.${r.theme}`)}. ${meta}. ${r.summary}`}
                onPress={() => router.push({ pathname: '/travel/route/[id]', params: { id: r.id } })}
                style={({ pressed }) => [styles.card, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.92 : 1 }]}>
                <View style={[styles.art, { backgroundColor: sceneSky(scene) }]}>
                  <View style={[StyleSheet.absoluteFill, styles.artInner]}>
                    <SceneArt kind={scene} />
                  </View>
                  <View style={[StyleSheet.absoluteFill, styles.shade]} />
                  <View style={styles.artRow}>
                    <View style={styles.themeIcon}>
                      <MaterialIcons name={ROUTE_THEME_ICONS[r.theme]} size={20} color="#081F24" />
                    </View>
                    <View style={styles.flex}>
                      <AppText style={styles.themeText}>{t(`travel.routeThemes.${r.theme}`).toLocaleUpperCase(i18n.language)}</AppText>
                      <AppText style={styles.title} numberOfLines={1}>{r.title}</AppText>
                    </View>
                    <View style={styles.length}>
                      <AppText style={styles.lengthText}>{t(`travel.lengths.${r.length}`)}</AppText>
                    </View>
                  </View>
                </View>
                <View style={styles.body}>
                  <AppText style={[styles.summary, { color: c.textMuted }]} numberOfLines={2}>{r.summary}</AppText>
                  <View style={styles.chain}>
                    {first.map((s, i) => (
                      <View key={`${s.name}-${i}`} style={styles.chainItem}>
                        <View style={[styles.num, { backgroundColor: c.accentSoft }]}>
                          <AppText style={[styles.numText, { color: c.accent }]}>{i + 1}</AppText>
                        </View>
                        <AppText style={[styles.stopName, { color: c.textStrong }]} numberOfLines={1}>{s.name}</AppText>
                        {i < first.length - 1 ? <MaterialIcons name="arrow-forward" size={12} color={c.textSoft} /> : null}
                      </View>
                    ))}
                    {more > 0 ? <AppText style={[styles.more, { color: c.textSoft }]}>+{more}</AppText> : null}
                  </View>
                  <View style={styles.foot}>
                    <View style={styles.metaRow}>
                      <MaterialIcons name="schedule" size={14} color={c.textSoft} />
                      <AppText style={[styles.metaText, { color: c.textMuted }]}>{meta}</AppText>
                    </View>
                    <View style={styles.metaRow}>
                      <AppText style={[styles.detail, { color: c.accent }]}>{t('travel.details')}</AppText>
                      <MaterialIcons name="arrow-forward" size={14} color={c.accent} />
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.xl },
  pad: { paddingHorizontal: GUTTER, paddingTop: spacing.md, gap: spacing.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
  h1: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  filters: { paddingHorizontal: GUTTER, paddingTop: spacing.md, gap: spacing.sm },
  filter: { minHeight: 34, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  filterText: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.5 },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  art: { height: 92, justifyContent: 'flex-end', overflow: 'hidden' },
  artInner: { opacity: 0.9 },
  shade: { backgroundColor: 'rgba(8,31,36,0.45)' },
  artRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  themeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0B07A', alignItems: 'center', justifyContent: 'center' },
  themeText: { color: '#E0B07A', fontFamily: fonts.bodySemi, fontSize: 9, letterSpacing: 1.5 },
  title: { color: '#FFFFFF', fontFamily: fonts.heading, fontSize: 18, lineHeight: 23 },
  length: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)' },
  lengthText: { color: '#FFFFFF', fontFamily: fonts.bodySemi, fontSize: 10 },
  body: { padding: spacing.md, gap: spacing.sm },
  summary: { fontSize: 13, lineHeight: 18 },
  chain: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chainItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  num: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: fonts.bodySemi, fontSize: 10 },
  stopName: { fontFamily: fonts.bodyMedium, fontSize: 12, flexShrink: 1 },
  more: { fontFamily: fonts.bodySemi, fontSize: 12 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
  detail: { fontFamily: fonts.bodySemi, fontSize: 12 },
});
