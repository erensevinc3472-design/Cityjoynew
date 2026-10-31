import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isListingLive, type Listing } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { ListingCard } from '@/components/listing-card';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useFavorites } from '@/lib/listings';
import { listingRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { spacing } from '@/theme/tokens';

type Tab = 'ilanlarim' | 'favoriler';

/** İlanlarım (yayında, satılan, süresi dolan) ve Favorilerim (hâlâ yayında olanlar). */
export default function MyListingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useSession();
  const fav = useFavorites(user?.uid);
  const [tab, setTab] = useState<Tab>('ilanlarim');
  const [list, setList] = useState<Listing[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setFailed(false);
    setList(null);
    try {
      setList(tab === 'ilanlarim' ? await listingRepository.listMine(user.uid) : (await listingRepository.listFavorites(user.uid)).filter((l) => isListingLive(l) || l.status === 'satildi'));
    } catch {
      setFailed(true);
      setList([]);
    }
  }, [user, tab]);

  // İlan sayfasından dönünce (satıldı, yenile, kaldır) liste tazelenir.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const header = <HeroHeader title={t('carsi.mine')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/carsi'))} />;
  const status = (l: Listing) =>
    l.status === 'satildi' ? t('carsi.sold') : !isListingLive(l) ? t('carsi.notListed') : null;

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        {!user ? (
          <FormMessage kind="info" text={t('carsi.signIn')} />
        ) : (
          <>
            <Chips<Tab> label={t('carsi.mine')} value={tab} onChange={setTab} options={[{ value: 'ilanlarim', label: t('carsi.myListings') }, { value: 'favoriler', label: t('carsi.favorites') }]} />
            {failed ? (
              <StateMessage kind="error" message={t('carsi.loadError')} onRetry={load} />
            ) : list === null ? (
              <StateMessage kind="loading" />
            ) : list.length === 0 ? (
              <>
                <StateMessage kind="empty" message={tab === 'ilanlarim' ? t('carsi.noMine') : t('carsi.noFavorites')} />
                {tab === 'ilanlarim' ? <AppButton title={t('carsi.new')} onPress={() => router.push('/carsi/new')} /> : null}
              </>
            ) : (
              list.map((l) => (
                <View key={l.id} style={styles.item}>
                  <ListingCard
                    item={l}
                    favorite={tab === 'favoriler' ? fav.isFavorite(l.id) : undefined}
                    onFavorite={tab === 'favoriler' ? () => fav.toggle(l.id).then(() => setList((cur) => cur?.filter((x) => x.id !== l.id) ?? null), () => {}) : undefined}
                    onPress={() => router.push({ pathname: '/carsi/[id]', params: { id: l.id } })}
                  />
                  {tab === 'ilanlarim' && status(l) && l.status !== 'satildi' ? <AppText variant="caption" muted>{status(l)}</AppText> : null}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  item: { gap: 4 },
});
