import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CityShowcase, ShowcaseItem, ShowcaseTheme } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { useProvinceCover } from '@/components/city-cover';
import { PageHead, PAGE_CONTENT, usePageBottom } from '@/components/page-head';
import { SectionTitle, Tag } from '@/components/inner';
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

const PLACEHOLDER_THEMES: ShowcaseTheme[] = ['lezzet', 'tarih', 'doga'];

/**
 * İl Vitrini (tasarım: bursa-vitrini.html; Karar Eren, 3 Kasım 2026): şehirdeki reklam panoları gibi bir reklam vitrini.
 * En son sayı açılır; panolar Sosyal Harmoni'deki gibi yana kaydırılır, her panoda seçilen işletmeler ve gezilecek yerler
 * (dokununca sayfası açılır). Ücretli panoda açıkça "Reklam" yazar. Aşağıda eski dergi gibi son 6 sayı.
 */
export default function CityShowcaseScreen() {
  const { t, i18n } = useTranslation();
  const cover = useProvinceCover();
  const bottom = usePageBottom();
  const router = useRouter();
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const panelW = Math.min(width, 640) - 48;
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

  // Geçmiş sayı yokken de yeri görünsün (Eren, 10 Kasım 2026): soluk, kesik çizgili boş kapaklar.
  const emptyArchive = (
    <>
      <SectionTitle title={t('showcase.archive')} />
      <View style={styles.covers} accessible accessibilityLabel={t('showcase.archiveEmpty')}>
        {[0, 1, 2].map((k) => (
          <View key={k} style={[styles.cover, styles.coverEmpty, { borderColor: c.border, backgroundColor: c.surface }]}>
            <MaterialIcons name="auto-stories" size={26} color={c.textSoft} />
          </View>
        ))}
      </View>
      <AppText style={[styles.note, { color: c.textMuted }]}>{t('showcase.archiveEmpty')}</AppText>
    </>
  );

  const header = <PageHead cover={cover} title={t('showcase.title', { city: province })} onBack={() => (router.canGoBack() ? router.back() : router.replace('/city'))} />;

  return (
    <Screen bleed cover={cover}>
      <ScrollView contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false}>
        {header}
        {!provinceCode ? (
          <StateMessage kind="empty" message={t('city.needLocation')} />
        ) : error ? (
          <StateMessage kind="error" onRetry={load} />
        ) : issues === null ? (
          <StateMessage kind="loading" />
        ) : !issue ? (
          <>
            {/* İlk sayı çıkana kadar boş panolar: kayan kartların yeri görünsün, uydurma içerik yok. */}
            <ScrollView horizontal snapToInterval={panelW + spacing.sm} decelerationRate="fast" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.panels}>
              {PLACEHOLDER_THEMES.map((theme, i) => {
                const scene = THEME_SCENES[theme];
                return (
                  <View key={theme} accessible accessibilityLabel={`${t(`showcase.themes.${theme}`)}. ${t('showcase.soonPanel')}`} style={[styles.story, { width: panelW, backgroundColor: c.surface, borderColor: c.border }]}>
                    <View style={[styles.storyArt, { backgroundColor: sceneSky(scene) }]}>
                      <View style={StyleSheet.absoluteFill}>
                        <SceneArt kind={scene} still />
                      </View>
                      <View style={[StyleSheet.absoluteFill, styles.shade]} />
                      <View style={styles.adTag}>
                        <Tag label={t('showcase.soonIssue')} />
                      </View>
                      <View style={styles.storyHead}>
                        <AppText style={styles.storyNo}>{String(i + 1).padStart(2, '0')} · {t(`showcase.themes.${theme}`)}</AppText>
                        <AppText style={styles.storyTitle}>{t('showcase.soonPanel')}</AppText>
                      </View>
                    </View>
                    <AppText style={[styles.body, { color: c.textMuted }]}>{t('showcase.soonPanelSub')}</AppText>
                    {[0, 1, 2].map((j) => (
                      <View key={j} style={[styles.item, { borderTopColor: c.border }]}>
                        <View style={[styles.rank, { backgroundColor: c.accentSoft }]}>
                          <AppText style={[styles.rankText, { color: c.accent }]}>{j + 1}</AppText>
                        </View>
                        <View style={styles.flex}>
                          <View style={[styles.bar, { width: `${70 - j * 12}%`, backgroundColor: c.border }]} />
                          <View style={[styles.bar, styles.barSmall, { width: `${45 - j * 8}%`, backgroundColor: c.border }]} />
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })}
            </ScrollView>
            <AppText style={[styles.intro, { color: c.textMuted }]}>{t('showcase.empty', { city: province })}</AppText>
            {emptyArchive}
          </>
        ) : (
          <>
            <View style={[styles.masthead, { backgroundColor: c.hero }]}>
              <AppText style={[styles.kicker, { color: c.heroAccent }]}>
                {t('showcase.issue', { n: issue.issue }).toLocaleUpperCase(i18n.language)} · {week(issue.weekOf)}
              </AppText>
              <AppText accessibilityRole="header" style={[styles.title, { color: c.heroText }]}>{issue.title}</AppText>
              {issue.intro ? <AppText style={[styles.intro, { color: c.heroMuted }]}>{issue.intro}</AppText> : null}
            </View>

            <ScrollView horizontal snapToInterval={panelW + spacing.sm} decelerationRate="fast" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.panels}>
            {issue.stories.map((s, i) => {
              const scene = THEME_SCENES[s.theme] ?? 'showcase';
              return (
                <View key={`${issue.id}-${i}`} style={[styles.story, { width: panelW, backgroundColor: c.surface, borderColor: s.sponsored ? c.accentBorder : c.border }]}>
                  <View style={[styles.storyArt, { backgroundColor: sceneSky(scene) }]}>
                    <View style={StyleSheet.absoluteFill}>
                      <SceneArt kind={scene} still />
                    </View>
                    <View style={[StyleSheet.absoluteFill, styles.shade]} />
                    {s.sponsored ? (
                      <View style={styles.adTag}>
                        <Tag label={t('business.ad')} />
                      </View>
                    ) : null}
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
            </ScrollView>

            {issues.length > 1 ? (
              <>
                <SectionTitle title={t('showcase.archive')} />
                <View style={styles.covers}>
                {issues.slice(0, 6).map((x) => {
                  const current = x.id === issue.id;
                  return (
                    <Pressable
                      key={x.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: current }}
                      onPress={() => setSelected(x.id)}
                      style={({ pressed }) => [styles.cover, { borderColor: current ? c.primary : c.border, opacity: pressed ? 0.8 : 1 }]}>
                      <SceneArt kind={THEME_SCENES[x.stories[0]?.theme] ?? 'showcase'} still />
                      <View style={[StyleSheet.absoluteFill, styles.coverShade]} />
                      <View style={styles.coverText}>
                        <AppText style={styles.coverNo}>{t('showcase.issue', { n: x.issue })}</AppText>
                        <AppText style={styles.coverTitle} numberOfLines={3}>{x.title}</AppText>
                        <AppText style={styles.coverDate}>{week(x.weekOf)}</AppText>
                      </View>
                      {current ? (
                        <View style={styles.coverCheck}>
                          <MaterialIcons name="check-circle" size={20} color={c.primary} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
                </View>
              </>
            ) : (
              emptyArchive
            )}
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
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  intro: { fontSize: 14, lineHeight: 20 },
  panels: { gap: spacing.sm, paddingEnd: spacing.md },
  adTag: { position: 'absolute', top: 10, end: 10 },
  covers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cover: { flexBasis: '31%', flexGrow: 1, aspectRatio: 0.72, borderRadius: radius.md, borderWidth: 1.5, overflow: 'hidden' },
  coverShade: { backgroundColor: 'rgba(8, 26, 30, 0.55)' },
  coverText: { flex: 1, justifyContent: 'flex-end', padding: 8, gap: 2 },
  coverNo: { color: '#E2B277', fontFamily: fonts.bodySemi, fontSize: 10.5 },
  coverTitle: { color: '#FFFFFF', fontFamily: fonts.heading, fontSize: 13, lineHeight: 17 },
  coverDate: { color: 'rgba(255, 255, 255, 0.75)', fontSize: 10 },
  coverEmpty: { borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', opacity: 0.7 },
  bar: { height: 10, borderRadius: 5 },
  barSmall: { height: 8, marginTop: 4 },
  coverCheck: { position: 'absolute', top: 6, end: 6 },
  story: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  storyArt: { height: 150, justifyContent: 'flex-end', overflow: 'hidden' },
  shade: { backgroundColor: 'rgba(8,31,36,0.5)' },
  storyHead: { padding: spacing.md, gap: 2 },
  storyNo: { color: '#E0B07A', fontFamily: fonts.display, fontSize: 14 },
  storyTitle: { color: '#FFFFFF', fontFamily: fonts.heading, fontSize: 18, lineHeight: 23 },
  storySub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 },
  body: { fontSize: 14, lineHeight: 21, padding: spacing.md, paddingBottom: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderTopWidth: StyleSheet.hairlineWidth, minHeight: MIN_TOUCH + 8 },
  rank: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  itemName: { fontFamily: fonts.bodySemi, fontSize: 14 },
  note: { fontSize: 12, lineHeight: 16 },
});
