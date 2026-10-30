import { MaterialIcons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';

/**
 * İnternet kesilince her ekranın altında birkaç saniyelik "Bağlantı yok" bildirimi. Ekrandaki düğmeleri kapatmasın diye
 * kendiliğinden kaybolur ve dokunmaları engellemez; bağlantı gelip yeniden kesilirse tekrar görünür. Durum henüz
 * bilinmiyorsa (null) gösterilmez.
 */
export function OfflineBanner() {
  const net = useNetInfo();
  const { t } = useTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const offline = net.isConnected === false || net.isInternetReachable === false;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(offline);
    if (!offline) return;
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [offline]);

  if (!visible) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 72 }]}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${t('common.offlineTitle')}. ${t('common.offline')}`}
        style={[styles.pill, { backgroundColor: c.surfaceStrong, borderColor: c.border }]}>
        <MaterialIcons name="wifi-off" size={18} color={c.danger} />
        <AppText variant="label" numberOfLines={1} style={{ color: c.textStrong }}>{t('common.offlineTitle')}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.md, zIndex: 90 },
  pill: {
    maxWidth: 640,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
});
