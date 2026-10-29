import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { listMunicipalities, municipalityIdsFor, normalizeName, profileIdOfAuthor, type Municipality } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { GlossyIcon } from '@/components/glossy-icon';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { useAnnouncements } from '@/lib/announcements';
import { useCityGuideMeta } from '@/lib/city-guide';
import { LOOK } from '@/lib/city-look';
import { locationRepository as repo } from '@/lib/locations';
import { useOfficialProfiles } from '@/lib/official-profiles';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Belediye Hizmetleri (tasarım: belediye-hizmetleri.html): üstte kullanıcının ilçe belediyesi ve büyükşehir / il
 * belediyesi (künyesinin başı ve son duyurusu), altında açılır "Diğer ilçe belediyeleri". Her belediye resmî profiline
 * gider. Şehir rehberinde belediye hizmetleri bilgisi varsa "Hizmet rehberi" satırı da çıkar.
 */
export default function MunicipalitiesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { rtl, language } = useSettings();
  const { location } = useUserLocation();
  const provinceCode = location?.provinceCode;
  const { meta } = useCityGuideMeta(provinceCode);
  const { list: news } = useAnnouncements(location, 'hepsi');
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
    <HeroHeader
      title={t('city.townhall')}
      subtitle={t('city.townhallIntro')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/city'))}
    />
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <SearchField value={query} onChangeText={setQuery} placeholder={t('city.townhallSearch')} />

        {found ? (
          <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
            {found.length ? found.map(row) : <AppText muted style={styles.empty}>{t('common.noResults')}</AppText>}
          </View>
        ) : (
          <>
            {own.map((m) => {
              const p = profiles[m.id];
              const last = (news ?? []).find((a) => profileIdOfAuthor(a.author) === m.id);
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
                  {last ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${t('city.lastNews')}: ${last.title}`}
                      onPress={() => router.push({ pathname: '/announcements/[id]', params: { id: last.id } })}
                      style={[styles.news, { backgroundColor: c.accentSoft }]}>
                      <MaterialIcons name="campaign" size={18} color={c.accent} />
                      <AppText style={[styles.newsText, { color: c.textStrong }]} numberOfLines={2}>{last.title}</AppText>
                    </Pressable>
                  ) : null}
                </Pressable>
              );
            })}

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
  cardName: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 23 },
  about: { fontSize: 13, lineHeight: 19 },
  news: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 2, borderRadius: radius.lg },
  newsText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: fonts.bodySemi },
  guide: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1 },
  box: { borderRadius: radius.xl, borderWidth: 1, paddingHorizontal: spacing.md, overflow: 'hidden' },
  boxHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56 },
  boxTitle: { flex: 1, fontFamily: fonts.heading, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, borderTopWidth: StyleSheet.hairlineWidth },
  rowName: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15 },
  hint: { fontSize: 12 },
  empty: { paddingVertical: spacing.md },
});
