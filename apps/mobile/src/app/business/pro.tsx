import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { proOffer, type Business, type ProPlan } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { ListSurface } from '@/components/inner';
import { StateMessage } from '@/components/state-message';
import { buy, loadOffers, purchasesAvailable, restore, type PlanOffer } from '@/lib/purchases';
import { businessRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];
/** Pro'nun getirdikleri (PROJE.md 14 madde 2, Karar Eren 3 Kasım 2026). */
const PERKS: { key: string; icon: IconName }[] = [
  { key: 'photos', icon: 'photo-library' },
  { key: 'video', icon: 'videocam' },
  { key: 'details', icon: 'description' },
  { key: 'prices', icon: 'sell' },
  { key: 'reviews', icon: 'star-outline' },
  { key: 'map', icon: 'directions' },
  { key: 'deals', icon: 'local-offer' },
  { key: 'featured', icon: 'trending-up' },
  { key: 'stats', icon: 'insights' },
];
/** Satın almadan sonra sunucunun Pro'yu açmasını bu kadar bekleriz (mağaza bildirimi genelde birkaç saniye). */
const WAIT_MS = 30_000;

/**
 * Pro'ya geç (Karar Eren, 12 Kasım 2026): yalnızca doğrulanmış işletmenin sahibi. Aylık ve yıllık plan, fiyatlar
 * mağazadan (Apple / Google, kendi para biriminde). Mağaza kuralları gereği fiyat, süre, kendiliğinden yenilenme ve iptal
 * bilgisi, Kullanım Koşulları ve Gizlilik bağlantıları ile "Satın almayı geri yükle" bu ekranda durur.
 */
