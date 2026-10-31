import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { chatTitle, foldForSearch, inboxSection, isHiddenFor, otherMember, type Chat, type InboxSection } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { CheckboxRow } from '@/components/checkbox-row';
import { Chips } from '@/components/chips';
import { RoundButton } from '@/components/hero-header';
import { SearchField } from '@/components/search-field';
import { TopBar } from '@/components/top-bar';
import { StateMessage } from '@/components/state-message';
import { chatHref, useChats, useReadReceipts } from '@/lib/messages';
import { businessRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { useSocial } from '@/lib/social';
import { GUTTER, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Mesajlar (PROJE.md 5.11; profilin sağ üstünden açılır, 13. madde 31): üstte kullanıcı adım ve yeni mesaj düğmesi, altında
 * sohbetlerde arama. Sohbetlerim, mesaj istekleri (takipleşmediğim kişilerden gelen, kabul etmediğim) ve işletmesi olan
 * kişide "İşletmem" (müşterilerin işletmeme yazdıkları). Engellediklerim ve sildiğim sohbetler listede görünmez. Okundu bilgisi buradan kapatılır.
 */
export default function MessagesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { user, profile } = useSession();
  const me = user?.uid ?? '';
  const { chats, failed } = useChats(user?.uid);
  const { blocked, me: myProfile } = useSocial();
  const [receipts, setReceipts] = useReadReceipts();
  const [tab, setTab] = useState<InboxSection>('sohbetler');
  const [find, setFind] = useState('');
  const [hasBusiness, setHasBusiness] = useState(false);

  useEffect(() => {
    if (!me) return;
    businessRepository.listMine(me).then((l) => setHasBusiness(l.length > 0), () => {});
  }, [me]);

  const visible = (chats ?? []).filter((x) => !blocked.has(otherMember(x, me)) && !isHiddenFor(x, me));
  const count = (s: InboxSection) => visible.filter((x) => inboxSection(x, me) === s).length;
  const unreadIn = (s: InboxSection) => visible.some((x) => inboxSection(x, me) === s && (x.unread[me] ?? 0) > 0);
  const needle = foldForSearch(find.trim());
  const shown = visible.filter((x) => inboxSection(x, me) === tab && (!needle || foldForSearch(chatTitle(x, me)).includes(needle)));
  const tabLabel = (s: InboxSection, label: string, n?: number) => `${label}${n ? ` (${n})` : ''}${unreadIn(s) && s !== tab ? ' •' : ''}`;

  const when = (iso: string) => {
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString(lang, { day: 'numeric', month: 'short' });
  };
  const preview = (x: Chat) =>
    !x.last ? '' : x.last.text ? `${x.last.from === me ? `${t('messages.you')}: ` : ''}${x.last.text}` : t('messages.deleted');

  const title = myProfile?.displayName ?? profile?.displayName ?? t('messages.title');

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <TopBar
        title={title}
        left={<RoundButton icon="arrow-back" label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/me'))} />}
        right={user ? <RoundButton icon="edit-square" label={t('messages.newMessage')} onPress={() => router.push('/messages/new')} /> : undefined} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <SearchField value={find} onChangeText={setFind} placeholder={t('messages.searchChats')} />
        <Chips<InboxSection>
          label={t('messages.title')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'sohbetler', label: tabLabel('sohbetler', t('messages.chats')) },
            { value: 'istekler', label: tabLabel('istekler', t('messages.requests'), count('istekler')) },
            ...(hasBusiness || count('isletmem') ? [{ value: 'isletmem' as const, label: tabLabel('isletmem', t('messages.business')) }] : []),
          ]}
        />
        {tab === 'istekler' ? <AppText variant="caption" muted>{t('messages.requestsIntro')}</AppText> : null}
        {tab === 'isletmem' ? <AppText variant="caption" muted>{t('messages.businessIntro')}</AppText> : null}
        {failed && !chats?.length ? (
          <StateMessage kind="error" message={t('messages.loadError')} />
        ) : chats === null ? (
          <StateMessage kind="loading" />
        ) : shown.length === 0 ? (
          <StateMessage kind="empty" message={needle ? t('messages.noMatch') : tab === 'istekler' ? t('messages.noRequests') : tab === 'isletmem' ? t('messages.noBusinessChats') : t('messages.empty')} />
        ) : (
          shown.map((x) => {
            const name = chatTitle(x, me);
            // İşletme sohbetinde: müşteri işletmenin adını, sahibi müşterinin adını ve altında işletmesini görür.
            const about = x.context && x.startedBy !== me ? x.context.title : null;
            const unread = x.unread[me] ?? 0;
            return (
              <Pressable
                key={x.id}
                accessibilityRole="button"
                accessibilityLabel={`${name}. ${about ? `${about}. ` : ''}${preview(x)}${unread ? `. ${t('messages.unread', { count: unread })}` : ''}`}
                onPress={() => router.push(chatHref(x, me))}
                style={({ pressed }) => [styles.row, { backgroundColor: c.surface, borderColor: unread ? c.accentBorder : c.border, opacity: pressed ? 0.85 : 1 }]}>
                <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
                  {x.context && x.startedBy === me ? (
                    <MaterialIcons name="storefront" size={20} color={c.textStrong} />
                  ) : (
                    <AppText variant="label">{name.slice(0, 1)}</AppText>
                  )}
                </View>
                <View style={styles.texts}>
                  <View style={styles.line}>
                    <AppText variant="label" numberOfLines={1} style={styles.grow}>{name}</AppText>
                    {x.last ? <AppText variant="caption" muted>{when(x.last.at)}</AppText> : null}
                  </View>
                  {about ? <AppText variant="caption" muted numberOfLines={1}>{t('messages.aboutBusiness', { name: about })}</AppText> : null}
                  <View style={styles.line}>
                    <AppText variant="caption" muted={!unread} numberOfLines={1} style={styles.grow}>{preview(x)}</AppText>
                    {unread ? (
                      <View style={[styles.badge, { backgroundColor: c.primary }]}>
                        <AppText variant="caption" style={{ color: c.onPrimary }}>{unread > 99 ? '99+' : unread}</AppText>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
        <CheckboxRow checked={receipts} onToggle={() => setReceipts(!receipts)} label={t('messages.readReceipts')} />
        <AppText variant="caption" muted>{t('messages.readReceiptsNote')}</AppText>
        <AppText variant="caption" muted>{t('messages.safetyNote')}</AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: spacing.md, padding: GUTTER, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
});
