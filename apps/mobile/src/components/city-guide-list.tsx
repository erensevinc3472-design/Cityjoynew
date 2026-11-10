import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Linking, ScrollView, SectionList, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { cityChoiceLabel, mapsUrl, normalizeName, telUrl, type CityGuideItem, type CityGuideSectionId } from '@cityjoy/shared';

import { useCityGuideItems } from '@/lib/city-guide';
import type { Look } from '@/lib/city-look';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { radius, spacing } from '@/theme/tokens';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';
import { CallButton, DistrictTile, ExpandRow, frost, GroupLabel, HubTitle, KindTile, PillButton, SelectionBar, Spotlight, type InfoLine } from './city-hub';
import { FrostFill } from './glass';
import { FeaturedCard, FilterChip, FilterRow, PickerModal, Tag } from './inner';
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

/** Bu kadar ve daha çok kayıt varsa sayfa uzun liste yerine tür / ilçe kutularıyla açılır. */
const HUB_MIN = 10;
/** Kutularda gösterilen en çok tür ve ilçe; fazlası "Tüm ilçeler" seçim listesinden. */
const MAX_KINDS = 6;
const MAX_DISTRICTS = 5;

/** Türe göre kutuda türün kendi simgesi (bilinmeyende bölümün simgesi). */
const KIND_ICON: Record<string, Look['icon']> = {
  'hastane-devlet': 'add-box',
  'hastane-ozel': 'apartment',
  emniyet: 'local-police',
  jandarma: 'shield',
  okul: 'school',
  'halk-egitim': 'menu-book',
  banka: 'account-balance',
  atm: 'atm',
  valilik: 'account-balance',
  kaymakamlik: 'account-balance',
  adliye: 'gavel',
};

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/**
 * Benim Şehrim liste sayfası (cam taslağı, Eren 7 Kasım 2026). Kayıt çoksa önce "Türüne göre" ve "İlçene göre"
 * kutuları ve kullanıcının ilçesinden öne çıkan bir kayıt (Ara, Yol tarifi) gelir; seçim yapılınca ya da "Tümünü
 * listele" ile türlere ayrılmış kısa liste açılır. Arama her zaman en üstte. Az kayıtta doğrudan liste. Otoparkta
 * ücret yoksa "Ücret bilgisi yok". categories verilirse bölümün yalnızca o kategorileri (Önemli Kurumlar alt başlığı).
 */
