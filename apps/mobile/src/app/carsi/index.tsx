import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  filterBySearch,
  LISTING_CATEGORIES,
  LISTING_KINDS,
  SEARCH_LIMITS,
  searchKeyCandidates,
  type Listing,
  type ListingCategory,
  type ListingKind,
} from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Chips } from '@/components/chips';
import { HeroHeader } from '@/components/hero-header';
import { ListingArt, ListingCard } from '@/components/listing-card';
import { OptionRow } from '@/components/option-row';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { StateMessage } from '@/components/state-message';
import { useFavorites } from '@/lib/listings';
import { locationRepository as repo } from '@/lib/locations';
import { listingRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useUserLocation } from '@/lib/user-location';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type KindFilter = ListingKind | 'hepsi';

/**
 * Çarşı (PROJE.md 5.11): kayıtlı ildeki ikinci el eşya ilanları; istenirse yalnızca ilçesi. Tür ve kategori süzgeci, arama.
 * Üstte il adı yazar; konum buradan değiştirilmez (ilan verirken telefonun konumu kayıtlı ille karşılaştırılır).
 * Sağ üstte "İlanlarım" ve "İlan ver". İlanlar uygulama içinden yazışılarak alınır; telefon numarası yoktur.
 */
export default function CarsiScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { user } = useSession();
  const { location } = useUserLocation();
  const fav = useFavorites(user?.uid);
  const [kind, setKind] = useState<KindFilter>('hepsi');
  const [category, setCategory] = useState<ListingCategory | null>(null);
  const [onlyDistrict, setOnlyDistrict] = useState(false);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [list, setList] = useState<Listing[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);
  const run = useRef(0);

  const district = location?.districtId ? repo.getDistrict(location.districtId) : undefined;
  const province = location ? repo.getProvince(location.provinceCode)?.name : undefined;

  const load = useCallback(async () => {
    if (!location) return;
    const n = ++run.current;
    setFailed(false);
    setList(null);
    try {
      const base = { provinceCode: location.provinceCode, districtId: onlyDistrict ? district?.id : undefined };
      if (searched) {
        // Aramada tür ve kategori ekranda süzülür (arama dizini il, ilçe ve tarihe göre).
        let found: Listing[] = [];
        for (const key of searchKeyCandidates(searched, SEARCH_LIMITS.minPost)) {
          const page = await listingRepository.list({ ...base, key });
          found = filterBySearch(page.listings, searched, (l) => `${l.title} ${l.description}`);
          if (found.length) break;
        }
        if (n !== run.current) return;
        setList(found.filter((l) => (kind === 'hepsi' || l.kind === kind) && (!category || l.category === category)));
        setCursor(null);
      } else {
        const page = await listingRepository.list({ ...base, kind: kind === 'hepsi' ? undefined : kind, category: category ?? undefined });
        if (n !== run.current) return;
        setList(page.listings);
        setCursor(page.cursor);
      }
    } catch {
      if (n === run.current) {
        setFailed(true);
        setList([]);
      }
    }
  }, [location, onlyDistrict, district, kind, category, searched]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (!location || !cursor || more) return;
    setMore(true);
    try {
      const page = await listingRepository.list(
        { provinceCode: location.provinceCode, districtId: onlyDistrict ? district?.id : undefined, kind: kind === 'hepsi' ? undefined : kind, category: category ?? undefined },
        cursor,
      );
      setList((cur) => [...(cur ?? []), ...page.listings]);
      setCursor(page.cursor);
    } catch {
      setFailed(true);
    } finally {
      setMore(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/city'));
  const header = (
    <HeroHeader
      title={t('carsi.title')}
      subtitle={province}
      onBack={back}
      right={
        user
          ? [
              { icon: 'inventory-2', label: t('carsi.mine'), onPress: () => router.push('/carsi/mine') },
              { icon: 'add', label: t('carsi.new'), onPress: () => router.push('/carsi/new') },
            ]
          : undefined
      }
    />
  );

  if (!location) {
    return (
      <Screen header={header}>
        <View style={styles.content}>
          <StateMessage kind="empty" message={t('carsi.needLocation')} />
          <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />} keyboardShouldPersistTaps="handled">
        <AppText variant="caption" muted>{t('carsi.slogan')}</AppText>
        <SearchField value={query} onChangeText={(v) => (setQuery(v), v.trim() ? null : setSearched(''))} placeholder={t('carsi.searchPlaceholder')} onSubmitEditing={() => setSearched(query.trim())} />
        <Chips<KindFilter>
          label={t('carsi.kind')}
          value={kind}
          onChange={setKind}
          options={[{ value: 'hepsi', label: t('carsi.all') }, ...LISTING_KINDS.map((k) => ({ value: k as KindFilter, label: t(`carsi.kinds.${k}`) }))]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats}>
          {LISTING_CATEGORIES.map((x) => {
            const on = category === x;
            return (
              <Pressable
                key={x}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t(`carsi.categories.${x}`)}
                onPress={() => setCategory(on ? null : x)}
                style={[styles.cat, { borderColor: on ? c.accent : 'transparent', backgroundColor: on ? c.surface : 'transparent' }]}>
                <ListingArt category={x} size={44} />
                <AppText variant="caption" numberOfLines={2} style={styles.catLabel}>{t(`carsi.categories.${x}`)}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>
        {district ? (
          <View style={styles.filters}>
            <OptionRow title={t('carsi.wholeProvince', { place: province ?? '' })} selected={!onlyDistrict} onPress={() => setOnlyDistrict(false)} />
            <OptionRow title={t('carsi.onlyDistrict', { place: district.name })} selected={onlyDistrict} onPress={() => setOnlyDistrict(true)} />
          </View>
        ) : null}
        {failed && !list?.length ? (
          <StateMessage kind="error" message={t('carsi.loadError')} onRetry={load} />
        ) : list === null ? (
          <StateMessage kind="loading" />
        ) : list.length === 0 ? (
          <>
            <StateMessage kind="empty" message={searched ? t('carsi.noResults') : t('carsi.empty')} />
            {user ? <AppButton variant="secondary" title={t('carsi.new')} onPress={() => router.push('/carsi/new')} /> : null}
          </>
        ) : (
          list.map((l) => (
            <ListingCard
              key={l.id}
              item={l}
              favorite={fav.isFavorite(l.id)}
              onFavorite={user && l.ownerUid !== user.uid ? () => fav.toggle(l.id).catch(() => {}) : undefined}
              onPress={() => router.push({ pathname: '/carsi/[id]', params: { id: l.id } })}
            />
          ))
        )}
        {cursor && list?.length ? <AppButton variant="ghost" title={t('carsi.more')} loading={more} disabled={more} onPress={loadMore} /> : null}
        <View style={[styles.safety, { borderColor: c.border }]}>
          <MaterialIcons name="shield" size={18} color={c.textMuted} />
          <AppText variant="caption" muted style={styles.grow}>{t('carsi.safety.short')}</AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  filters: { gap: spacing.xs },
  cats: { gap: spacing.xs, paddingVertical: spacing.xs },
  cat: { width: 76, alignItems: 'center', gap: 4, paddingVertical: spacing.xs, borderRadius: radius.md, borderWidth: 1 },
  catLabel: { textAlign: 'center' },
  safety: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  grow: { flex: 1 },
});
