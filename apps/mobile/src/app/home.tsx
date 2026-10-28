import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isUnread, videoEmbedUrl } from '@cityjoy/shared';

import { UrgentStrip } from '@/components/announcement-card';
import { AppText } from '@/components/app-text';
import { BottomNav } from '@/components/bottom-nav';
import { HeroHeader, LocationChip } from '@/components/hero-header';
import { SceneArt, sceneRim, type SceneKind } from '@/components/scene-art';
import { Screen } from '@/components/screen';
import { SideMenu } from '@/components/side-menu';
import { VideoModal } from '@/components/video-modal';
import { VerifyEmailBanner } from '@/components/verify-email-banner';
import { useAnnouncements } from '@/lib/announcements';
import { useIntroVideoUrl } from '@/lib/intro-video';
import { locationRepository as repo } from '@/lib/locations';
import { useNotificationFeed, useReadState } from '@/lib/notifications';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const MODULES: { key: string; icon: IconName; scene: SceneKind; href?: Href }[] = [
  { key: 'myCity', icon: 'location-city', scene: 'city', href: '/city' },
  // Seyahat sonraki aşamada bağlanacak.
  { key: 'travel', icon: 'explore', scene: 'travel' },
  { key: 'social', icon: 'groups', scene: 'social', href: '/social' },
  { key: 'urgent', icon: 'emergency', scene: 'urgent', href: '/urgent' },
];

function greetingKey(now = new Date()) {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'home.greetingMorning';
  if (h >= 12 && h < 18) return 'home.greetingDay';
  return 'home.greetingEvening';
}

