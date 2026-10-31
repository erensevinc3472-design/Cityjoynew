import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { averageRating, isValidReplyText, REPLY_TEXT, REPORT_REASONS, type Business, type ReportReason, type Review } from '@cityjoy/shared';

import { reviewRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppButton } from './app-button';
import { AppText } from './app-text';
import { FormMessage } from './form-message';
import { Stars } from './stars';
import { StateMessage } from './state-message';
import { TextField } from './text-field';
import { errorText } from '@/lib/limits';

/**
 * İşletme sayfasındaki değerlendirmeler: ortalama, son yorumlar, işletmenin cevabı, şikâyet.
 * "Değerlendir" yalnızca işletmeyi uygulamadan arayan / yazan kişiye açılır.
 */
export function ReviewsSection({ business: b }: { business: Business }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { user } = useSession();
  // Sahibi ya da cevap izni olan yetkili yorumlara işletme adına cevap verir; kendi işletmesine yorum yazamaz.
  const isOwner = user?.uid === b.ownerUid || b.managers.some((m) => m.uid === user?.uid && m.reply);

  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [mine, setMine] = useState<Review | null>(null);
  const [contacted, setContacted] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [replyFor, setReplyFor] = useState<string>();
  const [replyText, setReplyText] = useState('');
  const [reportFor, setReportFor] = useState<string>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(false);
    reviewRepository.list(b.id).then(setReviews).catch(() => setError(true));
    if (user && !isOwner) {
      reviewRepository.getMine(b.id, user.uid).then(setMine).catch(() => {});
      reviewRepository.hasContacted(b.id, user.uid).then(setContacted).catch(() => {});
    }
  }, [b.id, user, isOwner]);

  // Değerlendirme ekranından dönünce ve arama yapıp geri gelince tazelenir.
  useFocusEffect(load);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    setNotice(undefined);
    try {
      await fn();
      if (ok) setNotice(ok);
      load();
    } catch (e) {
      setNotice(errorText(t, e, 'reviews.error'));
    } finally {
      setBusy(false);
    }
  };

  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language);
  const writeHint = !user ? t('reviews.signIn') : isOwner ? null : !contacted && !mine ? t('reviews.needContact') : null;

  return (
    <View style={styles.wrap}>
      <AppText variant="subtitle" accessibilityRole="header">{t('reviews.title')}</AppText>
      {b.rating.count ? (
        <View style={styles.row}>
          <AppText style={[styles.avg, { color: c.textStrong }]}>{averageRating(b.rating).toLocaleString(i18n.language)}</AppText>
          <Stars value={Math.round(averageRating(b.rating))} />
          <AppText variant="caption" muted>({b.rating.count})</AppText>
        </View>
      ) : null}

      {notice ? <FormMessage kind="info" text={notice} /> : null}
      {mine?.status === 'gizlendi' ? <FormMessage kind="info" text={t('reviews.hiddenNote')} /> : null}
      {user && !isOwner && (contacted || mine) && mine?.status !== 'gizlendi' ? (
        <AppButton
          variant="secondary"
          title={mine ? t('reviews.edit') : t('reviews.write')}
          onPress={() => router.push({ pathname: '/business/review', params: { id: b.id } })}
        />
      ) : null}
      {writeHint ? <AppText variant="caption" muted>{writeHint}</AppText> : null}

      {error ? (
        <StateMessage kind="error" onRetry={load} />
      ) : reviews === null ? (
        <StateMessage kind="loading" />
      ) : reviews.length === 0 ? (
        <AppText muted>{t('reviews.none')}</AppText>
      ) : (
        reviews.map((r) => (
          <View key={r.uid} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.row}>
              <Stars value={r.stars} size={16} />
              <AppText variant="caption" muted style={styles.flex}>{`${r.authorName} · ${date(r.createdAt)}`}</AppText>
            </View>
            <AppText>{r.text}</AppText>
            {r.reply ? (
              <View style={[styles.reply, { borderColor: c.accentBorder, backgroundColor: c.accentSoft }]}>
                <AppText variant="caption" style={{ color: c.textStrong }}>{`${t('reviews.replyFrom')} · ${date(r.reply.at)}`}</AppText>
                <AppText variant="caption">{r.reply.text}</AppText>
              </View>
            ) : null}

            {isOwner && !r.reply ? (
              replyFor === r.uid ? (
                <View style={styles.wrapSm}>
                  <TextField label={t('reviews.replyLabel')} value={replyText} onChangeText={setReplyText} maxLength={REPLY_TEXT[1]} multiline />
                  <AppButton
                    title={t('reviews.replySend')}
                    disabled={busy || !isValidReplyText(replyText)}
                    onPress={() => run(async () => {
                      await reviewRepository.reply(b.id, r.uid, replyText);
                      setReplyFor(undefined);
                      setReplyText('');
                    })}
                  />
                </View>
              ) : (
                <LinkButton label={t('reviews.reply')} onPress={() => setReplyFor(r.uid)} />
              )
            ) : null}

            {user && user.uid !== r.uid ? (
              reportFor === r.uid ? (
                <View style={styles.wrapSm}>
                  <AppText variant="caption" style={{ color: c.textStrong }}>{t('reviews.reportTitle')}</AppText>
                  {REPORT_REASONS.map((reason: ReportReason) => (
                    <LinkButton
                      key={reason}
                      label={t(`reviews.reasons.${reason}`)}
                      onPress={() => run(async () => {
                        await reviewRepository.report(b.id, r.uid, user.uid, reason);
                        setReportFor(undefined);
                      }, t('reviews.reported'))}
                    />
                  ))}
                  <LinkButton label={t('reviews.cancel')} onPress={() => setReportFor(undefined)} />
                </View>
              ) : (
                <LinkButton label={t('reviews.report')} muted onPress={() => setReportFor(r.uid)} />
              )
            ) : null}
          </View>
        ))
      )}
      <AppText variant="caption" muted>{t('reviews.rules')}</AppText>
    </View>
  );
}

function LinkButton({ label, onPress, muted }: { label: string; onPress(): void; muted?: boolean }) {
  const c = useThemeColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6} style={styles.link}>
      <AppText variant="caption" style={{ color: muted ? c.textMuted : c.primary }}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  wrapSm: { gap: spacing.xs },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avg: { fontSize: 22, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  reply: { borderWidth: 1, borderRadius: radius.sm, padding: spacing.sm, gap: 2 },
  link: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' },
});
