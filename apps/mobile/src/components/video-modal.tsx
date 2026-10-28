import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { radius } from '@/theme/tokens';
import { AppText } from './app-text';
import { VideoFrame } from './video-frame';

/** Ekranın ortasında beliren video penceresi: arkası kararır, dışına dokunmak ya da kapat düğmesi kapatır. */
export function VideoModal({ src, title, onClose }: { src: string | null; title: string; onClose(): void }) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const w = Math.min(width - 24, 720, (height - 160) * (16 / 9));
  return (
    <Modal visible={!!src} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={{ width: w, gap: 10 }}>
          <View style={styles.head}>
            <AppText numberOfLines={1} style={styles.title}>{title}</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={8} style={styles.close}>
              <MaterialIcons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={[styles.frame, { height: Math.round((w * 9) / 16) }]} accessibilityViewIsModal>
            {src ? <VideoFrame src={src} title={title} /> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.82)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: '#FFFFFF', fontSize: 15 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.14)' },
  frame: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
});
