import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { proOffer, type Business } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Tag } from '@/components/inner';
import { useSettings } from '@/lib/settings';
import { spacing } from '@/theme/tokens';

/**
 * İşletme düzenleme ekranında üyelik kartı (Eren, 12 Kasım 2026): mevcut kademe, "Pro'ya geç" (yalnızca doğrulanmış
 * işletmede açık; değilse neden kapalı olduğu yazar) ve "Üyelik ve Ödemeler". Yalnızca sahibi görür: satın alma ve
 * iptal sahibinin işidir, yetkililer göremez.
 */
export function MembershipSection({ business }: { business: Business }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { language } = useSettings();
  const offer = proOffer(business, new Date());
  const until = business.membership.endsAt ? new Date(business.membership.endsAt).toLocaleDateString(language ?? 'tr', { dateStyle: 'medium' }) : '';

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <AppText variant="label" accessibilityRole="header">{t('business.membership.title')}</AppText>
        <Tag label={offer === 'pro' ? t('business.membership.pro') : t('business.membership.free')} tone={offer === 'pro' ? 'gold' : 'muted'} />
      </View>
      {offer === 'pro' ? (
        <AppText variant="caption" muted>
          {until ? (business.membership.autoRenew === false ? t('business.membership.endsOn', { date: until }) : t('business.membership.renewsOn', { date: until })) : t('business.membership.noEnd')}
        </AppText>
      ) : (
        <AppText variant="caption" muted>{offer === 'dogrulama-gerek' ? t('business.membership.verifyFirst') : t('business.membership.freeIntro')}</AppText>
      )}
      {offer === 'pro' ? null : (
        <AppButton
          title={t('business.membership.goPro')}
          disabled={offer !== 'satin-alinabilir'}
          onPress={() => router.push({ pathname: '/business/pro', params: { id: business.id } })}
        />
      )}
      <AppButton variant="secondary" title={t('business.membership.manage')} onPress={() => router.push({ pathname: '/business/membership', params: { id: business.id } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
