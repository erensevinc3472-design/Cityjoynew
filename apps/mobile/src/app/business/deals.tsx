import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { activeDealLimit, dealExpired, dealLive, type Business, type Deal, type DealStatus } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { useDealEndText } from '@/components/deal-box';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { Tag } from '@/components/inner';
import { StateMessage } from '@/components/state-message';
import { forgetProvinceDeals } from '@/lib/deals';
import { businessRepository, dealRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Profil > İşletmem > işletme sayfası > Fırsatlarım (13. madde 35): fırsatlar, durumları ve sayılar (görüntülenme, kod
 * açılma, arama). Düzenle / durdur / yeniden aç / bitir. Yalnızca doğrulanmış işletme yeni fırsat açar; aynı anda açık
 * fırsat Ücretsiz 1, Pro 5. Süresi dolan fırsat kendiliğinden listeden kalkar, burada "Süresi doldu" görünür.
 */
export default function MyDealsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const endText = useDealEndText();
  const [biz, setBiz] = useState<Business | null>(null);
  const [list, setList] = useState<Deal[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user) return;
    setError(false);
    businessRepository.get(id).then(setBiz, () => setError(true));
    dealRepository.listMine(id, user.uid).then(setList, () => setError(true));
  }, [id, user]);
  useFocusEffect(load);

  const verified = biz?.verification.status === 'dogrulandi';
  const limit = biz ? activeDealLimit(biz.membership.tier) : 1;
  const liveCount = (list ?? []).filter((d) => dealLive(d)).length;
  const full = liveCount >= limit;

  const change = async (d: Deal, status: Exclude<DealStatus, 'gizlendi'>) => {
    setBusy(d.id);
    await dealRepository.setStatus(d.id, status).catch(() => Alert.alert(t('deals.form.errors.save')));
    if (biz) forgetProvinceDeals(biz.location.provinceCode);
    setBusy(null);
    load();
  };
  const end = (d: Deal) =>
    Alert.alert(t('deals.mine.end'), t('deals.mine.endConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('deals.mine.end'), style: 'destructive', onPress: () => change(d, 'bitti') },
    ]);

  const statusOf = (d: Deal) => (d.status === 'aktif' && dealExpired(d) ? t('deals.mine.expired') : t(`deals.mine.status.${d.status}`));
  const tone = (d: Deal) => (dealLive(d) ? 'green' : d.status === 'gizlendi' ? 'red' : 'muted') as 'green' | 'red' | 'muted';

  return (
    <FormScreen title={t('deals.mine.title')} subtitle={biz?.name}>
      {error ? (
        <StateMessage kind="error" onRetry={load} />
      ) : list === null || !biz ? (
        <StateMessage kind="loading" />
      ) : (
        <>
          {!verified ? <FormMessage kind="info" text={t('deals.mine.needVerified')} /> : full ? <FormMessage kind="info" text={t('deals.mine.limit', { count: limit })} /> : null}
          <AppButton title={t('deals.mine.add')} disabled={!verified || full} onPress={() => router.push({ pathname: '/business/deal-edit', params: { id } })} />
          {list.length === 0 ? <AppText muted>{t('deals.mine.empty')}</AppText> : null}
          {list.map((d) => {
            const editable = d.status !== 'gizlendi' && d.status !== 'bitti' && !dealExpired(d);
            return (
              <View key={d.id} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={styles.row}>
                  <AppText style={[styles.value, { color: c.primary }]}>{d.value}</AppText>
                  <View style={styles.flex} />
                  <Tag label={statusOf(d)} tone={tone(d)} />
                </View>
                <AppText style={[styles.title, { color: c.textStrong }]}>{d.title}</AppText>
                <AppText style={[styles.meta, { color: c.textMuted }]}>{[t(`social.deals.${d.category}.name`), endText(d)].join(' · ')}</AppText>
                <AppText style={[styles.meta, { color: c.textMuted }]}>{t('deals.mine.stats', { views: d.stats.views, codes: d.stats.codeViews, calls: d.stats.calls })}</AppText>
                {editable ? (
                  <View style={styles.actions}>
                    <Action label={t('deals.mine.edit')} onPress={() => router.push({ pathname: '/business/deal-edit', params: { id, deal: d.id } })} />
                    {d.status === 'aktif' ? (
                      <Action label={t('deals.mine.pause')} busy={busy === d.id} onPress={() => change(d, 'durduruldu')} />
                    ) : (
                      <Action label={t('deals.mine.resume')} busy={busy === d.id} disabled={!verified || full} onPress={() => change(d, 'aktif')} />
                    )}
                    <Action label={t('deals.mine.end')} danger busy={busy === d.id} onPress={() => end(d)} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </>
      )}
    </FormScreen>
  );
}

function Action({ label, onPress, danger, busy, disabled }: { label: string; onPress(): void; danger?: boolean; busy?: boolean; disabled?: boolean }) {
  const c = useThemeColors();
  const off = busy || disabled;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: off }} disabled={off} onPress={onPress} style={({ pressed }) => [styles.action, { borderColor: danger ? c.danger : c.accentBorder, opacity: off ? 0.45 : pressed ? 0.75 : 1 }]}>
      <AppText style={[styles.actionText, { color: danger ? c.danger : c.accent }]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  value: { fontFamily: fonts.heading, fontSize: 22 },
  title: { fontFamily: fonts.bodySemi, fontSize: 15 },
  meta: { fontSize: 12.5 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: { flex: 1, minHeight: 38, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: fonts.bodySemi, fontSize: 13 },
});
