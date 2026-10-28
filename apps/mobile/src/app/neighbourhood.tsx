import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  municipalityIdsFor,
  muhtarProfileId,
  sameNeighbourhoodName,
  type CityGuideItem,
  type OfficialProfile,
} from '@cityjoy/shared';

import { AnnouncementCard } from '@/components/announcement-card';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { EventCard } from '@/components/event-card';
import { HeroHeader, LocationChip } from '@/components/hero-header';
import { OfficialProfileCard } from '@/components/official-profile-card';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useAnnouncements } from '@/lib/announcements';
import { useCityGuideItems } from '@/lib/city-guide';
import { useEvents } from '@/lib/events';
import { locationRepository as repo } from '@/lib/locations';
import { useOfficialProfiles } from '@/lib/official-profiles';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** Şehir rehberindeki muhtarlık satırı, resmî profil girilmemişse yedek olarak (doğrulanmamış olabilir). */
function guideMuhtar(item: CityGuideItem): OfficialProfile {
  const v = item.values;
  return { id: item.id, type: 'muhtar', name: str(v.muhtar_adi) ?? '', phone: str(v.telefon), address: str(v.adres), hours: str(v.calisma_saatleri), updatedAt: '' };
}

/**
 * Mahalle Meydanı (PROJE.md 5.1, Eren onayladı): mahallenin künyesi, akış değil. Muhtarlık (resmî profil, yoksa şehir
 * rehberindeki kayıt), mahalleye özel duyurular, yakındaki etkinlikler, afet toplanma alanları ve belediyeler.
 * Okumalar önbellekli: duyuru ve etkinlik il başına tek sorgu, profiller tek tek okuma (en çok 3).
 */
