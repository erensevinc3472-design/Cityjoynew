import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isPostListed, type Post } from '@cityjoy/shared';

import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { PostCard } from '@/components/post-card';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { toggleLike, useLiked } from '@/lib/posts';
import { postRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { spacing } from '@/theme/tokens';

/** Kaydettiklerim: kişinin kaydettiği gönderiler (yeniden eskiye). Kaldırılan ya da artık görülemeyenler listede yok. */
export default function SavedPostsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useSession();
  const isLiked = useLiked(user?.uid);
  const [list, setList] = useState<Post[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (!user) return;
    setFailed(false);
    postRepository.listSaved(user.uid).then((l) => setList(l.filter(isPostListed)), () => setFailed(true));
  }, [user]);
  // Ayrıntıda "kaydetmeyi geri al" denince dönüşte liste güncel olsun.
  useFocusEffect(load);

  const like = async (p: Post) => {
    if (!user) return;
    const count = await toggleLike(p, user.uid, isLiked(p.id)).catch(() => p.likeCount);
    setList((l) => (l ?? []).map((x) => (x.id === p.id ? { ...x, likeCount: count } : x)));
  };

  const header = <HeroHeader title={t('explore.saved')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} />;

  if (!user) {
    return (
      <Screen header={header}>
        <FormMessage kind="info" text={t('explore.signIn')} />
      </Screen>
    );
  }

  return (
    <Screen header={header}>
      <FlatList
        data={list ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <PostCard item={item} liked={isLiked(item.id)} onPress={() => router.push({ pathname: '/explore/[id]', params: { id: item.id } })} onLike={() => like(item)} />
        )}
        ListEmptyComponent={
          failed ? <StateMessage kind="error" message={t('explore.loadError')} onRetry={load} />
          : list === null ? <StateMessage kind="loading" />
          : <StateMessage kind="empty" message={t('explore.savedEmpty')} />
        }
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
});
