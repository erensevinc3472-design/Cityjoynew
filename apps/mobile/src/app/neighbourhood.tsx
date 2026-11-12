import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
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
import { AppText } from '@/components/app-text';
import { frost, PillButton } from '@/components/city-hub';
import { EventCard } from '@/components/event-card';
import { FrostFill } from '@/components/glass';
import { OfficialProfileCard } from '@/components/official-profile-card';
import { PageHead, PAGE_CONTENT, usePageBottom } from '@/components/page-head';
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
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
type RowId = 'muhtar' | 'announcements' | 'events' | 'gathering' | 'municipalities';

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** Şehir rehberindeki muhtarlık satırı, resmî profil girilmemişse yedek olarak (doğrulanmamış olabilir). */
function guideMuhtar(item: CityGuideItem): OfficialProfile {
  const v = item.values;
  return { id: item.id, type: 'muhtar', name: str(v.muhtar_adi) ?? '', phone: str(v.telefon), address: str(v.adres), hours: str(v.calisma_saatleri), updatedAt: '' };
}

/** Üstteki dört kutudan üçü: o ilçedeki okullar, aile sağlığı merkezleri, ibadethaneler (Önemli Kurumlar grupları). */
const PLACE_TILES: { id: string; icon: IconName; label: 'neighbourhood.education' | 'neighbourhood.health' | 'neighbourhood.worship' }[] = [
  { id: 'egitim', icon: 'school', label: 'neighbourhood.education' },
  { id: 'asm', icon: 'medical-services', label: 'neighbourhood.health' },
  { id: 'ibadethane', icon: 'mosque', label: 'neighbourhood.worship' },
];

/**
 * Mahalle Meydanı (PROJE.md 5.1, Eren onayladı; tasarım örneği `mahalle-meydani.png`, 10 Kasım 2026): mahallenin künyesi,
 * akış değil. Kayan ince başlık ve il fotoğrafı; dört kutu (Muhtarlık, Eğitim, Sağlık, İbadethane); açılır satırlar
 * (muhtarlık, mahalle duyuruları, etkinlikler, afet toplanma alanları, belediye) ve çevredeki hizmetler; en altta mahalle
 * kartı ve "Değiştir". Örnekteki bildirim / menü düğmeleri ve gömülü harita yeni özellik / maliyet olduğundan yok.
 * Okumalar önbellekli: duyuru ve etkinlik il başına tek sorgu, profiller tek tek okuma (en çok 3).
 */