export default function ProScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [biz, setBiz] = useState<Business | null | undefined>(undefined);
  const [offers, setOffers] = useState<PlanOffer[] | null>(null);
  const [plan, setPlan] = useState<ProPlan>('yillik');
  const [stage, setStage] = useState<'hazir' | 'odeme' | 'aciliyor' | 'tamam' | 'gecikti'>('hazir');
  const [error, setError] = useState<'yukleme' | 'odeme' | 'geri' | null>(null);
  const [restored, setRestored] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const load = useCallback(() => {
    setError(null);
    businessRepository.get(id).then(setBiz, () => setError('yukleme'));
    if (purchasesAvailable) loadOffers(id).then(setOffers, () => setError('yukleme'));
    else setOffers([]);
  }, [id]);
  useEffect(load, [load]);

  /** Mağaza bildirimi sunucuya ulaşıp üyelik açılana kadar işletme kaydı yeniden okunur. */
  const waitForPro = async () => {
    setStage('aciliyor');
    const until = Date.now() + WAIT_MS;
    while (alive.current && Date.now() < until) {
      await new Promise((r) => setTimeout(r, 2500));
      const b = await businessRepository.get(id).catch(() => null);
      if (b && proOffer(b, new Date()) === 'pro') {
        setBiz(b);
        setStage('tamam');
        return;
      }
    }
    if (alive.current) setStage('gecikti');
  };

  const purchase = async () => {
    const offer = offers?.find((o) => o.plan === plan);
    if (!offer) return;
    setError(null);
    setStage('odeme');
    try {
      if ((await buy(offer)) === 'vazgecildi') return setStage('hazir');
      await waitForPro();
    } catch {
      setError('odeme');
      setStage('hazir');
    }
  };

  const restoreNow = async () => {
    setError(null);
    setStage('odeme');
    try {
      await restore(id);
      setRestored(true);
      await waitForPro();
    } catch {
      setError('geri');
      setStage('hazir');
    }
  };

  if (biz === undefined && !error) return <FormScreen title={t('business.proPlan.title')}><StateMessage kind="loading" /></FormScreen>;
  if (!biz || !user || biz.ownerUid !== user.uid) {
    return (
      <FormScreen title={t('business.proPlan.title')}>
        <StateMessage kind="error" onRetry={load} />
      </FormScreen>
    );
  }
  const offer = proOffer(biz, new Date());

  return (
    <FormScreen title={t('business.proPlan.title')} subtitle={biz.name}>
      <AppText style={[styles.lead, { color: c.textStrong }]}>{t('business.proPlan.lead')}</AppText>
      <ListSurface>
        {PERKS.map((p, i) => (
          <View key={p.key} style={[styles.perk, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
            <MaterialIcons name={p.icon} size={20} color={c.primary} />
            <AppText style={[styles.perkText, { color: c.text }]}>{t(`business.proPlan.perks.${p.key}`)}</AppText>
          </View>
        ))}
      </ListSurface>

      {stage === 'tamam' || offer === 'pro' ? (
        <>
          <FormMessage kind="info" text={t('business.proPlan.done')} />
          <AppButton title={t('business.proPlan.back')} onPress={() => router.back()} />
        </>
      ) : offer === 'dogrulama-gerek' ? (
        <FormMessage kind="info" text={t('business.membership.verifyFirst')} />
      ) : stage === 'aciliyor' ? (
        <>
          <StateMessage kind="loading" />
          <AppText variant="caption" muted style={styles.center}>{t('business.proPlan.activating')}</AppText>
        </>
      ) : stage === 'gecikti' ? (
        <>
          <FormMessage kind="info" text={restored ? t('business.proPlan.restoreLate') : t('business.proPlan.late')} />
          <AppButton variant="secondary" title={t('business.proPlan.back')} onPress={() => router.back()} />
        </>
      ) : !purchasesAvailable ? (
        <FormMessage kind="info" text={t('business.proPlan.soon')} />
      ) : offers === null ? (
        <StateMessage kind="loading" />
      ) : offers.length === 0 ? (
        <FormMessage kind="info" text={t('business.proPlan.noOffers')} />
      ) : (
        <>
          <View accessibilityRole="radiogroup" style={styles.plans}>
            {offers.map((o) => {
              const on = o.plan === plan;
              return (
                <Pressable
                  key={o.plan}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${t(`business.proPlan.plans.${o.plan}`)}, ${o.price}${o.perMonth ? `, ${t('business.proPlan.perMonth', { price: o.perMonth })}` : ''}`}
                  onPress={() => setPlan(o.plan)}
                  style={[styles.plan, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.accentSoft : c.surface }]}>
                  <MaterialIcons name={on ? 'radio-button-checked' : 'radio-button-unchecked'} size={22} color={on ? c.primary : c.textSoft} />
                  <View style={styles.planText}>
                    <AppText style={[styles.planName, { color: c.textStrong }]}>{t(`business.proPlan.plans.${o.plan}`)}</AppText>
                    {o.perMonth ? <AppText variant="caption" muted>{t('business.proPlan.perMonth', { price: o.perMonth })}</AppText> : null}
                  </View>
                  <AppText style={[styles.price, { color: c.textStrong }]}>{o.price}</AppText>
                </Pressable>
              );
            })}
          </View>
          {error === 'odeme' ? <FormMessage kind="error" text={t('business.proPlan.buyError')} /> : null}
          <AppButton title={t('business.proPlan.buy')} onPress={purchase} loading={stage === 'odeme'} disabled={stage !== 'hazir'} />
          <AppText variant="caption" muted style={styles.small}>
            {t('business.proPlan.terms', { price: offers.find((o) => o.plan === plan)?.price ?? '', period: t(`business.proPlan.periods.${plan}`) })}
          </AppText>
        </>
      )}

      {error === 'yukleme' ? <StateMessage kind="error" onRetry={load} /> : null}
      {error === 'geri' ? <FormMessage kind="error" text={t('business.proPlan.restoreError')} /> : null}
      {purchasesAvailable && offer !== 'pro' && stage !== 'tamam' ? (
        <AppButton variant="ghost" title={t('business.proPlan.restore')} onPress={restoreNow} disabled={stage !== 'hazir'} />
      ) : null}
      <View style={styles.links}>
        <AppText accessibilityRole="link" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} style={[styles.link, { color: c.primary }]}>{t('account.terms')}</AppText>
        <AppText accessibilityRole="link" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} style={[styles.link, { color: c.primary }]}>{t('account.privacy')}</AppText>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 11 },
  perkText: { flex: 1, fontSize: 14.5, lineHeight: 20 },
  plans: { gap: spacing.sm },
  plan: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 64, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5 },
  planText: { flex: 1, gap: 2 },
  planName: { fontFamily: fonts.bodySemi, fontSize: 15.5 },
  price: { fontFamily: fonts.heading, fontSize: 17 },
  small: { lineHeight: 18 },
  center: { textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.sm },
  link: { fontSize: 13.5, minHeight: 44, textAlignVertical: 'center', paddingVertical: 12 },
});