/**
 * Ana sayfa (PROJE.md 5, 13. madde 29; Eren onayladı): sade, tek bakışta ama gösterişli. Üstte yan menü, CityJoy ve
 * bildirim zili; tarih, selamlama ve konum; yalnızca varsa acil duyuru şeridi; dört modül resimli kartlarda;
 * tanıtım videosu; altta gezinme çubuğu.
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const { location } = useUserLocation();
  const { user, profile } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [neighbourhoodName, setNeighbourhoodName] = useState<string>();
  const { list: announcements } = useAnnouncements(location);
  const urgent = (announcements ?? []).filter((a) => a.kind === 'acil');
  const feed = useNotificationFeed(false);
  const [read] = useReadState();
  const hasUnread = (feed ?? []).some((n) => isUnread(n, read));
  const videoUrl = useIntroVideoUrl();

  useEffect(() => {
    setNeighbourhoodName(undefined);
    const { districtId, neighbourhoodId } = location ?? {};
    if (!districtId || !neighbourhoodId) return;
    repo
      .getNeighbourhoods(districtId)
      .then((list) => setNeighbourhoodName(list.find((n) => n.id === neighbourhoodId)?.name))
      .catch(() => {});
  }, [location]);

  const parts = location ? [neighbourhoodName, location.districtId && repo.getDistrict(location.districtId)?.name, repo.getProvince(location.provinceCode)?.name] : [];
  const locationText = parts.filter(Boolean).join(', ') || t('home.noLocation');
  const firstName = (profile?.displayName ?? user?.displayName ?? '').trim().split(/\s+/)[0];
  const today = new Date().toLocaleDateString(language ?? 'tr', { weekday: 'long', day: 'numeric', month: 'long' });

  const header = (
    <HeroHeader
      title="CityJoy"
      left={{ icon: 'menu', label: t('menu.open'), onPress: () => setMenuOpen(true) }}
      right={
        user
          ? // Bildirim merkezi (PROJE.md 5.12); okunmamış varsa altın nokta.
            { icon: 'notifications-none', label: hasUnread ? t('notifications.titleUnread') : t('notifications.title'), onPress: () => router.push('/notifications'), badge: hasUnread }
          : undefined
      }>
      <View style={styles.heroText}>
        <AppText style={{ color: c.heroMuted }}>{today}</AppText>
        <AppText accessibilityRole="header" style={[styles.greeting, { color: c.heroText }]}>
          {firstName ? t(greetingKey(), { name: firstName }) : t('home.slogan')}
        </AppText>
      </View>
      <LocationChip label={locationText} onPress={() => router.push('/location?edit=1')} />
    </HeroHeader>
  );

  return (
    <Screen header={header} footer={<BottomNav active="home" />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <VerifyEmailBanner />
        {/* Acil duyurular en üstte (PROJE.md 5.5); yoksa bu alan hiç görünmez. */}
        {urgent.map((a) => (
          <UrgentStrip key={a.id} item={a} onPress={() => router.push({ pathname: '/announcements/[id]', params: { id: a.id } })} />
        ))}
        <View style={styles.grid}>
          {MODULES.map((m) => (
            <Pressable
              key={m.key}
              accessibilityRole={m.href ? 'button' : undefined}
              disabled={!m.href}
              accessibilityLabel={m.href ? `${t(`modules.${m.key}`)}. ${t(`modules.${m.key}Hint`)}` : `${t(`modules.${m.key}`)}. ${t('home.comingSoon')}`}
              onPress={m.href ? () => router.push(m.href!) : undefined}
              style={({ pressed }) => [styles.module, { borderColor: sceneRim(m.scene), opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
              <SceneArt kind={m.scene} />
              <View style={styles.moduleIcon}>
                <MaterialIcons name={m.icon} size={19} color="#FFFFFF" />
              </View>
              <View style={styles.moduleFoot}>
                <AppText style={styles.moduleTitle}>{t(`modules.${m.key}`)}</AppText>
                <AppText numberOfLines={1} style={styles.moduleHint}>{m.href ? t(`modules.${m.key}Hint`) : t('menu.soon')}</AppText>
              </View>
            </Pressable>
          ))}
        </View>
        {/* Tanıtım videosu (bağlantısı panelden girilir); bağlantı yoksa "yakında". */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={videoUrl ? t('home.introVideo') : `${t('home.introVideo')}. ${t('home.comingSoon')}`}
          disabled={!videoUrl}
          onPress={() => {
            // YouTube / Vimeo uygulama içinde, ortada açılır; tanınmayan bağlantı tarayıcıda.
            const embed = videoEmbedUrl(videoUrl);
            if (embed) setPlaying(embed);
            else WebBrowser.openBrowserAsync(videoUrl).catch(() => {});
          }}
          style={({ pressed }) => [styles.video, { backgroundColor: c.surface, borderColor: c.accentBorder, opacity: !videoUrl ? 0.6 : pressed ? 0.85 : 1 }]}>
          <View style={[styles.play, { backgroundColor: c.primary }]}>
            <MaterialIcons name="play-arrow" size={24} color={c.onPrimary} />
          </View>
          <View style={styles.grow}>
            <AppText style={[styles.videoTitle, { color: c.textStrong }]}>{t('home.introVideo')}</AppText>
            <AppText variant="caption" muted>{videoUrl ? t('home.introVideoHint') : t('menu.soon')}</AppText>
          </View>
          {videoUrl ? <AppText style={[styles.watch, { color: c.accent, backgroundColor: c.accentSoft }]}>{t('home.watch')}</AppText> : null}
        </Pressable>
      </ScrollView>
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <VideoModal src={playing} title={t('home.introVideo')} onClose={() => setPlaying(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  heroText: { gap: 2 },
  greeting: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  module: { flexGrow: 1, flexBasis: '45%', height: 164, borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  moduleIcon: {
    position: 'absolute',
    top: 12,
    start: 12,
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 35, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  moduleFoot: { position: 'absolute', start: 0, end: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, backgroundColor: 'rgba(8, 26, 30, 0.72)' },
  moduleTitle: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 20, color: '#FFFFFF' },
  moduleHint: { fontSize: 11, lineHeight: 15, color: '#D5E2E3', marginTop: 2 },
  video: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, paddingStart: 8, paddingEnd: 12, borderRadius: radius.lg, borderWidth: 1 },
  play: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1, gap: 2 },
  videoTitle: { fontFamily: fonts.heading, fontSize: 14, lineHeight: 19 },
  watch: { fontFamily: fonts.bodySemi, fontSize: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, overflow: 'hidden' },
});
