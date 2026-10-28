import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  authorNameOf,
  COMMENT_LIMITS,
  isCommentListed,
  POST_REPORT_REASONS,
  validateComment,
  type Post,
  type PostComment,
  type PostReportReason,
} from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { StateMessage } from '@/components/state-message';
import { TextField } from '@/components/text-field';
import { patchCachedPost } from '@/lib/posts';
import { postRepository } from '@/lib/services';
import { useSettings } from '@/lib/settings';
import { useSocial } from '@/lib/social';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

interface Props {
  post: Post;
  uid: string;
  displayName: string | undefined;
  /** Yorum sayısı değişince ayrıntı ekranı kartı günceller. */
  onCount(count: number): void;
}

/**
 * Gönderi yorumları (Keşfet kuralları madde 3): eskiden yeniye ilk 50 yorum, yazma (yorumlar açıksa), yazanın ve
 * gönderi sahibinin silmesi, başkasının yorumunu şikâyet. Üç şikâyet alan yorum, moderatör bakana kadar gizlenir.
 */
export function PostComments({ post, uid, displayName, onCount }: Props) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const [list, setList] = useState<PostComment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reporting, setReporting] = useState<{ id: string; reason: PostReportReason } | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const owner = post.authorUid === uid;
  const { blocked } = useSocial();

  const load = () => {
    setFailed(false);
    postRepository.comments(post.id).then(setList, () => setFailed(true));
  };
  useEffect(load, [post.id]);

  const run = async (fn: () => Promise<void>, errKey: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch {
      setError(t(errKey));
    } finally {
      setBusy(false);
    }
  };

  const setCount = (n: number) => {
    patchCachedPost(post.id, { commentCount: n });
    onCount(n);
  };

  const send = () => {
    if (!validateComment(text)) return setError(t('explore.comments.tooLong'));
    run(async () => {
      const added = await postRepository.addComment(post.id, uid, authorNameOf(displayName), text);
      setList((l) => [...(l ?? []), added]);
      setText('');
      setCount(post.commentCount + 1);
    }, 'explore.comments.sendError');
  };

  const remove = (id: string) =>
    run(async () => {
      await postRepository.deleteComment(post.id, id);
      setList((l) => (l ?? []).filter((x) => x.id !== id));
      setCount(Math.max(0, post.commentCount - 1));
    }, 'explore.saveError');

  const report = (cm: PostComment) =>
    run(async () => {
      await postRepository.reportComment(post, cm, uid, reporting!.reason);
      setReported((s) => new Set(s).add(cm.id));
      setReporting(null);
    }, 'explore.reportError');

  // Şikâyetle gizlenenler ve engellediklerimin yorumları görünmez.
  const shown = (list ?? []).filter((x) => x.authorUid === uid || (isCommentListed(x) && !blocked.has(x.authorUid)));

  return (
    <View style={styles.wrap}>
      <AppText variant="label" accessibilityRole="header">{t('explore.comments.title', { count: post.commentCount })}</AppText>
      {failed ? (
        <StateMessage kind="error" message={t('explore.comments.loadError')} onRetry={load} />
      ) : list === null ? (
        <StateMessage kind="loading" />
      ) : shown.length === 0 ? (
        <AppText variant="caption" muted>{t('explore.comments.empty')}</AppText>
      ) : (
        shown.map((cm) => {
          const at = new Date(cm.createdAt);
          const mine = cm.authorUid === uid;
          return (
            <View key={cm.id} style={[styles.item, { backgroundColor: c.surface, borderColor: c.border }]}>
              <AppText variant="caption" muted>
                {cm.authorName} · {at.toLocaleDateString(lang, { day: 'numeric', month: 'short' })} {at.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
              </AppText>
              <AppText selectable>{cm.text}</AppText>
              {reporting?.id === cm.id ? (
                <View style={styles.block}>
                  <Chips<PostReportReason>
                    label={t('explore.reportTitle')}
                    value={reporting.reason}
                    onChange={(reason) => setReporting({ id: cm.id, reason })}
                    options={POST_REPORT_REASONS.filter((r) => r !== 'emlak').map((r) => ({ value: r, label: t(`explore.reasons.${r}`) }))}
                  />
                  <AppButton title={t('explore.reportSend')} loading={busy} disabled={busy} onPress={() => report(cm)} />
                  <AppButton variant="ghost" title={t('account.cancel')} onPress={() => setReporting(null)} />
                </View>
              ) : (
                <View style={styles.actions}>
                  {mine || owner ? <AppButton variant="ghost" title={t('explore.comments.delete')} disabled={busy} onPress={() => remove(cm.id)} /> : null}
                  {mine ? null : reported.has(cm.id) ? (
                    <AppText variant="caption" muted>{t('explore.reported')}</AppText>
                  ) : (
                    <AppButton variant="ghost" title={t('explore.report')} disabled={busy} onPress={() => setReporting({ id: cm.id, reason: 'taciz' })} />
                  )}
                </View>
              )}
            </View>
          );
        })
      )}
      {error ? <FormMessage kind="error" text={error} /> : null}
      {post.commentsOff ? (
        <FormMessage kind="info" text={t('explore.comments.off')} />
      ) : (
        <>
          <TextField label={t('explore.comments.write')} value={text} onChangeText={setText} maxLength={COMMENT_LIMITS.text[1]} multiline />
          <AppButton title={t('explore.comments.send')} loading={busy} disabled={busy || !text.trim()} onPress={send} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  item: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  block: { gap: spacing.xs },
});
