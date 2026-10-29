import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactElement } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { cityChoiceLabel, normalizeName, type CityGuideItem, type CityGuideSectionId } from '@cityjoy/shared';

import { useCityGuideItems } from '@/lib/city-guide';
import type { Look } from '@/lib/city-look';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';
import { GlossyIcon } from './glossy-icon';
import { SearchField } from './search-field';
import { StateMessage } from './state-message';

/** Kartta adın altındaki kısa bilgi: bölüme göre en işe yarayan alan. */
const SUMMARY_KEYS = ['kisa_metin', 'aciklama', 'adres'];
/** Kartın alt satırındaki bilgi (saat, gün, ücret). */
const META_KEYS = ['acilis_saatleri', 'calisma_hafta_ici', 'calisma_saatleri', 'gunler', 'saatler', 'ilk_saat_tl', 'hat_kodu'];
const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

/**
 * Benim Şehrim liste sayfası (tasarım: muzeler.html, otopark.html, park-pazar.html): arama, türe göre altın düğmeler,
 * pazarlarda gün, sayı kutuları (kayıt / ilçe), ilçe seçimi; kartta simge, ilçe, ad, kısa bilgi, saat ve ücret.
 * Kullanıcının ilçesi önce gelir. categories verilirse bölümün yalnızca o kategorileri (Önemli Kurumlar alt başlığı).
 */
