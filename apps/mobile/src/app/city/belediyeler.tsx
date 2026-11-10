import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { listMunicipalities, municipalityIdsFor, normalizeName, type Municipality } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { GlossyIcon } from '@/components/glossy-icon';
import { useProvinceCover } from '@/components/city-cover';
import { PageHead, PAGE_CONTENT, usePageBottom } from '@/components/page-head';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { useCityGuideMeta } from '@/lib/city-guide';
import { LOOK } from '@/lib/city-look';
import { locationRepository as repo } from '@/lib/locations';
import { useOfficialProfiles } from '@/lib/official-profiles';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Belediye Hizmetleri (13. madde 35): üstte kullanıcının ilçe belediyesi ve büyükşehir / il belediyesi aynı büyüklükte
 * kartta, altında sık kullanılanlar ve açılır "Diğer ilçe belediyeleri". Her belediye resmî profiline gider. Duyurular
 * yalnızca Mahalle Meydanı > Duyurular'da (Eren, 3 Kasım 2026); burada "son duyuru" satırı yok. Başkan adı / parti yok.
 */
const FREQUENT = [
  { key: 'water', icon: 'water-drop', tint: '#5FD3DA' },
  { key: 'waste', icon: 'delete-outline', tint: '#34D399' },
  { key: 'police', icon: 'local-police', tint: '#E2B277' },
  { key: 'funeral', icon: 'local-florist', tint: '#C4B5FD' },
] as const;

