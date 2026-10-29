import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CityShowcase, ShowcaseItem, ShowcaseTheme } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { SceneArt, sceneSky, type SceneKind } from '@/components/scene-art';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { locationRepository } from '@/lib/locations';
import { showcaseRepository } from '@/lib/services';
import { useUserLocation } from '@/lib/user-location';
import { fonts, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const THEME_SCENES: Record<ShowcaseTheme, SceneKind> = {
  lezzet: 'food',
  tarih: 'townhall',
  doga: 'neighbourhood',
  konaklama: 'travel',
  alisveris: 'market',
  kultur: 'showcase',
  aile: 'activities',
  gece: 'city',
};

/**
 * Şehir Vitrini (tasarım: bursa-vitrini.html): ilin haftalık seçkisi. En son sayı açılır; konular büyük kartlarda,
 * her konuda seçilmiş işletmeler ve gezilecek yerler (dokununca sayfası açılır); altta geçmiş sayılar. Editör
 * seçkisidir, para karşılığı girilmez.
 */
export default function CityShowcaseScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { location } = useUserLocation();
  const provinceCode = location?.provinceCode;
  const province = provinceCode ? locationRepository.getProvince(provinceCode)?.name ?? '' : '';
  const [issues, setIssues] = useState<CityShowcase[] | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!provinceCode) return;
    setError(false);
    showcaseRepository
      .listPublished(provinceCode)
      .then(setIssues)
      .catch(() => setError(true));
  }, [provinceCode]);
  useEffect(load, [load]);

  const issue = issues?.find((x) => x.id === selected) ?? issues?.[0];
  const week = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' });
  const open = (item: ShowcaseItem) =>
    item.kind === 'isletme'
      ? router.push({ pathname: '/business/[id]', params: { id: item.id } })
      : router.push({ pathname: '/travel/place/[id]', params: { id: item.id } });

  const header = <HeroHeader title={t('showcase.title', { city: province })} onBack={() => (router.canGoBack() ? router.back() : router.replace('/city'))} />;

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!provinceCode ? (
          <StateMessage kind="empty" message={t('city.needLocation')} />
        ) : error ? (
          <StateMessage kind="error" onRetry={load} />
        ) : issues === null ? (
          <StateMessage kind="loading" />
        ) : !issue ? (
          <StateMessage kind="empty" message={t('showcase.empty', { city: province })} />
        ) : (
          <>
            <View style={[styles.masthead, { backgroundColor: c.hero }]}>
              <AppText style={[styles.kicker, { color: c.heroAccent }]}>
                {t('showcase.issue', { n: issue.issue }).toLocaleUpperCase(i18n.language)} · {week(issue.weekOf)}
              </AppText>
              <AppText accessibilityRole="header" style={[styles.title, { color: c.heroText }]}>{issue.title}</AppText>
              {issue.intro ? <AppText style={[styles.intro, { color: c.heroMuted }]}>{issue.intro}</AppText> : null}
              <View style={[styles.editor, { borderColor: c.heroAccent }]}>
                <MaterialIcons name="auto-awesome" size={12} color={c.heroAccent} />
                <AppText style={[styles.editorText, { color: c.heroAccent }]}>{t('showcase.editorsPick')}</AppText>
              </View>
            </View>

            {issue.stories.map((s, i) => {
              const scene = THEME_SCENES[s.theme] ?? 'showcase';
              return (
                <View key={`${issue.id}-${i}`} style={[styles.story, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <View style={[styles.storyArt, { backgroundColor: sceneSky(scene) }]}>
                    <View style={StyleSheet.absoluteFill}>
                      <SceneArt kind={scene} still />
                    </View>
                    <View style={[StyleSheet.absoluteFill, styles.shade]} />
                    <View style={styles.storyHead}>
                      <AppText style={styles.storyNo}>{String(i + 1).padStart(2, '0')}</AppText>
                      <AppText style={styles.storyTitle}>{s.title}</AppText>
                      {s.subtitle ? <AppText style={styles.storySub}>{s.subtitle}</AppText> : null}
                    </View>
                  </View>
                  {s.body ? <AppText style={[styles.body, { color: c.text }]}>{s.body}</AppText> : null}
                  {s.items.map((item, j) => (
                    <Pressable
                      key={`${item.kind}-${item.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={[item.name, item.note].filter(Boolean).join('. ')}
                      onPress={() => open(item)}
                      style={({ pressed }) => [styles.item, { borderTopColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
                      <View style={[styles.rank, { backgroundColor: c.accentSoft }]}>
                        <AppText style={[styles.rankText, { color: c.accent }]}>{j + 1}</AppText>
                      </View>
                      <View style={styles.flex}>
                        <AppText style={[styles.itemName, { color: c.textStrong }]}>{item.name}</AppText>
                        {item.note ? <AppText style={[styles.note, { color: c.textMuted }]}>{item.note}</AppText> : null}
                      </View>
                      <MaterialIcons name={item.kind === 'isletme' ? 'storefront' : 'place'} size={18} color={c.textSoft} />
                    </Pressable>
                  ))}
                </View>
              );
            })}

            {issues.length > 1 ? (
              <>
                <AppText variant="subtitle" accessibilityRole="header">{t('showcase.archive')}</AppText>
                {issues.map((x) => {
                  const current = x.id === issue.id;
                  return (
                    <Pressable
                      key={x.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: current }}
                      onPress={() => setSelected(x.id)}
                      style={({ pressed }) => [styles.past, { backgroundColor: c.surface, borderColor: current ? c.accentBorder : c.border, opacity: pressed ? 0.8 : 1 }]}>
                      <AppText style={[styles.pastNo, { color: c.accent }]}>{x.issue}</AppText>
                      <View style={styles.flex}>
                        <AppText variant="label" numberOfLines={1}>{x.title}</AppText>
                        <AppText variant="caption" muted>{week(x.weekOf)}</AppText>
                      </View>
                      {current ? <MaterialIcons name="check" size={18} color={c.accent} /> : null}
                    </Pressable>
                  );
                })}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1, gap: 2 },
  masthead: { borderRadius: radius.xl, padding: spacing.lg, gap: 6 },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 1.2 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32 },
  intro: { fontSize: 14, lineHeight: 20 },
  editor: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  editorText: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 0.5 },
  story: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  storyArt: { height: 150, justifyContent: 'flex-end', overflow: 'hidden' },
  shade: { backgroundColor: 'rgba(8,31,36,0.5)' },
  storyHead: { padding: spacing.md, gap: 2 },
  storyNo: { color: '#E0B07A', fontFamily: fonts.display, fontSize: 14 },
  storyTitle: { color: '#FFFFFF', fontFamily: fonts.heading, fontSize: 20, lineHeight: 25 },
  storySub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 },
  body: { fontSize: 14, lineHeight: 21, padding: spacing.md, paddingBottom: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderTopWidth: StyleSheet.hairlineWidth, minHeight: MIN_TOUCH + 8 },
  rank: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  itemName: { fontFamily: fonts.bodySemi, fontSize: 14 },
  note: { fontSize: 12, lineHeight: 16 },
  past: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  pastNo: { fontFamily: fonts.display, fontSize: 22, minWidth: 28, textAlign: 'center' },
});
