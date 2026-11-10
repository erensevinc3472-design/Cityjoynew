import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type ComponentProps } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  cityChoiceLabel,
  cityFieldLabel,
  citySection,
  ltr,
  mapsUrl,
  telUrl,
  type CityGuideItem,
  type CityGuideSectionId,
  type CityValue,
  type LanguageCode,
} from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { frost, PillButton } from '@/components/city-hub';
import { useProvinceCover } from '@/components/city-cover';
import { FrostFill } from '@/components/glass';
import { PageHead, PAGE_CONTENT, usePageBottom } from '@/components/page-head';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useCityGuideItems } from '@/lib/city-guide';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** Başlıkta ya da düğmelerde zaten görünen, listede tekrar edilmeyen alanlar. */
const HIDDEN = new Set(['ad', 'hizmet_adi', 'baslik', 'kategori', 'tur', 'tip', 'mahalle', 'adres', 'telefon', 'web', 'basvuru_baglantisi', 'ilgili_baglanti', 'not', 'adimlar']);
/** Açıklama olarak üstte gösterilen alanlar (ilk dolu olan). */
const ABOUT_KEYS = ['aciklama', 'kisa_metin'];
/** Bu kadar karakterden uzun açıklama "Daha fazla" ile açılır. */
const ABOUT_CLAMP = 180;
/** Simgeli bilgi şeridine (örnekteki Ziyaret saatleri, Giriş ücreti…) çıkan alanlar: anahtara göre simge. */
const FACT_ICONS: [RegExp, IconName][] = [
  [/saat|calisma|acilis/, 'schedule'],
  [/gun/, 'event'],
  [/ucret|_tl$/, 'confirmation-number'],
  [/sure/, 'timelapse'],
  [/erisilebilir|engelli/, 'accessible'],
];
const MAX_FACTS = 4;
const MAX_NEARBY = 8;

function formatValue(key: string, v: CityValue, lang: LanguageCode): string {
  if (typeof v === 'boolean') return cityChoiceLabel(v ? 'Evet' : 'Hayır', lang);
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'number') return key.endsWith('_tl') ? `${v.toLocaleString('tr-TR')} ₺` : v.toLocaleString('tr-TR');
  return key === 'ucret_durumu' ? cityChoiceLabel(v, lang) : v;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/**
 * Bir yerin ayrıntısı (Eren'in tasarım örneği `ayrinti-muze.png`, 10 Kasım 2026): kayan ince başlık ve il fotoğrafı,
 * tür etiketi, açıklama ("Daha fazla"), simgeli bilgi şeridi, adres kartı, Ara / Yol tarifi, diğer bilgiler ve aynı
 * ilçedeki diğer noktalar. Örnekteki paylaş, favori, puan, sekmeler ve gömülü harita yeni özellik / maliyet olduğundan
 * yok. Doğrulanmamış bilgide açık uyarı (sürprizsiz bilgi ilkesi, PROJE.md 1.1). Uygulama aramayı kendiliğinden yapmaz,
 * telefonun arama ekranını açar.
 */
