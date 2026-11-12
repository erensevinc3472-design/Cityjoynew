import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { listMunicipalities, municipalityIdsFor, normalizeName, type Municipality } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { GlassRow, KURUMLAR_ART, PhotoCard, SectionHeading, TOWNHALL_ART } from '@/components/city-tiles';
import { useProvinceCover } from '@/components/city-cover';
import { PageHead, PAGE_CONTENT, usePageBottom } from '@/components/page-head';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { useCityGuideMeta } from '@/lib/city-guide';
import { locationRepository as repo } from '@/lib/locations';
import { useOfficialProfiles } from '@/lib/official-profiles';
import { useUserLocation } from '@/lib/user-location';
import { spacing } from '@/theme/tokens';

/**
 * Belediye Hizmetleri (13. madde 35): üstte kullanıcının ilçe belediyesi ve büyükşehir / il belediyesi aynı büyüklükte
 * kartta, altında sık kullanılanlar ve açılır 'Diğer ilçe belediyeleri'. Her belediye resmî profiline gider. Duyurular
 * yalnızca Mahalle Meydanı > Duyurular'da (Eren, 3 Kasım 2026); burada 'son duyuru' satırı yok. Başkan adı / parti yok.
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

  const row = (m: Municipality) => <GlassRow key={m.id} icon='apartment' tint='teal' title={m.name} onPress={() => go(m)} />;
  /** Kutuları Benim Şehrim gibi ikişer ikişer dizer. */
  const pairs = (nodes: ReactNode[]) => {
    const out: ReactNode[] = [];
    for (let i = 0; i < nodes.length; i += 2)
      out.push(
        <View key={i} style={styles.pair}>
          {nodes[i]}
          {nodes[i + 1] ?? <View style={styles.flex} />}
        </View>,
      );
    return out;
  };
  const toGuide = () => router.push({ pathname: '/city/[section]', params: { section: 'belediye-hizmetleri' } });

  const header = (
    <PageHead cover={cover}
      title={t('city.townhall')}
      subtitle={t('city.townhallIntro')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/city'))}
    />
  );

  return (
    <Screen bleed cover={cover}>
      <ScrollView contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]} keyboardShouldPersistTaps='handled' showsVerticalScrollIndicator={false}>
        {header}
        <SearchField value={query} onChangeText={setQuery} placeholder={t('city.townhallSearch')} />

        {found ? (
          found.length ? pairs(found.map(row)) : <AppText muted style={styles.empty}>{t('common.noResults')}</AppText>
        ) : (
          <>
            {/* Benim Şehrim kartları gibi: ilçe belediyesi ve büyükşehir yan yana (altın renk yok, Eren 12 Kasım 2026). */}
            {own.length ? (
              <View style={styles.pair}>
                {own.map((m) => {
                  const mine = m.kind === 'ilce-belediyesi';
                  return (
                    <PhotoCard
                      key={m.id}
                      scene='townhall'
                      image={mine ? TOWNHALL_ART : KURUMLAR_ART}
                      height={112}
                      icon={mine ? 'location-city' : 'account-balance'}
                      title={m.name}
                      sub={profiles[m.id]?.about || t(mine ? 'city.myMunicipality' : 'city.cityMunicipality')}
                      onPress={() => go(m)}
                    />
                  );
                })}
              </View>
            ) : null}

            <SectionHeading icon='bolt' title={t('city.frequent')} />
            {pairs(
              FREQUENT.map((x) => (
                <GlassRow key={x.key} icon={x.icon} tint={x.tint} title={t(`city.frequentItem.${x.key}`)} onPress={() => (hasGuide ? toGuide() : own[0] && go(own[0]))} />
              )),
            )}
            {hasGuide ? <GlassRow icon='miscellaneous-services' tint='gold' title={t('city.serviceGuide')} sub={t('city.townhallHint')} onPress={toGuide} /> : null}

            {others.length ? (
              <>
                <GlassRow
                  icon='location-city'
                  title={t('city.otherMunicipalities')}
                  sub={t('city.districtCount', { count: others.length })}
                  open={open}
                  onPress={() => setOpen((x) => !x)}
                />
                {open ? pairs(others.map(row)) : null}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  flex: { flex: 1 },
  pair: { flexDirection: 'row', gap: spacing.sm },
  empty: { paddingVertical: spacing.md },
});
