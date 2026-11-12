import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { I18nManager, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { telUrl, type OfficialProfile } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { BottomShade, GlassRow, SectionHeading, TOWNHALL_ART, type IconName } from '@/components/city-tiles';
import { useProvinceCover } from '@/components/city-cover';
import { PageHead, PAGE_CONTENT, usePageBottom } from '@/components/page-head';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { ThumbImage } from '@/components/thumb-image';
import { locationRepository as repo } from '@/lib/locations';
import { useOfficialFollow } from '@/lib/official-follows';
import { useTravelMunicipal } from '@/lib/travel';
import { fonts, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const GOLD = '#E2B277';

/** e-Belediye işlemleri: hepsi belediyenin resmî internet sitesinde açılır (Eren, 12 Kasım 2026). */
const SERVICES: { key: string; icon: IconName; tint: string }[] = [
  { key: 'pay', icon: 'payments', tint: '#34D399' },
  { key: 'request', icon: 'support-agent', tint: '#5FD3DA' },
  { key: 'zoning', icon: 'architecture', tint: GOLD },
  { key: 'marriage', icon: 'favorite-border', tint: '#F9A8D4' },
  { key: 'social', icon: 'volunteer-activism', tint: '#C4B5FD' },
  { key: 'culture', icon: 'theater-comedy', tint: '#FCA5A5' },
  { key: 'tenders', icon: 'gavel', tint: '#93C5FD' },
  { key: 'council', icon: 'groups', tint: '#FDE68A' },
];

/**
 * Belediyenin resmî profil sayfası (Eren, 12 Kasım 2026: "içerik olsun, içerikteki düğmeler belediyenin internet
 * sitesine gitsin"). Üstte belediyenin fotoğrafı (Başkanlarla Keşif kapağı, yoksa belediye resmi), logo ve ad; hızlı
 * düğmeler (ara, internet sitesi, e-posta, yol tarifi), e-Belediye işlemleri, başkan, tanıtım, çalışma saatleri ve
 * adres. Bilgiler belediyenin panelinden gelir (Resmî profil ve Başkanlarla Keşif). İnternet sitesi girilmemişse
 * işlemler belediyenin adıyla web aramasını açar.
 */
export function MunicipalityProfile({
  id,
  name,
  profile,
  loading,
  mayor,
  mayorId,
}: {
  id: string;
  name: string;
  profile: OfficialProfile | null | undefined;
  loading: boolean;
  mayor: OfficialProfile | null | undefined;
  mayorId: string | null;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const bottom = usePageBottom();
  const cover = useProvinceCover();
  const code = /^bld-(\d{2})/.exec(id)?.[1] ?? '';
  const { value: intros } = useTravelMunicipal(code);
  const intro = intros?.find((x) => x.id === id);
  const follow = useOfficialFollow(profile ? id : undefined);
  const p = profile ?? undefined;
  const r = p?.region;
  const place = r ? [r.districtId ? repo.getDistrict(r.districtId)?.name : null, repo.getProvince(r.provinceCode)?.name].filter(Boolean).join(', ') : repo.getProvince(code)?.name ?? '';
  const mayorName = mayor?.name || (intro?.showMayor && intro.mayorName ? intro.mayorName : undefined);
  const mayorPhoto = intro?.showMayor ? intro.mayorPhoto : undefined;

  const site = p?.website;
  const openSite = () => {
    const url = site ?? `https://www.google.com/search?q=${encodeURIComponent(`${name} resmi internet sitesi`)}`;
    WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => {}));
  };
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, p?.address, place].filter(Boolean).join(', '))}`;

  const quick: { key: string; icon: IconName; label: string; onPress(): void }[] = [
    ...(p?.phone ? [{ key: 'call', icon: 'call' as IconName, label: t('official.muni.call'), onPress: () => open(telUrl(p.phone!)) }] : []),
    { key: 'web', icon: 'language', label: t('official.muni.web'), onPress: openSite },
    ...(p?.email ? [{ key: 'mail', icon: 'mail-outline' as IconName, label: t('official.muni.mail'), onPress: () => open(`mailto:${p.email}`) }] : []),
    { key: 'map', icon: 'directions', label: t('official.muni.map'), onPress: () => open(mapLink) },
  ];

  const pairs = [];
  for (let i = 0; i < SERVICES.length; i += 2) pairs.push(SERVICES.slice(i, i + 2));

  return (
    <Screen bleed cover={cover}>
      <ScrollView contentContainerStyle={[PAGE_CONTENT, styles.content, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false}>
        <PageHead cover={cover} title={t('official.title')} subtitle={place} onBack={() => (router.canGoBack() ? router.back() : router.replace('/city/belediyeler'))} />

        {/* Kapak: belediyenin fotoğrafı, logo, ad, resmî hesap. */}
        <View style={[styles.hero, { borderColor: c.border }]}>
          {intro?.cover ? (
            <ThumbImage photo={intro.cover} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
          ) : (
            <Image source={TOWNHALL_ART} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
          )}
          <BottomShade top={0.2} bottom={0.95} />
          <View style={styles.heroFoot}>
            <View style={[styles.logo, { borderColor: GOLD }]}>
              {p?.logo ? (
                <ThumbImage photo={p.logo} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
              ) : (
                <MaterialIcons name="account-balance" size={26} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.flex}>
              <AppText accessibilityRole="header" style={styles.heroTitle} numberOfLines={2}>{name}</AppText>
              <View style={styles.verified}>
                <MaterialIcons name="verified" size={14} color={GOLD} />
                <AppText style={styles.verifiedText}>{t('announcements.official')}</AppText>
                {intro?.slogan ? <AppText style={styles.slogan} numberOfLines={1}>· {intro.slogan}</AppText> : null}
              </View>
            </View>
          </View>
        </View>

        {/* Hızlı düğmeler. */}
        <View style={styles.quick}>
          {quick.map((q) => (
            <Pressable
              key={q.key}
              accessibilityRole="button"
              accessibilityLabel={q.label}
              onPress={q.onPress}
              style={({ pressed }) => [styles.quickItem, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.quickIcon, { backgroundColor: c.accentSoft }]}>
                <MaterialIcons name={q.icon} size={20} color={c.accent} />
              </View>
              <AppText style={[styles.quickText, { color: c.textStrong }]} numberOfLines={1}>{q.label}</AppText>
            </Pressable>
          ))}
        </View>

        {follow.canFollow ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: follow.following, busy: follow.busy }}
            disabled={follow.busy}
            onPress={follow.toggle}
            style={({ pressed }) => [styles.follow, follow.following ? { backgroundColor: c.surface, borderColor: c.border } : styles.followOn, { opacity: pressed || follow.busy ? 0.8 : 1 }]}>
            <MaterialIcons name={follow.following ? 'check' : 'add'} size={18} color={follow.following ? c.textStrong : '#1A1408'} />
            <AppText style={[styles.followText, { color: follow.following ? c.textStrong : '#1A1408' }]}>{follow.following ? t('official.following') : t('official.follow')}</AppText>
          </Pressable>
        ) : null}
        {follow.error ? <AppText variant="caption" style={{ color: c.danger }}>{t('official.followError')}</AppText> : null}

        {/* e-Belediye işlemleri: belediyenin internet sitesinde açılır. */}
        <SectionHeading icon="touch-app" title={t('official.muni.services')} />
        {pairs.map((row) => (
          <View key={row[0].key} style={styles.pair}>
            {row.map((s) => (
              <GlassRow key={s.key} icon={s.icon} tint={s.tint} title={t(`official.muni.service.${s.key}`)} onPress={openSite} />
            ))}
          </View>
        ))}
        <View style={styles.note}>
          <MaterialIcons name="open-in-new" size={14} color={c.textMuted} />
          <AppText variant="caption" muted style={styles.flex}>{site ? t('official.muni.servicesNote') : t('official.muni.servicesNoSite')}</AppText>
        </View>

        {/* Başkan. */}
        {mayorName ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('official.mayor')}: ${mayorName}`}
            onPress={() => (mayor && mayorId ? router.push({ pathname: '/official/[id]', params: { id: mayorId } }) : router.push({ pathname: '/travel/municipality/[id]', params: { id } }))}
            style={({ pressed }) => [styles.mayor, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}>
            <View style={[styles.mayorPhoto, { borderColor: GOLD, backgroundColor: c.accentSoft }]}>
              {mayorPhoto ? (
                <ThumbImage photo={mayorPhoto} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
              ) : mayor?.logo ? (
                <ThumbImage photo={mayor.logo} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
              ) : (
                <MaterialIcons name="person" size={28} color={c.accent} />
              )}
            </View>
            <View style={styles.flex}>
              <AppText variant="caption" muted>{t(intro?.mayorActing ? 'official.muni.mayorActing' : 'official.mayor')}</AppText>
              <AppText style={[styles.mayorName, { color: c.textStrong }]} numberOfLines={1}>{mayorName}</AppText>
            </View>
            <MaterialIcons name={I18nManager.isRTL ? 'chevron-left' : 'chevron-right'} size={22} color={c.textSoft} />
          </Pressable>
        ) : null}

        {/* Başkanlarla Keşif tanıtımı. */}
        {intro && (intro.slogan || intro.description) ? (
          <GlassRow icon="travel-explore" tint="teal" title={t('official.muni.discover')} sub={t('official.muni.discoverSub')} onPress={() => router.push({ pathname: '/travel/municipality/[id]', params: { id } })} />
        ) : null}

        {loading && profile === undefined ? <StateMessage kind="loading" /> : null}

        {/* Tanıtım, saatler, adres. */}
        {p?.about || p?.hours || p?.address ? (
          <View style={[styles.info, { backgroundColor: c.surface, borderColor: c.border }]}>
            {p?.about ? (
              <>
                <AppText style={[styles.infoHead, { color: c.textStrong }]}>{t('official.muni.about')}</AppText>
                <AppText selectable style={[styles.body, { color: c.text }]}>{p.about}</AppText>
              </>
            ) : null}
            {p?.hours ? <InfoLine icon="schedule" label={t('official.hours')} value={p.hours} /> : null}
            {p?.address ? <InfoLine icon="place" label={t('official.address')} value={p.address} /> : null}
          </View>
        ) : !loading ? (
          <AppText variant="caption" muted>{t('official.noInfo')}</AppText>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function InfoLine({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const c = useThemeColors();
  return (
    <View style={styles.line}>
      <MaterialIcons name={icon} size={18} color={c.accent} />
      <View style={styles.flex}>
        <AppText variant="caption" muted>{label}</AppText>
        <AppText selectable style={{ color: c.text }}>{value}</AppText>
      </View>
    </View>
  );
}

const white = '#FFFFFF';
const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  flex: { flex: 1 },
  pair: { flexDirection: 'row', gap: spacing.sm },
  hero: { height: 190, borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden', justifyContent: 'flex-end', padding: spacing.md, backgroundColor: '#0B2327' },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  logo: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8, 31, 36, 0.7)' },
  heroTitle: { color: white, fontFamily: fonts.display, fontSize: 22, lineHeight: 27 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  verifiedText: { color: GOLD, fontFamily: fonts.bodySemi, fontSize: 12 },
  slogan: { flexShrink: 1, color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  quick: { flexDirection: 'row', gap: spacing.sm },
  quickItem: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: spacing.sm + 2, borderRadius: radius.lg, borderWidth: 1, minHeight: MIN_TOUCH + 24 },
  quickIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  quickText: { fontFamily: fonts.bodySemi, fontSize: 11.5 },
  follow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: MIN_TOUCH, borderRadius: radius.pill, borderWidth: 1, borderColor: 'transparent' },
  followOn: { backgroundColor: GOLD },
  followText: { fontFamily: fonts.heading, fontSize: 14 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  mayor: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.xs },
  mayorPhoto: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  mayorName: { fontFamily: fonts.heading, fontSize: 16 },
  info: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  infoHead: { fontFamily: fonts.heading, fontSize: 15 },
  body: { fontSize: 14, lineHeight: 21 },
  line: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
