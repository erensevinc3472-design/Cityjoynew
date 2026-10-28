import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { videoEmbedUrl } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { RoundButton } from '@/components/hero-header';
import { SceneArt, sceneSky } from '@/components/scene-art';
import { StateMessage } from '@/components/state-message';
import { TravelHeader } from '@/components/travel-header';
import { VideoModal } from '@/components/video-modal';
import { locationRepository as repo } from '@/lib/locations';
import { CATEGORY_SCENES, MODE_ICONS, NEARBY_ICONS, useTravelPlace } from '@/lib/travel';
import { fonts, GUTTER, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Gezilecek yer (tasarım: bursa.html ayrıntı penceresi): hakkında, tanıtım videosu, saat / ücret / adres / süre, nasıl
 * gidilir, yakındaki hizmetler, ipuçları, tarihçe, mimari, erişilebilirlik, iletişim. Yalnızca girilmiş bilgiler
 * görünür; değişebilen bilgiler için "gitmeden kontrol edin" notu ve son güncelleme tarihi. Puan yok (Karar, Eren).
 */
export default function TravelPlaceScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { value: p, failed, retry } = useTravelPlace(id);
  const [playing, setPlaying] = useState<string | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/travel/explore'));

  if (!p) {
    return (
      <View style={[styles.root, { backgroundColor: c.background }]}>
        <TravelHeader subtitle={t('travel.route')} onBack={back} />
        {failed ? <StateMessage kind="error" onRetry={retry} /> : p === null ? <StateMessage kind="loading" /> : <StateMessage kind="empty" message={t('travel.notFound')} />}
      </View>
    );
  }

  const cityName = repo.getProvince(p.cityId)?.name ?? '';
  const district = p.districtId ? repo.getDistrict(p.districtId)?.name : undefined;
  const scene = CATEGORY_SCENES[p.category];
  const mapsQuery = encodeURIComponent([p.name, p.address, district, cityName].filter(Boolean).join(', '));
  const mapsUrl = Platform.OS === 'ios' ? `http://maps.apple.com/?q=${mapsQuery}` : `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const play = (url: string) => {
    const embed = videoEmbedUrl(url);
    if (embed) setPlaying(embed);
    else WebBrowser.openBrowserAsync(url).catch(() => {});
  };
  const share = () => Share.share({ message: `${p.name} (${[district, cityName].filter(Boolean).join(', ')})\n${p.summary}\n\nCityJoy · TravelJoy` }).catch(() => {});

  const actions: { icon: IconName; label: string; onPress(): void }[] = [
    { icon: 'directions', label: t('travel.directions'), onPress: () => Linking.openURL(mapsUrl).catch(() => {}) },
    ...(p.phone ? [{ icon: 'phone' as IconName, label: t('travel.call'), onPress: () => Linking.openURL(`tel:${p.phone!.replace(/[^\d+]/g, '')}`).catch(() => {}) }] : []),
    ...(p.website ? [{ icon: 'language' as IconName, label: t('travel.web'), onPress: () => WebBrowser.openBrowserAsync(p.website!).catch(() => {}) }] : []),
  ];
  const card = (icon: IconName, title: string, body: ReactNode, accent?: boolean) => (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, accent && { borderLeftWidth: 4, borderLeftColor: c.accent }]}>
      <View style={styles.cardHead}>
        <MaterialIcons name={icon} size={18} color={c.accent} />
        <AppText accessibilityRole="header" style={[styles.cardTitle, { color: c.textStrong }]}>{title}</AppText>
      </View>
      {typeof body === 'string' ? <AppText style={[styles.body, { color: c.text }]}>{body}</AppText> : body}
    </View>
  );
  const quick = [
    { icon: 'schedule' as IconName, label: t('travel.visitingHours'), value: p.visitingHours },
    { icon: 'payments' as IconName, label: t('travel.entranceFee'), value: p.entranceFee },
    { icon: 'place' as IconName, label: t('travel.address'), value: p.address },
    { icon: 'timelapse' as IconName, label: t('travel.duration'), value: p.suggestedDuration },
  ].filter((x) => x.value);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      <TravelHeader subtitle={p.kind} title={p.name} onBack={back} right={<RoundButton icon="share" label={t('travel.share')} onPress={share} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <View style={[styles.hero, { height: Math.round(width * 0.62), backgroundColor: sceneSky(scene) }]}>
          <View style={StyleSheet.absoluteFill}>
            <SceneArt kind={scene} />
          </View>
          <View style={[StyleSheet.absoluteFill, styles.heroShade]} />
          <View style={styles.heroTags}>
            <View style={styles.tag}>
              <MaterialIcons name="place" size={11} color="#E0B07A" />
              <AppText style={styles.tagText}>{[district, cityName].filter(Boolean).join(', ')}</AppText>
            </View>
            {p.mustSee ? (
              <View style={[styles.tag, styles.mustTag]}>
                <MaterialIcons name="star" size={11} color="#FFD7A0" />
                <AppText style={styles.tagText}>{t('travel.mustSee')}</AppText>
              </View>
            ) : null}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
          {actions.map((a) => (
            <Pressable key={a.label} accessibilityRole="button" onPress={a.onPress} style={({ pressed }) => [styles.action, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}>
              <MaterialIcons name={a.icon} size={18} color={c.accent} />
              <AppText style={[styles.actionText, { color: c.textStrong }]}>{a.label}</AppText>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.pad}>
          {card('info-outline', t('travel.about'), p.about)}
          {p.videoUrl ? (
            <Pressable accessibilityRole="button" onPress={() => play(p.videoUrl!)} style={({ pressed }) => [styles.videoCard, { backgroundColor: c.hero, opacity: pressed ? 0.9 : 1 }]}>
              <View style={styles.playRing}>
                <MaterialIcons name="play-arrow" size={30} color="#E0B07A" />
              </View>
              <AppText style={styles.videoLabel}>{t('travel.video')}</AppText>
            </Pressable>
          ) : null}
          {quick.length ? (
            <View style={styles.grid}>
              {quick.map((q) => (
                <View key={q.label} style={[styles.quick, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <View style={styles.cardHead}>
                    <MaterialIcons name={q.icon} size={15} color={c.accent} />
                    <AppText style={[styles.quickLabel, { color: c.textStrong }]}>{q.label}</AppText>
                  </View>
                  <AppText style={[styles.quickValue, { color: c.text }]}>{q.value}</AppText>
                </View>
              ))}
            </View>
          ) : null}
          <AppText variant="caption" muted>{t('travel.checkNote')}</AppText>

          {p.howToGet.length
            ? card(
                'directions-bus',
                t('travel.howToGet'),
                <View style={styles.list}>
                  {p.howToGet.map((s, i) => (
                    <View key={i} style={[styles.step, { borderLeftColor: c.accentBorder }]}>
                      <View style={styles.cardHead}>
                        <MaterialIcons name={MODE_ICONS[s.mode]} size={15} color={c.accent} />
                        <AppText style={[styles.stepMode, { color: c.textStrong }]}>{t(`travel.modes.${s.mode}`)}</AppText>
                      </View>
                      <AppText style={[styles.small, { color: c.text }]}>{s.text}</AppText>
                    </View>
                  ))}
                </View>,
              )
            : null}
          {p.nearby.length
            ? card(
                'room-service',
                t('travel.nearby'),
                <View style={styles.list}>
                  {p.nearby.map((n, i) => (
                    <View key={i} style={[styles.nearby, { backgroundColor: c.surfaceStrong }]}>
                      <MaterialIcons name={NEARBY_ICONS[n.kind]} size={16} color={c.accent} />
                      <View style={styles.flex}>
                        <AppText style={[styles.stepMode, { color: c.textStrong }]}>{t(`travel.nearbyKinds.${n.kind}`)}</AppText>
                        <AppText style={[styles.small, { color: c.text }]}>{n.text}</AppText>
                      </View>
                    </View>
                  ))}
                </View>,
              )
            : null}
          {p.tips.length
            ? card(
                'lightbulb-outline',
                t('travel.tips'),
                <View style={styles.list}>
                  {p.tips.map((tip, i) => (
                    <View key={i} style={styles.tip}>
                      <MaterialIcons name="check-circle" size={16} color={c.accent} />
                      <AppText style={[styles.small, styles.flex, { color: c.text }]}>{tip}</AppText>
                    </View>
                  ))}
                </View>,
              )
            : null}
          {p.history ? card('history-edu', t('travel.history'), p.history) : null}
          {p.architecture ? card('architecture', t('travel.architecture'), p.architecture) : null}
          {p.accessibility ? card('accessible', t('travel.accessibility'), p.accessibility, true) : null}

          {p.source ? <AppText variant="caption" muted>{t('travel.source', { source: p.source })}</AppText> : null}
          {p.updatedAt ? <AppText variant="caption" muted>{t('travel.updated', { date: new Date(p.updatedAt).toLocaleDateString(i18n.language) })}</AppText> : null}
        </View>
      </ScrollView>
      <VideoModal src={playing} title={`${p.name} · ${t('travel.video')}`} onClose={() => setPlaying(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  hero: { maxHeight: 320, justifyContent: 'flex-end', overflow: 'hidden' },
  heroShade: { backgroundColor: 'rgba(8,31,36,0.3)' },
  heroTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: GUTTER },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(8,31,36,0.65)', borderWidth: 1, borderColor: 'rgba(224,176,122,0.35)' },
  mustTag: { backgroundColor: 'rgba(166,72,52,0.75)' },
  tagText: { color: '#FFFFFF', fontFamily: fonts.bodySemi, fontSize: 11 },
  actions: { paddingHorizontal: GUTTER, paddingVertical: spacing.md, gap: spacing.sm },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 40, borderRadius: radius.pill, borderWidth: 1 },
  actionText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  pad: { paddingHorizontal: GUTTER, gap: spacing.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
  card: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontFamily: fonts.heading, fontSize: 14 },
  body: { fontSize: 14, lineHeight: 21 },
  videoCard: { height: 150, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  playRing: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(224,176,122,0.18)', borderWidth: 2, borderColor: 'rgba(224,176,122,0.5)', alignItems: 'center', justifyContent: 'center' },
  videoLabel: { color: '#C7D8DA', fontFamily: fonts.bodySemi, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quick: { width: '48%', flexGrow: 1, padding: 10, borderRadius: radius.md, borderWidth: 1, gap: 4, minHeight: MIN_TOUCH + 16 },
  quickLabel: { fontFamily: fonts.bodySemi, fontSize: 12 },
  quickValue: { fontSize: 12, lineHeight: 17 },
  list: { gap: spacing.sm },
  step: { borderLeftWidth: 2, paddingLeft: spacing.sm, gap: 2 },
  stepMode: { fontFamily: fonts.bodySemi, fontSize: 12 },
  small: { fontSize: 13, lineHeight: 19 },
  nearby: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm },
  tip: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
});
