import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { POST_REPORT_REASONS, type Post, type PostReportReason } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { patchCachedPost } from '@/lib/posts';
import { postRepository } from '@/lib/services';
import { errorText } from '@/lib/limits';
import { spacing } from '@/theme/tokens';

interface Props {
  item: Post;
  uid: string;
  onChange(item: Post): void;
  onRemoved(): void;
}

/**
 * Gönderinin altındaki işlemler (ayrıntı ekranı ve yorum paneli): sahibi yorumları kapatır / açar ve gönderiyi kaldırır,
 * başkası şikâyet eder. Üç şikâyet alan gönderi sahibine "incelemede" notuyla görünür.
 */
export function PostActions({ item, uid, onChange, onRemoved }: Props) {
  const { t } = useTranslation();
  const mine = item.authorUid === uid;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reporting, setReporting] = useState<PostReportReason | null>(null);
  const [reported, setReported] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!mine) postRepository.hasReported(item.id, uid).then(setReported, () => {});
  }, [item.id, uid, mine]);

  const run = async (fn: () => Promise<void>, errKey: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(errorText(t, e, errKey));
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    run(async () => {
      await postRepository.remove(item.id);
      patchCachedPost(item.id, { status: 'kaldirildi' });
      onRemoved();
    }, 'explore.saveError');

  const report = () =>
    run(async () => {
      await postRepository.report(item, uid, reporting!);
      setReported(true);
      setReporting(null);
    }, 'explore.reportError');

  const toggleComments = () =>
    run(async () => {
      await postRepository.setCommentsOff(item.id, !item.commentsOff);
      patchCachedPost(item.id, { commentsOff: !item.commentsOff });
      onChange({ ...item, commentsOff: !item.commentsOff });
    }, 'explore.saveError');

  return (
    <View style={styles.block}>
      {mine && item.reportCount >= 3 && !item.cleared ? <FormMessage kind="info" text={t('explore.hiddenForReview')} /> : null}
      {error ? <FormMessage kind="error" text={error} /> : null}
      {mine ? (
        <>
          <AppButton variant="secondary" title={item.commentsOff ? t('explore.comments.turnOn') : t('explore.comments.turnOff')} disabled={busy} onPress={toggleComments} />
          {confirmRemove ? (
            <View style={styles.block}>
              <AppText>{t('explore.removeConfirm')}</AppText>
              <AppButton title={t('explore.remove')} loading={busy} disabled={busy} onPress={remove} />
              <AppButton variant="ghost" title={t('account.cancel')} onPress={() => setConfirmRemove(false)} />
            </View>
          ) : (
            <AppButton variant="ghost" title={t('explore.remove')} onPress={() => setConfirmRemove(true)} />
          )}
        </>
      ) : reported ? (
        <AppText variant="caption" muted>{t('explore.reported')}</AppText>
      ) : reporting ? (
        <View style={styles.block}>
          <AppText variant="label">{t('explore.reportTitle')}</AppText>
          <Chips<PostReportReason> label={t('explore.reportTitle')} value={reporting} onChange={setReporting} options={POST_REPORT_REASONS.map((r) => ({ value: r, label: t(`explore.reasons.${r}`) }))} />
          <AppButton title={t('explore.reportSend')} loading={busy} disabled={busy} onPress={report} />
          <AppButton variant="ghost" title={t('account.cancel')} onPress={() => setReporting(null)} />
        </View>
      ) : (
        <AppButton variant="ghost" title={t('explore.report')} onPress={() => setReporting('spam')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
});
