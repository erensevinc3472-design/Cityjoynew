import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FOOD_KINDS, openState, rankBusinesses, type Business } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { BusinessCard } from '@/components/business-card';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { locationRepository } from '@/lib/locations';
import { businessRepository } from '@/lib/services';
import { useUserLocation } from '@/lib/user-location';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Benim Şehrim > Cafe ve Restoran (tasarım: cafe-restaurant.html): İşletmem'de "yeme-içme" türüyle kayıtlı, kullanıcının
 * ilindeki işletmeler. Türe göre filtre (kafe, restoran, kebap…) ve "Şu an açık"; sıralama hizmet listeleriyle aynı
 * kural (Reklam en çok 2, sonra doğrulanmış, puan, ilçe, güncellik; PROJE.md 5.6). Uydurma örnek mekân yok.
 */
export default function CityFoodScreen() {
  const { t } = useTranslation();
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
    const list = (all ?? []).filter((b) => (!kind || b.categoryIds.includes(kind)) && (!openNow || openState(b, now)?.open));
    return rankBusinesses(list, { districtId });
  }, [all, kind, openNow, districtId]);
  const total = ranked.featured.length + ranked.others.length;

  const chip = (key: string, label: string, selected: boolean, onPress: () => void, icon?: string) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? { backgroundColor: c.primary, borderColor: c.primary } : { backgroundColor: c.surface, borderColor: c.border }]}>
      {icon ? <MaterialIcons name={(icon in MaterialIcons.glyphMap ? icon : 'restaurant') as never} size={16} color={selected ? c.onPrimary : c.icon} /> : null}
      <AppText variant="caption" style={{ color: selected ? c.onPrimary : c.text }}>{label}</AppText>
    </Pressable>
  );

  const header = <HeroHeader title={t('city.tiles.cafe')} subtitle={province} onBack={() => (router.canGoBack() ? router.back() : router.replace('/city'))} />;

  return (
    <Screen header={header}>
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {chip('open', t('food.openNow'), openNow, () => setOpenNow((v) => !v), 'schedule')}
                {chip('all', t('food.all'), !kind, () => setKind(null))}
                {used.map((k) => chip(k.id, t(`food.kinds.${k.id}`), kind === k.id, () => setKind(kind === k.id ? null : k.id), k.icon))}
              </ScrollView>
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
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  invite: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, minHeight: MIN_TOUCH },
});
