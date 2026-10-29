import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState, type ComponentProps, type ReactNode } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  averageRating,
  findCategory,
  isFoodKind,
  isPostListed,
  localized,
  openState,
  postModeFor,
  telUrl,
  whatsappUrl,
  type Business,
  type Post,
} from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { verificationText } from '@/components/business-card';
import { RoundButton } from '@/components/hero-header';
import { PostGrid } from '@/components/post-grid';
import { ReviewsSection } from '@/components/reviews-section';
import { StateMessage } from '@/components/state-message';
import { TopBar } from '@/components/top-bar';
import { locationRepository } from '@/lib/locations';
import { useServiceCategories } from '@/lib/service-categories';
import { businessRepository, postRepository, reviewRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { toggleFollowBusiness, useSocial } from '@/lib/social';
import { useUserLocation } from '@/lib/user-location';
import { fonts, GUTTER, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
type Tab = 'gonderiler' | 'menu' | 'yorumlar' | 'bilgiler';
const TAB_ICONS: Record<Tab, IconName> = { gonderiler: 'grid-on', menu: 'restaurant-menu', yorumlar: 'star-outline', bilgiler: 'info-outline' };
const OPEN_GREEN = '#2E9D5B';

/**
 * İşletme sayfası (Eren, 28 Ekim 2026; 13. madde 33): kullanıcı profiliyle aynı iskelet. Üstte logo yerine halkalı
 * harf, gönderi / takipçi / puan; ad, doğrulama rozeti, kategori ve "şu an açık". Takip et, Ara, WhatsApp, Yol tarifi.
 * Sekmeler: Gönderiler (işletme adına paylaşımlar), Menü ya da Hizmetler (fiyat listesi), Yorumlar, Bilgiler.
 * Güven bilgisi (doğrulama, puan, saatler, iletişim) herkese ücretsiz (PROJE.md 1.1). Sahibi ve yetkililer onay
 * bekleyen paylaşımları burada görür; sahibi onaylar ya da reddeder.
 */
export default function BusinessScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { location } = useUserLocation();
  const { followingBusinesses } = useSocial();
  const { all } = useServiceCategories();
  const [b, setB] = useState<Business | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [pending, setPending] = useState<Post[]>([]);
  const [tab, setTab] = useState<Tab>('gonderiler');
  const [busy, setBusy] = useState(false);
  const following = !!followingBusinesses?.includes(id);

  const load = useCallback(() => {
    setError(false);
    businessRepository.get(id).then(
      (biz) => {
        setB(biz);
        if (!biz || !user) return setPosts([]);
        postRepository.byBusiness(id, { provinceCode: location?.provinceCode, following }).then((l) => setPosts(l.filter(isPostListed)), () => setPosts([]));
        if (biz.ownerUid === user.uid || biz.managers.some((m) => m.uid === user.uid)) postRepository.pendingOf(id).then(setPending, () => setPending([]));
      },
      () => setError(true),
    );
  }, [id, user, location?.provinceCode, following]);
  // Değerlendirme yazıp ya da düzenleyip dönünce sayfa tazelenir.
  useFocusEffect(load);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/search'));
  const shell = (title: string, body: ReactNode) => (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <TopBar centered title={title} left={<RoundButton icon="arrow-back" label={t('common.back')} onPress={back} />} />
      <View style={styles.pad}>{body}</View>
    </View>
  );
  const isOwner = !!user && b?.ownerUid === user.uid;
  const team = !!b && !!user && (isOwner || b.managers.some((m) => m.uid === user.uid));
  if (error) return shell('', <StateMessage kind="error" onRetry={load} />);
  if (b === undefined) return shell('', <StateMessage kind="loading" />);
  if (!b || (b.status !== 'yayinda' && !team)) return shell('', <StateMessage kind="empty" message={t('business.notFound')} />);

  const verified = b.verification.status === 'dogrulandi';
  const district = locationRepository.getDistrict(b.location.districtId)?.name;
  const province = locationRepository.getProvince(b.location.provinceCode)?.name;
  const services = [
    ...b.categoryIds.filter(isFoodKind).map((k) => t(`food.kinds.${k}`)),
    ...b.categoryIds.map((cid) => findCategory(all, cid)).filter(Boolean).map((cat) => localized(cat!.names, lang)),
  ];
  const state = openState(b, new Date());
  const avg = averageRating(b.rating);
  const isFood = b.type === 'yeme-icme';
  const postMode = user ? postModeFor(b, user.uid) : null;

  const contact = (url: string) => {
    // Arama kaydı değerlendirme yazabilmenin şartı (PROJE.md 13 madde 17).
    if (user && !team) reviewRepository.recordContact(b.id, user.uid).catch(() => {});
    Linking.openURL(url).catch(() => {});
  };
  const mapsUrl = () => {
    const q = encodeURIComponent([b.name, b.address, district, province].filter(Boolean).join(', '));
    return Platform.OS === 'ios' ? `http://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
  };
  const toggleFollow = async () => {
    if (!user || busy) return;
    setBusy(true);
    const now = await toggleFollowBusiness(user.uid, b.id, following).catch(() => following);
    if (now !== following) setB({ ...b, followerCount: Math.max(0, b.followerCount + (now ? 1 : -1)) });
    setBusy(false);
  };
  const decide = async (p: Post, approve: boolean) => {
    setBusy(true);
    await (approve ? postRepository.approve(p.id) : postRepository.remove(p.id)).catch(() => {});
    setBusy(false);
    load();
  };
  const share = () => Share.share({ message: t('business.page.shareText', { name: b.name, place: district ?? province ?? '' }) }).catch(() => {});

  const pill = (label: string, icon: IconName, onPress: () => void, primary?: boolean) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.pill, { backgroundColor: primary ? c.primary : c.surfaceStrong, opacity: pressed ? 0.75 : 1 }]}>
      <MaterialIcons name={icon} size={17} color={primary ? c.onPrimary : c.textStrong} />
      <AppText numberOfLines={1} style={[styles.pillText, { color: primary ? c.onPrimary : c.textStrong }]}>{label}</AppText>
    </Pressable>
  );

  const days = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(lang, { weekday: 'long' }));
  const today = (new Date().getDay() + 6) % 7;
  const infoRow = (icon: IconName, label: string, value: ReactNode) => (
    <View style={styles.infoRow}>
      <MaterialIcons name={icon} size={20} color={c.textMuted} />
      <View style={styles.grow}>
        <AppText variant="caption" muted>{label}</AppText>
        {typeof value === 'string' ? <AppText>{value}</AppText> : value}
      </View>
    </View>
  );
  const chips = (list: string[]) => (
    <View style={styles.chips}>
      {list.map((x) => (
        <View key={x} style={[styles.chip, { backgroundColor: c.surfaceStrong }]}>
          <AppText style={[styles.chipText, { color: c.textStrong }]}>{x}</AppText>
        </View>
      ))}
    </View>
  );

  const right = team ? (
    <RoundButton icon="edit" label={t('business.page.manage')} onPress={() => router.push({ pathname: '/business/edit', params: { id: b.id } })} />
  ) : (
    <RoundButton icon="share" label={t('business.page.share')} onPress={share} />
  );

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <TopBar centered title={b.name} left={<RoundButton icon="arrow-back" label={t('common.back')} onPress={back} />} right={right} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.pad}>
          <View style={styles.head}>
            <View style={[styles.ring, { borderColor: c.accent }]}>
              <View style={[styles.avatar, { backgroundColor: c.surfaceStrong }]}>
                <MaterialIcons name="storefront" size={22} color={c.accent} style={styles.avatarIcon} />
                <AppText style={[styles.initial, { color: c.accent }]}>{b.name.slice(0, 1).toLocaleUpperCase(lang)}</AppText>
              </View>
            </View>
            <View style={styles.stats}>
              {[
                { n: posts === null ? '–' : String(posts.length), label: t('explore.profile.statPosts') },
                { n: String(b.followerCount), label: t('explore.profile.statFollowers') },
                { n: b.rating.count ? `★ ${avg.toLocaleString(i18n.language)}` : '–', label: t('business.page.statRating', { count: b.rating.count }) },
              ].map((x) => (
                <View key={x.label} style={styles.stat} accessible accessibilityLabel={`${x.n} ${x.label}`}>
                  <AppText style={[styles.statN, { color: c.textStrong }]}>{x.n}</AppText>
                  <AppText style={[styles.statL, { color: c.textMuted }]} numberOfLines={1}>{x.label}</AppText>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.bio}>
            <View style={styles.nameRow}>
              <AppText style={[styles.name, { color: c.textStrong }]}>{b.name}</AppText>
              {verified ? <MaterialIcons name="verified" size={16} color={c.accent} accessibilityLabel={t('business.verified')} /> : null}
            </View>
            <AppText variant="caption" muted numberOfLines={2}>{[services.slice(0, 2).join(', '), district].filter(Boolean).join(' · ')}</AppText>
            {state ? (
              <AppText style={[styles.open, { color: state.open ? OPEN_GREEN : c.danger }]}>
                {state.open
                  ? state.until ? t('business.page.openUntil', { time: state.until }) : t('business.page.openNow')
                  : state.until ? t('business.page.opensAt', { time: state.until }) : t('business.page.closedNow')}
              </AppText>
            ) : null}
            {b.description ? <AppText style={styles.desc}>{b.description}</AppText> : null}
            {b.status !== 'yayinda' ? <AppText variant="caption" style={{ color: c.danger }}>{b.status === 'gizli' ? t('business.statusHidden') : t('business.statusRemoved')}</AppText> : null}
          </View>

          <View style={styles.buttons}>
            {team ? null : pill(following ? t('business.page.following') : t('business.page.follow'), following ? 'check' : 'add', toggleFollow, !following)}
            {pill(t('business.call'), 'call', () => contact(telUrl(b.phone)))}
            {b.whatsapp ? pill(t('business.whatsappBtn'), 'chat', () => contact(whatsappUrl(b.phone))) : null}
            {b.address ? pill(t('business.page.directions'), 'directions', () => Linking.openURL(mapsUrl()).catch(() => {})) : null}
          </View>

          {/* Ekip: işletme adına paylaş ve onay bekleyenler. */}
          {team ? (
            <View style={[styles.teamBox, { backgroundColor: c.surface, borderColor: c.border }]}>
              {postMode ? (
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/explore/new', params: { as: b.id } })} style={({ pressed }) => [styles.teamRow, { opacity: pressed ? 0.75 : 1 }]}>
                  <MaterialIcons name="add-box" size={22} color={c.accent} />
                  <AppText style={[styles.grow, styles.teamText, { color: c.textStrong }]}>{t('business.page.postAs')}</AppText>
                  {postMode === 'onayla' ? <AppText variant="caption" muted>{t('business.page.needsApproval')}</AppText> : null}
                  <MaterialIcons name="chevron-right" size={20} color={c.textSoft} />
                </Pressable>
              ) : (
                <AppText variant="caption" muted>{t('business.page.noPostPermission')}</AppText>
              )}
              {pending.length ? (
                <View style={styles.pending}>
                  <AppText variant="label">{t('business.page.pendingTitle', { count: pending.length })}</AppText>
                  {pending.map((p) => (
                    <View key={p.id} style={[styles.pendingRow, { borderTopColor: c.border }]}>
                      <AppText numberOfLines={3}>{p.text}</AppText>
                      {isOwner ? (
                        <View style={styles.buttons}>
                          {pill(t('business.page.approve'), 'check', () => decide(p, true), true)}
                          {pill(t('business.page.reject'), 'close', () => decide(p, false))}
                        </View>
                      ) : (
                        <AppText variant="caption" muted>{t('business.page.waitingOwner')}</AppText>
                      )}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: c.border }]}>
          {(['gonderiler', 'menu', 'yorumlar', 'bilgiler'] as Tab[]).map((x) => {
            const selected = x === tab;
            const label = x === 'menu' ? t(isFood ? 'business.page.tabMenu' : 'business.page.tabServices') : t(`business.page.tabs.${x}`);
            return (
              <Pressable key={x} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={label} onPress={() => setTab(x)} style={styles.tab}>
                <MaterialIcons name={x === 'menu' && !isFood ? 'list-alt' : TAB_ICONS[x]} size={24} color={selected ? c.textStrong : c.textSoft} />
                <View style={[styles.tabLine, { backgroundColor: selected ? c.textStrong : 'transparent' }]} />
              </Pressable>
            );
          })}
        </View>

        {tab === 'gonderiler' ? (
          <PostGrid list={posts} empty={t('business.page.noPosts')} />
        ) : tab === 'menu' ? (
          <View style={styles.section}>
            {b.priceList.length ? (
              <>
                {b.priceList.map((p, i) => (
                  <View key={i} style={[styles.price, { borderBottomColor: c.border }]}>
                    <AppText style={styles.grow}>{p.name}</AppText>
                    <AppText style={[styles.priceValue, { color: c.textStrong }]}>{p.price}</AppText>
                  </View>
                ))}
                <AppText variant="caption" muted>{t('business.priceNote')}</AppText>
              </>
            ) : (
              <AppText variant="caption" muted style={styles.center}>{t('business.page.noMenu')}</AppText>
            )}
          </View>
        ) : tab === 'yorumlar' ? (
          <View style={styles.section}>
            <ReviewsSection business={b} />
          </View>
        ) : (
          <View style={styles.section}>
            {infoRow(verified ? 'verified' : 'help-outline', t('business.page.trust'), verificationText(b, t, i18n.language))}
            {b.address || district ? infoRow('place', t('business.addressLabel'), [b.address, district, province].filter(Boolean).join(', ')) : null}
            {infoRow(
              'schedule',
              t('business.hoursLabel'),
              b.is24h ? (
                t('business.open24')
              ) : b.weeklyHours ? (
                <View style={styles.hours}>
                  {b.weeklyHours.map((d, i) => (
                    <View key={i} style={styles.hourRow}>
                      <AppText style={[styles.grow, i === today && styles.bold]}>{days[i]}</AppText>
                      <AppText style={i === today ? styles.bold : undefined}>{d ? `${d.open} – ${d.close}` : t('business.page.closed')}</AppText>
                    </View>
                  ))}
                </View>
              ) : (
                b.hoursNote ?? '–'
              ),
            )}
            {services.length ? infoRow('handyman', t('business.servicesLabel'), services.join(', ')) : null}
            {b.paymentMethods?.length ? infoRow('payments', t('business.page.payment'), chips(b.paymentMethods.map((m) => t(`business.payment.${m}`)))) : null}
            {b.amenities?.length ? infoRow('check-circle-outline', t('business.page.amenities'), chips(b.amenities.map((m) => t(`business.amenity.${m}`)))) : null}
            {!verified ? <AppText variant="caption" muted>{t('business.unverifiedWarning')}</AppText> : null}
            <AppText variant="caption" muted>{t('business.updated', { date: new Date(b.updatedAt).toLocaleDateString(i18n.language) })}</AppText>
            <AppText variant="caption" muted>{t('business.infoOnly')}</AppText>
          </View>
        )}
        <View style={{ height: insets.bottom + spacing.lg }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  pad: { paddingHorizontal: GUTTER, paddingTop: spacing.md, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  ring: { width: 88, height: 88, borderRadius: 44, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  avatarIcon: { position: 'absolute', top: 8, opacity: 0.35 },
  initial: { fontFamily: fonts.heading, fontSize: 32, marginTop: 8 },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', flexShrink: 1 },
  statN: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 23 },
  statL: { fontSize: 12, lineHeight: 16 },
  bio: { gap: 2, marginTop: -spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20, flexShrink: 1 },
  open: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18 },
  desc: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  buttons: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: { flexGrow: 1, flexBasis: 70, minHeight: 36, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: spacing.sm },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  teamBox: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH },
  teamText: { fontFamily: fonts.bodySemi, fontSize: 14 },
  pending: { gap: spacing.sm },
  pendingRow: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  grow: { flex: 1 },
  tabs: { flexDirection: 'row', marginTop: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'flex-end', gap: 9 },
  tabLine: { height: 1.5, alignSelf: 'stretch' },
  section: { padding: GUTTER, gap: spacing.md },
  price: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  priceValue: { fontFamily: fonts.bodySemi, fontSize: 15 },
  center: { textAlign: 'center', padding: spacing.lg },
  infoRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  hours: { gap: 4, marginTop: 2 },
  hourRow: { flexDirection: 'row', gap: spacing.sm },
  bold: { fontFamily: fonts.bodySemi },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  chipText: { fontSize: 12, fontFamily: fonts.bodyMedium },
});
