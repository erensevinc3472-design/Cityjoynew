import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { distanceKm, isPharmacyListCurrent, pharmaciesFor, type DutyPharmacy } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { FilterChip, ListRow, ListSurface, RowIcon, SectionTitle, Tag } from '@/components/inner';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { currentLocation } from '@/lib/location';
import { locationRepository as repo } from '@/lib/locations';
import { useDutyPharmacies } from '@/lib/pharmacies';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const EDEVLET = 'https://www.turkiye.gov.tr/saglik-titck-nobetci-eczane-sorgulama';
type Mode = { kind: 'near' } | { kind: 'district'; name: string };

/**
 * Nöbetçi Eczaneler (önizleme S-Eczane, Eren onayladı 3 Kasım 2026): üstte liste durumu (son güncelleme), "Yakınımda" ve
 * ilçe düğmeleri, en yakın / ilçendeki eczane büyük kartta (Ara, Yol tarifi), "Diğer nöbetçiler" listesi (satırda Ara).
 * Nöbet saatleri servisten gelmediği için gösterilmez (uydurma yok). Liste bugüne ait değilse uyarı; yoksa e-Devlet.
 */
export default function PharmacyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const { location } = useUserLocation();
  const pc = location?.provinceCode;
  const { day, failed } = useDutyPharmacies(pc);
  const myDistrict = location?.districtId ? repo.getDistrict(location.districtId)?.name : undefined;
  const all = useMemo(() => (day ? pharmaciesFor(day, myDistrict) : []), [day, myDistrict]);
  const districts = useMemo(() => [...new Set(all.map((p) => p.district))], [all]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locNote, setLocNote] = useState<string>();
  const active: Mode = mode ?? (myDistrict && districts.some((d) => d.toLocaleLowerCase('tr') === myDistrict.toLocaleLowerCase('tr'))
    ? { kind: 'district', name: districts.find((d) => d.toLocaleLowerCase('tr') === myDistrict.toLocaleLowerCase('tr'))! }
    : { kind: 'near' });

  const km = (p: DutyPharmacy) => (here && p.lat !== undefined && p.lng !== undefined ? distanceKm(here, { lat: p.lat, lng: p.lng }) : undefined);
  const list = active.kind === 'district'
    ? all.filter((p) => p.district === active.name)
    : here
      ? [...all].sort((a, b) => (km(a) ?? 1e9) - (km(b) ?? 1e9))
      : all;
  const [first, ...rest] = list;
  const current = day ? isPharmacyListCurrent(day) : false;
  const fmtKm = (d?: number) => (d === undefined ? undefined : `${d.toLocaleString(language ?? 'tr', { maximumFractionDigits: 1 })} km`);
  const updated = day?.fetchedAt ? new Date(day.fetchedAt).toLocaleString(language ?? 'tr', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const call = (p: DutyPharmacy) => p.phone && open(`tel:${p.phone.replace(/[^0-9+]/g, '')}`);
  const directions = (p: DutyPharmacy) =>
    open(p.lat !== undefined && p.lng !== undefined
      ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${p.name}, ${p.address}`)}`);

  const near = async () => {
    setMode({ kind: 'near' });
    setLocNote(undefined);
    if (here) return;
    const r = await currentLocation();
    if (r.status === 'ready') {
      setHere({ lat: r.location.lat, lng: r.location.lng });
      if (!all.some((p) => p.lat !== undefined)) setLocNote(t('pharmacy.noCoords'));
    } else setLocNote(r.status === 'denied' ? t('pharmacy.locDenied') : t('pharmacy.locUnavailable'));
  };

  const header = (
    <HeroHeader
      title={t('pharmacy.title')}
      subtitle={pc ? t('pharmacy.subtitle', { province: repo.getProvince(pc)?.name ?? '' }) : undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/urgent'))}
      right={first ? { icon: 'map', label: t('pharmacy.mapAll'), onPress: () => open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${t('pharmacy.mapQuery')} ${active.kind === 'district' ? active.name : repo.getProvince(pc!)?.name ?? ''}`)}`) } : undefined}
    />
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content}>
        {!pc ? <StateMessage kind="empty" message={t('pharmacy.noLocation')} /> : failed ? <StateMessage kind="error" message={t('pharmacy.loadError')} /> : day === undefined ? <StateMessage kind="loading" /> : !day || !all.length ? (
          <View style={{ gap: spacing.md }}>
            <StateMessage kind="empty" message={t('pharmacy.none')} />
            <AppButton variant="secondary" title={t('pharmacy.edevlet')} onPress={() => open(EDEVLET)} />
          </View>
        ) : (
          <>
            {/* Liste durumu: güncelse yeşil, değilse uyarı (PROJE.md 9.1). */}
            <View style={[styles.status, { backgroundColor: current ? c.successSoft : `${c.danger}1F`, borderColor: current ? `${c.success}55` : `${c.danger}55` }]}>
              <RowIcon icon={current ? 'local-pharmacy' : 'warning-amber'} tint={current ? c.success : c.danger} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText style={[styles.statusTitle, { color: c.textStrong }]}>{current ? t('pharmacy.listToday') : t('pharmacy.stale')}</AppText>
                <AppText variant="caption" muted>{t('pharmacy.updated', { date: updated })}</AppText>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <FilterChip label={t('pharmacy.near')} icon="near-me" active={active.kind === 'near'} onPress={near} />
              {districts.map((d) => <FilterChip key={d} label={d} active={active.kind === 'district' && active.name === d} onPress={() => setMode({ kind: 'district', name: d })} />)}
            </ScrollView>
            {locNote ? <AppText variant="caption" muted>{locNote}</AppText> : null}

            {first ? (
              <View style={[styles.featured, { backgroundColor: c.surface, borderColor: c.accentBorder }]}>
                <View style={{ alignSelf: 'flex-start' }}>
                  <Tag label={active.kind === 'near' && km(first) !== undefined ? t('pharmacy.nearest', { km: fmtKm(km(first)) }) : myDistrict && first.district.toLocaleLowerCase('tr') === myDistrict.toLocaleLowerCase('tr') ? t('pharmacy.yourDistrict') : first.district} />
                </View>
                <View style={{ gap: 2 }}>
                  <AppText accessibilityRole="header" style={[styles.featuredName, { color: c.textStrong }]}>{first.name}</AppText>
                  <AppText variant="caption" muted selectable>{first.address}</AppText>
                </View>
                <View style={styles.buttons}>
                  {first.phone ? <View style={{ flex: 1 }}><AppButton title={t('pharmacy.call')} onPress={() => call(first)} /></View> : null}
                  <View style={{ flex: 1 }}><AppButton variant="secondary" title={t('pharmacy.directions')} onPress={() => directions(first)} /></View>
                </View>
              </View>
            ) : null}

            {rest.length ? (
              <>
                <SectionTitle title={t('pharmacy.others')} aside={t('pharmacy.count', { count: rest.length })} />
                <ListSurface>
                  {rest.map((p, i) => (
                    <ListRow
                      key={`${p.district}-${p.name}`}
                      first={i === 0}
                      leading={<RowIcon icon="add" tint={c.success} size={38} />}
                      title={p.name}
                      subtitle={[active.kind === 'near' ? p.district : null, fmtKm(km(p)), p.address].filter(Boolean).join(' · ')}
                      trailing={p.phone ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`${t('pharmacy.call')}: ${p.name}`} onPress={() => call(p)} style={[styles.callBtn, { backgroundColor: c.accentSoft }]}>
                          <MaterialIcons name="call" size={18} color={c.primary} />
                        </Pressable>
                      ) : undefined}
                    />
                  ))}
                </ListSurface>
              </>
            ) : null}
          </>
        )}
        <AppText variant="caption" muted>{t('pharmacy.note')}</AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1 },
  statusTitle: { fontFamily: fonts.bodySemi, fontSize: 15 },
  chips: { gap: spacing.xs, paddingVertical: 2 },
  featured: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1 },
  featuredName: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  callBtn: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