export default function NeighbourhoodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { rtl } = useSettings();
  const { location } = useUserLocation();
  const [name, setName] = useState<string>();
  const nb = location?.neighbourhoodId;
  const districtId = location?.districtId;
  const provinceCode = location?.provinceCode;

  useEffect(() => {
    setName(undefined);
    if (!districtId || !nb) return;
    repo.getNeighbourhoods(districtId).then((l) => setName(l.find((n) => n.id === nb)?.name), () => {});
  }, [districtId, nb]);

  const muhtarId = nb ? muhtarProfileId(nb) : null;
  const municipalityIds = provinceCode ? municipalityIdsFor({ provinceCode, districtId }) : [];
  const { profiles, loading } = useOfficialProfiles(muhtarId ? [muhtarId, ...municipalityIds] : []);
  const { list: announcements } = useAnnouncements(location);
  const { list: events } = useEvents(provinceCode);
  const guideMuhtars = useCityGuideItems(nb ? provinceCode : undefined, 'muhtarliklar');
  const gathering = useCityGuideItems(nb ? provinceCode : undefined, 'toplanma-alanlari');

  const district = districtId ? repo.getDistrict(districtId)?.name : undefined;
  const province = provinceCode ? repo.getProvince(provinceCode)?.name : undefined;
  const place = [district, province].filter(Boolean).join(', ');
  const inMahalle = (i: CityGuideItem) => i.districtId === districtId && !!name && sameNeighbourhoodName(str(i.values.mahalle) ?? '', name);

  const header = (
    <HeroHeader title={t('neighbourhood.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/city'))}>
      <LocationChip label={[name, district, province].filter(Boolean).join(', ') || t('home.noLocation')} onPress={() => router.push('/location?edit=1')} />
    </HeroHeader>
  );

  if (!nb) {
    return (
      <Screen header={header}>
        <View style={styles.content}>
          <StateMessage kind="empty" message={t('neighbourhood.needNeighbourhood')} />
          <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
        </View>
      </Screen>
    );
  }

  const muhtarlik = name ? t('announcements.muhtarOf', { place: name }) : t('neighbourhood.muhtarlik');
  const official = muhtarId ? profiles[muhtarId] : undefined;
  const fallback = official ? undefined : guideMuhtars.items?.find(inMahalle);
  const muhtar = official ?? (fallback ? guideMuhtar(fallback) : null);
  const municipalities = municipalityIds.flatMap((id) => (profiles[id] ? [profiles[id]!] : []));

  const mine = (announcements ?? []).filter((a) => a.region.neighbourhoodId === nb || a.kind === 'acil');
  const nearby = (events ?? []).filter((e) => e.region.neighbourhoodId === nb || (!e.region.neighbourhoodId && e.region.districtId === districtId)).slice(0, 5);
  const ownAreas = (gathering.items ?? []).filter(inMahalle);
  const areas = ownAreas.length ? ownAreas : (gathering.items ?? []).filter((i) => i.districtId === districtId).slice(0, 5);

  const section = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <AppText variant="label" accessibilityRole="header">{title}</AppText>
      {children}
    </View>
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {section(
          t('neighbourhood.muhtarlik'),
          loading && official === undefined ? (
            <StateMessage kind="loading" />
          ) : muhtar ? (
            <>
              <OfficialProfileCard title={muhtar.name || muhtarlik} subtitle={muhtar.name ? muhtarlik : undefined} profile={muhtar} place={place} />
              {fallback ? <AppText variant="caption" muted>{fallback.verified ? t('neighbourhood.fromGuide') : t('neighbourhood.fromGuideUnverified')}</AppText> : null}
            </>
          ) : (
            <AppText variant="caption" muted>{t('neighbourhood.noMuhtar')}</AppText>
          ),
        )}

        {section(
          t('neighbourhood.announcements'),
          <>
            {mine.length ? mine.slice(0, 5).map((a) => <AnnouncementCard key={a.id} item={a} onPress={() => router.push({ pathname: '/announcements/[id]', params: { id: a.id } })} />) : announcements ? <AppText variant="caption" muted>{t('neighbourhood.noAnnouncements')}</AppText> : <StateMessage kind="loading" />}
            <AppButton variant="secondary" title={t('announcements.seeAll')} onPress={() => router.push('/announcements')} />
          </>,
        )}

        {section(
          t('neighbourhood.events'),
          <>
            {nearby.length ? nearby.map((e) => <EventCard key={e.id} item={e} onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })} />) : events ? <AppText variant="caption" muted>{t('neighbourhood.noEvents')}</AppText> : <StateMessage kind="loading" />}
            <AppButton variant="secondary" title={t('neighbourhood.allEvents')} onPress={() => router.push('/events')} />
          </>,
        )}

        {section(
          t('neighbourhood.gathering'),
          gathering.items === null && !gathering.error ? (
            <StateMessage kind="loading" />
          ) : areas.length ? (
            <>
              {!ownAreas.length ? <AppText variant="caption" muted>{t('neighbourhood.gatheringDistrict', { place: district ?? '' })}</AppText> : null}
              {areas.map((i) => (
                <Pressable
                  key={i.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/city/item', params: { section: 'toplanma-alanlari', id: i.id } })}
                  style={({ pressed }) => [styles.row, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}>
                  <MaterialIcons name="emoji-people" size={22} color={c.icon} />
                  <View style={styles.rowText}>
                    <AppText style={[styles.rowTitle, { color: c.textStrong }]}>{i.name}</AppText>
                    {str(i.values.mahalle) ? <AppText variant="caption" muted>{str(i.values.mahalle)}</AppText> : null}
                  </View>
                  <MaterialIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={22} color={c.textSoft} />
                </Pressable>
              ))}
            </>
          ) : (
            <AppText variant="caption" muted>{t('neighbourhood.noGathering')}</AppText>
          ),
        )}

        {municipalities.length
          ? section(
              t('neighbourhood.municipalities'),
              municipalities.map((p) => <OfficialProfileCard key={p.id} title={p.name} profile={p} place={place} />),
            )
          : null}

        <AppText variant="caption" muted style={styles.center}>{t('neighbourhood.feedSoon')}</AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, minHeight: 56 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 21 },
  center: { textAlign: 'center' },
});
