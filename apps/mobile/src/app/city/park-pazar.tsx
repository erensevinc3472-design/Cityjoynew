import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CityGuideSectionId } from '@cityjoy/shared';

import { PhotoCard } from '@/components/city-tiles';
import { CityGuideList } from '@/components/city-guide-list';
import { useProvinceCover } from '@/components/city-cover';
import { PageHead, PAGE_CONTENT, usePageBottom } from '@/components/page-head';
import { Screen } from '@/components/screen';
import { useCityGuideMeta } from '@/lib/city-guide';
import { LOOK } from '@/lib/city-look';
import { useUserLocation } from '@/lib/user-location';
import { spacing } from '@/theme/tokens';

const MARKET = { icon: 'storefront', colors: ['#FFB25C', '#EE5A24'] } as const;

/** Park ve Pazar (tasarım: park-pazar.html): tek ekran, iki sekme; pazarlarda gün seçimi. */
export default function ParkMarketScreen() {
  const { t } = useTranslation();
  const cover = useProvinceCover();
  const router = useRouter();
  const bottom = usePageBottom();
  const { location } = useUserLocation();
  const { meta } = useCityGuideMeta(location?.provinceCode);
  const hasParks = (meta?.sections.parklar?.count ?? 0) > 0;
  const [tab, setTab] = useState<CityGuideSectionId>(hasParks || !meta ? 'parklar' : 'pazarlar');

  // Benim Şehrim kartları gibi iki büyük kart; seçili olan altın (Eren, 10 Kasım 2026).
  const tabs = (
    <View style={styles.tabs} accessibilityRole='tablist'>
      {(['parklar', 'pazarlar'] as const).map((s) => {
        const count = meta?.sections[s]?.count ?? 0;
        return (
          <PhotoCard
            key={s}
            scene={s === 'parklar' ? 'neighbourhood' : 'market'}
            gold={tab === s}
            height={92}
            icon={s === 'parklar' ? 'park' : 'storefront'}
            title={t(s === 'parklar' ? 'city.parks' : 'city.markets')}
            sub={count ? t(`city.hub.units.${s}`, { count }) : t('city.soon')}
            onPress={() => setTab(s)}
          />
        );
      })}
    </View>
  );

  return (
    <Screen bleed cover={cover}>
      <CityGuideList
        key={tab}
        section={tab}
        look={tab === 'parklar' ? LOOK.parkPazar : MARKET}
        contentStyle={[PAGE_CONTENT, { paddingBottom: bottom }]}
        header={
          <PageHead cover={cover} title={t('city.tiles.parkPazar')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/city'))}>
            {tabs}
          </PageHead>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.sm },
});
