import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { cityChoiceLabel, normalizeName } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { frost, GroupLabel } from '@/components/city-hub';
import { FrostFill } from '@/components/glass';
import { CoverBackdrop, useProvinceCover } from '@/components/city-cover';
import { RoundButton } from '@/components/hero-header';
import { FilterChip } from '@/components/inner';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { StateMessage } from '@/components/state-message';
import { useCityGuideItems, useCityGuideMeta } from '@/lib/city-guide';
import { INSTITUTION_GROUPS } from '@/lib/city-look';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';

type Group = (typeof INSTITUTION_GROUPS)[number];

/** Arama sonucunda gösterilen en çok kurum. */
const MAX_MATCHES = 12;

/**
 * Önemli Kurumlar (Eren'in tasarım örneği `onemli-kurumlar-*.png`, 10 Kasım 2026): tepede ilin fotoğrafı üstünde arama
 * ve ilçe düğmeleri (Eren: "Tümü, Osmangazi, Nilüfer gibi ilçeler"); altında iki sütunlu kartlar: solda altın simge,
 * başlık ve kısa açıklama, sağda ok. İlçe seçilince kartlarda o ilçedeki kayıt sayısı görünür ve alt sayfa o ilçeyle
 * açılır. Bilgisi olmayan başlık soluk ve "Yakında".
 */
