import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DEAL_REPORT_REASONS, dealDaysLeft, type Deal, type DealReportReason } from '@cityjoy/shared';

import { countDeal } from '@/lib/deals';
import { dealRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';
import { FilterChip, Tag } from './inner';

/** "3 gün kaldı", "Son gün" ya da tarih. */
export function useDealEndText() {
  const { t } = useTranslation();
  const { language } = useSettings();
  return (d: Deal) => {
    const left = dealDaysLeft(d);
    if (left === 0) return t('deals.lastDay');
    if (left <= 7) return t('deals.daysLeft', { count: left });
    return t('deals.until', { date: new Date(`${d.endsOn}T12:00:00`).toLocaleDateString(language ?? 'tr', { day: 'numeric', month: 'long' }) });
  };
}

/**
 * İşletme sayfasında kapağın altındaki fırsat kutusu (13. madde 35): oran, neyde geçerli, gün/saat, geçerlilik,
 * "Kodu göster" (ya da "ekranı göster"), açılır Şartlar, şart değiştiyse "Güncellendi", şikâyet. Açılması görüntülenme,
 * kod açma kod sayacı olarak sayılır (oturumda bir kez).
 */
export function DealBox({ deal, own }: { deal: Deal; own?: boolean }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { user } = useSession();
  const endText = useDealEndText();
  const [code, setCode] = useState(false);
  const [terms, setTerms] = useState(false);
  const [report, setReport] = useState<'closed' | 'open' | 'done'>('closed');

  useEffect(() => {
    if (!own) countDeal(deal.id, 'views');
  }, [deal.id, own]);

  const reveal = () => {
    setCode(true);
    if (!own) countDeal(deal.id, 'codeViews');
  };
  const send = (reason: DealReportReason) => {
    if (!user) return;
    setReport('done');
    dealRepository.report(deal, user.uid, reason).catch(() => {});
  };

  return (
    <View style={[styles.box, { backgroundColor: c.accentSoft, borderColor: c.accentBorder }]}>
      <View style={styles.top}>
        <MaterialIcons name="local-offer" size={18} color={c.primary} />
        <AppText style={[styles.kicker, { color: c.primary }]}>{t(`deals.kinds.${deal.kind}`)}</AppText>
        <View style={styles.flex} />
        {deal.sponsored ? <Tag label={t('deals.sponsored')} tone="muted" /> : null}
        {deal.changedAt ? <Tag label={t('deals.updated')} /> : null}
      </View>
      <AppText style={[styles.value, { color: c.textStrong }]}>{deal.value}</AppText>
      <AppText style={[styles.title, { color: c.textStrong }]}>{deal.title}</AppText>
      <AppText style={[styles.meta, { color: c.textMuted }]}>{[deal.when || t('deals.always'), endText(deal)].join(' · ')}</AppText>

      {code ? (
        <View style={[styles.code, { backgroundColor: c.surface, borderColor: c.accentBorder }]} accessibilityLiveRegion="polite">
          <AppText style={[styles.codeLabel, { color: c.textMuted }]}>{deal.usage === 'kod' ? t('deals.codeLabel') : t('deals.showScreen')}</AppText>
          <AppText selectable style={[styles.codeText, { color: c.primary }]}>{deal.usage === 'kod' ? deal.code : `${deal.value} · ${deal.businessName}`}</AppText>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={reveal} style={({ pressed }) => [styles.btn, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}>
          <MaterialIcons name={deal.usage === 'kod' ? 'confirmation-number' : 'smartphone'} size={18} color={c.onPrimary} />
          <AppText style={[styles.btnText, { color: c.onPrimary }]}>{t('deals.showCode')}</AppText>
        </Pressable>
      )}

      <View style={styles.links}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: terms }} onPress={() => setTerms((x) => !x)} hitSlop={8} style={styles.link}>
          <AppText style={[styles.linkText, { color: c.textStrong }]}>{t('deals.terms')}</AppText>
          <MaterialIcons name={terms ? 'expand-less' : 'expand-more'} size={18} color={c.textMuted} />
        </Pressable>
        {!own && user && report === 'closed' ? (
          <AppText accessibilityRole="button" onPress={() => setReport('open')} style={[styles.linkText, { color: c.textMuted }]}>{t('deals.report')}</AppText>
        ) : null}
      </View>
      {terms ? <AppText style={[styles.terms, { color: c.textMuted }]}>{deal.terms || t('deals.noTerms')}</AppText> : null}
      {report === 'open' ? (
        <View style={styles.report}>
          <AppText variant="label">{t('deals.reportTitle')}</AppText>
          <View style={styles.reasons}>
            {DEAL_REPORT_REASONS.map((r) => <FilterChip key={r} label={t(`deals.reportReasons.${r}`)} active={false} onPress={() => send(r)} />)}
          </View>
        </View>
      ) : report === 'done' ? (
        <AppText style={[styles.terms, { color: c.success }]}>{t('deals.reportDone')}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 12 },
  flex: { flex: 1 },
  value: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 32, marginTop: 2 },
  title: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20 },
  meta: { fontSize: 12.5, lineHeight: 17 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radius.pill, marginTop: spacing.sm },
  btnText: { fontFamily: fonts.bodySemi, fontSize: 15 },
  code: { alignItems: 'center', gap: 2, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.lg, padding: spacing.sm + 2, marginTop: spacing.sm },
  codeLabel: { fontSize: 12 },
  codeText: { fontFamily: fonts.heading, fontSize: 22, letterSpacing: 2 },
  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs, minHeight: 32 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  terms: { fontSize: 13, lineHeight: 19 },
  report: { gap: spacing.xs, marginTop: spacing.xs },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
});
