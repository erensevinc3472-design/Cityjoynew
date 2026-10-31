import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MediaKind, Photo } from '@cityjoy/shared';
import { PhotoTooLargeError, uploadMedia } from '@cityjoy/shared/firebase';

import { AppText } from '@/components/app-text';
import { storage } from '@/lib/firebase';
import { PhotoPermissionError, pickPhotos } from '@/lib/photos';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Kayda bağlı görseller (işletme logosu, vitrin): seçilen fotoğraf küçültülüp hemen yüklenir, liste kayıtla birlikte
 * kaydedilir. Kaldırılan görselin dosyasını kayıt kaydedilince sunucu siler.
 */
export function MediaPicker({
  label,
  hint,
  kind,
  uid,
  photos,
  max,
  onChange,
  disabled,
  round,
}: {
  label: string;
  hint?: string;
  kind: MediaKind;
  uid: string;
  photos: Photo[];
  max: number;
  onChange(photos: Photo[]): void;
  disabled?: boolean;
  round?: boolean;
}) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const add = async () => {
    setError(undefined);
    try {
      const picked = await pickPhotos(max - photos.length);
      if (!picked.length) return;
      setBusy(true);
      const uploaded: Photo[] = [];
      for (const p of picked) uploaded.push(await uploadMedia(storage, uid, kind, p));
      onChange([...photos, ...uploaded].slice(0, max));
    } catch (e) {
      setError(t(e instanceof PhotoPermissionError ? 'explore.photos.permission' : e instanceof PhotoTooLargeError ? 'explore.photos.tooLarge' : 'explore.photos.uploadError'));
    } finally {
      setBusy(false);
    }
  };

  const shape = round ? styles.round : null;
  return (
    <View style={styles.block}>
      <AppText variant="label" accessibilityRole="header">{label}</AppText>
      <View style={styles.thumbs}>
        {photos.map((p, i) => (
          <View key={p.path} style={[styles.thumb, shape, { backgroundColor: c.surfaceStrong }]}>
            <Image source={{ uri: p.url }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={t('explore.photos.label', { n: i + 1, total: photos.length })} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('explore.photos.remove')} (${i + 1})`}
              disabled={disabled || busy}
              onPress={() => onChange(photos.filter((_, k) => k !== i))}
              hitSlop={10}
              style={styles.remove}>
              <MaterialIcons name="close" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        ))}
        {photos.length < max ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('explore.photos.add')}
            accessibilityState={{ busy, disabled: disabled || busy }}
            disabled={disabled || busy}
            onPress={add}
            style={({ pressed }) => [styles.thumb, shape, styles.add, { borderColor: c.accent, opacity: pressed ? 0.7 : 1 }]}>
            {busy ? <ActivityIndicator color={c.accent} /> : <MaterialIcons name="add-a-photo" size={24} color={c.accent} />}
            <AppText style={[styles.addText, { color: c.accent }]}>{busy ? t('explore.photos.uploading') : t('explore.photos.add')}</AppText>
          </Pressable>
        ) : null}
      </View>
      <AppText variant="caption" muted>
        {max > 1 ? `${t('media.count', { count: photos.length, max })} · ` : ''}
        {hint ?? t('explore.photos.note')}
      </AppText>
      {error ? <AppText variant="caption" style={{ color: c.danger }}>{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 76, height: 76, borderRadius: radius.md, overflow: 'hidden' },
  round: { borderRadius: 38 },
  remove: { position: 'absolute', top: 4, end: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  add: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 4 },
  addText: { fontSize: 11, lineHeight: 14, textAlign: 'center' },
});
