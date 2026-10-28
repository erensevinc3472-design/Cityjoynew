import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { EventCard } from '@/components/event-card';
import { BottomNav } from '@/components/bottom-nav';
import { RoundButton } from '@/components/hero-header';
import { OptionRow } from '@/components/option-row';
import { PostCard } from '@/components/post-card';
import { StateMessage } from '@/components/state-message';
import { useEvents } from '@/lib/events';
import { locationRepository as repo } from '@/lib/locations';
import { authorHref, toggleLike, useLiked } from '@/lib/posts';
import { searchBusinesses, searchPeople, searchPosts, useCityPlaces, useRecentSearches, useSearchSuggestions } from '@/lib/search';
import { useServiceCategories } from '@/lib/service-categories';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { useSocial } from '@/lib/social';
import { useUserLocation } from '@/lib/user-location';
import { fonts, GUTTER, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
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
  const { language, rtl } = useSettings();
  const lang = language ?? 'tr';
  const params = useLocalSearchParams<{ q?: string; tab?: string }>();
  const { user } = useSession();
  const { location } = useUserLocation();
  const { blocked } = useSocial();
  const isLiked = useLiked(user?.uid);
  const recent = useRecentSearches();
  const remoteSuggestions = useSearchSuggestions(lang);
  const { all: categories } = useServiceCategories();

  const [input, setInput] = useState(params.q ?? '');
  const [query, setQuery] = useState(params.q?.trim() ?? '');
  const tabParam = (SEARCH_TABS as readonly string[]).includes(params.tab ?? '') ? (params.tab as SearchTab) : undefined;
  const [tab, setTab] = useState<SearchTab>(tabParam ?? 'tumu');
  // Profil > Kişi bul: ekran açıkken de sekme Kişiler'e geçsin.
  useEffect(() => {
    if (tabParam) setTab(tabParam);
  }, [tabParam]);
  const insets = useSafeAreaInsets();
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
  // Boşken "Yaklaşan etkinlikler" de buradan; oturumda önbellekte.
  const { list: events } = useEvents(province);

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
        onAuthor={() => router.push(authorHref(p))}
      />
    ), { failed: posts.failed, note: postsOk ? undefined : t('search.postsTooShort') }),
  ];

  // Tümü sekmesinde her şey bittiyse ve hiç sonuç yoksa tek bir "sonuç yok" yazısı.
  const allLists = [categoryHits, businessHits, peopleHits, placeHits, eventHits, postsOk ? postHits : []];
  const allDone = allLists.every((l) => l !== null);
  const nothing = tab === 'tumu' && allDone && allLists.every((l) => !l || l.length === 0);
  const loadingAll = tab === 'tumu' && !allDone && allLists.every((l) => !l || l.length === 0);

  const quick: { icon: IconName; label: string; color: string; href: Parameters<typeof router.push>[0] }[] = [
    { icon: 'emergency', label: t('search.quickUrgent'), color: c.danger, href: '/urgent' },
    { icon: 'handyman', label: t('search.quickServices'), color: c.accent, href: '/services' },
    { icon: 'event', label: t('search.quickEvents'), color: '#C2577A', href: '/events' },
    { icon: 'location-city', label: t('search.quickCity'), color: '#2D8A8A', href: '/city' },
  ];
  // Bölgendeki ustalar: önce acil kategoriler, en çok altı.
  const masters = [...subcategories.filter((x) => x.urgent), ...subcategories.filter((x) => !x.urgent)].slice(0, 6);
  const upcoming = (events ?? []).filter((e) => e.status === 'yayinda').slice(0, 2);
  const typing = input.trim().length > 0;
  const submit = () => {
    const q = input.trim();
    if (!q) return;
    setQuery(q);
    recent.add(q);
  };
  const sectionHead = (title: string, action?: { label: string; onPress(): void }) => (
    <View style={styles.row}>
      <AppText accessibilityRole="header" style={[styles.kicker, styles.grow, { color: c.textMuted }]}>{title.toLocaleUpperCase(lang)}</AppText>
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} style={styles.more} hitSlop={6}>
          <AppText style={[styles.link, { color: c.accent }]}>{action.label}</AppText>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      {/* Üst bölüm (tasarım: ara.html): yazarken başlık küçülür, arama kutusu ve sekmeler kalır. */}
      <View style={[styles.hero, { backgroundColor: c.hero, paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.heroInner}>
          <View style={styles.row}>
            <RoundButton icon="arrow-back" label={t('common.back')} onPress={() => router.dismissTo('/home')} />
            {typing ? <AppText accessibilityRole="header" style={[styles.barTitle, { color: c.heroText }]}>{t('search.title')}</AppText> : null}
          </View>
          {!typing ? (
            <View style={styles.titleBox}>
              <AppText accessibilityRole="header" style={[styles.heroTitle, { color: c.heroText }]}>
                {t('search.heroLine1')}{' '}
                <AppText style={[styles.heroTitle, { color: c.heroAccent }]}>{t('search.heroLine2')}</AppText>
              </AppText>
              <AppText style={[styles.heroSub, { color: c.heroMuted }]}>{t('search.heroSub')}</AppText>
            </View>
          ) : null}
          <View style={styles.searchRow}>
            <View style={[styles.box, { borderColor: typing ? c.heroAccent : 'rgba(224, 176, 122, 0.35)' }]}>
              <MaterialIcons name="search" size={20} color={c.heroAccent} />
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={t('search.placeholder')}
                placeholderTextColor="rgba(199, 216, 218, 0.6)"
                accessibilityLabel={t('search.placeholder')}
                autoCorrect={false}
                autoCapitalize="none"
                autoFocus={tabParam === 'kisiler'}
                returnKeyType="search"
                onSubmitEditing={submit}
                style={[styles.input, { textAlign: rtl ? 'right' : 'left' }]}
              />
              {typing ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t('search.clear')} onPress={() => setInput('')} hitSlop={8}>
                  <MaterialIcons name="close" size={20} color={c.heroMuted} />
                </Pressable>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('search.title')} onPress={submit} style={({ pressed }) => [styles.go, { backgroundColor: c.heroAccent, opacity: pressed ? 0.8 : 1 }]}>
              <MaterialIcons name="search" size={24} color="#1A1408" />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.tabsScroll} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
            {SEARCH_TABS.map((x) => {
              const selected = x === tab;
              return (
                <Pressable
                  key={x}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setTab(x)}
                  style={[styles.tab, selected ? { backgroundColor: c.heroAccent, borderColor: c.heroAccent } : { borderColor: 'rgba(255, 255, 255, 0.18)' }]}>
                  <AppText style={[styles.tabText, { color: selected ? '#1A1408' : c.heroText }]}>{t(`search.tabs.${x}`)}</AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!query ? (
          <>
            {recent.list.length ? (
              <View style={styles.group}>
                {sectionHead(t('search.recent'), { label: t('search.clearRecent'), onPress: recent.clear })}
                {recent.list.map((q) => (
                  <View key={q} style={[styles.recent, { backgroundColor: c.surface }]}>
                    <Pressable accessibilityRole="button" accessibilityLabel={q} onPress={() => pick(q)} style={[styles.row, styles.grow]}>
                      <MaterialIcons name="history" size={20} color={c.textMuted} />
                      <AppText style={styles.grow} numberOfLines={1}>{q}</AppText>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('search.removeRecent', { q })} onPress={() => recent.remove(q)} style={styles.icon} hitSlop={8}>
                      <MaterialIcons name="close" size={18} color={c.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {suggested.length ? (
              <View style={styles.group}>
                {sectionHead(t('search.suggested'))}
                <View style={styles.wrap}>
                  {suggested.map((q) => (
                    <Pressable key={q} accessibilityRole="button" accessibilityLabel={q} onPress={() => pick(q)} style={({ pressed }) => [styles.tag, { borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 }]}>
                      <AppText style={[styles.tagText, { color: c.text }]}>#{q.replace(/\s+/g, '')}</AppText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {masters.length ? (
              <View style={styles.group}>
                {sectionHead(t('search.masters'), { label: t('search.seeAllShort'), onPress: () => router.push('/services') })}
                <View style={styles.grid}>
                  {masters.map((x) => (
                    <Pressable
                      key={x.id}
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: '/services/[id]', params: { id: x.id } })}
                      style={({ pressed }) => [styles.master, { backgroundColor: c.surface, borderColor: x.urgent ? c.danger : c.border, opacity: pressed ? 0.85 : 1 }]}>
                      <View style={[styles.masterIcon, { backgroundColor: c.accentSoft }]}>
                        <MaterialIcons name={(x.icon || 'handyman') as IconName} size={20} color={c.accent} />
                      </View>
                      <AppText numberOfLines={2} style={[styles.masterText, { color: c.textStrong }]}>{localized(x.names, lang) ?? x.names.tr}</AppText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {upcoming.length ? (
              <View style={styles.group}>
                {sectionHead(t('search.upcoming'), { label: t('search.seeAllShort'), onPress: () => router.push('/events') })}
                {upcoming.map((e) => (
                  <EventCard key={e.id} item={e} onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })} />
                ))}
              </View>
            ) : null}

            <View style={styles.group}>
              {sectionHead(t('search.quick'))}
              <View style={styles.quick}>
                {quick.map((q) => (
                  <Pressable key={q.label} accessibilityRole="button" onPress={() => router.push(q.href)} style={({ pressed }) => [styles.quickTile, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}>
                    <View style={[styles.quickIcon, { backgroundColor: q.color }]}>
                      <MaterialIcons name={q.icon} size={20} color="#FFFFFF" />
                    </View>
                    <AppText numberOfLines={2} style={[styles.quickText, { color: c.textStrong }]}>{q.label}</AppText>
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
      <BottomNav active="search" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  hero: { borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, paddingBottom: spacing.md },
  heroInner: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: GUTTER, gap: spacing.md },
  barTitle: { fontFamily: fonts.heading, fontSize: 18 },
  titleBox: { gap: 6, paddingTop: spacing.xs },
  heroTitle: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  heroSub: { fontSize: 13, lineHeight: 19 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  box: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 50, paddingHorizontal: 14, borderRadius: radius.lg, borderWidth: 1.5, backgroundColor: 'rgba(23, 70, 75, 0.6)' },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15, paddingVertical: 10, color: '#FFFFFF' },
  go: { width: 50, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  tabsScroll: { marginHorizontal: -GUTTER, flexGrow: 0 },
  tabs: { paddingHorizontal: GUTTER, gap: spacing.sm },
  tab: { minHeight: 34, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  tabText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: GUTTER, gap: spacing.lg, paddingBottom: spacing.xl },
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 1.2 },
  link: { fontFamily: fonts.bodySemi, fontSize: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1 },
  tagText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  master: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, padding: 10, borderRadius: radius.md, borderWidth: 1 },
  masterIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  masterText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 17 },
  quick: { flexDirection: 'row', gap: spacing.sm },
  quickTile: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: spacing.md, paddingHorizontal: 4, borderRadius: radius.md, borderWidth: 1 },
  quickIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  quickText: { fontFamily: fonts.bodySemi, fontSize: 11, lineHeight: 14, textAlign: 'center' },
  recent: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH, paddingStart: spacing.md, borderRadius: radius.md },
  icon: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  more: { minHeight: 32, justifyContent: 'center' },
});
