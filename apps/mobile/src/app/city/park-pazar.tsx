import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CityGuideSectionId } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { CityGuideList } from '@/components/city-guide-list';
import { useProvinceCover } from '@/components/city-cover';
import { PageHead, PAGE_CONTENT, usePageBottom } from '@/components/page-head';
import { Screen } from '@/components/screen';
import { useCityGuideMeta } from '@/lib/city-guide';
import { LOOK } from '@/lib/city-look';
import { useUserLocation } from '@/lib/user-location';
import { fonts, radius } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

const MARKET = { icon: 'storefront', colors: ['#FFB25C', '#EE5A24'] } as const;

/** Park ve Pazar (tasarım: park-pazar.html): tek ekran, iki sekme; pazarlarda gün seçimi. */
export default function ParkMarketScreen() {
  const { t } = useTranslation();
  const cover = useProvinceCover();
  const router = useRouter();
  const c = useThemeColors();
  const bottom = usePageBottom();
  const { location } = useUserLocation();
  const { meta } = useCityGuideMeta(location?.provinceCode);
  const hasParks = (meta?.sections.parklar?.count ?? 0) > 0;
  const [tab, setTab] = useState<CityGuideSectionId>(hasParks || !meta ? 'parklar' : 'pazarlar');

  const tabs = (
    <View style={[styles.tabs, { backgroundColor: c.surface, borderColor: c.border }]} accessibilityRole="tablist">
      {(['parklar', 'pazarlar'] as const).map((s) => {
        const on = tab === s;
        return (
          <Pressable
            key={s}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => setTab(s)}
            style={[styles.tab, on ? { backgroundColor: c.accent } : null]}>
            <AppText style={[styles.tabText, { color: on ? c.onPrimary : c.textMuted }]}>
              {t(s === 'parklar' ? 'city.parks' : 'city.markets')} {meta?.sections[s]?.count ? `(${meta.sections[s]!.count})` : ''}
            </AppText>
          </Pressable>
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
  tabs: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, borderWidth: 1 },
  tab: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  tabText: { fontFamily: fonts.bodySemi, fontSize: 13 },
});
