import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LISTING_CATEGORY_ICONS, type Listing, type ListingCategory } from '@cityjoy/shared';

import { priceText } from '@/lib/listings';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';
import { GlossyIcon } from './glossy-icon';
import { useRelativeTime } from './post-card';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** Kategori başına renk çifti [açık, koyu]; fotoğraf gelene kadar ilanın görseli kategori simgesidir. */
export const CATEGORY_COLORS: Record<ListingCategory, readonly [string, string]> = {
  elektronik: ['#7FB2F0', '#3E6FC2'],
  'ev-mobilya': ['#E3B47A', '#B07A3C'],
  'ev-aletleri': ['#6FD3C4', '#22897C'],
  giyim: ['#EE9AB6', '#C2557A'],
  cocuk: ['#F4C86A', '#C9922A'],
  'kitap-hobi': ['#B3A3F0', '#7462C9'],
  spor: ['#74D6A7', '#2E9A6C'],
  diger: ['#AEB6C4', '#6C7689'],
};

export function ListingArt({ category, size = 64 }: { category: ListingCategory; size?: number }) {
  return <GlossyIcon icon={LISTING_CATEGORY_ICONS[category] as IconName} colors={CATEGORY_COLORS[category]} size={size} />;
}

/** Çarşı listesindeki ilan: kategori görseli, başlık, fiyat, ilçe ve zaman; sağda favori kalbi. */
export function ListingCard({ item, favorite, onFavorite, onPress }: { item: Listing; favorite?: boolean; onFavorite?(): void; onPress(): void }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { language } = useSettings();
  const ago = useRelativeTime();
  const district = repo.getDistrict(item.region.districtId)?.name;
  const price = priceText(item, t, language ?? 'tr');
  const sold = item.status === 'satildi';

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, shadowColor: c.shadow }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[item.title, price, sold ? t('carsi.sold') : null, district, ago(item.listedAt)].filter(Boolean).join(', ')}
        onPress={onPress}
        style={({ pressed }) => [styles.body, { opacity: pressed ? 0.85 : 1 }]}>
        <ListingArt category={item.category} />
        <View style={styles.texts}>
          <AppText variant="label" numberOfLines={2}>{item.title}</AppText>
          <View style={styles.line}>
            <AppText variant="label" style={{ color: item.price == null ? c.success : c.highlight }}>{price}</AppText>
            {sold ? (
              <View style={[styles.tag, { borderColor: c.border }]}>
                <AppText variant="caption" muted>{t('carsi.sold')}</AppText>
              </View>
            ) : null}
          </View>
          <AppText variant="caption" muted numberOfLines={1}>{[district, ago(item.listedAt)].filter(Boolean).join(' · ')}</AppText>
        </View>
      </Pressable>
      {onFavorite ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? t('carsi.unfavorite') : t('carsi.favorite')}
          accessibilityState={{ selected: !!favorite }}
          onPress={onFavorite}
          hitSlop={8}
          style={styles.heart}>
          <MaterialIcons name={favorite ? 'favorite' : 'favorite-border'} size={22} color={favorite ? c.danger : c.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  texts: { flex: 1, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  tag: { paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1 },
  heart: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
