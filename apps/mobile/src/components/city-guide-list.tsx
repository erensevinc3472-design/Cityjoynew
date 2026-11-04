import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactElement } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { cityChoiceLabel, normalizeName, type CityGuideItem, type CityGuideSectionId } from '@cityjoy/shared';

import { useCityGuideItems } from '@/lib/city-guide';
import type { Look } from '@/lib/city-look';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';
import { GlossyIcon } from './glossy-icon';
import { FeaturedCard, FilterChip, FilterRow, ListRow, SectionTitle, Tag } from './inner';
import type { SceneKind } from './scene-art';
import { SearchField } from './search-field';
import { StateMessage } from './state-message';

/** Kartta adın altındaki kısa bilgi: bölüme göre en işe yarayan alan. */
const SUMMARY_KEYS = ['kisa_metin', 'aciklama', 'adres'];
/** Kartın alt satırındaki bilgi (saat, gün, ücret). */
const META_KEYS = ['acilis_saatleri', 'calisma_hafta_ici', 'calisma_saatleri', 'gunler', 'saatler', 'ilk_saat_tl', 'hat_kodu'];
const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

/** Öne çıkan büyük kartı olan bölümler ve kartın çizimi (Müzeler önizlemesi, 13. madde 35). */
const FEATURED: Partial<Record<CityGuideSectionId, SceneKind>> = { muzeler: 'townhall', parklar: 'neighbourhood' };

/**
 * Benim Şehrim liste sayfası (13. madde 35, Müzeler önizlemesi): arama, tek filtre satırı (ilçe açılır düğmesi + türler,
 * normal harf), pazarlarda gün; filtre yokken öne çıkan büyük kart, altında tek yüzeyde liste. Sayı kutuları, "DİĞER"
 * ve yıldız yok. Otoparkta kapasite / doluluk gösterilmez, ücret yoksa "Ücret bilgisi yok". Kullanıcının ilçesi önce
 * gelir. categories verilirse bölümün yalnızca o kategorileri (Önemli Kurumlar alt başlığı).
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

  const featuredKind = FEATURED[section];
  const filtered = !!(query || kind || district || day);
  const featured = featuredKind && !filtered ? shown[0] : undefined;
  const rows = featured ? shown.slice(1) : shown;
  const go = (i: CityGuideItem) => router.push({ pathname: '/city/item', params: { section, id: i.id } });
  const sectionName = (n: number) => t('city.listAll', { count: n });

  return (
    <FlatList
      data={rows}
      keyExtractor={(i) => i.id}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.top}>
          {header}
          <SearchField value={query} onChangeText={setQuery} placeholder={t('city.search')} />
          <FilterRow
            districts={districts}
            district={district}
            onDistrict={setDistrict}
            kinds={kinds.filter((k) => k !== 'diger').map((k) => ({ id: k, name: cityChoiceLabel(k, lang) }))}
            kind={kind}
            onKind={setKind}
          />
          {isMarket ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <FilterChip label={t('city.allDays')} active={!day} onPress={() => setDay(null)} />
              {DAYS.map((d) => <FilterChip key={d} label={d} active={day === d} onPress={() => setDay(day === d ? null : d)} />)}
            </ScrollView>
          ) : null}
          {stale ? <AppText variant="caption" muted>{t('city.staleNote')}</AppText> : null}
          {lang !== 'tr' ? <AppText variant="caption" muted>{t('city.contentLanguage')}</AppText> : null}
          {featured ? (
            <FeaturedCard
              kind={featuredKind!}
              badge={t('city.featured')}
              title={featured.name}
              meta={[featured.districtId ? repo.getDistrict(featured.districtId)?.name : '', text(featured, META_KEYS)].filter(Boolean).join(' · ')}
              tag={featured.values.ucret_durumu === 'Ücretsiz' ? <Tag label={cityChoiceLabel('Ücretsiz', lang)} /> : undefined}
              onPress={() => go(featured)}
            />
          ) : null}
          {rows.length ? <SectionTitle title={sectionName(shown.length)} aside={location?.districtId && !district ? t('city.nearFirst') : undefined} /> : null}
        </View>
      }
      ListEmptyComponent={
        featured ? undefined : error ? (
          <StateMessage kind="error" message={t('city.loadError')} onRetry={retry} />
        ) : items === null ? (
          <StateMessage kind="loading" />
        ) : (
          <StateMessage kind="empty" message={own.length ? t('common.noResults') : t('city.empty')} />
        )
      }
      renderItem={({ item: i, index }) => {
        const districtName = i.districtId ? repo.getDistrict(i.districtId)?.name : undefined;
        const meta = text(i, META_KEYS);
        const summary = meta || text(i, SUMMARY_KEYS);
        const free = i.values.ucret_durumu === 'Ücretsiz';
        const parking = section === 'otoparklar';
        const last = index === rows.length - 1;
        return (
          <View style={[styles.surfaceRow, { backgroundColor: c.surface, borderColor: c.border }, index === 0 && styles.surfaceFirst, last && styles.surfaceLast]}>
            <ListRow
              first={index === 0}
              leading={<GlossyIcon icon={look.icon} colors={look.colors} size={40} />}
              title={i.name}
              subtitle={[districtName, i.category && i.category !== 'diger' ? cityChoiceLabel(i.category, lang) : '', summary].filter(Boolean).join(' · ')}
              accessibilityLabel={[i.name, districtName, i.verified ? '' : t('city.unverified')].filter(Boolean).join(', ')}
              trailing={
                free ? (
                  <Tag label={cityChoiceLabel('Ücretsiz', lang)} tone="green" />
                ) : parking && i.values.ilk_saat_tl === undefined ? (
                  <Tag label={t('city.noPrice')} tone="muted" />
                ) : !i.verified ? (
                  <Tag label={t('city.unverified')} tone="muted" />
                ) : undefined
              }
              onPress={() => go(i)}
            />
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  top: { gap: spacing.sm + 2, marginBottom: spacing.sm + 2 },
  chips: { gap: spacing.xs + 2, paddingVertical: 2 },
  // Satırlar tek yüzeyde: ilk ve son satır köşeleri yuvarlar, kenarlar birleşir.
  surfaceRow: { borderLeftWidth: 1, borderRightWidth: 1, paddingHorizontal: spacing.md },
  surfaceFirst: { borderTopWidth: 1, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  surfaceLast: { borderBottomWidth: 1, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
});
