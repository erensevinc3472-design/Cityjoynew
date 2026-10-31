import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  isPostListed,
  PROFILE_LIMITS,
  PROFILE_REPORT_REASONS,
  validateBio,
  type FollowStatus,
  type Post,
  type ProfileReportReason,
  type PublicProfile,
  unreadKey,
} from '@cityjoy/shared';
import type { JoinedItem } from '@cityjoy/shared/firebase';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { BottomNav } from '@/components/bottom-nav';
import { CheckboxRow } from '@/components/checkbox-row';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { PostGrid } from '@/components/post-grid';
import { RoundButton } from '@/components/hero-header';
import { StateMessage } from '@/components/state-message';
import { TextField } from '@/components/text-field';
import { TopBar } from '@/components/top-bar';
import { useBannedWordCheck } from '@/lib/banned-words';
import { useChats } from '@/lib/messages';
import { eventRepository, postRepository, socialRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { refreshFollowing, setBlocked, setMyProfile, useSocial } from '@/lib/social';
import { fonts, GUTTER, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { errorText } from '@/lib/limits';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
type Tab = 'gonderiler' | 'kaydedilenler' | 'katildiklarim';
const TAB_ICONS: Record<Tab, IconName> = { gonderiler: 'grid-on', kaydedilenler: 'bookmark-border', katildiklarim: 'event-available' };

/**
 * Profil (Instagram düzeni; 13. madde 31). Paylaşım yalnızca Keşfet'ten yapılır, profil paylaşılanları gösterir.
 * Üstte halkalı harf ve gönderi / takipçi / takip sayıları, altında ad ve kısa tanıtım (il gösterilmez, isteyen
 * tanıtımına yazar). Kendi profilinde: Düzenle, Profili paylaş, Kişi bul; Ailem (SOS) ve İşletmem kısayolları;
 * sekmeler Gönderiler, Kaydedilenler, Katıldıklarım. Başkasının profilinde: Takip et, Mesaj; engelle ve şikâyet "…"
 * menüsünde. Gizli hesabın gönderilerini yalnızca takipçileri görür.
 */
export function ProfileView({ uid, asTab }: { uid: string; asTab?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { user } = useSession();
  const { blocked } = useSocial();
  const own = !!user && user.uid === uid;
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null);
  const [follow, setFollow] = useState<FollowStatus | null | undefined>(undefined);
  const [blockedMe, setBlockedMe] = useState(false);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [saved, setSaved] = useState<Post[] | null>(null);
  const [joined, setJoined] = useState<JoinedItem[] | null>(null);
  const [requests, setRequests] = useState<{ uid: string; displayName: string }[]>([]);
  const [tab, setTab] = useState<Tab>('gonderiler');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ displayName: '', bio: '', isPrivate: false });
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState<ProfileReportReason | null>(null);
  const [reported, setReported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const iBlocked = blocked.has(uid);
  const hasBanned = useBannedWordCheck();
  // Mesajlar profilin sağ üstünde (alt menüde değil); okunmamış varsa nokta.
  const { chats } = useChats(own ? uid : undefined);
  const unreadChats = (chats ?? []).some((x) => (x.unread[unreadKey(x, uid)] ?? 0) > 0);

  const load = useCallback(async () => {
    if (!user) return;
    const p = await socialRepository.getProfile(uid).catch(() => null);
    setProfile(p);
    if (!p) return;
    socialRepository.counts(uid).then(setCounts, () => setCounts(null));
    if (own) {
      socialRepository.requests(uid).then(setRequests, () => setRequests([]));
      // İşletme adına paylaşımlar kişinin değil işletmenin sayfasında görünür.
      postRepository.listMine(uid).then((l) => setPosts(l.filter((x) => x.status === 'aktif' && !x.business)), () => setPosts([]));
      return;
    }
    const [f, b] = await Promise.all([socialRepository.followState(user.uid, uid), socialRepository.isBlockedBy(user.uid, uid)]);
    setFollow(f);
    setBlockedMe(b);
    socialRepository.hasReportedProfile(uid, user.uid).then(setReported);
    if (b || (p.isPrivate && f !== 'aktif')) return setPosts([]);
    postRepository.byAuthor(uid, f === 'aktif').then((l) => setPosts(l.filter((x) => isPostListed(x) && !x.business)), () => setPosts([]));
  }, [uid, user, own]);

  useEffect(() => {
    load();
  }, [load]);

  // Kaydedilenler ve Katıldıklarım yalnızca sekme açılınca okunur.
  useEffect(() => {
    if (!own || !user) return;
    if (tab === 'kaydedilenler' && saved === null) postRepository.listSaved(user.uid).then((l) => setSaved(l.filter(isPostListed)), () => setSaved([]));
    if (tab === 'katildiklarim' && joined === null) eventRepository.listJoined(user.uid).then(setJoined, () => setJoined([]));
  }, [tab, own, user, saved, joined]);

  const back = () => (asTab ? router.dismissTo('/home') : router.canGoBack() ? router.back() : router.replace('/explore'));
  const footer = asTab ? <BottomNav active="profile" /> : null;
  const top = (title: string, right?: ReactNode) => (
    <TopBar centered title={title} left={<RoundButton icon="arrow-back" label={t('common.back')} onPress={back} />} right={right} />
  );

  if (!user || !profile) {
    return (
      <View style={[styles.root, { backgroundColor: c.background }]}>
        {top(own ? t('explore.profile.mine') : t('explore.profile.title'))}
        <View style={styles.pad}>
          {!user ? <FormMessage kind="info" text={t('explore.signIn')} /> : profile === undefined ? <StateMessage kind="loading" /> : <StateMessage kind="empty" message={t('explore.profile.missing')} />}
        </View>
        {footer}
      </View>
    );
  }

  const run = async (fn: () => Promise<void>, errKey = 'explore.saveError') => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(errorText(t, e, errKey));
    } finally {
      setBusy(false);
    }
  };

  const toggleFollow = () =>
    run(async () => {
      if (follow) {
        await socialRepository.unfollow(user.uid, uid);
        setFollow(null);
      } else setFollow(await socialRepository.follow(user.uid, uid, profile.isPrivate));
      refreshFollowing(user.uid);
      load();
    });

  const toggleBlock = () =>
    run(async () => {
      if (iBlocked) await socialRepository.unblock(user.uid, uid);
      else await socialRepository.block(user.uid, uid);
      setBlocked(user.uid, uid, !iBlocked);
      setFollow(null);
      setMenu(false);
      load();
    });

  const saveProfile = () => {
    if (!draft.displayName.trim() || !validateBio(draft.bio)) return setError(t('explore.profile.invalid'));
    if (hasBanned(draft.displayName, draft.bio)) return setError(t('explore.errors.banned'));
    run(async () => {
      await socialRepository.updateProfile(uid, draft);
      const next = { ...profile, displayName: draft.displayName.trim().slice(0, 40), bio: draft.bio.trim(), isPrivate: draft.isPrivate };
      setProfile(next);
      setMyProfile(next);
      setEditing(false);
    });
  };

  const answer = (follower: string, accept: boolean) =>
    run(async () => {
      if (accept) await socialRepository.accept(uid, follower);
      else await socialRepository.removeFollower(uid, follower);
      setRequests((r) => r.filter((x) => x.uid !== follower));
      socialRepository.counts(uid).then(setCounts, () => {});
    });

  const report = () =>
    run(async () => {
      await socialRepository.reportProfile(profile, user.uid, reporting!);
      setReported(true);
      setReporting(null);
      setMenu(false);
    }, 'explore.reportError');

  const shareProfile = () => Share.share({ message: t('explore.profile.shareText', { name: profile.displayName }) }).catch(() => {});
  const startEdit = () => {
    setDraft({ displayName: profile.displayName, bio: profile.bio, isPrivate: profile.isPrivate });
    setEditing(true);
  };

  const hidden = !own && (blockedMe || iBlocked || (profile.isPrivate && follow !== 'aktif'));
  const tabs: Tab[] = own ? ['gonderiler', 'kaydedilenler', 'katildiklarim'] : ['gonderiler'];

  const pill = (label: string, onPress: () => void, opts: { primary?: boolean; disabled?: boolean } = {}) => (
    <Pressable
      accessibilityRole="button"
      disabled={opts.disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, { backgroundColor: opts.primary ? c.primary : c.surfaceStrong, opacity: opts.disabled ? 0.5 : pressed ? 0.75 : 1 }]}>
      <AppText numberOfLines={1} style={[styles.pillText, { color: opts.primary ? c.onPrimary : c.textStrong }]}>{label}</AppText>
    </Pressable>
  );
  const iconPill = (icon: IconName, label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.pillIcon, { backgroundColor: c.surfaceStrong, opacity: pressed ? 0.75 : 1 }]}>
      <MaterialIcons name={icon} size={20} color={c.textStrong} />
    </Pressable>
  );
  const shortcut = (icon: IconName, title: string, hint: string, color: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${hint}`} onPress={onPress} style={({ pressed }) => [styles.shortcut, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[styles.shortcutIcon, { backgroundColor: color }]}>
        <MaterialIcons name={icon} size={18} color="#FFFFFF" />
      </View>
      <View style={styles.grow}>
        <AppText numberOfLines={1} style={[styles.shortcutTitle, { color: c.textStrong }]}>{title}</AppText>
        <AppText numberOfLines={1} style={[styles.shortcutHint, { color: c.textMuted }]}>{hint}</AppText>
      </View>
    </Pressable>
  );

  const joinedList = () =>
    joined === null ? (
      <StateMessage kind="loading" />
    ) : joined.length === 0 ? (
      <AppText variant="caption" muted style={styles.empty}>{t('explore.profile.noJoined')}</AppText>
    ) : (
      <View style={styles.joined}>
        {joined.map((j) => {
          const d = j.startsAt ? new Date(j.startsAt) : null;
          return (
            <Pressable
              key={`${j.kind}-${j.id}`}
              accessibilityRole="button"
              onPress={() => router.push(j.kind === 'etkinlik' ? { pathname: '/events/[id]', params: { id: j.id } } : { pathname: '/activities/[id]', params: { id: j.id } })}
              style={({ pressed }) => [styles.joinedRow, { borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 }]}>
              <View style={[styles.date, { backgroundColor: c.accentSoft }]}>
                <AppText style={[styles.day, { color: c.accent }]}>{d ? d.getDate() : '–'}</AppText>
                <AppText style={[styles.month, { color: c.accent }]}>{d ? d.toLocaleDateString(lang, { month: 'short' }) : ''}</AppText>
              </View>
              <View style={styles.grow}>
                <AppText numberOfLines={2} style={[styles.joinedTitle, { color: c.textStrong }]}>{j.title}</AppText>
                <AppText style={[styles.shortcutHint, { color: j.cancelled ? c.danger : c.textMuted }]}>
                  {j.cancelled ? t('explore.profile.cancelled') : t(j.kind === 'etkinlik' ? 'explore.profile.joinedEvent' : 'explore.profile.joinedActivity')}
                </AppText>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={c.textSoft} />
            </Pressable>
          );
        })}
      </View>
    );

  const right = own ? (
    <>
      <RoundButton icon="chat-bubble-outline" label={unreadChats ? t('messages.titleUnread') : t('messages.title')} onPress={() => router.push('/messages')} badge={unreadChats} />
      <RoundButton icon="menu" label={t('menu.settings')} onPress={() => router.push('/account')} />
    </>
  ) : blockedMe ? null : (
    <RoundButton icon="more-horiz" label={t('explore.profile.more')} onPress={() => setMenu(true)} />
  );

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {top(profile.displayName, right)}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.pad}>
          {/* Profil başı: halkalı harf, yanında gönderi / takipçi / takip sayıları. */}
          <View style={styles.head}>
            <View style={[styles.ring, { borderColor: c.accent }]}>
              <View style={[styles.avatar, { backgroundColor: c.surfaceStrong }]}>
                <AppText style={[styles.initial, { color: c.accent }]}>{(profile.displayName || '?').slice(0, 1).toLocaleUpperCase(lang)}</AppText>
              </View>
            </View>
            <View style={styles.stats}>
              {[
                { n: hidden || posts === null ? '–' : String(posts.length), label: t('explore.profile.statPosts') },
                { n: counts ? String(counts.followers) : '–', label: t('explore.profile.statFollowers') },
                { n: counts ? String(counts.following) : '–', label: t('explore.profile.statFollowing') },
              ].map((x) => (
                <View key={x.label} style={styles.stat} accessible accessibilityLabel={`${x.n} ${x.label}`}>
                  <AppText style={[styles.statN, { color: c.textStrong }]}>{x.n}</AppText>
                  <AppText style={[styles.statL, { color: c.textMuted }]}>{x.label}</AppText>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.bio}>
            <AppText style={[styles.name, { color: c.textStrong }]}>{profile.displayName}</AppText>
            {profile.isPrivate ? (
              <View style={styles.privateRow}>
                <MaterialIcons name="lock-outline" size={13} color={c.textMuted} />
                <AppText variant="caption" muted>{t('explore.profile.private')}</AppText>
              </View>
            ) : null}
            {profile.bio ? <AppText selectable style={styles.bioText}>{profile.bio}</AppText> : null}
          </View>
          {error ? <FormMessage kind="error" text={error} /> : null}

          {own ? (
            editing ? (
              <View style={styles.block}>
                <TextField label={t('explore.profile.name')} value={draft.displayName} onChangeText={(v) => setDraft((d) => ({ ...d, displayName: v }))} maxLength={40} hint={t('explore.profile.nameHint')} />
                {profile.bioRemoved ? (
                  <FormMessage kind="info" text={t('explore.profile.bioRemoved')} />
                ) : (
                  <TextField label={t('explore.profile.bio')} hint={t('explore.profile.bioHint')} value={draft.bio} onChangeText={(v) => setDraft((d) => ({ ...d, bio: v }))} maxLength={PROFILE_LIMITS.bio} multiline />
                )}
                <CheckboxRow checked={draft.isPrivate} onToggle={() => setDraft((d) => ({ ...d, isPrivate: !d.isPrivate }))} label={t('explore.profile.privateToggle')} />
                <AppButton title={t('explore.profile.save')} loading={busy} disabled={busy} onPress={saveProfile} />
                <AppButton variant="ghost" title={t('account.cancel')} onPress={() => setEditing(false)} />
              </View>
            ) : (
              <View style={styles.buttons}>
                {pill(t('explore.profile.editShort'), startEdit)}
                {pill(t('explore.profile.share'), shareProfile)}
                {iconPill('person-add-alt', t('explore.profile.findPeople'), () => router.push({ pathname: '/search', params: { tab: 'kisiler' } }))}
              </View>
            )
          ) : blockedMe ? (
            <FormMessage kind="info" text={t('explore.profile.unavailable')} />
          ) : iBlocked ? (
            <AppButton variant="secondary" title={t('explore.profile.unblock')} disabled={busy} onPress={toggleBlock} />
          ) : (
            <View style={styles.buttons}>
              {pill(
                follow === 'aktif' ? t('explore.profile.following') : follow === 'istek' ? t('explore.profile.requested') : profile.isPrivate ? t('explore.profile.request') : t('explore.profile.follow'),
                toggleFollow,
                { primary: !follow, disabled: busy || follow === undefined },
              )}
              {/* Mesaj (PROJE.md 5.11): takipleşmiyorlarsa karşı tarafa istek olarak düşer. */}
              {pill(t('messages.write'), () => router.push({ pathname: '/messages/[uid]', params: { uid } }))}
            </View>
          )}

          {own && !editing ? (
            <View style={styles.shortcuts}>
              {shortcut('sos', t('family.title'), t('explore.profile.familyHint'), c.danger, () => router.push('/family'))}
              {shortcut('storefront', t('business.myTitle'), t('explore.profile.businessHint'), c.primary, () => router.push('/business'))}
            </View>
          ) : null}

          {own && requests.length ? (
            <View style={[styles.requests, { backgroundColor: c.surface, borderColor: c.border }]}>
              <AppText variant="label" accessibilityRole="header">{t('explore.profile.requests')}</AppText>
              {requests.map((r) => (
                <View key={r.uid} style={styles.request}>
                  <AppText style={styles.grow}>{r.displayName}</AppText>
                  {pill(t('explore.profile.accept'), () => answer(r.uid, true), { primary: true, disabled: busy })}
                  {pill(t('explore.profile.decline'), () => answer(r.uid, false), { disabled: busy })}
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Sekmeler: simgeli, seçilenin altında çizgi. */}
        <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: c.border }]}>
          {tabs.map((x) => {
            const selected = x === tab;
            return (
              <Pressable key={x} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={t(`explore.profile.tabs.${x}`)} onPress={() => setTab(x)} style={styles.tab}>
                <MaterialIcons name={TAB_ICONS[x]} size={24} color={selected ? c.textStrong : c.textSoft} />
                <View style={[styles.tabLine, { backgroundColor: selected ? c.textStrong : 'transparent' }]} />
              </Pressable>
            );
          })}
        </View>

        {tab === 'gonderiler' ? (
          hidden ? (
            <View style={styles.lockBox}>
              <MaterialIcons name="lock-outline" size={36} color={c.textSoft} />
              <AppText muted style={styles.center}>{iBlocked ? t('explore.profile.youBlocked') : blockedMe ? '' : t('explore.profile.privateNote')}</AppText>
            </View>
          ) : (
            <PostGrid list={posts} empty={own ? t('explore.profile.noPostsOwn') : t('explore.profile.noPosts')} />
          )
        ) : tab === 'kaydedilenler' ? (
          <PostGrid list={saved} empty={t('explore.profile.noSaved')} />
        ) : (
          joinedList()
        )}
        <View style={{ height: asTab ? spacing.lg : insets.bottom + spacing.lg }} />
      </ScrollView>
      {footer}

      {/* Başkasının profili: engelle ve şikâyet et. */}
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} style={styles.backdrop} onPress={() => setMenu(false)} />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: insets.bottom + spacing.md }]}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          {reporting ? (
            <>
              <AppText variant="label">{t('explore.reportTitle')}</AppText>
              <Chips<ProfileReportReason> label={t('explore.reportTitle')} value={reporting} onChange={setReporting} options={PROFILE_REPORT_REASONS.map((r) => ({ value: r, label: t(`explore.profile.reasons.${r}`) }))} />
              <AppButton title={t('explore.reportSend')} loading={busy} disabled={busy} onPress={report} />
              <AppButton variant="ghost" title={t('account.cancel')} onPress={() => setReporting(null)} />
            </>
          ) : (
            <>
              <SheetRow icon="share" label={t('explore.profile.share')} onPress={() => { setMenu(false); shareProfile(); }} />
              {reported ? (
                <AppText variant="caption" muted style={styles.sheetNote}>{t('explore.reported')}</AppText>
              ) : (
                <SheetRow icon="flag" label={t('explore.profile.report')} danger onPress={() => setReporting('taklit')} />
              )}
              <SheetRow icon="block" label={iBlocked ? t('explore.profile.unblock') : t('explore.profile.block')} danger={!iBlocked} onPress={toggleBlock} />
              {!iBlocked ? <AppText variant="caption" muted style={styles.sheetNote}>{t('explore.profile.blockNote')}</AppText> : null}
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

function SheetRow({ icon, label, danger, onPress }: { icon: IconName; label: string; danger?: boolean; onPress(): void }) {
  const c = useThemeColors();
  const color = danger ? c.danger : c.textStrong;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.sheetRow, { opacity: pressed ? 0.7 : 1 }]}>
      <MaterialIcons name={icon} size={22} color={color} />
      <AppText style={[styles.sheetText, { color }]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  pad: { paddingHorizontal: GUTTER, paddingTop: spacing.md, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  ring: { width: 88, height: 88, borderRadius: 44, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.heading, fontSize: 32 },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statN: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 23 },
  statL: { fontSize: 12, lineHeight: 16 },
  bio: { gap: 2, marginTop: -spacing.xs },
  name: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20 },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bioText: { fontSize: 14, lineHeight: 20 },
  buttons: { flexDirection: 'row', gap: 6 },
  pill: { flex: 1, minHeight: 36, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: spacing.sm },
  pillIcon: { width: 40, minHeight: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 14 },
  shortcuts: { flexDirection: 'row', gap: spacing.sm },
  shortcut: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH + 8, padding: 10, borderRadius: radius.md, borderWidth: 1 },
  shortcutIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  shortcutTitle: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 17 },
  shortcutHint: { fontSize: 11, lineHeight: 15 },
  grow: { flex: 1 },
  block: { gap: spacing.sm },
  requests: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  request: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabs: { flexDirection: 'row', marginTop: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'flex-end', gap: 9 },
  tabLine: { height: 1.5, alignSelf: 'stretch' },
  empty: { textAlign: 'center', padding: spacing.xl },
  lockBox: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  center: { textAlign: 'center' },
  joined: { gap: spacing.sm, padding: GUTTER },
  joinedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 10, borderRadius: radius.md, borderWidth: 1 },
  date: { width: 46, height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  day: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 22 },
  month: { fontSize: 11, lineHeight: 14, textTransform: 'uppercase' },
  joinedTitle: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 19 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { paddingHorizontal: GUTTER, paddingTop: spacing.sm, gap: spacing.sm, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: spacing.xs },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH + 4 },
  sheetText: { fontFamily: fonts.bodySemi, fontSize: 15 },
  sheetNote: { marginTop: -spacing.xs },
});
