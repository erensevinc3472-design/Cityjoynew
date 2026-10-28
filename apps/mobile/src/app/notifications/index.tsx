import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isUnread, markRead, type AppNotification, type NotificationCategory } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { useNotificationFeed, useReadState } from '@/lib/notifications';
import { useSettings } from '@/lib/settings';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
const ICONS: Record<NotificationCategory, IconName> = {
  acil: 'campaign',
  sos: 'sos',
  mesaj: 'chat-bubble-outline',
  takip: 'person-add-alt',
  duyuru: 'notifications-none',
  haber: 'newspaper',
  etkinlik: 'event',
};

/**
 * Bildirim merkezi (PROJE.md 5.12): son 14 günün duyuru, kurum haberi, etkinlik, mesaj, takip ve SOS olayları;
 * okunmamışlar vurgulu. Hangi türlerin görüneceği ve sessiz saatler ayarlardan seçilir.
 */
export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const list = useNotificationFeed(true);
  const [read, setRead] = useReadState();
  const unread = (list ?? []).filter((n) => isUnread(n, read));

  const open = (n: AppNotification) => {
    setRead(markRead(read, n.id));
    router.push(n.href as Href);
  };
  const when = (iso: string) => {
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString(lang, { day: 'numeric', month: 'short' });
  };

  const header = (
    <HeroHeader
      title={t('notifications.title')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
      right={{ icon: 'tune', label: t('notifications.settings'), onPress: () => router.push('/notifications/settings') }}
    />
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content}>
        {unread.length ? (
          <AppButton variant="ghost" title={t('notifications.markAll')} onPress={() => setRead({ until: new Date().toISOString(), ids: [] })} />
        ) : null}
        {list === null ? (
          <StateMessage kind="loading" />
        ) : list.length === 0 ? (
          <StateMessage kind="empty" message={t('notifications.empty')} />
        ) : (
          list.map((n) => {
            const fresh = isUnread(n, read);
            const critical = n.category === 'acil' || n.category === 'sos';
            return (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                accessibilityLabel={`${fresh ? `${t('notifications.unread')}. ` : ''}${t(`notifications.categories.${n.category}`)}. ${n.title}${n.body ? `. ${n.body}` : ''}`}
                onPress={() => open(n)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: fresh ? c.accentSoft : c.surface, borderColor: critical ? c.danger : fresh ? c.accentBorder : c.border, opacity: pressed ? 0.85 : 1 },
                ]}>
                <View style={[styles.icon, { backgroundColor: critical ? c.dangerSoft : c.surfaceStrong }]}>
                  <MaterialIcons name={ICONS[n.category]} size={20} color={critical ? c.danger : c.icon} />
                </View>
                <View style={styles.texts}>
                  <View style={styles.line}>
                    <AppText variant="caption" muted style={styles.grow}>{t(`notifications.categories.${n.category}`)}</AppText>
                    <AppText variant="caption" muted>{when(n.at)}</AppText>
                  </View>
                  <AppText variant={fresh ? 'label' : undefined} numberOfLines={2}>{n.title}</AppText>
                  {n.body ? <AppText variant="caption" muted numberOfLines={1}>{n.body}</AppText> : null}
                </View>
                {fresh ? <View style={[styles.dot, { backgroundColor: c.primary }]} /> : null}
              </Pressable>
            );
          })
        )}
        <AppText variant="caption" muted>{t('notifications.pushNote')}</AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  icon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
