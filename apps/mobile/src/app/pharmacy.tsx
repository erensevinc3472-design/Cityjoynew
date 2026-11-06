import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { distanceKm, dutyWindow, isPharmacyListCurrent, pharmaciesFor, type DutyPharmacy } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { FilterChip, ListRow, ListSurface, RowIcon, SectionTitle, Tag } from '@/components/inner';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { currentLocation, knownLocation } from '@/lib/location';
import { locationRepository as repo } from '@/lib/locations';
import { useDutyPharmacies } from '@/lib/pharmacies';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const EDEVLET = 'https://www.turkiye.gov.tr/saglik-titck-nobetci-eczane-sorgulama';
type Mode = { kind: 'near' } | { kind: 'district'; name: string };
const same = (a: string, b?: string) => !!b && a.toLocaleLowerCase('tr') === b.toLocaleLowerCase('tr');

/**
 * Nöbetçi Eczaneler (önizleme S-Eczane; Eren: "tasarım böyleydi bunu yap", 5 Kasım 2026): başlık geri düğmesinin
 * yanında, nöbet durumu kartı ("Nöbet başladı", aralık, bitişe kalan saat; saatler il başına panelden, yoksa
 * 19.00–08.30), "Yakınımda" (açık gelir) ve ilçe düğmeleri, en yakın eczane büyük kartta (Ara, Yol tarifi), "Diğer
 * nöbetçiler" listesi. Liste bugüne ait değilse uyarı; liste yoksa e-Devlet.
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
  const [mode, setMode] = useState<Mode>({ kind: 'near' });
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locNote, setLocNote] = useState<string>();

  // İzin önceden verildiyse "Yakınımda" hemen uzaklığa göre sıralar; izin burada sorulmaz.
  useEffect(() => {
    knownLocation().then((l) => l && setHere((x) => x ?? { lat: l.lat, lng: l.lng }));
  }, []);

  const km = (p?: DutyPharmacy) => (here && p && p.lat !== undefined && p.lng !== undefined ? distanceKm(here, { lat: p.lat, lng: p.lng }) : undefined);
  const list = mode.kind === 'district' ? all.filter((p) => p.district === mode.name) : here ? [...all].sort((a, b) => (km(a) ?? 1e9) - (km(b) ?? 1e9)) : all;
  const [first, ...rest] = list;
  const current = day ? isPharmacyListCurrent(day) : false;
  const win = day ? dutyWindow(day) : undefined;
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

  const province = pc ? repo.getProvince(pc)?.name ?? '' : '';
  const header = (
    <HeroHeader
      inline
      title={t('pharmacy.screenTitle')}
      subtitle={pc ? `${province} · ${t('pharmacy.today')}` : undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/urgent'))}
      right={first ? { icon: 'map', label: t('pharmacy.mapAll'), onPress: () => open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${t('pharmacy.mapQuery')} ${mode.kind === 'district' ? mode.name : province}`)}`) } : undefined}
    />
  );

  const featuredTag = mode.kind === 'near' && km(first) !== undefined
    ? t('pharmacy.nearest', { km: fmtKm(km(first)) })
    : first && same(first.district, myDistrict) ? t('pharmacy.yourDistrict') : first?.district;

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
            {/* Nöbet durumu: sürüyorsa yeşil ve kalan saat; liste bugüne ait değilse uyarı (PROJE.md 9.1). */}
            {current && win ? (
              <View accessible style={[styles.status, { backgroundColor: c.successSoft, borderColor: `${c.success}55` }]}>
                <RowIcon icon="local-pharmacy" tint={c.success} size={44} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.statusRow}>
                    {win.phase === 'on' ? <View style={[styles.dot, { backgroundColor: c.success }]} /> : null}
                    <AppText style={[styles.statusTitle, { color: c.textStrong }]}>{win.phase === 'on' ? t('pharmacy.dutyOn') : t('pharmacy.dutySoon')}</AppText>
                  </View>
                  <AppText variant="caption" muted>
                    {t(win.startDay < 0 ? 'pharmacy.rangeYesterday' : 'pharmacy.rangeToday', { start: win.hours.start, end: win.hours.end })}
                  </AppText>
                </View>
                {win.phase === 'on' ? <AppText style={[styles.left, { color: c.success }]}>{t('pharmacy.hoursLeft', { count: win.hoursLeft })}</AppText> : null}
              </View>
            ) : (
              <View style={[styles.status, { backgroundColor: `${c.danger}1F`, borderColor: `${c.danger}55` }]}>
                <RowIcon icon="warning-amber" tint={c.danger} size={44} />
                <AppText style={[styles.statusTitle, { flex: 1, color: c.textStrong }]}>{t('pharmacy.stale')}</AppText>
              </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <FilterChip label={t('pharmacy.near')} icon="near-me" active={mode.kind === 'near'} onPress={near} />
              {districts.map((d) => <FilterChip key={d} label={d} active={mode.kind === 'district' && mode.name === d} onPress={() => setMode({ kind: 'district', name: d })} />)}
            </ScrollView>
            {locNote ? <AppText variant="caption" muted>{locNote}</AppText> : null}

            {first ? (
              <View style={[styles.featured, { backgroundColor: c.surface, borderColor: c.accentBorder }]}>
                {featuredTag ? <View style={{ alignSelf: 'flex-start' }}><Tag label={featuredTag} /></View> : null}
                <View style={{ gap: 2 }}>
                  <AppText accessibilityRole="header" style={[styles.featuredName, { color: c.textStrong }]}>{first.name}</AppText>
                  <AppText variant="caption" muted selectable>{first.address}</AppText>
                </View>
                <View style={styles.buttons}>
                  {first.phone ? <View style={{ flex: 1 }}><AppButton icon="call" title={t('pharmacy.call')} onPress={() => call(first)} /></View> : null}
                  <View style={{ flex: 1 }}><AppButton icon="navigation" variant="secondary" title={t('pharmacy.directions')} onPress={() => directions(first)} /></View>
                </View>
              </View>
            ) : null}

            {rest.length ? (
              <>
                <SectionTitle title={t('pharmacy.others')} aside={t('pharmacy.count', { count: rest.length })} />
                <ListSurface>
                  {rest.map((p, i) => {
                    const d = fmtKm(km(p));
                    return (
                      <ListRow
                        key={`${p.district}-${p.name}`}
                        first={i === 0}
                        leading={<RowIcon icon="add" tint={c.success} size={38} />}
                        title={p.name}
                        subtitle={d ? `${p.district} · ${d}` : `${p.district} · ${p.address}`}
                        trailing={p.phone ? (
                          <Pressable accessibilityRole="button" accessibilityLabel={`${t('pharmacy.call')}: ${p.name}`} onPress={() => call(p)} style={[styles.callBtn, { backgroundColor: c.accentSoft }]}>
                            <MaterialIcons name="call" size={18} color={c.primary} />
                          </Pressable>
                        ) : undefined}
                      />
                    );
                  })}
                </ListSurface>
              </>
            ) : null}
            <AppText variant="caption" muted>{t('pharmacy.updated', { date: updated })}</AppText>
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
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusTitle: { fontFamily: fonts.bodySemi, fontSize: 15 },
  left: { fontFamily: fonts.heading, fontSize: 22 },
  chips: { gap: spacing.xs, paddingVertical: 2 },
  featured: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1 },
  featuredName: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  callBtn: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
