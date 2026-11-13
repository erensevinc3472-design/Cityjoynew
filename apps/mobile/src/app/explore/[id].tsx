import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isPostListed, type Post } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { PostActions } from '@/components/post-actions';
import { PostCard } from '@/components/post-card';
import { PostComments } from '@/components/post-comments';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { authorHref, cachedPost, toggleLike, useLiked } from '@/lib/posts';
import { postRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { spacing } from '@/theme/tokens';
import { errorText } from '@/lib/limits';

/**
 * Gönderi ayrıntısı: bildirimden ya da paylaşılan bağlantıdan açılır (akışta gönderi yerinde, yorumlar alttan açılan
 * panelde). Yazının tamamı, beğeni, kaydet, yorumlar, şikâyet; sahibi için yorumları kapatma ve kaldırma.
 */
export default function PostScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, profile } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Post | null | undefined>(() => cachedPost(id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<boolean>();
  const isLiked = useLiked(user?.uid);
  const mine = !!item && !!user && item.authorUid === user.uid;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/explore'));

  useEffect(() => {
    if (!user) return;
    // Göremediği gönderide (başka mahalle, kaldırılmış) kurallar okutmaz: "artık yok" gösterilir.
    postRepository.get(id).then(setItem, () => setItem(null));
    postRepository.isSaved(user.uid, id).then(setSaved);
  }, [id, user]);

  const header = <HeroHeader compact title={t('explore.post')} onBack={back} />;

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
    } catch (e) {
      setError(errorText(t, e, errKey));
    } finally {
      setBusy(false);
    }
  };

  const like = () =>
    run(async () => {
      const count = await toggleLike(item, user.uid, isLiked(item.id));
      setItem({ ...item, likeCount: count });
    }, 'explore.likeError');

  const toggleSave = () =>
    run(async () => {
      if (saved) await postRepository.unsave(user.uid, item.id);
      else await postRepository.save(user.uid, item.id);
      setSaved(!saved);
    }, 'explore.saveError');

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <PostCard item={item} liked={isLiked(item.id)} full onLike={busy ? undefined : like} onAuthor={() => router.push(authorHref(item))} />
        {error ? <FormMessage kind="error" text={error} /> : null}
        <View style={styles.row}>
          <AppButton variant="secondary" title={saved ? t('explore.unsave') : t('explore.save')} disabled={busy || saved === undefined} onPress={toggleSave} />
        </View>
        <PostComments post={item} uid={user.uid} displayName={profile?.displayName} onCount={(n) => setItem((p) => (p ? { ...p, commentCount: n } : p))} />
        <PostActions item={item} uid={user.uid} onChange={setItem} onRemoved={back} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