export default function InstitutionsScreen() {
  const { t } = useTranslation();
  const cover = useProvinceCover();
  const router = useRouter();
  const c = useThemeColors();
  const dark = useResolvedScheme() === 'dark';
  const { language, rtl } = useSettings();
  const chevron = rtl ? 'chevron-left' : 'chevron-right';
  const lang = language ?? 'tr';
  const { location } = useUserLocation();
  const provinceCode = location?.provinceCode;
  const mine = location?.districtId;
  const { meta } = useCityGuideMeta(provinceCode);
  const { items, error, retry } = useCityGuideItems(provinceCode, 'onemli-kurumlar');
  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState<string | null>(null);
  const [headH, setHeadH] = useState(0);
  const insets = useSafeAreaInsets();

  // İlçe düğmeleri: "Tümü", kullanıcının ilçesi, sonra abece sırasıyla ilin diğer ilçeleri.
  const districts = useMemo(
    () =>
      (provinceCode ? repo.getDistricts(provinceCode) : [])
        .slice()
        .sort((a, b) => Number(b.id === mine) - Number(a.id === mine) || a.name.localeCompare(b.name, 'tr')),
    [provinceCode, mine],
  );

  const inGroup = (g: Group) => (items ?? []).filter((i) => i.category && g.categories?.includes(i.category) && (!district || i.districtId === district));
  /** Kartın kayıt sayısı; bilinmiyorsa (muhtarlıklar ilçeye göre) null. */
  const countOf = (g: Group): number | null => {
    if (g.section) return district ? null : (meta?.sections[g.section]?.count ?? 0);
    if (!g.categories) return 0;
    return inGroup(g).length;
  };
  const has = (g: Group) => {
    if (g.section) return (meta?.sections[g.section]?.count ?? 0) > 0;
    if (!g.categories) return false;
    return (items ?? []).some((i) => i.category && g.categories!.includes(i.category));
  };

  const q = normalizeName(query.trim());
  const groups = q
    ? INSTITUTION_GROUPS.filter((g) => normalizeName(`${t(`city.groups.${g.id}.title`)} ${t(`city.groups.${g.id}.hint`)}`).includes(q))
    : INSTITUTION_GROUPS;
  const matches = useMemo(() => {
    if (!q) return [];
    return (items ?? [])
      .filter((i) => !district || i.districtId === district)
      .filter((i) => normalizeName(`${i.name} ${i.category ? cityChoiceLabel(i.category, lang) : ''}`).includes(q))
      .sort((a, b) => Number(b.districtId === mine) - Number(a.districtId === mine) || a.name.localeCompare(b.name, 'tr'))
      .slice(0, MAX_MATCHES);
  }, [items, q, district, mine, lang]);

  // Fotoğraf varsa ya da koyu modda başlık açık renk; açık modda fotoğraf yoksa koyu.
  const light = dark || !!cover;
  const head = (
    <View onLayout={(e) => setHeadH(Math.round(e.nativeEvent.layout.height))} style={[styles.head, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.titleRow}>
        <RoundButton icon={rtl ? 'arrow-forward' : 'arrow-back'} label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/city'))} />
        <View style={styles.flex}>
          <AppText accessibilityRole="header" numberOfLines={1} style={[styles.pageTitle, { color: light ? c.heroText : c.textStrong }]}>{t('city.tiles.kurumlar')}</AppText>
          <AppText numberOfLines={1} style={[styles.pageSub, { color: light ? c.heroMuted : c.textMuted }]}>{t('city.kurumlarIntro')}</AppText>
          <View style={[styles.goldRule, { backgroundColor: c.heroAccent }]} />
        </View>
      </View>
      <SearchField glass value={query} onChangeText={setQuery} placeholder={t('city.kurumlarSearch')} />
      {districts.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipStrip}>
          <FilterChip icon="apps" label={t('city.all')} active={!district} onPress={() => setDistrict(null)} />
          {districts.map((d) => (
            <FilterChip
              key={d.id}
              icon={d.id === mine ? 'near-me' : undefined}
              label={d.name}
              active={district === d.id}
              onPress={() => setDistrict(district === d.id ? null : d.id)}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  const open = (g: Group) => {
    const extra = district ? { district } : {};
    router.push({
      pathname: '/city/[section]',
      params: g.section ? { section: g.section, ...extra } : { section: 'onemli-kurumlar', group: g.id, ...extra },
    });
  };

  return (
    <Screen bleed cover={cover} warm={!cover}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {cover && headH ? <CoverBackdrop photo={cover} height={headH + 24} /> : null}
        {head}
        {error ? <StateMessage kind="error" message={t('city.loadError')} onRetry={retry} /> : null}
        <View style={styles.grid}>
          {groups.map((g) => {
            const on = has(g);
            const n = countOf(g);
            const empty = on && district && n === 0;
            const title = t(`city.groups.${g.id}.title`);
            const sub = !on ? t('city.soon') : empty ? t('city.noneInDistrict') : district && n ? t('city.count', { count: n }) : t(`city.groups.${g.id}.hint`);
            const live = on && !empty;
            return (
              <Pressable
                key={g.id}
                accessibilityRole="button"
                accessibilityLabel={`${title}. ${sub}`}
                accessibilityState={{ disabled: !live }}
                disabled={!live}
                onPress={() => open(g)}
                style={({ pressed }) => [styles.tile, frost(dark, c.surface, c.border), { opacity: live ? 1 : 0.5, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                <FrostFill />
                <View style={[styles.icon, dark ? styles.iconDark : { backgroundColor: c.accentSoft, borderColor: c.border }]}>
                  <MaterialIcons name={g.look.icon} size={22} color={dark ? c.heroAccent : c.primary} />
                </View>
                <View style={[styles.rule, { backgroundColor: dark ? c.heroAccent : c.primary }]} />
                <View style={styles.flex}>
                  <AppText style={[styles.title, { color: c.textStrong }]} numberOfLines={2}>{title}</AppText>
                  <AppText style={[styles.hint, { color: district && n && live ? c.primary : live ? c.text : c.textMuted, opacity: live ? 0.82 : 1 }]} numberOfLines={2}>{sub}</AppText>
                </View>
                {live ? <MaterialIcons name={chevron} size={16} color={c.textMuted} style={styles.chev} /> : null}
              </Pressable>
            );
          })}
        </View>
        {q && matches.length ? (
          <View style={styles.matches}>
            <GroupLabel label={t('city.matches')} />
            {matches.map((i) => (
              <Pressable
                key={i.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/city/item', params: { section: 'onemli-kurumlar', id: i.id } })}
                style={({ pressed }) => [styles.match, frost(dark, c.surface, c.border), { opacity: pressed ? 0.8 : 1 }]}>
                <FrostFill />
                <View style={styles.flex}>
                  <AppText style={[styles.title, { color: c.textStrong }]} numberOfLines={1}>{i.name}</AppText>
                  <AppText style={[styles.hint, { color: c.textMuted }]} numberOfLines={1}>
                    {[repo.getDistrict(i.districtId ?? '')?.name, i.category && i.category !== 'diger' ? cityChoiceLabel(i.category, lang) : ''].filter(Boolean).join(' · ')}
                  </AppText>
                </View>
                <MaterialIcons name={chevron} size={20} color={c.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}
        {q && !groups.length && !matches.length ? <StateMessage kind="empty" message={t('common.noResults')} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Üst kısım sayfayla birlikte kayar (sabit bant yok; Eren 10 Kasım: sabit kalın başlık kaba duruyordu).
  head: { gap: spacing.sm + 4, paddingBottom: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + 2 },
  pageTitle: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28, letterSpacing: -0.3, textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowRadius: 6 },
  pageSub: { fontSize: 13, lineHeight: 18 },
  goldRule: { width: 30, height: 3, borderRadius: 2, marginTop: 7 },
  chipStrip: { marginHorizontal: -GUTTER },
  chips: { gap: spacing.xs + 2, paddingVertical: 2, paddingHorizontal: GUTTER },
  content: { gap: spacing.md, paddingHorizontal: GUTTER, width: '100%', maxWidth: 640, alignSelf: 'center' },
  // İki sütunlu kartlar: solda simge ve ince altın çizgi, başlık ve açıklama, sağda ok.
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm + 2, marginHorizontal: -6 },
  tile: { width: '48.8%', minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: spacing.sm + 2, paddingStart: spacing.sm + 2, paddingEnd: 0, borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  icon: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  // Koyu modda simge kutusu: hafif açık cam, altın tonlu ince çerçeve (örnekteki gibi).
  iconDark: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(226, 178, 119, 0.28)' },
  chev: { marginStart: -4 },
  rule: { width: 1.5, alignSelf: 'stretch', marginVertical: spacing.sm, borderRadius: 1, opacity: 0.8 },
  flex: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.heading, fontSize: 14, lineHeight: 17 },
  hint: { fontSize: 11.5, lineHeight: 15 },
  matches: { gap: spacing.sm },
  match: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md - 2, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
});