export default function CityItemScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const dark = useResolvedScheme() === 'dark';
  const cover = useProvinceCover();
  const bottom = usePageBottom();
  const { section, id } = useLocalSearchParams<{ section: CityGuideSectionId; id: string }>();
  const { language, rtl } = useSettings();
  const lang = language ?? 'tr';
  const { location } = useUserLocation();
  const { items, error, retry } = useCityGuideItems(location?.provinceCode, section);
  const item: CityGuideItem | undefined = items?.find((i) => i.id === id);
  const def = citySection(section);
  const [more, setMore] = useState(false);
  const districtName = (d?: string) => (d ? repo.getDistrict(d)?.name : undefined);

  const nearby = useMemo(
    () => (item ? (items ?? []).filter((i) => i.id !== item.id && item.districtId && i.districtId === item.districtId).slice(0, MAX_NEARBY) : []),
    [items, item],
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/city/[section]', params: { section } }));

  if (!item) {
    return (
      <Screen bleed cover={cover}>
        <ScrollView contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]}>
          <PageHead cover={cover} title={def ? (def.names[lang] ?? def.names.tr) : ''} onBack={back} />
          {error ? <StateMessage kind="error" message={t('city.loadError')} onRetry={retry} /> : items === null ? <StateMessage kind="loading" /> : <StateMessage kind="empty" message={t('city.notFound')} />}
        </ScrollView>
      </Screen>
    );
  }

  const v = item.values;
  const place = [v.mahalle, districtName(item.districtId), repo.getProvince(item.provinceCode)?.name].filter(Boolean).join(', ');
  const address = typeof v.adres === 'string' ? v.adres : '';
  const phone = typeof v.telefon === 'string' && v.telefon.trim() ? v.telefon : undefined;
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const mapLink = item.location
    ? mapsUrl(item.location)
    : address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name}, ${address}, ${place}`)}`
      : undefined;
  const directions = item.location ? `https://www.google.com/maps/dir/?api=1&destination=${item.location.lat.toFixed(6)},${item.location.lng.toFixed(6)}` : mapLink;
  const aboutKey = ABOUT_KEYS.find((k) => typeof v[k] === 'string' && (v[k] as string).trim());
  const about = aboutKey ? (v[aboutKey] as string).trim() : '';
  // Otoparkta kapasite ve doluluk gösterilmez (Eren, 3 Kasım 2026): canlı takip yok, eski sayı yanıltır.
  const details = def?.columns.filter((col) => !HIDDEN.has(col.key) && col.key !== aboutKey && !(section === 'otoparklar' && col.key === 'kapasite') && v[col.key] !== undefined && v[col.key] !== '') ?? [];
  const iconOf = (key: string) => FACT_ICONS.find(([re]) => re.test(key))?.[1];
  const facts = details.filter((col) => iconOf(col.key)).slice(0, MAX_FACTS);
  const rest = details.filter((col) => !facts.includes(col));
  const steps = Array.isArray(v.adimlar) ? v.adimlar : [];
  const kind = item.category && item.category !== 'diger' ? cityChoiceLabel(item.category, lang) : def ? (def.names[lang] ?? def.names.tr) : '';
  const links = (
    [
      ['web', 'language', t('city.website')],
      ['basvuru_baglantisi', 'open-in-new', t('city.apply')],
      ['ilgili_baglanti', 'info-outline', t('city.moreInfo')],
    ] as const
  ).filter(([k]) => typeof v[k] === 'string' && (v[k] as string).trim());
  const card = [styles.card, frost(dark, c.surface, c.border)];

  return (
    <Screen bleed cover={cover}>
      <ScrollView contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false}>
        <PageHead cover={cover} title={item.name} subtitle={place || undefined} onBack={back} extend={40} />

        {kind ? (
          <View style={[styles.kind, { borderColor: dark ? 'rgba(226, 178, 119, 0.45)' : c.border, backgroundColor: dark ? 'rgba(226, 178, 119, 0.10)' : c.accentSoft }]}>
            <MaterialIcons name="local-offer" size={14} color={dark ? c.heroAccent : c.primary} />
            <AppText style={[styles.kindText, { color: dark ? c.heroAccent : c.primary }]}>{kind}</AppText>
          </View>
        ) : null}

        {item.verified ? null : (
          <View style={[styles.notice, { backgroundColor: c.dangerSoft }]} accessibilityRole="alert">
            <AppText variant="label" style={{ color: c.danger }}>{t('city.unverified')}</AppText>
            <AppText variant="caption">{t('city.unverifiedNote')}</AppText>
          </View>
        )}

        {about ? (
          <View style={styles.about}>
            <AppText style={[styles.aboutText, { color: c.text }]} numberOfLines={more || about.length <= ABOUT_CLAMP ? undefined : 4}>{about}</AppText>
            {about.length > ABOUT_CLAMP ? (
              <Pressable accessibilityRole="button" onPress={() => setMore(!more)} hitSlop={8} style={styles.moreRow}>
                <AppText style={[styles.more, { color: dark ? c.heroAccent : c.primary }]}>{more ? t('city.readLess') : t('city.readMore')}</AppText>
                <MaterialIcons name={more ? 'expand-less' : 'expand-more'} size={18} color={dark ? c.heroAccent : c.primary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {facts.length ? (
          <View style={[card, styles.facts]}>
            <FrostFill />
            {facts.map((col, n) => (
              <View key={col.key} style={[styles.fact, n > 0 && { borderStartWidth: 1, borderColor: c.border }]}>
                <MaterialIcons name={iconOf(col.key)!} size={22} color={dark ? c.heroAccent : c.primary} />
                <AppText style={[styles.factLabel, { color: c.textStrong }]} numberOfLines={2}>{cityFieldLabel(col.key, lang)}</AppText>
                <AppText style={[styles.factValue, { color: c.textMuted }]} numberOfLines={3}>{formatValue(col.key, v[col.key]!, lang)}</AppText>
              </View>
            ))}
          </View>
        ) : null}

        {address || place ? (
          <View style={[card, styles.addressCard]}>
            <FrostFill />
            <View style={[styles.pin, { backgroundColor: dark ? 'rgba(226, 178, 119, 0.12)' : c.accentSoft }]}>
              <MaterialIcons name="place" size={20} color={dark ? c.heroAccent : c.primary} />
            </View>
            <View style={styles.flex}>
              <AppText style={[styles.cardTitle, { color: c.textStrong }]}>{t('city.address')}</AppText>
              {address ? <AppText style={[styles.cardText, { color: c.text }]}>{address}</AppText> : null}
              {place ? <AppText style={[styles.cardText, { color: c.textMuted }]}>{place}</AppText> : null}
            </View>
          </View>
        ) : null}

        {phone || directions ? (
          <View style={styles.actions}>
            {phone ? (
              <View style={styles.flex}>
                <PillButton icon="call" label={t('city.callShort')} onPress={() => open(telUrl(phone))} />
              </View>
            ) : null}
            {directions ? (
              <View style={styles.flex}>
                <PillButton gold icon="directions" label={t('city.directions')} onPress={() => open(directions)} />
              </View>
            ) : null}
          </View>
        ) : null}
        {phone ? <AppText style={[styles.phone, { color: c.textMuted }]}>{ltr(phone)}</AppText> : null}
        {links.length ? (
          <View style={styles.links}>
            {links.map(([k, icon, label]) => (
              <PillButton key={k} small icon={icon} label={label} onPress={() => open(v[k] as string)} />
            ))}
          </View>
        ) : null}

        {steps.length ? (
          <View style={card}>
            <FrostFill />
            <AppText style={[styles.cardTitle, { color: c.textStrong }]}>{cityFieldLabel('adimlar', lang)}</AppText>
            {steps.map((s, i) => (
              <AppText key={i} style={[styles.cardText, { color: c.text }]}>{`${i + 1}. ${s}`}</AppText>
            ))}
          </View>
        ) : null}

        {rest.length ? (
          <View style={card}>
            <FrostFill />
            <AppText style={[styles.cardTitle, { color: c.textStrong }]}>{t('city.infoTitle')}</AppText>
            {rest.map((col, n) => (
              <View key={col.key} style={[styles.row, n > 0 && { borderTopWidth: 1, borderColor: c.border }]}>
                <AppText style={[styles.rowLabel, { color: c.textMuted }]}>{cityFieldLabel(col.key, lang)}</AppText>
                <AppText style={[styles.cardText, { color: c.text }]}>{formatValue(col.key, v[col.key]!, lang)}</AppText>
              </View>
            ))}
          </View>
        ) : null}

        {nearby.length ? (
          <View style={styles.nearby}>
            <AppText accessibilityRole="header" style={[styles.sectionTitle, { color: c.textStrong }]}>{t('city.nearby')}</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearRow}>
              {nearby.map((i) => (
                <Pressable
                  key={i.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/city/item', params: { section, id: i.id } })}
                  style={({ pressed }) => [styles.nearCard, frost(dark, c.surface, c.border), { opacity: pressed ? 0.8 : 1 }]}>
                  <FrostFill />
                  <AppText style={[styles.cardTitle, { color: c.textStrong }]} numberOfLines={2}>{i.name}</AppText>
                  <View style={styles.nearFoot}>
                    <MaterialIcons name="place" size={14} color={dark ? c.heroAccent : c.primary} />
                    <AppText style={[styles.rowLabel, styles.flex, { color: c.textMuted }]} numberOfLines={1}>
                      {i.category && i.category !== 'diger' ? cityChoiceLabel(i.category, lang) : districtName(i.districtId)}
                    </AppText>
                    <MaterialIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={18} color={c.textMuted} />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <AppText variant="caption" muted>
          {t('city.source', { source: hostOf(item.source), date: new Date(item.sourceDate).toLocaleDateString(lang) })}
          {item.verified && item.verifiedAt ? ` · ${t('city.verifiedOn', { date: new Date(item.verifiedAt).toLocaleDateString(lang) })}` : ''}
        </AppText>
        {lang !== 'tr' ? <AppText variant="caption" muted>{t('city.contentLanguage')}</AppText> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm + 4 },
  flex: { flex: 1 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, minHeight: 30, borderRadius: radius.pill, borderWidth: 1 },
  kindText: { fontFamily: fonts.bodySemi, fontSize: 12.5 },
  notice: { borderRadius: radius.md, padding: spacing.md, gap: 4 },
  about: { gap: 4 },
  aboutText: { fontSize: 14, lineHeight: 21 },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  more: { fontFamily: fonts.bodySemi, fontSize: 13 },
  card: { borderRadius: radius.lg + 2, borderWidth: 1, padding: spacing.md - 2, gap: spacing.sm, overflow: 'hidden' },
  // Simgeli bilgi şeridi: en çok dört sütun, aralarında ince çizgi.
  facts: { flexDirection: 'row', paddingHorizontal: 0, gap: 0 },
  fact: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  factLabel: { fontFamily: fonts.bodySemi, fontSize: 11.5, lineHeight: 15, textAlign: 'center' },
  factValue: { fontSize: 11.5, lineHeight: 15, textAlign: 'center' },
  addressCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  pin: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.heading, fontSize: 13.5, lineHeight: 18 },
  cardText: { fontSize: 13, lineHeight: 18 },
  phone: { fontSize: 12, textAlign: 'center', marginTop: -4 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { gap: 2, paddingTop: spacing.sm },
  rowLabel: { fontSize: 12, lineHeight: 16 },
  nearby: { gap: spacing.sm, marginTop: spacing.xs },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 21 },
  nearRow: { gap: spacing.sm, paddingEnd: spacing.md },
  nearCard: { width: 150, minHeight: 86, justifyContent: 'space-between', gap: spacing.sm, padding: spacing.md - 4, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  nearFoot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