export function CityGuideList({ section, look, categories, header }: { section: CityGuideSectionId; look: Look; categories?: string[]; header?: ReactElement }) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { location } = useUserLocation();
  const { items, stale, error, retry } = useCityGuideItems(location?.provinceCode, section);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);

  const own = useMemo(() => (items ?? []).filter((i) => !categories || (i.category && categories.includes(i.category))), [items, categories]);
  // Türler çoktan aza; "diğer" en sonda.
  const kinds = useMemo(() => {
    const n = new Map<string, number>();
    for (const i of own) if (i.category) n.set(i.category, (n.get(i.category) ?? 0) + 1);
    return [...n.keys()].sort((a, b) => Number(a === 'diger') - Number(b === 'diger') || n.get(b)! - n.get(a)!);
  }, [own]);
  const districts = useMemo(() => {
    const ids = [...new Set(own.map((i) => i.districtId).filter((x): x is string => !!x))];
    return ids.map((id) => ({ id, name: repo.getDistrict(id)?.name ?? id })).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [own]);
  const isMarket = section === 'pazarlar';

  const shown = useMemo(() => {
    const q = normalizeName(query);
    const mine = location?.districtId;
    return own
      .filter((i) => (!kind || i.category === kind) && (!district || i.districtId === district))
      .filter((i) => !day || (Array.isArray(i.values.gunler) && (i.values.gunler as string[]).includes(day)))
      .filter((i) => !q || normalizeName(`${i.name} ${i.category ? cityChoiceLabel(i.category, lang) : ''} ${repo.getDistrict(i.districtId ?? '')?.name ?? ''}`).includes(q))
      .sort((a, b) => Number(b.districtId === mine) - Number(a.districtId === mine) || a.name.localeCompare(b.name, 'tr'));
  }, [own, query, kind, district, day, location?.districtId, lang]);

  const text = (i: CityGuideItem, keys: string[]) => {
    const key = keys.find((k) => i.values[k] !== undefined && i.values[k] !== '');
    if (!key) return '';
    const v = i.values[key];
    if (key === 'ilk_saat_tl') return t('city.firstHour', { price: v });
    return Array.isArray(v) ? v.join(', ') : String(v);
  };

  const chip = (id: string | null, label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={id ?? 'all'}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active ? { backgroundColor: c.accent, borderColor: c.accent } : { backgroundColor: c.surface, borderColor: c.border }]}>
      <AppText style={[styles.chipText, { color: active ? c.onPrimary : c.textStrong }]}>{label.toLocaleUpperCase(lang)}</AppText>
    </Pressable>
  );

  const stat = (n: number, label: string) => (
    <View style={[styles.stat, { backgroundColor: c.surface, borderColor: c.border }]}>
      <AppText style={[styles.statN, { color: c.accent }]}>{n}</AppText>
      <AppText style={[styles.statLabel, { color: c.textMuted }]}>{label.toLocaleUpperCase(lang)}</AppText>
    </View>
  );

  return (
    <FlatList
      data={shown}
      keyExtractor={(i) => i.id}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.top}>
          {header}
          <SearchField value={query} onChangeText={setQuery} placeholder={t('city.search')} />
          {kinds.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {chip(null, t('city.all'), !kind, () => setKind(null))}
              {kinds.map((k) => chip(k, cityChoiceLabel(k, lang), kind === k, () => setKind(kind === k ? null : k)))}
            </ScrollView>
          ) : null}
          {isMarket ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {chip('all-days', t('city.allDays'), !day, () => setDay(null))}
              {DAYS.map((d) => chip(d, d, day === d, () => setDay(day === d ? null : d)))}
            </ScrollView>
          ) : null}
          {own.length ? (
            <View style={styles.stats}>
              {stat(own.length, t('city.records'))}
              {stat(districts.length, t('city.districts'))}
            </View>
          ) : null}
          {districts.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {chip('all-districts', t('city.allDistricts'), !district, () => setDistrict(null))}
              {districts.map((d) => chip(d.id, d.name, district === d.id, () => setDistrict(district === d.id ? null : d.id)))}
            </ScrollView>
          ) : null}
          {stale ? <AppText variant="caption" muted>{t('city.staleNote')}</AppText> : null}
          {lang !== 'tr' ? <AppText variant="caption" muted>{t('city.contentLanguage')}</AppText> : null}
        </View>
      }
      ListEmptyComponent={
        error ? (
          <StateMessage kind="error" message={t('city.loadError')} onRetry={retry} />
        ) : items === null ? (
          <StateMessage kind="loading" />
        ) : (
          <StateMessage kind="empty" message={own.length ? t('common.noResults') : t('city.empty')} />
        )
      }
      renderItem={({ item: i }) => {
        const districtName = i.districtId ? repo.getDistrict(i.districtId)?.name : undefined;
        const summary = text(i, SUMMARY_KEYS);
        const meta = text(i, META_KEYS);
        const free = i.values.ucret_durumu === 'Ücretsiz';
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={[i.name, districtName, i.verified ? '' : t('city.unverified')].filter(Boolean).join(', ')}
            onPress={() => router.push({ pathname: '/city/item', params: { section, id: i.id } })}
            style={({ pressed }) => [styles.card, { backgroundColor: c.surface, borderColor: c.border, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
            <View style={[styles.thumb, { backgroundColor: `${look.colors[1]}22` }]}>
              <GlossyIcon icon={look.icon} colors={look.colors} size={44} />
            </View>
            <View style={styles.body}>
              <AppText style={[styles.kicker, { color: c.accent }]} numberOfLines={1}>
                {[districtName, i.category ? cityChoiceLabel(i.category, lang) : ''].filter(Boolean).join(' · ').toLocaleUpperCase(lang)}
              </AppText>
              <AppText style={[styles.name, { color: c.textStrong }]} numberOfLines={2}>{i.name}</AppText>
              {summary ? <AppText style={[styles.summary, { color: c.textMuted }]} numberOfLines={2}>{summary}</AppText> : null}
              {meta || free || !i.verified ? (
                <View style={styles.metaRow}>
                  {meta ? (
                    <View style={styles.metaItem}>
                      <MaterialIcons name="schedule" size={13} color={c.textSoft} />
                      <AppText style={[styles.metaText, { color: c.textMuted }]} numberOfLines={1}>{meta}</AppText>
                    </View>
                  ) : null}
                  {free ? (
                    <View style={[styles.badge, { backgroundColor: c.successSoft }]}>
                      <AppText style={[styles.badgeText, { color: c.success }]}>{cityChoiceLabel('Ücretsiz', lang)}</AppText>
                    </View>
                  ) : null}
                  {!i.verified ? <AppText style={[styles.unverified, { color: c.textSoft }]}>{t('city.unverified')}</AppText> : null}
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm + 2, paddingBottom: spacing.xl },
  top: { gap: spacing.sm + 2, marginBottom: spacing.xs },
  chips: { gap: spacing.xs + 2, paddingVertical: 2 },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md + 2, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.8 },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm + 2, borderRadius: radius.lg, borderWidth: 1 },
  statN: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28 },
  statLabel: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 1 },
  card: { flexDirection: 'row', gap: spacing.md, padding: spacing.sm + 4, borderRadius: radius.xl, borderWidth: 1 },
  thumb: { width: 80, height: 80, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3, justifyContent: 'center' },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 1 },
  name: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 21 },
  summary: { fontSize: 12, lineHeight: 17 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  metaText: { fontSize: 11 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 10 },
  unverified: { fontSize: 10 },
});
