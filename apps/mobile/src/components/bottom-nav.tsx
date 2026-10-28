import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { fonts, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
export type TabKey = 'home' | 'explore' | 'search' | 'profile';

const TABS: { key: TabKey; icon: IconName; href: Href }[] = [
  { key: 'home', icon: 'home', href: '/home' },
  { key: 'explore', icon: 'explore', href: '/explore' },
  { key: 'search', icon: 'search', href: '/search' },
  { key: 'profile', icon: 'person-outline', href: '/account' },
];

/**
 * Alt gezinme çubuğu (PROJE.md 5, 13. madde 29): Ana Sayfa, Keşfet, Ara, Profil. Dört ana ekranın altında durur;
 * sekmeler arasında geçişte yığın büyümesin diye ekran değiştirilir, geri tuşu ana sayfaya döner.
 */
export function BottomNav({ active }: { active: TabKey }) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: c.background, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.inner}>
        {TABS.map((tab) => {
          const selected = tab.key === active;
          const color = selected ? c.accent : c.textMuted;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`nav.${tab.key}`)}
              onPress={() => {
                if (selected) return;
                if (tab.key === 'home') router.dismissTo('/home');
                else if (active === 'home') router.push(tab.href);
                else router.replace(tab.href);
              }}
              style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.7 : 1 }]}>
              <MaterialIcons name={tab.icon} size={24} color={color} />
              <AppText numberOfLines={1} style={[styles.label, { color }]}>{t(`nav.${tab.key}`)}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1, paddingTop: 6 },
  inner: { flexDirection: 'row', width: '100%', maxWidth: 640, alignSelf: 'center' },
  tab: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16 },
});
