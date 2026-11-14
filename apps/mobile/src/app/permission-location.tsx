import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { AuthScene, onboardingStyles as styles, StepDots, WhyRow } from '@/components/auth-scene';
import { locationRepository as repo } from '@/lib/locations';

const norm = (s?: string | null) => (s ?? '').toLocaleLowerCase('tr').replace(/\s+(ili|ilçesi|province|district)$/u, '').trim();

/** Telefonun verdiği il/ilçe adını kendi listemizdeki kayıtla eşler; bulamazsa boş döner. */
async function detectPlace(): Promise<{ province?: string; district?: string }> {
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const [addr] = await Location.reverseGeocodeAsync(pos.coords);
  if (!addr) return {};
  const names = [addr.region, addr.city, addr.subregion].map(norm);
  const province = repo.getProvinces().find((p) => names.includes(norm(p.name)));
  if (!province) return {};
  const dNames = [addr.subregion, addr.district, addr.city].map(norm);
  const district = repo.getDistricts(province.code).find((d) => dNames.includes(norm(d.name)));
  return { province: province.code, district: district?.id };
}

/**
 * Konum izni (G-IzinKonum): nedenini anlatır, tek düğme telefonun kendi izin sorusunu açar (Apple kuralı: özel ekranda
 * "İzin ver / Atla" olmaz). İzin verilirse il ve ilçe bulunup mahalle listesi açılır; verilmezse il listeden seçilir.
 * Konum yalnızca bu eşleştirme için bir kez okunur, kaydedilmez.
 */
export default function PermissionLocationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const next = async () => {
    setBusy(true);
    let found: { province?: string; district?: string } = {};
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        found = await Promise.race([detectPlace(), new Promise<typeof found>((r) => setTimeout(() => r({}), 10_000))]);
      }
    } catch {
      found = {};
    }
    setBusy(false);
    router.replace({ pathname: '/location', params: found.province ? { province: found.province, ...(found.district ? { district: found.district } : {}) } : {} });
  };

  return (
    <AuthScene kind="neighbourhood" art="permission" logo={false}>
      <StepDots total={3} current={0} label={t('onboarding.step', { n: 1, total: 3 })} />
      <View style={styles.texts}>
        <AppText accessibilityRole="header" style={styles.title}>{t('onboarding.locationTitle')}</AppText>
        <AppText style={styles.desc}>{t('onboarding.locationDesc')}</AppText>
      </View>
      <View style={styles.rows}>
        <WhyRow icon="campaign" text={t('onboarding.locationWhy1')} />
        <WhyRow icon="local-pharmacy" text={t('onboarding.locationWhy2')} />
        <WhyRow icon="sos" text={t('onboarding.locationWhy3')} />
      </View>
      <AppText style={styles.note}>{t('onboarding.locationNote')}</AppText>
      <AppButton title={t('common.continue')} onPress={next} loading={busy} />
    </AuthScene>
  );
}