export function CityGuideList({
  section,
  look,
  categories,
  header,
  onCount,
  initialDistrict,
  contentStyle,
}: {
  section: CityGuideSectionId;
  look: Look;
  categories?: string[];
  header?: ReactElement;
  /** Kayıt sayısı (başlığın altında "Bursa · 46 yer"). */
  onCount?(n: number): void;
  /** Açılışta seçili ilçe (Önemli Kurumlar'da seçilen ilçe). */
  initialDistrict?: string;
  /** Liste içeriğine ek stil (PageHead kullanan sayfada yan boşluk ve alt boşluk). */
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const dark = useResolvedScheme() === 'dark';
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { location } = useUserLocation();
  const mine = location?.districtId;
  const { items, stale, error, retry } = useCityGuideItems(location?.provinceCode, section);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(initialDistrict ?? null);
  const [day, setDay] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [pickDistrict, setPickDistrict] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const own = useMemo(() => (items ?? []).filter((i) => !categories || (i.category && categories.includes(i.category))), [items, categories]);
  useEffect(() => {
    if (items) onCount?.(own.length);
  }, [items, own.length, onCount]);
  const kindCount = useMemo(() => {
    const n = new Map<string, number>();
    for (const i of own) if (i.category) n.set(i.category, (n.get(i.category) ?? 0) + 1);
    return n;
  }, [own]);
  // Türler çoktan aza; "diğer" en sonda.
  const kinds = useMemo(() => [...kindCount.keys()].sort((a, b) => Number(a === 'diger') - Number(b === 'diger') || kindCount.get(b)! - kindCount.get(a)!), [kindCount]);
  const districtCount = useMemo(() => {
    const n = new Map<string, number>();
    for (const i of own) if (i.districtId) n.set(i.districtId, (n.get(i.districtId) ?? 0) + 1);
    return n;
  }, [own]);
  const districts = useMemo(
    () => [...districtCount.keys()].map((id) => ({ id, name: repo.getDistrict(id)?.name ?? id })).sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [districtCount],
  );
  const isMarket = section === 'pazarlar';
  const kindName = (k: string) => cityChoiceLabel(k, lang);
  const districtName = (id?: string | null) => (id ? repo.getDistrict(id)?.name : undefined);

  const shown = useMemo(() => {
    const q = normalizeName(query);
    return own
      .filter((i) => (!kind || i.category === kind) && (!district || i.districtId === district))
      .filter((i) => !day || (Array.isArray(i.values.gunler) && (i.values.gunler as string[]).includes(day)))
      .filter((i) => !q || normalizeName(`${i.name} ${i.category ? cityChoiceLabel(i.category, lang) : ''} ${repo.getDistrict(i.districtId ?? '')?.name ?? ''}`).includes(q))
      .sort((a, b) => Number(b.districtId === mine) - Number(a.districtId === mine) || a.name.localeCompare(b.name, 'tr'));
  }, [own, query, kind, district, day, mine, lang]);

  const text = (i: CityGuideItem, keys: string[]) => {
    const key = keys.find((k) => i.values[k] !== undefined && i.values[k] !== '');
    if (!key) return '';
    const v = i.values[key];
    if (key === 'ilk_saat_tl') return t('city.firstHour', { price: v });
    return Array.isArray(v) ? v.join(', ') : String(v);
  };
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const phoneOf = (i: CityGuideItem) => (typeof i.values.telefon === 'string' && i.values.telefon.trim() ? i.values.telefon : undefined);
  const mapOf = (i: CityGuideItem) => {
    if (i.location) return mapsUrl(i.location);
    const address = typeof i.values.adres === 'string' ? i.values.adres : '';
    const place = [districtName(i.districtId), repo.getProvince(i.provinceCode)?.name].filter(Boolean).join(', ');
    return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${i.name}, ${address}, ${place}`)}` : undefined;
  };
  const go = (i: CityGuideItem) => router.push({ pathname: '/city/item', params: { section, id: i.id } });
  const spotlight = (i: CityGuideItem) => {
    const phone = phoneOf(i);
    const map = mapOf(i);
    const address = typeof i.values.adres === 'string' ? i.values.adres : '';
    return (
      <Spotlight
        tag={mine && i.districtId === mine ? t('city.inYourDistrict') : districtName(i.districtId)}
        title={i.name}
        sub={[address || (i.category && i.category !== 'diger' ? kindName(i.category) : ''), districtName(i.districtId)].filter(Boolean).join(' · ') || undefined}
        onCall={phone ? () => open(telUrl(phone)) : undefined}
        onMap={map ? () => open(map) : undefined}
        onPress={() => go(i)}
      />
    );
  };
  const reset = () => {
    setKind(null);
    setDistrict(null);
    setDay(null);
    setQuery('');
    setAll(false);
  };

  const featuredKind = FEATURED[section];
  const filtered = !!(query || kind || district || day);
  const hub = !filtered && !all && !isMarket && own.length >= HUB_MIN && (kinds.length >= 2 || districts.length >= 3);
  const featured = !hub && featuredKind && !filtered ? shown[0] : undefined;
  const spot = !hub && !featuredKind && !filtered && shown.length > 1 ? shown[0] : undefined;
  const rows = featured || spot ? shown.slice(1) : shown;
  // Tür seçilmemişse liste türlere ayrılır (DEVLET, ÖZEL…).
  const sections = useMemo(() => {
    if (kind || kinds.length < 2) return [{ key: '', title: '', data: rows }];
    const order = new Map(kinds.map((k, n) => [k, n]));
    const groups = new Map<string, CityGuideItem[]>();
    for (const i of rows) {
      const k = i.category ?? 'diger';
      groups.set(k, [...(groups.get(k) ?? []), i]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
      .map(([k, data]) => ({ key: k, title: cityChoiceLabel(k, lang), data }));
  }, [rows, kind, kinds, lang]);
  const grouped = sections.length > 1;

  // İlçe kutuları: kullanıcının ilçesi başta, sonra kaydı çok olanlar.
  const topDistricts = [...districtCount.keys()].sort((a, b) => Number(b === mine) - Number(a === mine) || districtCount.get(b)! - districtCount.get(a)!);
  const districtTiles = topDistricts.length > MAX_DISTRICTS + 1 ? topDistricts.slice(0, MAX_DISTRICTS) : topDistricts;
  const moreDistricts = topDistricts.length > districtTiles.length;
  const near = mine && districtCount.has(mine) ? shown.find((i) => i.districtId === mine) : undefined;

  const hubView = (
    <>
      {kinds.length >= 2 ? (
        <>
          <HubTitle title={t('city.hub.byKind')} />
          {chunk(kinds.slice(0, MAX_KINDS), 2).map((pair, n) => (
            <View key={n} style={styles.gridRow}>
              {pair.map((k) => (
                <KindTile key={k} icon={KIND_ICON[k] ?? look.icon} name={kindName(k)} count={kindCount.get(k)!} onPress={() => setKind(k)} />
              ))}
              {pair.length < 2 ? <View style={styles.flex} /> : null}
            </View>
          ))}
        </>
      ) : null}
      {districts.length >= 2 ? (
        <>
          <HubTitle
            title={t('city.hub.byDistrict')}
            aside={moreDistricts ? t('city.hub.districts', { count: districts.length }) : undefined}
            onAside={moreDistricts ? () => setPickDistrict(true) : undefined}
          />
          {chunk([...districtTiles, ...(moreDistricts ? ['*'] : [])], 3).map((row, n) => (
            <View key={n} style={styles.gridRow}>
              {row.map((id) =>
                id === '*' ? (
                  <DistrictTile key="more" name={t('city.allDistricts')} note={t('city.hub.districts', { count: districts.length })} onPress={() => setPickDistrict(true)} />
                ) : (
                  <DistrictTile
                    key={id}
                    name={districtName(id) ?? id}
                    note={id === mine ? t('city.hub.yourDistrict', { count: districtCount.get(id) }) : String(districtCount.get(id))}
                    mine={id === mine}
                    onPress={() => setDistrict(id)}
                  />
                ),
              )}
              {Array.from({ length: 3 - row.length }, (_, k) => <View key={`e${k}`} style={styles.flex} />)}
            </View>
          ))}
        </>
      ) : null}
      {near ? (
        <>
          <HubTitle title={t('city.hub.nearest')} />
          {spotlight(near)}
        </>
      ) : null}
      <View style={styles.listAll}>
        <PillButton icon="format-list-bulleted" label={t('city.hub.listAll', { count: own.length })} onPress={() => setAll(true)} />
      </View>
      <PickerModal
        visible={pickDistrict}
        title={t('city.district')}
        options={districts.map((d) => ({ id: d.id, name: `${d.name} (${districtCount.get(d.id)})` }))}
        selectedId={district ?? ''}
        onSelect={(id) => {
          setDistrict(id || null);
          setPickDistrict(false);
        }}
        onClose={() => setPickDistrict(false)}
      />
    </>
  );

  const selection = [districtName(district), kind ? kindName(kind) : ''].filter(Boolean).join(' · ');

  return (
    <SectionList
      sections={hub ? [] : sections}
      keyExtractor={(i) => i.id}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <View style={styles.top}>
          {header}
          <SearchField glass value={query} onChangeText={setQuery} placeholder={t('city.search')} />
          {stale ? <AppText variant="caption" muted>{t('city.staleNote')}</AppText> : null}
          {lang !== 'tr' ? <AppText variant="caption" muted>{t('city.contentLanguage')}</AppText> : null}
          {hub ? (
            hubView
          ) : (
            <>
              {(kind || district || all) && own.length >= HUB_MIN ? <SelectionBar label={selection || t('city.hub.everything', { count: own.length })} onClear={reset} /> : null}
              <FilterRow
                districts={districts}
                district={district}
                onDistrict={setDistrict}
                kinds={kinds.filter((k) => k !== 'diger').map((k) => ({ id: k, name: kindName(k) }))}
                kind={kind}
                onKind={setKind}
              />
              {isMarket ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  <FilterChip label={t('city.allDays')} active={!day} onPress={() => setDay(null)} />
                  {DAYS.map((d) => <FilterChip key={d} label={d} active={day === d} onPress={() => setDay(day === d ? null : d)} />)}
                </ScrollView>
              ) : null}
              {featured ? (
                <FeaturedCard
                  kind={featuredKind!}
                  badge={t('city.featured')}
                  title={featured.name}
                  meta={[districtName(featured.districtId), text(featured, META_KEYS)].filter(Boolean).join(' · ')}
                  tag={featured.values.ucret_durumu === 'Ücretsiz' ? <Tag label={cityChoiceLabel('Ücretsiz', lang)} /> : undefined}
                  onPress={() => go(featured)}
                />
              ) : null}
              {spot ? spotlight(spot) : null}
              {rows.length ? <HubTitle title={t('city.listAll', { count: shown.length })} aside={mine && !district ? t('city.nearFirst') : undefined} /> : null}
            </>
          )}
        </View>
      }
      ListEmptyComponent={
        hub || featured || spot ? undefined : error ? (
          <StateMessage kind="error" message={t('city.loadError')} onRetry={retry} />
        ) : items === null ? (
          <StateMessage kind="loading" />
        ) : (
          <StateMessage kind="empty" message={own.length ? t('common.noResults') : t('city.empty')} />
        )
      }
      renderSectionHeader={({ section: s }) => (grouped && s.title ? <GroupLabel label={s.title} /> : null)}
      renderItem={({ item: i, index, section: s }) => {
        const meta = text(i, META_KEYS);
        const summary = meta || text(i, SUMMARY_KEYS);
        const free = i.values.ucret_durumu === 'Ücretsiz';
        const parking = section === 'otoparklar';
        const phone = phoneOf(i);
        const map = mapOf(i);
        const str = (k: string) => (typeof i.values[k] === 'string' ? (i.values[k] as string).trim() : '');
        const info = (
          [
            { icon: 'place', text: [str('adres'), districtName(i.districtId)].filter(Boolean).join(', ') },
            { icon: 'call', text: phone ?? '' },
            { icon: 'schedule', text: meta },
            { icon: 'info-outline', text: str('kisa_metin') || str('aciklama') },
          ] as InfoLine[]
        ).filter((x) => x.text);
        const first = index === 0;
        const last = index === s.data.length - 1;
        return (
          <View style={[styles.surfaceRow, frost(dark, c.surface, c.border), !first && { borderTopColor: 'transparent' }, first && styles.surfaceFirst, last && styles.surfaceLast]}>
            <FrostFill />
            <ExpandRow
              first={first}
              icon={look.icon}
              title={i.name}
              subtitle={[districtName(i.districtId), !grouped && i.category && i.category !== 'diger' ? kindName(i.category) : '', summary].filter(Boolean).join(' · ')}
              accessibilityLabel={[i.name, districtName(i.districtId), i.verified ? '' : t('city.unverified')].filter(Boolean).join(', ')}
              open={openId === i.id}
              onToggle={() => setOpenId(openId === i.id ? null : i.id)}
              info={info}
              onCall={phone ? () => open(telUrl(phone)) : undefined}
              onMap={map ? () => open(map) : undefined}
              onDetail={() => go(i)}
              trailing={
                free ? (
                  <Tag label={cityChoiceLabel('Ücretsiz', lang)} tone="green" />
                ) : parking && i.values.ilk_saat_tl === undefined ? (
                  <Tag label={t('city.noPrice')} tone="muted" />
                ) : phone ? (
                  <CallButton onPress={() => open(telUrl(phone))} />
                ) : !i.verified ? (
                  <Tag label={t('city.unverified')} tone="muted" />
                ) : undefined
              }
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
  gridRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  listAll: { flexDirection: 'row', marginTop: spacing.xs },
  // Satırlar tek yüzeyde: ilk ve son satır köşeleri yuvarlar, kenarlar birleşir.
  surfaceRow: { borderLeftWidth: 1, borderRightWidth: 1, paddingHorizontal: spacing.md, overflow: 'hidden' },
  surfaceFirst: { borderTopWidth: 1, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  surfaceLast: { borderBottomWidth: 1, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
});
