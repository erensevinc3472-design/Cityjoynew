import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { I18nManager, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { dealLive, isEventVisible, pollDaysLeft, pollOpen, sortDeals, sortEvents, type Contest, type Poll, type Sponsor, type UserLocation } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { eventDateRange } from '@/components/event-card';
import { GOLD, type IconName } from '@/components/city-tiles';
import { useActivities } from '@/lib/activities';
import { useAnnouncements } from '@/lib/announcements';
import { useProvinceDeals } from '@/lib/deals';
import { useEvents } from '@/lib/events';
import { locationRepository as repo } from '@/lib/locations';
import { communityRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { useCachedList } from '@/lib/sponsors';

import { fonts, radius } from '@/theme/tokens';

/**
 * Sosyal Harmoni şeridi (Eren, 11 Kasım 2026): ortadaki kartın bölümünden şehrindeki en yeni şey ("Yarın 20:00 ·
 * Caz Gecesi"). Yalnızca ortadaki kartın verisi okunur ve oturumda saklanır (maliyet ilkesi). İçerik yoksa şerit
 * hiç görünmez.
 */
export function SocialPeek({ cardKey, location }: { cardKey: string; location: UserLocation | null }) {
  if (!location) return null;
  switch (cardKey) {
    case 'events':
      return <EventPeek provinceCode={location.provinceCode} />;
    case 'activities':
      return <ActivityPeek provinceCode={location.provinceCode} />;
    case 'news':
      return <NewsPeek location={location} />;
    case 'contests':
      return <ContestPeek provinceCode={location.provinceCode} />;
    case 'polls':
      return <PollPeek provinceCode={location.provinceCode} />;
    default:
      return <DealPeek provinceCode={location.provinceCode} category={cardKey} />;
  }
}

function useWhen() {
  const { language } = useSettings();
  const lang = language ?? 'tr';
  return (startsAt: string, endsAt: string) => {
    const s = new Date(startsAt);
    const time = s.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
    return `${eventDateRange({ startsAt, endsAt }, lang)} · ${time}`;
  };
}

function EventPeek({ provinceCode }: { provinceCode: string }) {
  const { t } = useTranslation();
  const when = useWhen();
  const { list } = useEvents(provinceCode);
  const e = list ? sortEvents(list.filter((x) => x.status === 'yayinda' && isEventVisible(x))).at(0) : undefined;
  if (!e) return null;
  const district = e.region.districtId ? repo.getDistrict(e.region.districtId)?.name : undefined;
  return <Strip icon="event" kicker={t('social.peek.event')} title={e.title} meta={[when(e.startsAt, e.endsAt), district].filter(Boolean).join(' · ')} href={{ pathname: '/events/[id]', params: { id: e.id } }} />;
}

function ActivityPeek({ provinceCode }: { provinceCode: string }) {
  const { t } = useTranslation();
  const when = useWhen();
  const { user } = useSession();
  const { list } = useActivities(provinceCode, !!user);
  const a = list?.at(0);
  if (!a) return null;
  const district = repo.getDistrict(a.region.districtId)?.name;
  return <Strip icon="groups" kicker={t('social.peek.activity')} title={a.title} meta={[when(a.startsAt, a.endsAt), district].filter(Boolean).join(' · ')} href={{ pathname: '/activities/[id]', params: { id: a.id } }} />;
}

function NewsPeek({ location }: { location: UserLocation }) {
  const { t } = useTranslation();
  const { list } = useAnnouncements(location, 'haberler');
  const a = list?.at(0);
  if (!a) return null;
  return <Strip icon="newspaper" kicker={t('social.peek.news')} title={a.title} href={{ pathname: '/announcements/[id]', params: { id: a.id } }} />;
}

function ContestPeek({ provinceCode }: { provinceCode: string }) {
  const { t } = useTranslation();
  const { language } = useSettings();
  const list = useCachedList<Contest>(`contests:${provinceCode}`, () => communityRepository.listContests(provinceCode));
  const c = list?.find((x) => x.status === 'katilim' || x.status === 'oylama');
  if (!c) return null;
  const ymd = c.status === 'katilim' ? c.joinEndsOn : c.voteEndsOn;
  const date = new Date(`${ymd}T12:00:00`).toLocaleDateString(language ?? 'tr', { day: 'numeric', month: 'long' });
  return <Strip icon="emoji-events" kicker={t('social.peek.contest')} title={c.title} meta={t(c.status === 'katilim' ? 'contests.joinUntil' : 'contests.voteUntil', { date })} href={{ pathname: '/contests/[id]', params: { id: c.id } }} />;
}

function PollPeek({ provinceCode }: { provinceCode: string }) {
  const { t } = useTranslation();
  const list = useCachedList<Poll>(`polls:${provinceCode}`, () => communityRepository.listPolls(provinceCode));
  const p = list?.find((x) => pollOpen(x));
  if (!p) return null;
  const left = pollDaysLeft(p);
  return <Strip icon="poll" kicker={t('social.peek.poll')} title={p.question} meta={left ? t('polls.daysLeft', { count: left }) : t('polls.lastDay')} href="/polls" />;
}

function DealPeek({ provinceCode, category }: { provinceCode: string; category: string }) {
  const { t } = useTranslation();
  const { deals } = useProvinceDeals(provinceCode);
  const mine = deals ? sortDeals(deals.filter((d) => d.category === category && dealLive(d))) : [];
  const first = mine[0];
  if (!first) return null;
  return (
    <Strip
      icon="local-offer"
      kicker={t('social.peek.deals', { count: mine.length })}
      title={`${first.businessName}: ${first.title}`}
      meta={first.value}
      href={{ pathname: '/deals/[category]', params: { category } }}
    />
  );
}

function Strip({ icon, kicker, title, meta, href }: { icon: IconName; kicker: string; title: string; meta?: string; href: Href }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[kicker, title, meta].filter(Boolean).join('. ')}
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.strip, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={styles.icon}>
        <MaterialIcons name={icon} size={18} color="#2A1C06" />
      </View>
      <View style={styles.flex}>
        <AppText numberOfLines={1} style={styles.kicker}>{kicker.toLocaleUpperCase()}</AppText>
        <AppText numberOfLines={1} style={styles.title}>{title}</AppText>
        {meta ? <AppText numberOfLines={1} style={styles.meta}>{meta}</AppText> : null}
      </View>
      <MaterialIcons name={I18nManager.isRTL ? 'chevron-left' : 'chevron-right'} size={20} color="#D5E2E3" />
    </Pressable>
  );
}

