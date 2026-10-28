import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, type ComponentProps } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { useSignOut } from '@/lib/sign-out';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';
import { useReduceMotion } from './scene-art';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
interface Item {
  key: string;
  label: string;
  icon: IconName;
  href?: Href;
  danger?: boolean;
  onPress?(): void;
}

/**
 * Ana sayfadaki yan menü (tasarım: anasayfa.html): modüller ve hesap kısayolları. Soldan açılır (Arapçada sağdan),
 * dışına dokunmak ya da geri tuşu kapatır. "Hareketi azalt" açıksa kayma olmadan açılır.
 */
export function SideMenu({ open, onClose }: { open: boolean; onClose(): void }) {
  const reduceMotion = useReduceMotion();
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { rtl } = useSettings();
  const { user, profile } = useSession();
  const signOut = useSignOut();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(300, width * 0.78);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!open) return;
    slide.setValue(reduceMotion ? 1 : 0);
    if (!reduceMotion) Animated.timing(slide, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [open, reduceMotion, slide]);

  const go = (href: Href) => {
    onClose();
    router.push(href);
  };
  const modules: Item[] = [
    { key: 'myCity', label: t('modules.myCity'), icon: 'location-city', href: '/city' },
    { key: 'travel', label: t('modules.travel'), icon: 'explore' },
    { key: 'social', label: t('modules.social'), icon: 'groups', href: '/social' },
    { key: 'urgent', label: t('modules.urgent'), icon: 'emergency', href: '/urgent', danger: true },
    { key: 'explore', label: t('modules.explore'), icon: 'dynamic-feed', href: '/explore' },
  ];
  const account: Item[] = user
    ? [
        { key: 'profile', label: t('menu.profile'), icon: 'person-outline', href: { pathname: '/u/[uid]', params: { uid: user.uid } } },
        { key: 'messages', label: t('messages.title'), icon: 'chat-bubble-outline', href: '/messages' },
        { key: 'saved', label: t('explore.saved'), icon: 'bookmark-border', href: '/explore/saved' },
        { key: 'notifications', label: t('notifications.title'), icon: 'notifications-none', href: '/notifications' },
        { key: 'settings', label: t('menu.settings'), icon: 'settings', href: '/account' },
        { key: 'signOut', label: t('account.signOut'), icon: 'logout', onPress: () => { onClose(); signOut(); } },
      ]
    : [{ key: 'settings', label: t('home.changeLanguage'), icon: 'translate', href: '/language' }];

  const row = (item: Item) => {
    const disabled = !item.href && !item.onPress;
    return (
      <Pressable
        key={item.key}
        accessibilityRole="button"
        accessibilityLabel={disabled ? `${item.label}. ${t('home.comingSoon')}` : item.label}
        disabled={disabled}
        onPress={item.onPress ?? (item.href ? () => go(item.href!) : undefined)}
        style={({ pressed }) => [styles.row, { opacity: disabled ? 0.5 : pressed ? 0.7 : 1, backgroundColor: pressed ? c.surfaceStrong : 'transparent' }]}>
        <View style={[styles.rowIcon, { backgroundColor: item.danger ? c.dangerSoft : c.accentSoft }]}>
          <MaterialIcons name={item.icon} size={18} color={item.danger ? c.danger : c.icon} />
        </View>
        <AppText style={[styles.rowText, { color: c.textStrong }]}>{item.label}</AppText>
        {disabled ? <AppText variant="caption" muted>{t('menu.soon')}</AppText> : null}
      </Pressable>
    );
  };

  const offset = slide.interpolate({ inputRange: [0, 1], outputRange: [rtl ? panelWidth : -panelWidth, 0] });
  const name = (profile?.displayName ?? user?.displayName ?? '').trim();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <Animated.View
          accessibilityViewIsModal
          style={[styles.panel, { width: panelWidth, backgroundColor: c.background, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md, transform: [{ translateX: offset }] }]}>
          <View style={styles.head}>
            <View style={[styles.avatar, { backgroundColor: c.surfaceStrong }]}>
              <MaterialIcons name="person" size={22} color={c.accent} />
            </View>
            <View style={styles.flex}>
              <AppText numberOfLines={1} style={[styles.name, { color: c.textStrong }]}>{name || 'CityJoy'}</AppText>
              {user?.email ? <AppText variant="caption" muted numberOfLines={1}>{user.email}</AppText> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('menu.close')} onPress={onClose} hitSlop={8} style={styles.close}>
              <MaterialIcons name="close" size={24} color={c.textMuted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            <AppText variant="caption" muted style={styles.group}>{t('menu.modules')}</AppText>
            {modules.map(row)}
            <AppText variant="caption" muted style={styles.group}>{t('menu.account')}</AppText>
            {account.map(row)}
          </ScrollView>
        </Animated.View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('menu.close')} onPress={onClose} style={styles.scrim} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  panel: { paddingHorizontal: spacing.md, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 42, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 21 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  list: { gap: 2, paddingBottom: spacing.lg },
  group: { marginTop: spacing.sm, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  rowIcon: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14 },
});
