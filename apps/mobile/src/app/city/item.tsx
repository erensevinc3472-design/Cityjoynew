import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
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

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useCityGuideItems } from '@/lib/city-guide';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/** Başlıkta ya da düğmelerde zaten görünen, listede tekrar edilmeyen alanlar. */
const HIDDEN = new Set(['ad', 'hizmet_adi', 'baslik', 'kategori', 'tur', 'tip', 'mahalle', 'adres', 'telefon', 'web', 'basvuru_baglantisi', 'ilgili_baglanti', 'not', 'adimlar']);

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
 * Bir yerin ayrıntısı: arama, harita, web; bölüme özgü bilgiler; kaynak ve tarih. Doğrulanmamış bilgide açık uyarı
 * (sürprizsiz bilgi ilkesi, PROJE.md 1.1). Uygulama aramayı kendiliğinden yapmaz, telefonun arama ekranını açar.
 */
export default function CityItemScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { section, id } = useLocalSearchParams<{ section: CityGuideSectionId; id: string }>();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { location } = useUserLocation();
  const { items, error, retry } = useCityGuideItems(location?.provinceCode, section);
  const item: CityGuideItem | undefined = items?.find((i) => i.id === id);
  const def = citySection(section);

  const header = (
    <HeroHeader
      title={item?.name ?? (def ? (def.names[lang] ?? def.names.tr) : '')}
      subtitle={item?.category ? cityChoiceLabel(item.category, lang) : undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace({ pathname: '/city/[section]', params: { section } }))}
    />
  );

  if (!item) {
    return (
      <Screen header={header}>
        {error ? <StateMessage kind="error" message={t('city.loadError')} onRetry={retry} /> : items === null ? <StateMessage kind="loading" /> : <StateMessage kind="empty" message={t('city.notFound')} />}
      </Screen>
    );
  }

  const v = item.values;
  const place = [v.mahalle, item.districtId ? repo.getDistrict(item.districtId)?.name : '', repo.getProvince(item.provinceCode)?.name].filter(Boolean).join(', ');
  const address = typeof v.adres === 'string' ? v.adres : '';
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const mapLink = item.location
    ? mapsUrl(item.location)
    : address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name}, ${address}, ${place}`)}`
      : undefined;
  const details = def?.columns.filter((col) => !HIDDEN.has(col.key) && v[col.key] !== undefined) ?? [];
  const steps = Array.isArray(v.adimlar) ? v.adimlar : [];

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {item.verified ? null : (
          <View style={[styles.notice, { backgroundColor: c.dangerSoft }]} accessibilityRole="alert">
            <AppText variant="label" style={{ color: c.danger }}>{t('city.unverified')}</AppText>
            <AppText variant="caption">{t('city.unverifiedNote')}</AppText>
          </View>
        )}

        {place || address ? (
          <View style={styles.block}>
            {address ? <AppText>{address}</AppText> : null}
            {place ? <AppText variant="caption" muted>{place}</AppText> : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          {typeof v.telefon === 'string' ? <AppButton title={t('city.call', { number: ltr(v.telefon) })} onPress={() => open(telUrl(v.telefon as string))} /> : null}
          {mapLink ? <AppButton variant="secondary" title={t('city.openMap')} onPress={() => open(mapLink)} /> : null}
          {typeof v.web === 'string' ? <AppButton variant="secondary" title={t('city.website')} onPress={() => open(v.web as string)} /> : null}
          {typeof v.basvuru_baglantisi === 'string' ? <AppButton variant="secondary" title={t('city.apply')} onPress={() => open(v.basvuru_baglantisi as string)} /> : null}
          {typeof v.ilgili_baglanti === 'string' ? <AppButton variant="secondary" title={t('city.moreInfo')} onPress={() => open(v.ilgili_baglanti as string)} /> : null}
        </View>

        {steps.length ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <AppText variant="label">{cityFieldLabel('adimlar', lang)}</AppText>
            {steps.map((s, i) => (
              <AppText key={i}>{`${i + 1}. ${s}`}</AppText>
            ))}
          </View>
        ) : null}

        {details.length ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            {details.map((col) => (
              <View key={col.key} style={styles.row}>
                <AppText variant="caption" muted>{cityFieldLabel(col.key, lang)}</AppText>
                <AppText>{formatValue(col.key, v[col.key]!, lang)}</AppText>
              </View>
            ))}
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
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  notice: { borderRadius: radius.md, padding: spacing.md, gap: 4 },
  block: { gap: 2 },
  actions: { gap: spacing.sm },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  row: { gap: 2 },
});
