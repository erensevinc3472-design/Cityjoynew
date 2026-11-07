import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Business } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { ReviewsSection } from '@/components/reviews-section';
import { GUTTER, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Sayfası olmayan (doğrulanmamış) işletmenin yorumları: kartın "Yorumları gör"ü alttan açılır. Güven bilgisi herkese
 * açık kalır (Karar Eren, 7 Kasım: yorumlar Pro olmayanlarda da okunur).
 */
export function ReviewsSheet({ business, open, onClose }: { business: Business; open: boolean; onClose(): void }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: c.background, paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
        <View style={styles.head}>
          <View style={[styles.grabber, { backgroundColor: c.border }]} />
          <AppText variant="label" numberOfLines={1} style={styles.title}>{business.name}</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={8} style={[styles.close, { backgroundColor: c.surfaceStrong }]}>
            <MaterialIcons name="close" size={20} color={c.textStrong} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
          {open ? <ReviewsSection business={business} onNavigate={onClose} /> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { alignItems: 'center', justifyContent: 'center', minHeight: 60, gap: spacing.xs, paddingHorizontal: GUTTER + 44 },
  grabber: { width: 40, height: 5, borderRadius: 3 },
  title: { textAlign: 'center' },
  close: { position: 'absolute', end: GUTTER, top: 14, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: GUTTER, gap: spacing.md },
});