export default function NeighbourhoodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const dark = useResolvedScheme() === 'dark';
  const bottom = usePageBottom();
  const { rtl } = useSettings();
  const { location } = useUserLocation();
  const [name, setName] = useState<string>();
  const [open, setOpen] = useState<RowId | null>(null);
  const nb = location?.neighbourhoodId;
  const districtId = location?.districtId;
  const provinceCode = location?.provinceCode;
  const gold = dark ? c.heroAccent : c.primary;
  const chevron = rtl ? 'chevron-left' : 'chevron-right';

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
  const back = () => (router.canGoBack() ? router.back() : router.replace('/city'));
  const changePlace = () => router.push('/location?edit=1');
  const subtitle = [name, place].filter(Boolean).join(' · ') || t('home.noLocation');

  if (!nb) {
    return (
      <Screen bleed>
        <ScrollView contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]}>
          <PageHead extend={40} title={t('neighbourhood.title')} subtitle={place || undefined} onBack={back} />
          <StateMessage kind="empty" message={t('neighbourhood.needNeighbourhood')} />
          <PillButton gold icon="edit-location-alt" label={t('home.changeLocation')} onPress={changePlace} />
        </ScrollView>
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
  const toggle = (id: RowId) => setOpen((cur) => (cur === id ? null : id));
  const openGroup = (group: string) =>
    router.push({ pathname: '/city/[section]', params: districtId ? { section: 'onemli-kurumlar', group, district: districtId } : { section: 'onemli-kurumlar', group } });
  const card = frost(dark, c.surface, c.border);

  /** Örnekteki satır: altın ince simge, başlık ve kısa açıklama, sağda sayı ve ok; dokununca altında açılır. */
  const row = (id: RowId, icon: IconName, title: string, hint: string, body: ReactNode, badge?: string) => {
    const expanded = open === id;
    return (
      <View key={id} style={[styles.row, card]}>
        <FrostFill />
        <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={[title, hint, badge].filter(Boolean).join('. ')} onPress={() => toggle(id)} style={({ pressed }) => [styles.rowHead, { opacity: pressed ? 0.8 : 1 }]}>
          <MaterialIcons name={icon} size={26} color={gold} />
          <View style={styles.flex}>
            <AppText style={[styles.rowTitle, { color: c.textStrong }]} numberOfLines={1}>{title}</AppText>
            <AppText style={[styles.rowHint, { color: c.textMuted }]} numberOfLines={1}>{hint}</AppText>
          </View>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: dark ? c.heroAccent : c.primary }]}>
              <AppText style={[styles.badgeText, { color: dark ? '#1B2A2C' : c.onPrimary }]}>{badge}</AppText>
            </View>
          ) : null}
          <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={22} color={c.textMuted} />
        </Pressable>
        {expanded ? <View style={styles.rowBody}>{body}</View> : null}
      </View>
    );
  };

  const muhtarBody =
    loading && official === undefined ? (
      <StateMessage kind="loading" />
    ) : muhtar ? (
      <>
        <OfficialProfileCard title={muhtar.name || muhtarlik} subtitle={muhtar.name ? muhtarlik : undefined} profile={muhtar} place={place} />
        {fallback ? <AppText variant="caption" muted>{fallback.verified ? t('neighbourhood.fromGuide') : t('neighbourhood.fromGuideUnverified')}</AppText> : null}
      </>
    ) : (
      <AppText variant="caption" muted>{t('neighbourhood.noMuhtar')}</AppText>
    );

  const announcementsBody = (
    <>
      {mine.length ? (
        mine.slice(0, 5).map((a) => <AnnouncementCard key={a.id} item={a} onPress={() => router.push({ pathname: '/announcements/[id]', params: { id: a.id } })} />)
      ) : announcements ? (
        <AppText variant="caption" muted>{t('neighbourhood.noAnnouncements')}</AppText>
      ) : (
        <StateMessage kind="loading" />
      )}
      <PillButton small icon="campaign" label={t('announcements.seeAll')} onPress={() => router.push('/announcements')} />
    </>
  );

  const eventsBody = (
    <>
      {nearby.length ? (
        nearby.map((e) => <EventCard key={e.id} item={e} onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })} />)
      ) : events ? (
        <AppText variant="caption" muted>{t('neighbourhood.noEvents')}</AppText>
      ) : (
        <StateMessage kind="loading" />
      )}
      <PillButton small icon="event" label={t('neighbourhood.allEvents')} onPress={() => router.push('/events')} />
    </>
  );

  const gatheringBody =
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
            style={({ pressed }) => [styles.area, { borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}>
            <MaterialIcons name="place" size={18} color={gold} />
            <View style={styles.flex}>
              <AppText style={[styles.areaTitle, { color: c.textStrong }]}>{i.name}</AppText>
              {str(i.values.mahalle) ? <AppText style={[styles.rowHint, { color: c.textMuted }]}>{str(i.values.mahalle)}</AppText> : null}
            </View>
            <MaterialIcons name={chevron} size={20} color={c.textMuted} />
          </Pressable>
        ))}
      </>
    ) : (
      <AppText variant="caption" muted>{t('neighbourhood.noGathering')}</AppText>
    );

  const tile = (key: string, icon: IconName, label: string, onPress: () => void, active?: boolean) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={active === undefined ? undefined : { expanded: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, card, active && { borderColor: dark ? 'rgba(226, 178, 119, 0.55)' : c.primary }, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
      <FrostFill />
      <MaterialIcons name={icon} size={26} color={gold} />
      <AppText style={[styles.tileText, { color: c.textStrong }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{label}</AppText>
    </Pressable>
  );

  return (
    <Screen bleed>
      <ScrollView contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false}>
        <PageHead extend={60} title={t('neighbourhood.title')} subtitle={subtitle} onBack={back} />

        <View style={styles.tiles}>
          {tile('muhtar', 'person-outline', t('neighbourhood.muhtarlik'), () => toggle('muhtar'), open === 'muhtar')}
          {PLACE_TILES.map((p) => tile(p.id, p.icon, t(p.label), () => openGroup(p.id)))}
        </View>

        <View style={styles.rows}>
          {row('muhtar', 'location-city', t('neighbourhood.muhtarlik'), muhtar?.name || t('neighbourhood.muhtarHint'), muhtarBody)}
          {row('announcements', 'campaign', t('neighbourhood.announcements'), t('neighbourhood.announcementsHint'), announcementsBody, mine.length ? t('neighbourhood.newCount', { count: mine.length }) : undefined)}
          {row('events', 'event', t('neighbourhood.events'), t('neighbourhood.eventsHint'), eventsBody, nearby.length ? String(nearby.length) : undefined)}
          {row('gathering', 'emoji-people', t('neighbourhood.gathering'), t('neighbourhood.gatheringHint'), gatheringBody)}
          {municipalities.length
            ? row(
                'municipalities',
                'account-balance',
                t('neighbourhood.municipalities'),
                t('neighbourhood.municipalitiesHint'),
                municipalities.map((p) => <OfficialProfileCard key={p.id} title={p.name} profile={p} place={place} />),
              )
            : null}
          <Pressable accessibilityRole="button" onPress={() => router.push('/city/kurumlar')} style={({ pressed }) => [styles.row, styles.rowHead, card, { opacity: pressed ? 0.8 : 1 }]}>
            <FrostFill />
            <MaterialIcons name="share-location" size={26} color={gold} />
            <View style={styles.flex}>
              <AppText style={[styles.rowTitle, { color: c.textStrong }]} numberOfLines={1}>{t('neighbourhood.servicesTitle')}</AppText>
              <AppText style={[styles.rowHint, { color: c.textMuted }]} numberOfLines={1}>{t('neighbourhood.servicesHint')}</AppText>
            </View>
            <MaterialIcons name={chevron} size={22} color={c.textMuted} />
          </Pressable>
        </View>

        <AppText variant="caption" muted style={styles.center}>{t('neighbourhood.feedSoon')}</AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm + 4 },
  flex: { flex: 1, gap: 2 },
  // Dört eşit kutu: altın ince simge, altında kısa ad.
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, minHeight: 78, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4, borderRadius: radius.lg + 2, borderWidth: 1, overflow: 'hidden' },
  tileText: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 15 },
  rows: { gap: spacing.sm },
  row: { borderRadius: radius.lg + 2, borderWidth: 1, overflow: 'hidden' },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, minHeight: 64, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  rowTitle: { fontFamily: fonts.heading, fontSize: 14.5, lineHeight: 19 },
  rowHint: { fontSize: 12, lineHeight: 16 },
  rowBody: { gap: spacing.sm, paddingHorizontal: spacing.md - 4, paddingBottom: spacing.md - 4 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 9, minHeight: 22, justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 11.5 },
  area: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, paddingTop: spacing.sm },
  areaTitle: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18 },
  center: { textAlign: 'center' },
});
