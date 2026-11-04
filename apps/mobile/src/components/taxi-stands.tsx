import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { distanceKm, type CityGuideItem } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { ListRow, ListSurface, RowIcon, SectionTitle, Tag } from '@/components/inner';
import { StateMessage } from '@/components/state-message';
import { useCityGuideItems } from '@/lib/city-guide';
import { currentLocation } from '@/lib/location';
import { locationRepository as repo } from '@/lib/locations';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const TAXI = '#F2C94C';
const text = (i: CityGuideItem, k: string) => (typeof i.values[k] === 'string' ? (i.values[k] as string).trim() : '');

/**
 * Taksi durakları (13. madde 35, Acil > Taksi): en yakın durak büyük kartta, diğerleri altında. Veri Önemli Kurumlar
 * havuzundan (kategori "taksi-duragi"; OpenStreetMap'ten gelen ve telefonu olmayan duraklar "doğrulanmadı"). Tarife
 * yalnızca panelden girilmişse görünür. Konum izni önceden verildiyse sessizce alınır; verilmediyse ilçe sırası kullanılır
 * ve "Yakınımdakini bul" düğmesi izni ister.
 */
export function TaxiStands({ provinceCode, districtId }: { provinceCode: string; districtId?: string }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { items, error, retry } = useCityGuideItems(provinceCode, 'onemli-kurumlar');
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [asking, setAsking] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let alive = true;
    Location.getForegroundPermissionsAsync()
      .then((p) => (p.status === 'granted' ? currentLocation() : null))
      .then((r) => alive && r?.status === 'ready' && setHere(r.location))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const findNear = async () => {
    setAsking(true);
    const r = await currentLocation();
    setAsking(false);
    if (r.status === 'ready') setHere(r.location);
    else setDenied(true);
  };

  const stands = useMemo(() => {
    const list = (items ?? []).filter((i) => i.category === 'taksi-duragi');
    const km = (i: CityGuideItem) => (here && i.location ? distanceKm(here, i.location) : Infinity);
    return list
      .map((i) => ({ item: i, km: km(i) }))
      .sort((a, b) => a.km - b.km || Number(b.item.districtId === districtId) - Number(a.item.districtId === districtId) || a.item.name.localeCompare(b.item.name, 'tr'));
  }, [items, here, districtId]);

  if (error) return <StateMessage kind="error" message={t('taxi.loadError')} onRetry={retry} />;
  if (items === null) return <StateMessage kind="loading" />;
  if (!stands.length) return <AppText variant="caption" muted>{t('taxi.empty')}</AppText>;

  const [first, ...rest] = stands;
  const kmText = (km: number) => (Number.isFinite(km) ? t('taxi.distance', { km: km < 1 ? km.toFixed(1) : Math.round(km) }) : '');
  const place = (i: CityGuideItem) => [i.districtId ? repo.getDistrict(i.districtId)?.name : '', text(i, 'mahalle')].filter(Boolean).join(', ');
  const call = (i: CityGuideItem) => Linking.openURL(`tel:${text(i, 'telefon').replace(/[^\d+]/g, '')}`).catch(() => {});
  const route = (i: CityGuideItem) => {
    const at = i.location ? `${i.location.lat},${i.location.lng}` : encodeURIComponent(`${i.name}, ${text(i, 'adres') || place(i)}`);
    Linking.openURL(Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${at}` : `https://www.google.com/maps/dir/?api=1&destination=${at}`).catch(() => {});
  };
  const phone = text(first.item, 'telefon');
  const fare = text(first.item, 'tarife');

  return (
    <View style={styles.wrap}>
      <SectionTitle title={here ? t('taxi.nearest') : t('taxi.stands')} aside={!here && !denied ? (asking ? t('taxi.finding') : t('taxi.findNear')) : undefined} onAside={!here && !denied && !asking ? findNear : undefined} />
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.accentBorder }]}>
        <View style={styles.head}>
          <RowIcon icon="local-taxi" tint={TAXI} size={48} />
          <View style={styles.flex}>
            <AppText style={[styles.name, { color: c.textStrong }]} numberOfLines={2}>{first.item.name}</AppText>
            <AppText style={[styles.meta, { color: c.textMuted }]} numberOfLines={1}>{[kmText(first.km), place(first.item)].filter(Boolean).join(' · ')}</AppText>
          </View>
          {!phone || !first.item.verified ? <Tag label={t('taxi.unverified')} tone="muted" /> : null}
        </View>
        {fare ? <AppText style={[styles.meta, { color: c.text }]}>{t('taxi.fare', { fare })}</AppText> : null}
        <View style={styles.actions}>
          {phone ? <Action icon="call" label={t('taxi.call')} primary onPress={() => call(first.item)} /> : null}
          <Action icon="directions" label={t('taxi.route')} primary={!phone} onPress={() => route(first.item)} />
        </View>
        {!phone ? <AppText variant="caption" muted>{t('taxi.noPhone')}</AppText> : null}
      </View>
      {rest.length ? (
        <ListSurface>
          {rest.slice(0, 20).map(({ item, km }, n) => (
            <ListRow
              key={item.id}
              first={n === 0}
              leading={<RowIcon icon="local-taxi" tint={TAXI} />}
              title={item.name}
              subtitle={[kmText(km), place(item), text(item, 'telefon') ? '' : t('taxi.unverified')].filter(Boolean).join(' · ')}
              onPress={() => (text(item, 'telefon') ? call(item) : route(item))}
            />
          ))}
        </ListSurface>
      ) : null}
      <AppText variant="caption" muted>{t('taxi.source')}</AppText>
    </View>
  );
}

function Action({ icon, label, onPress, primary }: { icon: 'call' | 'directions'; label: string; onPress(): void; primary?: boolean }) {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, primary ? { backgroundColor: c.primary, borderColor: c.primary } : { borderColor: c.accentBorder }, { opacity: pressed ? 0.8 : 1 }]}>
      <MaterialIcons name={icon} size={18} color={primary ? c.onPrimary : c.accent} />
      <AppText style={[styles.actionText, { color: primary ? c.onPrimary : c.accent }]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm + 2 },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 23 },
  meta: { fontSize: 13 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1, flexDirection: 'row', gap: 6, minHeight: 44, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: fonts.bodySemi, fontSize: 14 },
});
