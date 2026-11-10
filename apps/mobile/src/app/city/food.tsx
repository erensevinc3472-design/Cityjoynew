import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { averageRating, FOOD_KINDS, openState, rankBusinesses, type Business } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { BusinessCard } from '@/components/business-card';
import { useProvinceCover } from '@/components/city-cover';
import { HeroHeader } from '@/components/hero-header';
import { FilterChip, FilterRow } from '@/components/inner';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { locationRepository } from '@/lib/locations';
import { businessRepository } from '@/lib/services';
import { useUserLocation } from '@/lib/user-location';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Benim Şehrim > Cafe ve Restoran (tasarım: cafe-restaurant.html, 13. madde 35): İşletmem'de "yeme-içme" türüyle kayıtlı,
 * kullanıcının ilinin tamamındaki işletmeler (Eren: uzak ilçedeki işletme de merkezden müşteri çekebilmeli). Tek filtre
 * satırı: "Tüm ilçeler" açılır düğmesi, "Şu an açık", türler; sıralama En yakın (hizmet listeleriyle aynı kural: Reklam en
 * çok 2, sonra doğrulanmış, puan, ilçe, güncellik; PROJE.md 5.6) ya da En beğenilen (gerçek oy ortalaması). Fiyat seviyesi
 * ve "EFSANE" yok; oyu olmayan işletmede "Yeni" yazar. Uydurma örnek mekân yok.
 */
export default function CityFoodScreen() {
  const { t } = useTranslation();
  const cover = useProvinceCover();
  const router = useRouter();
  const c = useThemeColors();
  const { location } = useUserLocation();
  const provinceCode = location?.provinceCode;
  const districtId = location?.districtId;
  const province = provinceCode ? locationRepository.getProvince(provinceCode)?.name : undefined;
  const [all, setAll] = useState<Business[] | null>(null);
  const [error, setError] = useState(false);
  const [kind, setKind] = useState<string | null>(null);
  const [openNow, setOpenNow] = useState(false);
  const [district, setDistrict] = useState<string | null>(null);
  const [sort, setSort] = useState<'near' | 'liked'>('near');

  const load = useCallback(() => {
    if (!provinceCode) return;
    setError(false);
    setAll(null);
    businessRepository
      .listByType(provinceCode, 'yeme-icme')
      .then(setAll)
      .catch(() => setError(true));
  }, [provinceCode]);
  useEffect(load, [load]);

  const used = FOOD_KINDS.filter((k) => (all ?? []).some((b) => b.categoryIds.includes(k.id)));
  const ranked = useMemo(() => {
    const now = new Date();
    const list = (all ?? []).filter(
      (b) => (!kind || b.categoryIds.includes(kind)) && (!openNow || openState(b, now)?.open) && (!district || b.location.districtId === district),
    );
    const r = rankBusinesses(list, { districtId });
    if (sort === 'liked') {
      const score = (b: Business) => (b.rating.count ? averageRating(b.rating) : -1);
      return { featured: r.featured, others: [...r.others].sort((a, b) => score(b) - score(a) || b.rating.count - a.rating.count) };
    }
    return r;
  }, [all, kind, openNow, district, districtId, sort]);
  const districts = useMemo(() => {
    const ids = [...new Set((all ?? []).map((b) => b.location.districtId))];
    return ids.map((id) => ({ id, name: locationRepository.getDistrict(id)?.name ?? id })).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [all]);
  const total = ranked.featured.length + ranked.others.length;

  const header = <HeroHeader serif title={t('city.tiles.cafe')} subtitle={province} onBack={() => (router.canGoBack() ? router.back() : router.replace('/city'))} />;

  return (
    <Screen warm cover={cover} header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!provinceCode ? (
          <>
            <StateMessage kind="empty" message={t('city.needLocation')} />
            <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} />
          </>
        ) : error ? (
          <StateMessage kind="error" message={t('business.listError')} onRetry={load} />
        ) : all === null ? (
          <StateMessage kind="loading" />
        ) : (
          <>
            {all.length ? (
              <>
                <FilterRow
                  districts={districts}
                  district={district}
                  onDistrict={setDistrict}
                  kinds={used.map((k) => ({ id: k.id, name: t(`food.kinds.${k.id}`) }))}
                  kind={kind}
                  onKind={setKind}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  <FilterChip icon="schedule" label={t('food.openNow')} active={openNow} onPress={() => setOpenNow((v) => !v)} />
                  <FilterChip icon="near-me" label={t('food.sortNear')} active={sort === 'near'} onPress={() => setSort('near')} />
                  <FilterChip icon="favorite-border" label={t('food.sortLiked')} active={sort === 'liked'} onPress={() => setSort('liked')} />
                </ScrollView>
              </>
            ) : null}
            {all.length ? <AppText variant="caption" muted>{t('food.count', { count: total })}</AppText> : null}
            {total === 0 ? (
              <StateMessage kind="empty" message={all.length ? t('food.noMatch') : t('food.empty', { province: province ?? '' })} />
            ) : (
              <>
                {ranked.featured.map((b) => <BusinessCard key={b.id} business={b} featured />)}
                {ranked.others.map((b) => <BusinessCard key={b.id} business={b} />)}
              </>
            )}
            <View style={[styles.invite, { borderColor: c.accentBorder, backgroundColor: c.accentSoft }]}>
              <MaterialIcons name="storefront" size={22} color={c.icon} />
              <View style={styles.flex}>
                <AppText variant="label">{t('food.inviteTitle')}</AppText>
                <AppText variant="caption" muted>{t('food.inviteBody')}</AppText>
              </View>
            </View>
            <AppButton variant="secondary" title={t('food.inviteCta')} onPress={() => router.push('/business')} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1, gap: 2 },
  chips: { gap: spacing.xs },
  invite: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, minHeight: MIN_TOUCH },
});
