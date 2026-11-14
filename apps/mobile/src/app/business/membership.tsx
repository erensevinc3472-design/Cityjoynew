import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatMoney, proOffer, type Business, type Payment } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { ListRow, ListSurface, SectionTitle, Tag } from '@/components/inner';
import { StateMessage } from '@/components/state-message';
import { manageSubscription, purchasesAvailable, restore } from '@/lib/purchases';
import { businessRepository, ownerPayments } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { spacing } from '@/theme/tokens';

/**
 * Üyelik ve Ödemeler (PROJE.md 15.2, 13. madde 29): yalnızca işletme sahibi. Kademe, plan, başlangıç ve bitiş /
 * yenilenme tarihi, yenileme durumu, ödeme geçmişi, aboneliği yönet (iptal ve plan değişikliği mağazanın kendi
 * sayfasında) ve satın almayı geri yükle. Faturayı mağaza (Apple / Google) e-postayla gönderir.
 */
export default function MembershipScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { language } = useSettings();
  const [biz, setBiz] = useState<Business | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState(false);
  const [note, setNote] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!user) return;
    setError(false);
    businessRepository.get(id).then(setBiz, () => setError(true));
    ownerPayments.list(id, user.uid).then(setPayments, () => setError(true));
  }, [id, user]);
  useFocusEffect(load);

  const date = (s?: string) => (s ? new Date(s).toLocaleDateString(language ?? 'tr', { dateStyle: 'medium' }) : '');

  if (error) return <FormScreen title={t('business.membership.screen')}><StateMessage kind="error" onRetry={load} /></FormScreen>;
  if (!biz || !payments || !user) return <FormScreen title={t('business.membership.screen')}><StateMessage kind="loading" /></FormScreen>;
  if (biz.ownerUid !== user.uid) return <FormScreen title={t('business.membership.screen')}><StateMessage kind="error" /></FormScreen>;

  const m = biz.membership;
  const offer = proOffer(biz, new Date());
  const fromStore = m.source === 'app-store' || m.source === 'google-play';
  const restoreNow = async () => {
    setBusy(true);
    setNote(null);
    try {
      await restore(id);
      setNote({ kind: 'info', text: t('business.membership.restored') });
      setTimeout(load, 4000);
    } catch {
      setNote({ kind: 'error', text: t('business.proPlan.restoreError') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen title={t('business.membership.screen')} subtitle={biz.name}>
      <ListSurface>
        <ListRow first title={t('business.membership.tier')} trailing={<Tag label={offer === 'pro' ? t('business.membership.pro') : t('business.membership.free')} tone={offer === 'pro' ? 'gold' : 'muted'} />} />
        {offer === 'pro' && m.plan ? <ListRow title={t('business.membership.plan')} subtitle={t(`business.proPlan.plans.${m.plan}`)} /> : null}
        {offer === 'pro' && m.startedAt ? <ListRow title={t('business.membership.started')} subtitle={date(m.startedAt)} /> : null}
        {offer === 'pro' ? (
          <ListRow
            title={m.autoRenew === false || !fromStore ? t('business.membership.ends') : t('business.membership.renews')}
            subtitle={m.endsAt ? date(m.endsAt) : t('business.membership.noEnd')}
          />
        ) : null}
        {offer === 'pro' && m.source ? <ListRow title={t('business.membership.source')} subtitle={t(`business.membership.sources.${m.source}`)} /> : null}
      </ListSurface>

      {offer === 'pro' && fromStore && m.autoRenew === false ? <FormMessage kind="info" text={t('business.membership.cancelledNote', { date: date(m.endsAt) })} /> : null}
      {offer === 'satin-alinabilir' ? <AppButton title={t('business.membership.goPro')} onPress={() => router.push({ pathname: '/business/pro', params: { id } })} /> : null}
      {offer === 'dogrulama-gerek' ? <FormMessage kind="info" text={t('business.membership.verifyFirst')} /> : null}
      {fromStore ? <AppButton variant="secondary" title={t('business.membership.manageStore')} onPress={() => manageSubscription(m.source)} /> : null}
      {purchasesAvailable ? <AppButton variant="ghost" title={t('business.proPlan.restore')} onPress={restoreNow} loading={busy} disabled={busy} /> : null}
      {note ? <FormMessage kind={note.kind} text={note.text} /> : null}

      <SectionTitle title={t('business.membership.history')} />
      {payments.length === 0 ? (
        <StateMessage kind="empty" message={t('business.membership.noPayments')} />
      ) : (
        <ListSurface>
          {payments.map((p, i) => (
            <ListRow
              key={p.id}
              first={i === 0}
              title={`${t(`business.membership.kinds.${p.kind}`)}${p.plan ? ` · ${t(`business.proPlan.plans.${p.plan}`)}` : ''}`}
              subtitle={`${date(p.at)} · ${t(`business.membership.sources.${p.store}`)}`}
              trailing={<AppText style={styles.amount}>{formatMoney(p.amount, p.currency, language ?? 'tr')}</AppText>}
            />
          ))}
        </ListSurface>
      )}
      <View style={styles.foot}>
        <AppText variant="caption" muted>{t('business.membership.invoiceNote')}</AppText>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  amount: { fontSize: 14, fontVariant: ['tabular-nums'] },
  foot: { paddingTop: spacing.xs },
});
