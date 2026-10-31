import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  chatTitle,
  isListingLive,
  isRequestFor,
  MESSAGE_LIMITS,
  MESSAGE_REPORT_REASONS,
  scamSignal,
  threadId,
  validateMessage,
  type Chat,
  type ChatContext,
  type ChatMessage,
  type MessageReportReason,
  type PublicProfile,
  unreadKey,
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
import { businessRepository, listingRepository, messageRepository, socialRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { setBlocked, useSocial } from '@/lib/social';
import { fonts, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Birebir sohbet (PROJE.md 5.11). İlk mesaj sohbeti açar: takipleşmiyorlarsa alıcıda "mesaj isteği" olur. Mesaja
 * dokununca: kendi mesajında "Sil", karşı tarafınkinde "Şikâyet et". IBAN, kapora ya da bağlantı geçen mesajın altında
 * dolandırıcılık uyarısı çıkar. Engel varsa yazma kapanır.
 *
 * İşletmeye yazılan sohbet ayrı bir sohbettir: işletme sayfasından `business` ile açılır (ilk mesajı müşteri atar, istek
 * aşaması yok), sonra `thread` (sohbet kimliği) ile. Çarşı ilanı için açılan sohbet de öyle: ilan sayfasından `listing` ile
 * açılır, alıcı başlatır, iki tarafta Mesajlar > Çarşı'da durur; üstte güvenli alışveriş uyarısı. Sağ üstteki seçeneklerde
 * profil / işletme / ilan, "Sohbeti sil" ve engelle var.
 */
export default function ChatScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language, rtl } = useSettings();
  const lang = language ?? 'tr';
  const { uid: other, business, listing, thread } = useLocalSearchParams<{ uid: string; business?: string; listing?: string; thread?: string }>();
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
  const [options, setOptions] = useState<'menu' | 'confirmDelete' | null>(null);
  // İşletme ya da ilan sayfasından açılan yeni sohbetin konusu (yayında olmalı ve karşı taraf sahibi).
  const [biz, setBiz] = useState<ChatContext | null | undefined>(business || listing ? undefined : null);
  const scroll = useRef<ScrollViewInstance>(null);
  const topic: Pick<ChatContext, 'type' | 'id'> | null = business ? { type: 'isletme', id: business } : listing ? { type: 'ilan', id: listing } : null;
  const id = thread ?? (me && other ? threadId(me, other, topic) : '');
  const iBlocked = blocked.has(other ?? '');

  useEffect(() => {
    if (!me || !other) return;
    socialRepository.getProfile(other).then(setProfile, () => setProfile(null));
    if (business) {
      businessRepository.get(business).then(
        (b) => setBiz(b && b.status === 'yayinda' && b.ownerUid === other ? { type: 'isletme', id: b.id, title: b.name } : null),
        () => setBiz(null),
      );
    } else if (listing) {
      listingRepository.get(listing).then(
        (l) => setBiz(l && isListingLive(l) && l.ownerUid === other ? { type: 'ilan', id: l.id, title: l.title } : null),
        () => setBiz(null),
      );
    }
    socialRepository.isBlockedBy(me, other).then(setBlockedMe, () => {});
    // Takipleşiyorlarsa sohbet baştan açık başlar (istek olmaz).
    Promise.all([socialRepository.followState(me, other), socialRepository.followState(other, me)]).then(
      ([a, b]) => setMutual(a === 'aktif' && b === 'aktif'),
      () => {},
    );
    return messageRepository.watchChat(id, setChat, () => setChat(null));
  }, [me, other, business, listing, id]);

  const exists = !!chat;
  // Sohbeti sildiysem, silmeden önceki mesajlar görünmez.
  const hiddenAt = chat?.hidden[me];
  useEffect(() => {
    if (!exists || !id) return;
    return messageRepository.watchMessages(id, setMessages, () => setMessages((m) => m ?? []), hiddenAt);
  }, [exists, id, hiddenAt]);

  const context = chat ? chat.context ?? null : biz ?? null;
  const isBiz = context?.type === 'isletme';
  const isListing = context?.type === 'ilan';
  // Müşteri işletmeyle yazışıyor (sahibi değil): başlıkta işletmenin adı, seçeneklerde işletme sayfası.
  const asCustomer = isBiz && (chat ? chat.startedBy === me : true);
  const businessSide = isBiz && !asCustomer;

  // Açık sohbette okunmamışlar sıfırlanır. Okundu bilgisi açıksa "gördüm" yazılır; mesaj isteğinde yazılmaz (gönderen,
  // istek kabul edilene kadar okunduğunu bilmez).
  useEffect(() => {
    if (!chat || !me || !chat.last) return;
    // İşletme ekibindeki yetkili sohbetin üyesi değildir: işletmenin ortak sayacını sıfırlar, "gördüm" yazmaz.
    const sendSeen = receipts && chat.accepted && chat.members.includes(me);
    const unread = (chat.unread[unreadKey(chat, me)] ?? 0) > 0;
    const unseen = sendSeen && chat.last.from !== me && (!chat.seen[me] || chat.seen[me] < chat.last.at);
    if (unread || unseen) messageRepository.markRead(chat, me, sendSeen).catch(() => {});
  }, [chat, me, receipts]);

  const send = async () => {
    const body = text.trim();
    if (validateMessage(body) || !other) return;
    if (hasBanned(body)) return setError(t('messages.banned'));
    if (!myProfile || (!profile && !context)) return;
    setBusy(true);
    setError(undefined);
    try {
      await messageRepository.send(me, other, body, { chat: chat ?? null, myName: myProfile.displayName, otherName: profile?.displayName ?? '', mutual, context: context ?? undefined });
      setText('');
    } catch {
      setError(chat ? t('messages.sendError') : isListing ? t('messages.listingStartError') : context ? t('messages.businessStartError') : t('messages.startError'));
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

  const hide = () =>
    run(async () => {
      await messageRepository.hide(chat!, me);
      router.back();
    });

  const title = chat ? chatTitle(chat, me) : asCustomer ? context!.title : profile?.displayName ?? t('messages.title');
  const header = (
    <HeroHeader
      title={title}
      subtitle={isListing ? t('messages.aboutListing', { title: context!.title }) : businessSide ? t('messages.aboutBusiness', { name: context!.title }) : undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/messages'))}
      right={{ icon: 'more-vert', label: t('messages.options'), onPress: () => setOptions(options ? null : 'menu') }}
    />
  );

  if (!user || profile === undefined || chat === undefined || biz === undefined) return <Screen header={header}><StateMessage kind="loading" /></Screen>;
  if ((business || listing) && !chat && !biz) return <Screen header={header}><StateMessage kind="empty" message={t(listing ? 'messages.listingUnavailable' : 'messages.businessUnavailable')} /></Screen>;
  if ((!profile && !context) || other === me) return <Screen header={header}><StateMessage kind="empty" message={t('messages.notFound')} /></Screen>;

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
          {options ? (
            <View style={[styles.notice, { backgroundColor: c.surface, borderColor: c.border }]}>
              {options === 'confirmDelete' ? (
                <>
                  <AppText>{t('messages.deleteChatConfirm')}</AppText>
                  <View style={styles.actions}>
                    <AppButton title={t('messages.deleteChatYes')} loading={busy} disabled={busy} onPress={hide} />
                    <AppButton variant="ghost" title={t('messages.cancel')} onPress={() => setOptions(null)} />
                  </View>
                </>
              ) : (
                <View style={styles.actions}>
                  {isListing ? (
                    <AppButton variant="ghost" title={t('messages.openListing')} onPress={() => router.push({ pathname: '/carsi/[id]', params: { id: context!.id } })} />
                  ) : null}
                  {asCustomer ? (
                    <AppButton variant="ghost" title={t('messages.openBusiness')} onPress={() => router.push({ pathname: '/business/[id]', params: { id: context!.id } })} />
                  ) : profile ? (
                    <AppButton variant="ghost" title={t('messages.openProfile')} onPress={() => router.push({ pathname: '/u/[uid]', params: { uid: other! } })} />
                  ) : null}
                  {chat && chat.members.includes(me) ? <AppButton variant="ghost" title={t('messages.deleteChat')} onPress={() => setOptions('confirmDelete')} /> : null}
                  {!iBlocked ? <AppButton variant="ghost" title={t('messages.block')} disabled={busy} onPress={block} /> : null}
                </View>
              )}
            </View>
          ) : null}
          {request ? (
            <View style={[styles.notice, { backgroundColor: c.accentSoft, borderColor: c.accentBorder }]}>
              <AppText>{t('messages.requestNotice', { name: title })}</AppText>
              <View style={styles.actions}>
                <AppButton title={t('messages.accept')} disabled={busy} onPress={() => run(() => messageRepository.accept(chat!.id))} />
                <AppButton variant="ghost" title={t('messages.block')} disabled={busy} onPress={block} />
              </View>
            </View>
          ) : null}
          {isListing ? (
            <View style={[styles.warn, { borderColor: c.accentBorder }]}>
              <MaterialIcons name="shield" size={18} color={c.textMuted} />
              <AppText variant="caption" style={styles.grow}>{t('carsi.safety.chat')}</AppText>
            </View>
          ) : null}
          {pendingMine ? <AppText variant="caption" muted style={styles.center}>{t('messages.pendingNotice')}</AppText> : null}
          {!chat ? <AppText variant="caption" muted style={styles.center}>{isListing ? t('messages.newListing') : context ? t('messages.newBusiness') : mutual ? t('messages.newChat') : t('messages.newRequest')}</AppText> : null}
          {chat && messages === null ? <StateMessage kind="loading" /> : null}

          {(messages ?? []).map((m) => {
            // İşletme tarafında (sahip ya da yetkili) müşteri dışındaki herkesin mesajı işletmenin mesajıdır.
            const own = m.from === me;
            const mine = own || (businessSide && m.from !== other);
            const team = mine && !own;
            const gone = m.status !== 'aktif';
            const signal = !mine && !gone ? scamSignal(m.text) : null;
            const open = selected === m.id && !gone;
            return (
              <View key={m.id} style={[styles.msgWrap, mine ? styles.mine : styles.theirs]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint={team ? undefined : t(own ? 'messages.tapOwn' : 'messages.tapOther')}
                  onPress={() => {
                    setSelected(open ? null : m.id);
                    setReporting(null);
                  }}
                  style={[styles.bubble, { backgroundColor: mine ? c.primary : c.surface, borderColor: mine ? c.primary : c.border }]}>
                  <AppText style={[gone && styles.italic, { color: mine ? c.onPrimary : gone ? c.textMuted : c.textStrong }]}>
                    {gone ? t(m.status === 'silindi' ? 'messages.deleted' : 'messages.removed') : m.text}
                  </AppText>
                  <AppText variant="caption" style={{ color: mine ? c.onPrimary : c.textMuted, opacity: 0.8 }}>{team ? `${t('messages.fromTeam')} · ` : ''}{time(m.createdAt)}</AppText>
                </Pressable>
                {signal ? (
                  <View style={[styles.warn, { borderColor: c.danger }]}>
                    <MaterialIcons name="warning-amber" size={18} color={c.danger} />
                    <AppText variant="caption" style={styles.grow}>{t(`messages.scam.${signal}`)}</AppText>
                  </View>
                ) : null}
                {open && own ? (
                  <AppButton variant="ghost" title={t('messages.delete')} disabled={busy} onPress={() => run(async () => {
                    await messageRepository.deleteMessage(chat!, m);
                    setSelected(null);
                  })} />
                ) : null}
                {open && !mine && !team ? (
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
