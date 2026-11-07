import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';

const SHOW_MS = 2800;

/**
 * Kısa süre görünüp kaybolan bilgi notu (ör. "Fırsatlar Pro üyelikte açılır"). Ekranın altında belirir, ekran okuyucu
 * da okur. Kullanım: `const toast = useToast();` → `toast.show(metin)`, ekranın sonunda `{toast.node}`.
 */
export function useToast() {
  const [text, setText] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const c = useThemeColors();
  const insets = useSafeAreaInsets();

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = useCallback(
    (message: string) => {
      clearTimeout(timer.current);
      setText(message);
      AccessibilityInfo.announceForAccessibility(message);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setText(null));
      }, SHOW_MS);
    },
    [opacity],
  );

  const node = text ? (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + spacing.lg }]}>
      <Animated.View accessibilityLiveRegion="polite" style={[styles.toast, { opacity, backgroundColor: c.textStrong }]}>
        <AppText style={[styles.text, { color: c.background }]}>{text}</AppText>
      </Animated.View>
    </View>
  ) : null;

  return { show, node };
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: spacing.lg, end: spacing.lg, alignItems: 'center', zIndex: 20 },
  toast: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, maxWidth: 480 },
  text: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
