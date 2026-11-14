import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Broadcast } from '@cityjoy/shared';
import { getBroadcast } from '@cityjoy/shared/firebase';

import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { TranslatableText } from '@/components/translatable-text';
import { firestore } from '@/lib/firebase';
import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { fonts, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Toplu bildirimin tam metni (PROJE.md 7): telefondaki bildirime dokununca açılır. Gönderen (kurum adı, muhtarlık
 * ya da CityJoy), bölge, saat ve metin; "Çevir" düğmesi var. Tek okuma.
 */
export default function BroadcastScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Broadcast | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getBroadcast(firestore, id).then(setItem, () => setFailed(true));
  }, [id]);

  const region = item
    ? item.region.districtId
      ? [repo.getDistrict(item.region.districtId)?.name, repo.getProvince(item.region.provinceCode)?.name].filter(Boolean).join(', ')
      : t('announcements.wholeProvince', { place: repo.getProvince(item.region.provinceCode)?.name ?? '' })
    : '';
  const when = item?.sentAt ? new Date(item.sentAt).toLocaleString(language ?? 'tr', { dateStyle: 'medium', timeStyle: 'short' }) : '';

  const header = (
    <HeroHeader
      title={item?.kind === 'acil' ? t('announcements.urgent') : t('broadcast.title')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content}>
        {failed ? (
          <StateMessage kind="error" message={t('announcements.loadError')} />
        ) : item === undefined ? (
          <StateMessage kind="loading" />
        ) : !item || item.status !== 'gonderildi' ? (
          <StateMessage kind="empty" message={t('announcements.gone')} />
        ) : (
          <>
            {item.kind === 'acil' ? <FormMessage kind="error" text={t('announcements.urgentNote')} /> : null}
            <AppText accessibilityRole="header" style={[styles.title, { color: c.textStrong }]}>{item.title}</AppText>
            <View style={styles.meta}>
              <AppText variant="label" style={{ color: c.textStrong }}>{item.author.type === 'kurum' ? item.sourceName : item.author.type === 'kisi' && item.author.role === 'muhtar' ? t('broadcast.muhtar') : 'CityJoy'}</AppText>
              <AppText variant="caption" muted>{t('announcements.forRegion', { region })}</AppText>
              {when ? <AppText variant="caption" muted>{when}</AppText> : null}
            </View>
            <TranslatableText selectable text={item.body} />
            <AppText variant="caption" muted>{t('broadcast.note')}</AppText>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  title: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  meta: { gap: 2 },
});
