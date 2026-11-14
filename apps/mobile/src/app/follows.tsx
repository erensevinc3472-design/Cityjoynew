import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { matchesSearch, type Business, type FollowStatus, type PublicProfile } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { AvatarPhoto } from '@/components/avatar-photo';
import { BusinessCard } from '@/components/business-card';
import { RoundButton } from '@/components/hero-header';
import { SearchField } from '@/components/search-field';
import { StateMessage } from '@/components/state-message';
import { TopBar } from '@/components/top-bar';
import { businessRepository, socialRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { toggleFollowAuthor, useSocial } from '@/lib/social';
import { fonts, GUTTER, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Side = 'takipci' | 'takip' | 'isletmeler';

/**
 * Takipçi / Takip listesi (Eren, 14 Kasım 2026). Profildeki ya da işletme sayfasındaki sayı kutusuna dokununca açılır.
 * - Kişi: Takipçi ve Takip sekmeleri; kendi listende ayrıca takip ettiğin İşletmeler ve takipçiyi "Çıkar".
 *   Gizli hesabın listesine profil yalnızca takipçilerini getirir.
 * - İşletme (?business=): yalnızca Takipçi; listeyi sahibi ve yetkilileri görür (kurallarda da öyle).
 * 30'ar kişi okunur, aşağı inince devamı gelir; arama yüklenenlerin içinde adla süzer.
 */
export default function FollowsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { rtl, language } = useSettings();
  const { user } = useSession();
  const { followingBusinesses } = useSocial();
  const params = useLocalSearchParams<{ uid?: string; side?: string; business?: string; name?: string }>();
  const bid = params.business;
  const own = !bid && !!user && params.uid === user.uid;
  const [side, setSide] = useState<Side>(params.side === 'takip' ? 'takip' : 'takipci');
  const [items, setItems] = useState<PublicProfile[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [states, setStates] = useState<Map<string, FollowStatus>>(new Map());
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  /** Bir sayfa kişi: profiller + benim onlarla takip durumum (tek sorgu). */
  const page = useCallback(
    async (cursor: string | null): Promise<{ items: PublicProfile[]; next: string | null }> => {
      if (bid) {
        const r = await businessRepository.followerPage(bid, cursor);
        const found = new Map((await socialRepository.profilesOf(r.uids)).map((p) => [p.uid, p]));
        return { items: r.uids.flatMap((u) => (found.has(u) ? [found.get(u)!] : [])), next: r.next };
      }
      return socialRepository.followPage(params.uid ?? '', side === 'takip' ? 'takip' : 'takipci', cursor);
    },
    [bid, params.uid, side],
  );

  const withStates = useCallback(
    async (list: PublicProfile[]) => {
      if (!user || !list.length) return;
      // Kendi Takip listemde herkes zaten takipte.
      if (own && side === 'takip') return setStates((m) => new Map([...m, ...list.map((p) => [p.uid, 'aktif'] as const)]));
      const got = await socialRepository.followStatesOf(user.uid, list.map((p) => p.uid)).catch(() => new Map<string, FollowStatus>());
      setStates((m) => new Map([...m, ...got]));
    },
    [user, own, side],
  );

  useEffect(() => {
    if (!user || side === 'isletmeler') return;
    let alive = true;
    setItems(null);
    setFailed(false);
    setQ('');
    page(null).then(
      (r) => {
        if (!alive) return;
        setItems(r.items);
        setNext(r.next);
        withStates(r.items);
      },
      () => alive && (setFailed(true), setItems([])),
    );
    return () => {
      alive = false;
    };
  }, [user, side, page, withStates, reload]);

  // Takip ettiğim işletmeler: kimlikler oturumda okunmuş; ilk 30'u açılır.
  useEffect(() => {
    if (side !== 'isletmeler' || !followingBusinesses || businesses !== null) return;
    Promise.all(followingBusinesses.slice(0, 30).map((id) => businessRepository.get(id).catch(() => null))).then((l) =>
      setBusinesses(l.filter((b): b is Business => !!b && b.status === 'yayinda')),
    );
  }, [side, followingBusinesses, businesses]);

  const loadMore = async () => {
    if (!next || more || q) return;
    setMore(true);
    const r = await page(next).catch(() => null);
    if (r) {
      setItems((l) => [...(l ?? []), ...r.items.filter((p) => !(l ?? []).some((x) => x.uid === p.uid))]);
      setNext(r.next);
      withStates(r.items);
    }
    setMore(false);
  };

  const follow = async (p: PublicProfile) => {
    if (!user || busy) return;
    setBusy(p.uid);
    const now = await toggleFollowAuthor(user.uid, p.uid, states.get(p.uid) === 'aktif' || states.get(p.uid) === 'istek').catch(() => states.get(p.uid) ?? null);
    setStates((m) => {
      const n = new Map(m);
      if (now) n.set(p.uid, now);
      else n.delete(p.uid);
      return n;
    });
    setBusy(null);
  };

  const removeFollower = (p: PublicProfile) =>
    Alert.alert(t('follows.removeTitle', { name: p.displayName }), t('follows.removeBody'), [
      { text: t('follows.cancel'), style: 'cancel' },
      {
        text: t('follows.remove'),
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          setBusy(p.uid);
          await socialRepository.removeFollower(user.uid, p.uid).then(() => setRemoved((s) => new Set(s).add(p.uid)), () => {});
          setBusy(null);
        },
      },
    ]);

  const shown = useMemo(() => (items ?? []).filter((p) => !removed.has(p.uid) && (!q || matchesSearch(p.displayName, q))), [items, removed, q]);
  const shownBiz = useMemo(() => (businesses ?? []).filter((b) => !q || matchesSearch(b.name, q)), [businesses, q]);

  const tabs: Side[] = bid ? [] : own ? ['takipci', 'takip', 'isletmeler'] : ['takipci', 'takip'];
  const back = () => (router.canGoBack() ? router.back() : router.replace('/explore'));
  const title = params.name || t('follows.title');

  const pill = (label: string, onPress: () => void, filled: boolean, key: string) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!!busy}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.pill,
        filled ? { backgroundColor: c.primary, borderColor: c.primary } : { borderColor: key === 'cikar' ? c.border : c.accent },
        { opacity: pressed || busy ? 0.6 : 1 },
      ]}>
      <AppText style={[styles.pillText, { color: filled ? c.onPrimary : key === 'cikar' ? c.textMuted : c.accent }]}>{label}</AppText>
    </Pressable>
  );

  const row = ({ item: p }: { item: PublicProfile }) => {
    const st = states.get(p.uid);
    const me = p.uid === user?.uid;
    return (
      <View style={[styles.row, { borderBottomColor: c.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={p.displayName}
          onPress={() => router.push({ pathname: '/u/[uid]', params: { uid: p.uid } })}
          style={({ pressed }) => [styles.who, { opacity: pressed ? 0.7 : 1 }]}>
          <View style={[styles.face, { backgroundColor: c.surfaceStrong }]}>
            <AppText style={[styles.initial, { color: c.accent }]}>{(p.displayName || '?').slice(0, 1).toLocaleUpperCase(language ?? 'tr')}</AppText>
            <AvatarPhoto photo={p.photo} size={44} />
          </View>
          <AppText numberOfLines={1} style={[styles.name, { color: c.textStrong }]}>{p.displayName}</AppText>
        </Pressable>
        {me ? null : (
          <View style={styles.actions}>
            {pill(st === 'aktif' ? t('explore.profile.following') : st === 'istek' ? t('explore.profile.requestedShort') : t('explore.profile.follow'), () => follow(p), st === 'aktif', 'takip')}
            {own && side === 'takipci' ? pill(t('follows.remove'), () => removeFollower(p), false, 'cikar') : null}
          </View>
        )}
      </View>
    );
  };

  const empty = failed ? (
    <StateMessage kind="error" onRetry={() => setReload((n) => n + 1)} />
  ) : (
    <AppText muted style={styles.empty}>
      {side === 'isletmeler' ? t('follows.noBusinesses') : side === 'takip' ? t('follows.noFollowing') : t('follows.noFollowers')}
    </AppText>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <TopBar centered title={title} left={<RoundButton icon={rtl ? 'arrow-forward' : 'arrow-back'} label={t('common.back')} onPress={back} />} />
      <View style={styles.body}>
        {tabs.length ? (
          <View style={[styles.tabs, { borderBottomColor: c.border }]} accessibilityRole="tablist">
            {tabs.map((x) => {
              const selected = side === x;
              return (
                <Pressable key={x} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setSide(x)} style={[styles.tab, selected && { borderBottomColor: c.accent }]}>
                  <AppText style={[styles.tabText, { color: selected ? c.textStrong : c.textMuted }]}>{t(`follows.tabs.${x}`)}</AppText>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.bizNote}>
            <MaterialIcons name="lock-outline" size={14} color={c.textMuted} />
            <AppText variant="caption" muted style={styles.grow}>{t('follows.businessPrivate')}</AppText>
          </View>
        )}
        <SearchField value={q} onChangeText={setQ} placeholder={t('follows.search')} square />
        {side === 'isletmeler' ? (
          businesses === null ? (
            <StateMessage kind="loading" />
          ) : (
            <FlatList
              data={shownBiz}
              keyExtractor={(b) => b.id}
              renderItem={({ item }) => <BusinessCard business={item} showProvince />}
              ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
              ListEmptyComponent={empty}
              contentContainerStyle={styles.list}
            />
          )
        ) : items === null ? (
          <StateMessage kind="loading" />
        ) : (
          <FlatList
            data={shown}
            keyExtractor={(p) => p.uid}
            renderItem={row}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={empty}
            ListFooterComponent={more ? <StateMessage kind="loading" /> : undefined}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: GUTTER, gap: spacing.sm },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontFamily: fonts.bodySemi, fontSize: 14 },
  bizNote: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: spacing.sm },
  grow: { flex: 1 },
  list: { paddingBottom: spacing.xl, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH },
  face: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { position: 'absolute', fontFamily: fonts.heading, fontSize: 18 },
  name: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14.5 },
  actions: { flexDirection: 'row', gap: 6 },
  pill: { minHeight: 32, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 12.5 },
  empty: { textAlign: 'center', marginTop: spacing.xl },
});
