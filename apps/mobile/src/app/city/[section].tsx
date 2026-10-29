import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { citySection, type CityGuideSectionId } from '@cityjoy/shared';

import { CityGuideList } from '@/components/city-guide-list';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { INSTITUTION_GROUPS, LOOK, type Look } from '@/lib/city-look';
import { useSettings } from '@/lib/settings';

const SECTION_LOOK: Partial<Record<CityGuideSectionId, Look>> = {
  'belediye-hizmetleri': LOOK.belediye,
  'onemli-kurumlar': LOOK.kurumlar,
  muzeler: LOOK.muzeler,
  ulasim: LOOK.ulasim,
  otoparklar: LOOK.otopark,
  parklar: LOOK.parkPazar,
  pazarlar: { icon: 'storefront', colors: ['#FFB25C', '#EE5A24'] },
  'nasil-yapilir': LOOK.rehber,
  muhtarliklar: { icon: 'location-city', colors: ['#F6D38B', '#C98A2C'] },
  'toplanma-alanlari': LOOK.toplanma,
};

/** Bir Benim Şehrim bölümünün listesi; ?group= ile Önemli Kurumlar'ın bir alt başlığı (hastaneler, noterler…). */
export default function CitySectionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { section, group } = useLocalSearchParams<{ section: CityGuideSectionId; group?: string }>();
  const def = citySection(section);
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const g = group ? INSTITUTION_GROUPS.find((x) => x.id === group) : undefined;
  const title = g ? t(`city.groups.${g.id}.title`) : def ? (def.names[lang] ?? def.names.tr) : '';
  const back = () => (router.canGoBack() ? router.back() : router.replace(g ? '/city/kurumlar' : '/city'));

  return (
    <Screen header={<HeroHeader title={title} onBack={back} />}>
      <CityGuideList section={section} look={g?.look ?? SECTION_LOOK[section] ?? LOOK.kurumlar} categories={g?.categories} />
    </Screen>
  );
}
