import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LOCAL_KINDS, type LocalKind } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { SceneArt, sceneSky } from '@/components/scene-art';
import { StateMessage } from '@/components/state-message';
import { TravelHeader } from '@/components/travel-header';
import { locationRepository as repo } from '@/lib/locations';
import { LOCAL_KIND_ICONS, useTravelLocal } from '@/lib/travel';
import { fonts, GUTTER, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Filter = 'all' | LocalKind;

/**
 * Yöresel (tasarım: bursa-yoresel.html): kültürel miras, el sanatları, lezzetler, gelenekler. Kart açılınca yazının
 * tamamı ve kaynaklı bilgiler. Rozet (UNESCO, coğrafi işaret) yalnızca kaynağı belli olanlarda.
 */
export default function TravelLocalScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { value: items, failed, retry } = useTravelLocal(code);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const name = repo.getProvince(code)?.name ?? '';
  const used = LOCAL_KINDS.filter((k) => (items ?? []).some((x) => x.kind === k));
  const shown = (items ?? []).filter((x) => filter === 'all' || x.kind === filter);
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/travel/city/[code]', params: { code } }));

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      <TravelHeader subtitle={name} title={t('travel.local', { name })} onBack={back} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: sceneSky('showcase') }]}>
          <View style={StyleSheet.absoluteFill}>
            <SceneArt kind="showcase" />
          </View>
          <View style={[StyleSheet.absoluteFill, styles.shade]} />
          <View style={styles.heroText}>
            <AppText style={styles.kicker}>{t('travel.localKicker').toLocaleUpperCase(i18n.language)}</AppText>
            <AppText accessibilityRole="header" style={styles.heroTitle}>{t('travel.local', { name })}</AppText>
            <AppText style={styles.heroSub}>{t('travel.localIntro')}</AppText>
          </View>
        </View>

        {used.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
            {(['all', ...used] as Filter[]).map((f) => {
              const selected = f === filter;
              return (
                <Pressable
                  key={f}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setFilter(f)}
                  style={[styles.filter, selected ? { backgroundColor: c.primary, borderColor: c.primary } : { borderColor: c.border, backgroundColor: c.surface }]}>
                  <AppText style={[styles.filterText, { color: selected ? c.onPrimary : c.text }]}>{f === 'all' ? t('travel.all') : t(`travel.localKinds.${f}`)}</AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.pad}>
          {failed && !items ? <StateMessage kind="error" onRetry={retry} /> : items === null ? <StateMessage kind="loading" /> : null}
          {items && !items.length ? <StateMessage kind="empty" message={t('travel.noLocal')} /> : null}
          {shown.map((x) => {
            const expanded = open === x.id;
            return (
              <View key={x.id} style={[styles.card, { backgroundColor: c.surface, borderColor: expanded ? c.accentBorder : c.border }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${x.title}. ${x.subtitle}`}
                  onPress={() => setOpen(expanded ? null : x.id)}
                  style={styles.head}>
                  <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
                    <MaterialIcons name={LOCAL_KIND_ICONS[x.kind]} size={20} color={c.accent} />
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.badges}>
                      <AppText style={[styles.kind, { color: c.accent }]}>{t(`travel.localKinds.${x.kind}`).toLocaleUpperCase(i18n.language)}</AppText>
                      {x.badges.map((b) => (
                        <View key={b} style={[styles.badge, { borderColor: c.accentBorder }]}>
                          <AppText style={[styles.badgeText, { color: c.accent }]}>{b}</AppText>
                        </View>
                      ))}
                    </View>
                    <AppText style={[styles.title, { color: c.textStrong }]}>{x.title}</AppText>
                    {x.subtitle ? <AppText style={[styles.sub, { color: c.textMuted }]}>{x.subtitle}</AppText> : null}
                  </View>
                  <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={24} color={c.textSoft} />
                </Pressable>
                {expanded ? (
                  <View style={styles.body}>
                    <AppText style={[styles.text, { color: c.text }]}>{x.body}</AppText>
                    {x.facts.map((f) => (
                      <View key={f.label} style={[styles.fact, { backgroundColor: c.background, borderColor: c.border }]}>
                        <AppText style={[styles.factLabel, { color: c.textMuted }]}>{f.label}</AppText>
                        <AppText style={[styles.factValue, { color: c.textStrong }]}>{f.value}</AppText>
                        {f.source ? <AppText style={[styles.factLabel, { color: c.textSoft }]}>{[f.source, f.asOf].filter(Boolean).join(', ')}</AppText> : null}
                      </View>
                    ))}
                    {x.source ? <AppText style={[styles.factLabel, { color: c.textSoft }]}>{t('travel.source', { source: x.source })}</AppText> : null}
                  </View>
                ) : null}
              </View>
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
  hero: { height: 220, justifyContent: 'flex-end', overflow: 'hidden' },
  shade: { backgroundColor: 'rgba(8,31,36,0.5)' },
  heroText: { padding: GUTTER + 4, gap: 4 },
  kicker: { color: '#E0B07A', fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 1.6 },
  heroTitle: { color: '#FFFFFF', fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 },
  filters: { paddingHorizontal: GUTTER, paddingTop: spacing.md, gap: spacing.sm },
  filter: { minHeight: 34, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  filterText: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.5 },
  pad: { paddingHorizontal: GUTTER, paddingTop: spacing.md, gap: spacing.sm + 2, width: '100%', maxWidth: 640, alignSelf: 'center' },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: MIN_TOUCH },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  kind: { fontFamily: fonts.bodySemi, fontSize: 9, letterSpacing: 1 },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, borderWidth: 1 },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 9 },
  title: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 21 },
  sub: { fontSize: 12, lineHeight: 16 },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  text: { fontSize: 14, lineHeight: 21 },
  fact: { padding: 10, borderRadius: radius.md, borderWidth: 1, gap: 2 },
  factLabel: { fontSize: 11, lineHeight: 14 },
  factValue: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18 },
});
