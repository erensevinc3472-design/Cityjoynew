import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  buildCategoryTree,
  cityChoiceLabel,
  citySection,
  filterBySearch,
  localized,
  rankBusinesses,
  SEARCH_LIMITS,
  SEARCH_TABS,
  searchWords,
  type Business,
  type CityGuideItem,
  type Post,
  type PublicProfile,
  type SearchTab,
  type ServiceCategory,
} from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { BusinessCard } from '@/components/business-card';
import { Chips } from '@/components/chips';
import { EventCard } from '@/components/event-card';
import { HeroHeader } from '@/components/hero-header';
import { OptionRow } from '@/components/option-row';
import { PostCard } from '@/components/post-card';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { StateMessage } from '@/components/state-message';
import { useEvents } from '@/lib/events';
import { locationRepository as repo } from '@/lib/locations';
import { toggleLike, useLiked } from '@/lib/posts';
import { searchBusinesses, searchPeople, searchPosts, useCityPlaces, useRecentSearches, useSearchSuggestions } from '@/lib/search';
import { useServiceCategories } from '@/lib/service-categories';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { useSocial } from '@/lib/social';
import { useUserLocation } from '@/lib/user-location';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
/** Tümü sekmesinde her bölümden gösterilen sonuç. */
const PREVIEW = 3;
type Remote<T> = { query: string; list: T[] | null; failed: boolean };
const idle = <T,>(): Remote<T> => ({ query: '', list: null, failed: false });

