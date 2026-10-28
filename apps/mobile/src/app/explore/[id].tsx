import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isPostListed, POST_REPORT_REASONS, type Post, type PostReportReason } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { PostCard } from '@/components/post-card';
import { PostComments } from '@/components/post-comments';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { authorHref, cachedPost, patchCachedPost, toggleLike, useLiked } from '@/lib/posts';
import { postRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { spacing } from '@/theme/tokens';

/** Gönderi ayrıntısı: yazının tamamı, beğeni, kaydet, yorumlar, şikâyet; sahibi için yorumları kapatma ve kaldırma. */
export default function PostScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, profile } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Post | null | undefined>(() => cachedPost(id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reporting, setReporting] = useState<PostReportReason | null>(null);
  const [reported, setReported] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saved, setSaved] = useState<boolean>();
  const isLiked = useLiked(user?.uid);
  const mine = !!item && !!user && item.authorUid === user.uid;

  useEffect(() => {
    if (!user) return;
    // Göremediği gönderide (başka mahalle, kaldırılmış) kurallar okutmaz: "artık yok" gösterilir.
    postRepository.get(id).then(setItem, () => setItem(null));
    postRepository.hasReported(id, user.uid).then(setReported);
    postRepository.isSaved(user.uid, id).then(setSaved);
  }, [id, user]);

  const header = <HeroHeader title={t('explore.post')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} />;

  if (!user || item === undefined || !item || !(isPostListed(item) || (mine && item.status === 'aktif'))) {
    return (
      <Screen header={header}>
        <View style={styles.content}>
          {!user ? <FormMessage kind="info" text={t('explore.signIn')} /> : item === undefined ? <StateMessage kind="loading" /> : <StateMessage kind="empty" message={t('explore.gone')} />}
        </View>
      </Screen>
    );
  }

  const run = async (fn: () => Promise<void>, errKey: string) => {
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

  const like = () =>
    run(async () => {
      const count = await toggleLike(item, user.uid, isLiked(item.id));
      setItem({ ...item, likeCount: count });
    }, 'explore.likeError');

  const remove = () =>
    run(async () => {
      await postRepository.remove(item.id);
      patchCachedPost(item.id, { status: 'kaldirildi' });
      router.canGoBack() ? router.back() : router.replace('/explore');
    }, 'explore.saveError');

  const report = () =>
    run(async () => {
      await postRepository.report(item, user.uid, reporting!);
      setReported(true);
      setReporting(null);
    }, 'explore.reportError');

  const toggleSave = () =>
    run(async () => {
      if (saved) await postRepository.unsave(user.uid, item.id);
      else await postRepository.save(user.uid, item.id);
      setSaved(!saved);
    }, 'explore.saveError');

  const toggleComments = () =>
    run(async () => {
      await postRepository.setCommentsOff(item.id, !item.commentsOff);
      patchCachedPost(item.id, { commentsOff: !item.commentsOff });
      setItem({ ...item, commentsOff: !item.commentsOff });
    }, 'explore.saveError');

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content}>
        <PostCard item={item} liked={isLiked(item.id)} full onLike={busy ? undefined : like} onAuthor={() => router.push(authorHref(item))} />
        {mine && item.reportCount >= 3 && !item.cleared ? <FormMessage kind="info" text={t('explore.hiddenForReview')} /> : null}
        {error ? <FormMessage kind="error" text={error} /> : null}
        <View style={styles.row}>
          <AppButton variant="secondary" title={saved ? t('explore.unsave') : t('explore.save')} disabled={busy || saved === undefined} onPress={toggleSave} />
          {mine ? <AppButton variant="secondary" title={item.commentsOff ? t('explore.comments.turnOn') : t('explore.comments.turnOff')} disabled={busy} onPress={toggleComments} /> : null}
        </View>
        <PostComments post={item} uid={user.uid} displayName={profile?.displayName} onCount={(n) => setItem((p) => (p ? { ...p, commentCount: n } : p))} />

        {mine ? (
          confirmRemove ? (
            <View style={styles.block}>
              <AppText>{t('explore.removeConfirm')}</AppText>
              <AppButton title={t('explore.remove')} loading={busy} disabled={busy} onPress={remove} />
              <AppButton variant="ghost" title={t('account.cancel')} onPress={() => setConfirmRemove(false)} />
            </View>
          ) : (
            <AppButton variant="ghost" title={t('explore.remove')} onPress={() => setConfirmRemove(true)} />
          )
        ) : reported ? (
          <AppText variant="caption" muted>{t('explore.reported')}</AppText>
        ) : reporting ? (
          <View style={styles.block}>
            <AppText variant="label">{t('explore.reportTitle')}</AppText>
            <Chips<PostReportReason> label={t('explore.reportTitle')} value={reporting} onChange={setReporting} options={POST_REPORT_REASONS.map((r) => ({ value: r, label: t(`explore.reasons.${r}`) }))} />
            <AppButton title={t('explore.reportSend')} loading={busy} disabled={busy} onPress={report} />
            <AppButton variant="ghost" title={t('account.cancel')} onPress={() => setReporting(null)} />
          </View>
        ) : (
          <AppButton variant="ghost" title={t('explore.report')} onPress={() => setReporting('spam')} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  block: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
