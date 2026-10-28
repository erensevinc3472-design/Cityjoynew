import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
} from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { CheckboxRow } from '@/components/checkbox-row';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { PostCard } from '@/components/post-card';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { TextField } from '@/components/text-field';
import { useBannedWordCheck } from '@/lib/banned-words';
import { toggleLike, useLiked } from '@/lib/posts';
import { postRepository, socialRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { refreshFollowing, setBlocked, setMyProfile, useSocial } from '@/lib/social';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Keşfet profili (PROJE.md 5.8): ad ("Ayşe K."), kısa tanıtım, takipçi / takip sayıları ve gönderiler. Yaş, cinsiyet,
 * meslek ve mahalle gösterilmez. Kendi profilinde: düzenleme, gizli hesap ve takip istekleri. Başkasının profilinde:
 * takip et (gizli hesapta istek), engelle, şikâyet et. Gizli hesabın gönderilerini yalnızca takipçileri görür.
 */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { user } = useSession();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { blocked } = useSocial();
  const isLiked = useLiked(user?.uid);
  const own = !!user && user.uid === uid;
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null);
  const [follow, setFollow] = useState<FollowStatus | null | undefined>(undefined);
  const [blockedMe, setBlockedMe] = useState(false);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [requests, setRequests] = useState<{ uid: string; displayName: string }[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ displayName: '', bio: '', isPrivate: false });
  const [reporting, setReporting] = useState<ProfileReportReason | null>(null);
  const [reported, setReported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const iBlocked = blocked.has(uid);
  const hasBanned = useBannedWordCheck();

  const load = useCallback(async () => {
    if (!user) return;
    const p = await socialRepository.getProfile(uid).catch(() => null);
    setProfile(p);
    if (!p) return;
    socialRepository.counts(uid).then(setCounts, () => setCounts(null));
    if (own) {
      socialRepository.requests(uid).then(setRequests, () => setRequests([]));
      postRepository.listMine(uid).then((l) => setPosts(l.filter((x) => x.status === 'aktif')), () => setPosts([]));
      return;
    }
    const [f, b] = await Promise.all([socialRepository.followState(user.uid, uid), socialRepository.isBlockedBy(user.uid, uid)]);
    setFollow(f);
    setBlockedMe(b);
    socialRepository.hasReportedProfile(uid, user.uid).then(setReported);
    if (b || (p.isPrivate && f !== 'aktif')) return setPosts([]);
    postRepository.byAuthor(uid, f === 'aktif').then((l) => setPosts(l.filter(isPostListed)), () => setPosts([]));
  }, [uid, user, own]);

  useEffect(() => {
    load();
  }, [load]);

  const header = <HeroHeader title={own ? t('explore.profile.mine') : t('explore.profile.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} />;

  if (!user || profile === undefined || !profile) {
    return (
      <Screen header={header}>
        <View style={styles.content}>
          {!user ? <FormMessage kind="info" text={t('explore.signIn')} /> : profile === undefined ? <StateMessage kind="loading" /> : <StateMessage kind="empty" message={t('explore.profile.missing')} />}
        </View>
      </Screen>
    );
  }

  const run = async (fn: () => Promise<void>, errKey = 'explore.saveError') => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch {
      setError(t(errKey));
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
    }, 'explore.reportError');

  const like = async (p: Post) => {
    const count = await toggleLike(p, user.uid, isLiked(p.id)).catch(() => p.likeCount);
    setPosts((l) => (l ?? []).map((x) => (x.id === p.id ? { ...x, likeCount: count } : x)));
  };

  const hidden = !own && (blockedMe || iBlocked || (profile.isPrivate && follow !== 'aktif'));

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.head}>
            <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
              <AppText style={[styles.initial, { color: c.icon }]}>{(profile.displayName || '?').slice(0, 1).toLocaleUpperCase()}</AppText>
            </View>
            <View style={styles.who}>
              <AppText accessibilityRole="header" style={[styles.name, { color: c.textStrong }]}>{profile.displayName}</AppText>
              {profile.isPrivate ? <AppText variant="caption" muted>{t('explore.profile.private')}</AppText> : null}
            </View>
          </View>
          {profile.bio ? <AppText selectable>{profile.bio}</AppText> : null}
          {counts ? <AppText variant="caption" muted>{t('explore.profile.counts', counts)}</AppText> : null}
        </View>
        {error ? <FormMessage kind="error" text={error} /> : null}

        {own ? (
          editing ? (
            <View style={styles.block}>
              <TextField label={t('explore.profile.name')} value={draft.displayName} onChangeText={(v) => setDraft((d) => ({ ...d, displayName: v }))} maxLength={40} hint={t('explore.profile.nameHint')} />
              {profile.bioRemoved ? (
                <FormMessage kind="info" text={t('explore.profile.bioRemoved')} />
              ) : (
                <TextField label={t('explore.profile.bio')} value={draft.bio} onChangeText={(v) => setDraft((d) => ({ ...d, bio: v }))} maxLength={PROFILE_LIMITS.bio} multiline />
              )}
              <CheckboxRow checked={draft.isPrivate} onToggle={() => setDraft((d) => ({ ...d, isPrivate: !d.isPrivate }))} label={t('explore.profile.privateToggle')} />
              <AppButton title={t('explore.profile.save')} loading={busy} disabled={busy} onPress={saveProfile} />
              <AppButton variant="ghost" title={t('account.cancel')} onPress={() => setEditing(false)} />
            </View>
          ) : (
            <AppButton variant="secondary" title={t('explore.profile.edit')} onPress={() => { setDraft({ displayName: profile.displayName, bio: profile.bio, isPrivate: profile.isPrivate }); setEditing(true); }} />
          )
        ) : blockedMe ? (
          <FormMessage kind="info" text={t('explore.profile.unavailable')} />
        ) : iBlocked ? null : (
          <>
            <AppButton
              variant={follow ? 'secondary' : 'primary'}
              title={follow === 'aktif' ? t('explore.profile.unfollow') : follow === 'istek' ? t('explore.profile.requested') : profile.isPrivate ? t('explore.profile.request') : t('explore.profile.follow')}
              loading={busy}
              disabled={busy || follow === undefined}
              onPress={toggleFollow}
            />
            {/* Mesaj (PROJE.md 5.11): takipleşmiyorlarsa karşı tarafa istek olarak düşer. */}
            <AppButton variant="secondary" title={t('messages.write')} onPress={() => router.push({ pathname: '/messages/[uid]', params: { uid } })} />
          </>
        )}

        {own && requests.length ? (
          <View style={styles.block}>
            <AppText variant="label" accessibilityRole="header">{t('explore.profile.requests')}</AppText>
            {requests.map((r) => (
              <View key={r.uid} style={[styles.request, { borderColor: c.border }]}>
                <AppText style={styles.who}>{r.displayName}</AppText>
                <AppButton title={t('explore.profile.accept')} disabled={busy} onPress={() => answer(r.uid, true)} />
                <AppButton variant="ghost" title={t('explore.profile.decline')} disabled={busy} onPress={() => answer(r.uid, false)} />
              </View>
            ))}
          </View>
        ) : null}

        <AppText variant="label" accessibilityRole="header">{t('explore.profile.posts')}</AppText>
        {hidden ? (
          <AppText variant="caption" muted>{iBlocked ? t('explore.profile.youBlocked') : blockedMe ? '' : t('explore.profile.privateNote')}</AppText>
        ) : posts === null ? (
          <StateMessage kind="loading" />
        ) : posts.length === 0 ? (
          <AppText variant="caption" muted>{t('explore.profile.noPosts')}</AppText>
        ) : (
          posts.map((p) => <PostCard key={p.id} item={p} liked={isLiked(p.id)} onPress={() => router.push({ pathname: '/explore/[id]', params: { id: p.id } })} onLike={() => like(p)} />)
        )}
        {own ? <AppText variant="caption" muted>{t('explore.profile.ownNote')}</AppText> : null}

        {own ? null : (
          <View style={styles.block}>
            <AppButton variant="ghost" title={iBlocked ? t('explore.profile.unblock') : t('explore.profile.block')} disabled={busy} onPress={toggleBlock} />
            {!iBlocked ? <AppText variant="caption" muted>{t('explore.profile.blockNote')}</AppText> : null}
            {reported ? (
              <AppText variant="caption" muted>{t('explore.reported')}</AppText>
            ) : reporting ? (
              <>
                <Chips<ProfileReportReason> label={t('explore.reportTitle')} value={reporting} onChange={setReporting} options={PROFILE_REPORT_REASONS.map((r) => ({ value: r, label: t(`explore.profile.reasons.${r}`) }))} />
                <AppButton title={t('explore.reportSend')} loading={busy} disabled={busy} onPress={report} />
                <AppButton variant="ghost" title={t('account.cancel')} onPress={() => setReporting(null)} />
              </>
            ) : (
              <AppButton variant="ghost" title={t('explore.profile.report')} onPress={() => setReporting('taklit')} />
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.heading, fontSize: 24 },
  who: { flex: 1 },
  name: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 24 },
  block: { gap: spacing.xs },
  request: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, paddingTop: spacing.xs, flexWrap: 'wrap' },
});