/** Veritabanı araması: sorgu değişince yeniden, sekmede gerekmiyorsa hiç çalışmaz. */
function useRemote<T>(query: string, enabled: boolean, run: (q: string) => Promise<T[]>, deps: unknown[]): Remote<T> {
  const [state, setState] = useState<Remote<T>>(idle);
  useEffect(() => {
    if (!enabled || !query) return;
    let alive = true;
    setState({ query, list: null, failed: false });
    run(query).then(
      (list) => alive && setState({ query, list, failed: false }),
      () => alive && setState({ query, list: [], failed: true }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, enabled, ...deps]);
  return state.query === query ? state : { query, list: enabled && query ? null : [], failed: false };
}

/**
 * Ara (PROJE.md 5.10): kişiler, işletmeler (ve hizmet kategorileri), yerler (Benim Şehrim), etkinlikler ve Keşfet
 * gönderileri. Sonuçlar kişinin iline göre süzülür, doğrulanmış işletmeler önce gelir, engellenenler görünmez.
 * Türkçe karakter ve bir harflik yazım hatası tolere edilir. Boşken son aramalar, önerilen aramalar ve hızlı erişim.
 */
export default function SearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const params = useLocalSearchParams<{ q?: string }>();
  const { user } = useSession();
  const { location } = useUserLocation();
  const { blocked } = useSocial();
  const isLiked = useLiked(user?.uid);
  const recent = useRecentSearches();
  const remoteSuggestions = useSearchSuggestions(lang);
  const { all: categories } = useServiceCategories();

  const [input, setInput] = useState(params.q ?? '');
  const [query, setQuery] = useState(params.q?.trim() ?? '');
  const [tab, setTab] = useState<SearchTab>('tumu');
  const [likes, setLikes] = useState<Record<string, number>>({});

  // Yazarken her harfte sorgu atılmaz: kısa bir duraklamadan sonra aranır.
  useEffect(() => {
    const h = setTimeout(() => setQuery(input.trim()), 350);
    return () => clearTimeout(h);
  }, [input]);

  const province = location?.provinceCode;
  const words = searchWords(query);
  const longest = Math.max(0, ...words.map((w) => w.length));
  const active = longest >= SEARCH_LIMITS.minName;
  const wants = (x: SearchTab) => active && (tab === 'tumu' || tab === x);

  const people = useRemote<PublicProfile>(query, wants('kisiler') && !!user, searchPeople, []);
  const businesses = useRemote<Business>(query, wants('isletmeler') && !!province, (q) => searchBusinesses(q, province!), [province]);
  const postsOk = longest >= SEARCH_LIMITS.minPost;
  const posts = useRemote<Post>(
    query,
    wants('gonderiler') && !!user && postsOk,
    (q) => searchPosts(q, { provinceCode: location?.provinceCode, neighbourhoodId: location?.neighbourhoodId }),
    [location?.provinceCode, location?.neighbourhoodId],
  );
  const places = useCityPlaces(province, wants('yerler'));
  const { list: events } = useEvents(wants('etkinlikler') ? province : undefined);

  const subcategories = useMemo(() => buildCategoryTree(categories).flatMap((n) => n.children), [categories]);
  const categoryText = (x: ServiceCategory) => `${localized(x.names, lang)} ${x.names.tr}`;
  const categoryHits = active ? filterBySearch(subcategories, query, categoryText).slice(0, 8) : [];
  const placeText = (i: CityGuideItem) =>
    [i.name, i.category && cityChoiceLabel(i.category, lang), i.districtId && repo.getDistrict(i.districtId)?.name].filter(Boolean).join(' ');
  const placeHits = active && places ? filterBySearch(places, query, placeText) : null;
  const eventHits = active && events ? filterBySearch(events, query, (e) => `${e.title} ${e.venueName} ${e.description}`) : null;
  const peopleHits = people.list?.filter((p) => !blocked.has(p.uid) && p.uid !== user?.uid) ?? null;
  const businessHits = businesses.list ? (({ featured, others }) => [...featured, ...others])(rankBusinesses(businesses.list, { districtId: location?.districtId })) : null;
  const postHits = posts.list?.filter((p) => !blocked.has(p.authorUid)).map((p) => (p.id in likes ? { ...p, likeCount: likes[p.id] } : p)) ?? null;

  // Bir sonuca (ya da başka ekrana) geçilince arama son aramalara eklenir.
  const lastQuery = useRef('');
  lastQuery.current = active ? query : '';
  const { add: addRecent } = recent;
  useFocusEffect(useCallback(() => () => {
    if (lastQuery.current) addRecent(lastQuery.current);
  }, [addRecent]));
  const pick = (q: string) => {
    setInput(q);
    setQuery(q);
  };
  const like = async (p: Post) => {
    if (!user) return;
    const count = await toggleLike(p, user.uid, isLiked(p.id)).catch(() => p.likeCount);
    setLikes((m) => ({ ...m, [p.id]: count }));
  };

  const defaults = t('search.defaults', { returnObjects: true }) as unknown;
  const suggested = remoteSuggestions ?? (Array.isArray(defaults) ? (defaults as string[]) : []);

  /** Bir sonuç bölümü: Tümü'nde başlık + ilk 3 + "Tümünü gör", kendi sekmesinde hepsi. */
  const section = <T,>(key: SearchTab, list: T[] | null, render: (x: T) => ReactNode, opts: { failed?: boolean; note?: string; id?: string; quiet?: boolean; title?: string } = {}) => {
    if (tab !== 'tumu' && tab !== key) return null;
    const preview = tab === 'tumu' || opts.quiet;
    if (opts.note) return preview ? null : <StateMessage key={key} kind="empty" message={opts.note} />;
    if (list === null) return preview ? null : <StateMessage key={key} kind="loading" />;
    if (opts.failed && !list.length) return preview ? null : <StateMessage key={key} kind="error" message={t('search.loadError')} />;
    if (!list.length) return preview ? null : <StateMessage key={key} kind="empty" message={t('search.noResults', { q: query })} />;
    const shown = tab === 'tumu' ? list.slice(0, PREVIEW) : list;
    return (
      <View key={opts.id ?? key} style={styles.group}>
        {tab === 'tumu' || opts.title ? <AppText variant="label" accessibilityRole="header">{opts.title ?? t(`search.tabs.${key}`)}</AppText> : null}
        {shown.map(render)}
        {tab === 'tumu' && list.length > PREVIEW ? (
          <Pressable accessibilityRole="button" onPress={() => setTab(key)} style={styles.more}>
            <AppText variant="label" style={{ color: c.accent }}>{t('search.seeAll', { count: list.length })}</AppText>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const needLocation = province ? undefined : t('search.needLocation');
  const results = [
    // Hizmet kategorileri ("berber" > Berberler listesi): yalnızca eşleşme varsa görünür.
    section<ServiceCategory>('isletmeler', categoryHits, (x) => (
      <OptionRow key={`k-${x.id}`} title={localized(x.names, lang) ?? x.names.tr} subtitle={t('search.serviceCategory')} showChevron onPress={() => router.push({ pathname: '/services/[id]', params: { id: x.id } })} />
    ), { id: 'kategoriler', quiet: true, title: t('search.services') }),
    section('isletmeler', businessHits, (b) => <BusinessCard key={b.id} business={b} />, { failed: businesses.failed, note: needLocation }),
    section('kisiler', peopleHits, (p) => (
      <OptionRow
        key={p.uid}
        title={p.displayName}
        // Gizli hesapta yalnızca ad görünür (PROJE.md 5.10).
        subtitle={p.isPrivate ? t('search.privateAccount') : p.bio || undefined}
        showChevron
        onPress={() => router.push({ pathname: '/u/[uid]', params: { uid: p.uid } })}
      />
    ), { failed: people.failed }),
    section('yerler', placeHits, (i) => (
      <OptionRow
        key={i.id}
        title={i.name}
        subtitle={[citySection(i.section)?.names[lang], i.districtId && repo.getDistrict(i.districtId)?.name].filter(Boolean).join(' · ')}
        showChevron
        onPress={() => router.push({ pathname: '/city/item', params: { section: i.section, id: i.id } })}
      />
    ), { note: needLocation }),
    section('etkinlikler', eventHits, (e) => (
      <EventCard key={e.id} item={e} onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })} />
    ), { note: needLocation }),
    section('gonderiler', postHits, (p) => (
      <PostCard
        key={p.id}
        item={p}
        liked={isLiked(p.id)}
        onPress={() => router.push({ pathname: '/explore/[id]', params: { id: p.id } })}
        onLike={() => like(p)}
        onAuthor={() => router.push({ pathname: '/u/[uid]', params: { uid: p.authorUid } })}
      />
    ), { failed: posts.failed, note: postsOk ? undefined : t('search.postsTooShort') }),
  ];

  // Tümü sekmesinde her şey bittiyse ve hiç sonuç yoksa tek bir "sonuç yok" yazısı.
  const allLists = [categoryHits, businessHits, peopleHits, placeHits, eventHits, postsOk ? postHits : []];
  const allDone = allLists.every((l) => l !== null);
  const nothing = tab === 'tumu' && allDone && allLists.every((l) => !l || l.length === 0);
  const loadingAll = tab === 'tumu' && !allDone && allLists.every((l) => !l || l.length === 0);

  const quick: { icon: IconName; label: string; href: Parameters<typeof router.push>[0] }[] = [
    { icon: 'handyman', label: t('search.quickServices'), href: '/services' },
    { icon: 'emergency', label: t('search.quickUrgent'), href: '/urgent' },
    { icon: 'event', label: t('search.quickEvents'), href: '/events' },
    { icon: 'location-city', label: t('search.quickCity'), href: '/city' },
  ];
  const urgentCategories = subcategories.filter((x) => x.urgent).slice(0, 6);

  const header = <HeroHeader title={t('search.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />;

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <SearchField value={input} onChangeText={setInput} placeholder={t('search.placeholder')} autoFocus={!params.q} onSubmitEditing={() => input.trim() && recent.add(input.trim())} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Chips<SearchTab> label={t('search.title')} value={tab} onChange={setTab} options={SEARCH_TABS.map((x) => ({ value: x, label: t(`search.tabs.${x}`) }))} />
        </ScrollView>

        {!query ? (
          <>
            {recent.list.length ? (
              <View style={styles.group}>
                <View style={styles.row}>
                  <AppText variant="label" accessibilityRole="header" style={styles.grow}>{t('search.recent')}</AppText>
                  <Pressable accessibilityRole="button" onPress={recent.clear} style={styles.more}>
                    <AppText variant="caption" style={{ color: c.accent }}>{t('search.clearRecent')}</AppText>
                  </Pressable>
                </View>
                {recent.list.map((q) => (
                  <View key={q} style={[styles.recent, { borderColor: c.border, backgroundColor: c.surface }]}>
                    <Pressable accessibilityRole="button" accessibilityLabel={q} onPress={() => pick(q)} style={[styles.row, styles.grow]}>
                      <MaterialIcons name="history" size={20} color={c.textMuted} />
                      <AppText style={styles.grow}>{q}</AppText>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('search.removeRecent', { q })} onPress={() => recent.remove(q)} style={styles.icon} hitSlop={8}>
                      <MaterialIcons name="close" size={20} color={c.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {suggested.length ? (
              <View style={styles.group}>
                <AppText variant="label" accessibilityRole="header">{t('search.suggested')}</AppText>
                <View style={styles.wrap}>
                  {suggested.map((q) => (
                    <Pressable key={q} accessibilityRole="button" onPress={() => pick(q)} style={({ pressed }) => [styles.pill, { borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 }]}>
                      <AppText variant="label">{q}</AppText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.group}>
              <AppText variant="label" accessibilityRole="header">{t('search.quick')}</AppText>
              <View style={styles.wrap}>
                {quick.map((q) => (
                  <Pressable key={q.label} accessibilityRole="button" onPress={() => router.push(q.href)} style={({ pressed }) => [styles.pill, styles.row, { borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 }]}>
                    <MaterialIcons name={q.icon} size={18} color={c.icon} />
                    <AppText variant="label">{q.label}</AppText>
                  </Pressable>
                ))}
                {urgentCategories.map((x) => (
                  <Pressable key={x.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/services/[id]', params: { id: x.id } })} style={({ pressed }) => [styles.pill, { borderColor: c.danger, backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 }]}>
                    <AppText variant="label">{localized(x.names, lang)}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        ) : !active ? (
          <StateMessage kind="empty" message={t('search.tooShort')} />
        ) : nothing ? (
          <StateMessage kind="empty" message={t('search.noResults', { q: query })} />
        ) : (
          <>
            {results}
            {loadingAll ? <StateMessage kind="loading" /> : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  recent: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH, paddingStart: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  icon: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  more: { minHeight: MIN_TOUCH, justifyContent: 'center' },
});