export default function MunicipalitiesScreen() {
  const { t } = useTranslation();
  const cover = useProvinceCover();
  const bottom = usePageBottom();
  const router = useRouter();
  const c = useThemeColors();
  const { rtl, language } = useSettings();
  const { location } = useUserLocation();
  const provinceCode = location?.provinceCode;
  const { meta } = useCityGuideMeta(provinceCode);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const all = useMemo<Municipality[]>(() => {
    if (!provinceCode) return [];
    const p = repo.getProvince(provinceCode);
    return p ? listMunicipalities([p], repo.getDistricts(provinceCode)) : [];
  }, [provinceCode]);
  const ownIds = useMemo(() => (provinceCode ? municipalityIdsFor({ provinceCode, districtId: location?.districtId }) : []), [provinceCode, location?.districtId]);
  const own = ownIds.flatMap((id) => all.filter((m) => m.id === id));
  const others = all.filter((m) => !ownIds.includes(m.id)).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  const { profiles } = useOfficialProfiles(ownIds);
  const hasGuide = (meta?.sections['belediye-hizmetleri']?.count ?? 0) > 0;

  const q = normalizeName(query);
  const found = q ? all.filter((m) => normalizeName(m.name).includes(q)) : null;
  const go = (m: Municipality) => router.push({ pathname: '/official/[id]', params: { id: m.id, label: m.name } });
  const arrow = rtl ? 'arrow-back' : 'arrow-forward';

  const row = (m: Municipality) => (
    <Pressable
      key={m.id}
      accessibilityRole="button"
      accessibilityLabel={m.name}
      onPress={() => go(m)}
      style={({ pressed }) => [styles.row, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
      <MaterialIcons name="apartment" size={20} color={c.accent} />
      <AppText style={[styles.rowName, { color: c.textStrong }]} numberOfLines={1}>{m.name}</AppText>
      <MaterialIcons name={arrow} size={18} color={c.textSoft} />
    </Pressable>
  );

  const header = (
    <PageHead cover={cover}
      title={t('city.townhall')}
      subtitle={t('city.townhallIntro')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/city'))}
    />
  );

  return (
    <Screen bleed cover={cover}>
      <ScrollView contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {header}
        <SearchField value={query} onChangeText={setQuery} placeholder={t('city.townhallSearch')} />

        {found ? (
          <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
            {found.length ? found.map(row) : <AppText muted style={styles.empty}>{t('common.noResults')}</AppText>}
          </View>
        ) : (
          <>
            {own.map((m) => {
              const p = profiles[m.id];
              const look = m.kind === 'ilce-belediyesi' ? LOOK.belediye : LOOK.kurumlar;
              return (
                <Pressable
                  key={m.id}
                  accessibilityRole="button"
                  accessibilityLabel={m.name}
                  onPress={() => go(m)}
                  style={({ pressed }) => [styles.card, { backgroundColor: c.surface, borderColor: c.accentBorder, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
                  <View style={styles.cardTop}>
                    <GlossyIcon icon={m.kind === 'ilce-belediyesi' ? 'location-city' : 'account-balance'} colors={look.colors} size={48} />
                    <View style={styles.flex}>
                      <AppText style={[styles.kicker, { color: c.accent }]}>
                        {t(m.kind === 'ilce-belediyesi' ? 'city.myMunicipality' : 'city.cityMunicipality').toLocaleUpperCase(language ?? 'tr')}
                      </AppText>
                      <AppText style={[styles.cardName, { color: c.textStrong }]}>{m.name}</AppText>
                    </View>
                    <MaterialIcons name={arrow} size={22} color={c.accent} />
                  </View>
                  <AppText style={[styles.about, { color: c.textMuted }]} numberOfLines={2}>
                    {p?.about || t('city.profileSoon')}
                  </AppText>
                </Pressable>
              );
            })}

            <AppText style={[styles.section, { color: c.textStrong }]}>{t('city.frequent')}</AppText>
            <View style={styles.grid}>
              {FREQUENT.map((x) => (
                <Pressable
                  key={x.key}
                  accessibilityRole="button"
                  onPress={() => (hasGuide ? router.push({ pathname: '/city/[section]', params: { section: 'belediye-hizmetleri' } }) : own[0] && go(own[0]))}
                  style={({ pressed }) => [styles.tile, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}>
                  <View style={[styles.tileIcon, { backgroundColor: x.tint + '22' }]}>
                    <MaterialIcons name={x.icon} size={20} color={x.tint} />
                  </View>
                  <AppText style={[styles.tileText, { color: c.textStrong }]} numberOfLines={2}>{t(`city.frequentItem.${x.key}`)}</AppText>
                </Pressable>
              ))}
            </View>

            {hasGuide ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/city/[section]', params: { section: 'belediye-hizmetleri' } })}
                style={({ pressed }) => [styles.guide, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}>
                <GlossyIcon icon="miscellaneous-services" colors={LOOK.belediye.colors} size={40} />
                <View style={styles.flex}>
                  <AppText style={[styles.rowName, { color: c.textStrong }]}>{t('city.serviceGuide')}</AppText>
                  <AppText style={[styles.hint, { color: c.textMuted }]}>{t('city.townhallHint')}</AppText>
                </View>
                <MaterialIcons name={arrow} size={20} color={c.accent} />
              </Pressable>
            ) : null}

            {others.length ? (
              <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => setOpen((x) => !x)}
                  style={styles.boxHead}>
                  <AppText style={[styles.boxTitle, { color: c.textStrong }]}>{t('city.otherMunicipalities')}</AppText>
                  <AppText style={[styles.hint, { color: c.textMuted }]}>{t('city.districtCount', { count: others.length })}</AppText>
                  <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={24} color={c.textMuted} />
                </Pressable>
                {open ? others.map(row) : null}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1, gap: 2 },
  card: { gap: spacing.sm + 2, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 1 },
  cardName: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22 },
  about: { fontSize: 13, lineHeight: 19 },
  section: { fontFamily: fonts.heading, fontSize: 16, paddingTop: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1 },
  tileIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tileText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14 },
  guide: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1 },
  box: { borderRadius: radius.xl, borderWidth: 1, paddingHorizontal: spacing.md, overflow: 'hidden' },
  boxHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56 },
  boxTitle: { flex: 1, fontFamily: fonts.heading, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, borderTopWidth: StyleSheet.hairlineWidth },
  rowName: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14 },
  hint: { fontSize: 12 },
  empty: { paddingVertical: spacing.md },
});
