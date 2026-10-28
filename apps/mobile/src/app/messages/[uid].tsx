import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  chatId,
  isRequestFor,
  MESSAGE_LIMITS,
  MESSAGE_REPORT_REASONS,
  scamSignal,
  validateMessage,
  type Chat,
  type ChatMessage,
  type MessageReportReason,
  type PublicProfile,
} from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useBannedWordCheck } from '@/lib/banned-words';
import { useReadReceipts } from '@/lib/messages';
import { messageRepository, socialRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { setBlocked, useSocial } from '@/lib/social';
import { fonts, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Birebir sohbet (PROJE.md 5.11). İlk mesaj sohbeti açar: takipleşmiyorlarsa alıcıda "mesaj isteği" olur. Mesaja
 * dokununca: kendi mesajında "Sil", karşı tarafınkinde "Şikâyet et". IBAN, kapora ya da bağlantı geçen mesajın altında
 * dolandırıcılık uyarısı çıkar. Engel varsa yazma kapanır.
 */
export default function ChatScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language, rtl } = useSettings();
  const lang = language ?? 'tr';
  const { uid: other } = useLocalSearchParams<{ uid: string }>();
  const { user } = useSession();
  const me = user?.uid ?? '';
  const { me: myProfile, blocked } = useSocial();
  const [receipts] = useReadReceipts();
  const hasBanned = useBannedWordCheck();

  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [chat, setChat] = useState<Chat | null | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [blockedMe, setBlockedMe] = useState(false);
  const [mutual, setMutual] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<string | null>(null);
  const [reporting, setReporting] = useState<MessageReportReason | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const scroll = useRef<ScrollViewInstance>(null);
  const id = me && other ? chatId(me, other) : '';
  const iBlocked = blocked.has(other ?? '');

  useEffect(() => {
    if (!me || !other) return;
    socialRepository.getProfile(other).then(setProfile, () => setProfile(null));
    socialRepository.isBlockedBy(me, other).then(setBlockedMe, () => {});
    // Takipleşiyorlarsa sohbet baştan açık başlar (istek olmaz).
    Promise.all([socialRepository.followState(me, other), socialRepository.followState(other, me)]).then(
      ([a, b]) => setMutual(a === 'aktif' && b === 'aktif'),
      () => {},
    );
    return messageRepository.watchChat(chatId(me, other), setChat, () => setChat(null));
  }, [me, other]);

  const exists = !!chat;
  useEffect(() => {
    if (!exists || !id) return;
    return messageRepository.watchMessages(id, setMessages, () => setMessages((m) => m ?? []));
  }, [exists, id]);

  // Açık sohbette okunmamışlar sıfırlanır. Okundu bilgisi açıksa "gördüm" yazılır; mesaj isteğinde yazılmaz (gönderen,
  // istek kabul edilene kadar okunduğunu bilmez).
  useEffect(() => {
    if (!chat || !me || !chat.last) return;
    const sendSeen = receipts && chat.accepted;
    const unread = (chat.unread[me] ?? 0) > 0;
    const unseen = sendSeen && chat.last.from !== me && (!chat.seen[me] || chat.seen[me] < chat.last.at);
    if (unread || unseen) messageRepository.markRead(chat, me, sendSeen).catch(() => {});
  }, [chat, me, receipts]);

  const send = async () => {
    const body = text.trim();
    if (validateMessage(body) || !other) return;
    if (hasBanned(body)) return setError(t('messages.banned'));
    if (!myProfile || !profile) return;
    setBusy(true);
    setError(undefined);
    try {
      await messageRepository.send(me, other, body, { chat: chat ?? null, myName: myProfile.displayName, otherName: profile.displayName, mutual });
      setText('');
    } catch {
      setError(chat ? t('messages.sendError') : t('messages.startError'));
    } finally {
      setBusy(false);
    }
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch {
      setError(t('messages.actionError'));
    } finally {
      setBusy(false);
    }
  };

  const block = () =>
    run(async () => {
      await socialRepository.block(me, other!);
      setBlocked(me, other!, true);
      router.back();
    });

  const header = (
    <HeroHeader
      title={profile?.displayName ?? t('messages.title')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/messages'))}
      right={profile ? { icon: 'person-outline', label: t('messages.openProfile'), onPress: () => router.push({ pathname: '/u/[uid]', params: { uid: other! } }) } : undefined}
    />
  );

  if (!user || profile === undefined || chat === undefined) return <Screen header={header}><StateMessage kind="loading" /></Screen>;
  if (!profile || other === me) return <Screen header={header}><StateMessage kind="empty" message={t('messages.notFound')} /></Screen>;

  const request = chat && isRequestFor(chat, me);
  const pendingMine = chat && !chat.accepted && chat.startedBy === me;
  const canWrite = !iBlocked && !blockedMe;
  const lastMine = [...(messages ?? [])].reverse().find((m) => m.from === me);
  const seenByOther = receipts && chat?.last && lastMine && chat.last.id === lastMine.id && chat.seen[other!] && chat.seen[other!] >= chat.last.at;
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });

  return (
    <Screen header={header}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroll}
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
          {request ? (
            <View style={[styles.notice, { backgroundColor: c.accentSoft, borderColor: c.accentBorder }]}>
              <AppText>{t('messages.requestNotice', { name: profile.displayName })}</AppText>
              <View style={styles.actions}>
                <AppButton title={t('messages.accept')} disabled={busy} onPress={() => run(() => messageRepository.accept(chat!.id))} />
                <AppButton variant="ghost" title={t('messages.block')} disabled={busy} onPress={block} />
              </View>
            </View>
          ) : null}
          {pendingMine ? <AppText variant="caption" muted style={styles.center}>{t('messages.pendingNotice')}</AppText> : null}
          {!chat ? <AppText variant="caption" muted style={styles.center}>{mutual ? t('messages.newChat') : t('messages.newRequest')}</AppText> : null}
          {chat && messages === null ? <StateMessage kind="loading" /> : null}

          {(messages ?? []).map((m) => {
            const mine = m.from === me;
            const gone = m.status !== 'aktif';
            const signal = !mine && !gone ? scamSignal(m.text) : null;
            const open = selected === m.id && !gone;
            return (
              <View key={m.id} style={[styles.msgWrap, mine ? styles.mine : styles.theirs]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint={t(mine ? 'messages.tapOwn' : 'messages.tapOther')}
                  onPress={() => {
                    setSelected(open ? null : m.id);
                    setReporting(null);
                  }}
                  style={[styles.bubble, { backgroundColor: mine ? c.primary : c.surface, borderColor: mine ? c.primary : c.border }]}>
                  <AppText style={[gone && styles.italic, { color: mine ? c.onPrimary : gone ? c.textMuted : c.textStrong }]}>
                    {gone ? t(m.status === 'silindi' ? 'messages.deleted' : 'messages.removed') : m.text}
                  </AppText>
                  <AppText variant="caption" style={{ color: mine ? c.onPrimary : c.textMuted, opacity: 0.8 }}>{time(m.createdAt)}</AppText>
                </Pressable>
                {signal ? (
                  <View style={[styles.warn, { borderColor: c.danger }]}>
                    <MaterialIcons name="warning-amber" size={18} color={c.danger} />
                    <AppText variant="caption" style={styles.grow}>{t(`messages.scam.${signal}`)}</AppText>
                  </View>
                ) : null}
                {open && mine ? (
                  <AppButton variant="ghost" title={t('messages.delete')} disabled={busy} onPress={() => run(async () => {
                    await messageRepository.deleteMessage(chat!, m);
                    setSelected(null);
                  })} />
                ) : null}
                {open && !mine ? (
                  reported.has(m.id) ? (
                    <AppText variant="caption" muted>{t('messages.reported')}</AppText>
                  ) : reporting ? (
                    <View style={styles.report}>
                      <AppText variant="label">{t('messages.reportTitle')}</AppText>
                      <Chips<MessageReportReason> label={t('messages.reportTitle')} value={reporting} onChange={setReporting} options={MESSAGE_REPORT_REASONS.map((r) => ({ value: r, label: t(`messages.reasons.${r}`) }))} />
                      <AppButton title={t('messages.reportSend')} loading={busy} disabled={busy} onPress={() => run(async () => {
                        await messageRepository.report(chat!, m, me, reporting);
                        setReported((s) => new Set(s).add(m.id));
                        setReporting(null);
                      })} />
                    </View>
                  ) : (
                    <AppButton variant="ghost" title={t('messages.report')} onPress={() => setReporting('taciz')} />
                  )
                ) : null}
              </View>
            );
          })}
          {seenByOther ? <AppText variant="caption" muted style={rtl ? styles.start : styles.end}>{t('messages.seen')}</AppText> : null}
        </ScrollView>

        {error ? <FormMessage kind="error" text={error} /> : null}
        {canWrite ? (
          <View style={[styles.composer, { borderColor: c.border, backgroundColor: c.surfaceStrong }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('messages.placeholder')}
              placeholderTextColor={c.textMuted}
              accessibilityLabel={t('messages.placeholder')}
              multiline
              maxLength={MESSAGE_LIMITS.text[1]}
              style={[styles.input, { color: c.textStrong, textAlign: rtl ? 'right' : 'left' }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('messages.send')}
              disabled={busy || !!validateMessage(text) || !myProfile}
              onPress={send}
              style={({ pressed }) => [styles.sendBtn, { backgroundColor: c.primary, opacity: busy || validateMessage(text) ? 0.5 : pressed ? 0.85 : 1 }]}>
              <MaterialIcons name="send" size={22} color={c.onPrimary} style={rtl ? styles.flip : undefined} />
            </Pressable>
          </View>
        ) : (
          <AppText variant="caption" muted style={styles.center}>{iBlocked ? t('messages.youBlocked') : t('messages.cannotWrite')}</AppText>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.sm, paddingBottom: spacing.md },
  center: { textAlign: 'center' },
  start: { textAlign: 'left' },
  end: { textAlign: 'right' },
  notice: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  actions: { gap: spacing.xs },
  msgWrap: { maxWidth: '85%', gap: spacing.xs },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1, gap: 2 },
  italic: { fontStyle: 'italic' },
  warn: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start', padding: spacing.sm, borderWidth: 1, borderRadius: radius.sm },
  grow: { flex: 1 },
  report: { gap: spacing.sm },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.sm, borderWidth: 1, borderRadius: radius.lg, marginBottom: spacing.sm },
  input: { flex: 1, minHeight: MIN_TOUCH, maxHeight: 140, fontFamily: fonts.body, fontSize: 16, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  sendBtn: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  flip: { transform: [{ scaleX: -1 }] },
});
