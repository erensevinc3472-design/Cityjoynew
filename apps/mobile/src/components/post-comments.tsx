import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { AvatarPhoto } from '@/components/avatar-photo';
import { TranslatableText } from '@/components/translatable-text';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { StateMessage } from '@/components/state-message';
import { TextField } from '@/components/text-field';
import { useBannedWordCheck } from '@/lib/banned-words';
import { patchCachedPost } from '@/lib/posts';
import { postRepository } from '@/lib/services';
import { useRelativeTime } from '@/lib/relative-time';
import { useSettings } from '@/lib/settings';
import { useSocial } from '@/lib/social';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { errorText } from '@/lib/limits';
import { useAuthor } from '@/lib/profile-photos';

interface Props {
  post: Post;
  uid: string;
  displayName: string | undefined;
  /** Yorum sayısı değişince ayrıntı ekranı kartı günceller. */
  onCount(count: number): void;
  /**
   * 'sheet': alttan açılan yorum penceresi (Eren, 12 Kasım 2026, Instagram örneği). Sade satırlar (avatar, ad, zaman,
   * yazı), altta sabit emoji satırı ve yazma kutusu. 'page' (varsayılan): gönderi sayfasındaki kutulu liste.
   */
  variant?: 'page' | 'sheet';
  /** Pencere "Yorum ekle..." ile açıldıysa yazma kutusu hemen odaklanır. */
  autoFocus?: boolean;
}

const EMOJIS = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];

/**
 * Gönderi yorumları (Keşfet kuralları madde 3): eskiden yeniye ilk 50 yorum, yazma (yorumlar açıksa), yazanın ve
 * gönderi sahibinin silmesi, başkasının yorumunu şikâyet. Üç şikâyet alan yorum, moderatör bakana kadar gizlenir.
 */