/** İnce sponsor bandı: her zaman "Sponsorlu" etiketli; bağlantı varsa dokununca sponsorun sayfası açılır. */
export function SponsorBand({ sponsor }: { sponsor: Sponsor }) {
  const { t } = useTranslation();
  const label = t('social.sponsored');
  return (
    <Pressable
      accessibilityRole={sponsor.url ? 'link' : 'text'}
      accessibilityLabel={`${label}: ${sponsor.line}`}
      disabled={!sponsor.url}
      onPress={sponsor.url ? () => Linking.openURL(sponsor.url!).catch(() => {}) : undefined}
      style={({ pressed }) => [styles.band, { opacity: pressed ? 0.8 : 1 }]}>
      <AppText style={styles.tag}>{label}</AppText>
      {sponsor.logo ? <Image source={{ uri: sponsor.logo.url }} style={styles.logo} contentFit="cover" accessible={false} /> : null}
      <AppText numberOfLines={2} style={styles.line}>{sponsor.line}</AppText>
      {sponsor.url ? <MaterialIcons name="open-in-new" size={14} color="#AFC3C4" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingStart: 10,
    paddingEnd: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(8, 26, 30, 0.6)',
  },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 10.5, letterSpacing: 0.8, color: GOLD },
  title: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 19, color: '#FFFFFF' },
  meta: { fontSize: 12, lineHeight: 16, color: '#D5E2E3' },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    backgroundColor: 'rgba(8, 26, 30, 0.5)',
  },
  tag: { fontFamily: fonts.bodySemi, fontSize: 9.5, letterSpacing: 0.6, color: '#AFC3C4', borderWidth: 1, borderColor: 'rgba(175, 195, 196, 0.45)', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  logo: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  line: { flex: 1, fontSize: 12, lineHeight: 16, color: '#E3ECEA' },
});
