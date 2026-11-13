import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isPostListed, POST_CATEGORIES, type Post } from '@cityjoy/shared';

import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { FilterRow } from '@/components/inner';
import { PostGrid } from '@/components/post-grid';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { postRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { GUTTER, spacing } from '@/theme/tokens';

/**
 * Kaydettiklerim: kişinin kaydettiği gönderiler (yeniden eskiye), üçlü küçük ızgara (Eren, 13 Kasım 2026: "medyalar küçük
 * olarak sıralansın, aradığını bulmak kolay olsun"). Üstte yalnızca kaydedilenlerde olan konular süzgeç olarak çıkar.
 * Dokununca gönderi açılır. Kaldırılan ya da artık görülemeyenler listede yok.
 */
export default function SavedPostsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useSession();
  const [list, setList] = useState<Post[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user) return;
    setFailed(false);
    postRepository.listSaved(user.uid).then((l) => setList(l.filter(isPostListed)), () => setFailed(true));
  }, [user]);
  // Ayrıntıda "kaydetmeyi geri al" denince dönüşte liste güncel olsun.
  useFocusEffect(load);

  const header = <HeroHeader title={t('explore.saved')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} />;

  if (!user) {
    return (
      <Screen header={header}>
        <FormMessage kind="info" text={t('explore.signIn')} />
      </Screen>
    );
  }

  const present = POST_CATEGORIES.filter((k) => list?.some((p) => p.category === k));
  const shown = list && category ? list.filter((p) => p.category === category) : list;

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />} showsVerticalScrollIndicator={false}>
        {failed ? (
          <StateMessage kind="error" message={t('explore.loadError')} onRetry={load} />
        ) : list?.length === 0 ? (
          <StateMessage kind="empty" message={t('explore.savedEmpty')} />
        ) : (
          <>
            <FilterRow kinds={present.map((k) => ({ id: k, name: t(`explore.categories.${k}`) }))} kind={category} onKind={setCategory} />
            <View style={styles.bleed}>
              <PostGrid list={shown} empty={t('explore.savedEmpty')} />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  // Izgara kenardan kenara (profildeki gibi).
  bleed: { marginHorizontal: -GUTTER },
});