export function PostComments({ post, uid, displayName, onCount, variant = 'page', autoFocus }: Props) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const ago = useRelativeTime();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [list, setList] = useState<PostComment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reporting, setReporting] = useState<{ id: string; reason: PostReportReason } | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const owner = post.authorUid === uid;
  const { blocked } = useSocial();
  const hasBanned = useBannedWordCheck();

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
    } catch (e) {
      setError(errorText(t, e, errKey));
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
    if (hasBanned(text)) return setError(t('explore.errors.banned'));
    run(async () => {
      const added = await postRepository.addComment(post.id, uid, authorNameOf(displayName), text);
      setList((l) => [...(l ?? []), added]);
      setText('');
      setCount(post.commentCount + 1);
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
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

  const reportBlock = (cm: PostComment) => (
    <View style={styles.block}>
      <Chips<PostReportReason>
        label={t('explore.reportTitle')}
        value={reporting?.reason ?? 'taciz'}
        onChange={(reason) => setReporting({ id: cm.id, reason })}
        options={POST_REPORT_REASONS.filter((r) => r !== 'emlak').map((r) => ({ value: r, label: t(`explore.reasons.${r}`) }))}
      />
      <AppButton title={t('explore.reportSend')} loading={busy} disabled={busy} onPress={() => report(cm)} />
      <AppButton variant="ghost" title={t('account.cancel')} onPress={() => setReporting(null)} />
    </View>
  );

  if (variant === 'sheet') {
    const canSend = !busy && !!text.trim();
    return (
      <View style={styles.flex}>
        <ScrollView ref={scroller} style={styles.flex} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetList}>
          {failed ? (
            <StateMessage kind="error" message={t('explore.comments.loadError')} onRetry={load} />
          ) : list === null ? (
            <StateMessage kind="loading" />
          ) : shown.length === 0 ? (
            <AppText variant="caption" muted style={styles.center}>{t('explore.comments.empty')}</AppText>
          ) : (
            shown.map((cm) => {
              const mine = cm.authorUid === uid;
              return (
                <View key={cm.id} style={styles.row}>
                  <Avatar uid={cm.authorUid} fallback={cm.authorName} size={34} />
                  <View style={styles.flex}>
                    <AppText style={[styles.rowHead, { color: c.textMuted }]}>
                      <AppText style={[styles.rowName, { color: c.textStrong }]}>
                        <AuthorName uid={cm.authorUid} fallback={cm.authorName} />
                      </AppText>
                      {'  '}
                      {ago(cm.createdAt)}
                    </AppText>
                    <TranslatableText selectable text={cm.text} style={[styles.rowText, { color: c.text }]} />
                    {reporting?.id === cm.id ? (
                      reportBlock(cm)
                    ) : (
                      <View style={styles.links}>
                        {mine || owner ? (
                          <AppText
                            accessibilityRole="button"
                            accessibilityLabel={t('explore.comments.delete')}
                            onPress={busy ? undefined : () => remove(cm.id)}
                            style={[styles.link, { color: c.textMuted }]}>
                            {t('explore.comments.deleteShort')}
                          </AppText>
                        ) : null}
                        {mine ? null : reported.has(cm.id) ? (
                          <AppText style={[styles.link, { color: c.textSoft }]}>{t('explore.reported')}</AppText>
                        ) : (
                          <AppText
                            accessibilityRole="button"
                            onPress={busy ? undefined : () => setReporting({ id: cm.id, reason: 'taciz' })}
                            style={[styles.link, { color: c.textMuted }]}>
                            {t('explore.report')}
                          </AppText>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
        <View style={[styles.composer, { borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          {error ? <FormMessage kind="error" text={error} /> : null}
          {post.commentsOff ? (
            <FormMessage kind="info" text={t('explore.comments.off')} />
          ) : (
            <>
              <View style={styles.emojis}>
                {EMOJIS.map((e) => (
                  <Pressable
                    key={e}
                    accessibilityRole="button"
                    accessibilityLabel={t('explore.comments.emoji', { emoji: e })}
                    onPress={() => setText((x) => (x + e).slice(0, COMMENT_LIMITS.text[1]))}
                    hitSlop={4}
                    style={({ pressed }) => [styles.emoji, { opacity: pressed ? 0.6 : 1 }]}>
                    <AppText style={styles.emojiText}>{e}</AppText>
                  </Pressable>
                ))}
              </View>
              <View style={styles.inputRow}>
                <Avatar uid={uid} fallback={displayName ?? ''} size={34} />
                <View style={[styles.inputBox, { borderColor: c.border, backgroundColor: c.surface }]}>
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder={t('explore.comments.add')}
                    placeholderTextColor={c.textSoft}
                    accessibilityLabel={t('explore.comments.write')}
                    maxLength={COMMENT_LIMITS.text[1]}
                    multiline
                    autoFocus={autoFocus}
                    style={[styles.input, { color: c.textStrong }]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('explore.comments.send')}
                    accessibilityState={{ disabled: !canSend }}
                    disabled={!canSend}
                    onPress={send}
                    hitSlop={6}
                    style={[styles.send, { backgroundColor: canSend ? c.primary : c.surfaceStrong }]}>
                    <MaterialIcons name="arrow-upward" size={18} color={canSend ? c.onPrimary : c.textSoft} />
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    );
  }

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
                <AuthorName uid={cm.authorUid} fallback={cm.authorName} /> · {at.toLocaleDateString(lang, { day: 'numeric', month: 'short' })} {at.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
              </AppText>
              <TranslatableText selectable text={cm.text} />
              {reporting?.id === cm.id ? (
                reportBlock(cm)
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
  block: { gap: spacing.xs, marginTop: spacing.xs },
  flex: { flex: 1 },
  center: { textAlign: 'center', paddingVertical: spacing.xl },
  sheetList: { paddingHorizontal: GUTTER, paddingVertical: spacing.sm, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  rowHead: { fontSize: 12.5, lineHeight: 17 },
  rowName: { fontFamily: fonts.bodySemi, fontSize: 13 },
  rowText: { fontSize: 14.5, lineHeight: 20 },
  links: { flexDirection: 'row', gap: spacing.md, marginTop: 2 },
  link: { fontFamily: fonts.bodySemi, fontSize: 12, paddingVertical: 4 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: GUTTER, paddingTop: spacing.xs, gap: spacing.xs },
  emojis: { flexDirection: 'row', justifyContent: 'space-between' },
  emoji: { minWidth: 36, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 24, lineHeight: 30 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 44, borderWidth: 1, borderRadius: 22, paddingStart: 14, paddingEnd: 5, paddingVertical: 4 },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15, maxHeight: 110, paddingVertical: 6 },
  send: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});

/** Yorumu yazanın güncel adı (oturumda kişi başına bir okuma); okunamazsa yorumdaki ad. */
function AuthorName({ uid, fallback }: { uid: string; fallback: string }) {
  return <>{useAuthor(uid).displayName || fallback}</>;
}

/** Yorum satırındaki yuvarlak avatar: baş harf, varsa profil fotoğrafı üstte. */
function Avatar({ uid, fallback, size }: { uid: string; fallback: string; size: number }) {
  const c = useThemeColors();
  const name = useAuthor(uid).displayName || fallback || '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceStrong, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <AppText style={{ fontFamily: fonts.heading, fontSize: size * 0.42, color: c.accent }}>{name.slice(0, 1).toLocaleUpperCase()}</AppText>
      <AvatarPhoto uid={uid} size={size} />
    </View>
  );
}
