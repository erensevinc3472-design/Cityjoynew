import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Post } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { ThumbImage } from '@/components/thumb-image';
import { useToast } from '@/components/toast';
import { postVisibility } from '@/lib/services';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Pro bitince gizlenen gönderiler (Karar Eren, 12 Kasım 2026): yalnızca işletmenin ekibi görür. Hiçbiri silinmedi;
 * "Göster" deyince en eski görünen gönderiyle yer değiştirir. Pro yenilenince hepsi kendiliğinden geri gelir.
 */
export function HiddenPosts({ businessId, list, limit, isOwner, onChanged }: { businessId: string; list: Post[]; limit: number; isOwner: boolean; onChanged: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (!list.length) return null;

  const show = async (id: string) => {
    setBusy(id);
    try {
      await postVisibility.set(id, true);
      onChanged();
    } catch {
      toast.show(t('business.hidden.error'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.head}>
        <MaterialIcons name="lock-outline" size={20} color={c.textSoft} />
        <AppText variant="label" accessibilityRole="header" style={styles.flex}>{t('business.hidden.title', { count: list.length })}</AppText>
      </View>
      <AppText variant="caption" muted>{t('business.hidden.body', { count: limit })}</AppText>
      {list.map((p) => (
        <View key={p.id} style={[styles.row, { borderTopColor: c.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={p.text.slice(0, 100) || t(`explore.categories.${p.category}`)}
            onPress={() => router.push({ pathname: '/explore/[id]', params: { id: p.id } })}
            style={styles.rowMain}>
            {p.photos?.length ? (
              <ThumbImage photo={p.photos[0]} style={[styles.thumb, { backgroundColor: c.surfaceStrong }]} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbIcon, { backgroundColor: c.surfaceStrong }]}>
                <MaterialIcons name={p.video ? 'videocam' : 'notes'} size={20} color={c.textSoft} />
              </View>
            )}
            <AppText numberOfLines={2} style={[styles.flex, { color: c.text }]}>{p.text || t(`explore.categories.${p.category}`)}</AppText>
          </Pressable>
          <AppButton variant="secondary" title={t('business.hidden.show')} onPress={() => show(p.id)} loading={busy === p.id} disabled={!!busy} />
        </View>
      ))}
      {isOwner ? <AppButton title={t('business.hidden.renew')} onPress={() => router.push({ pathname: '/business/pro', params: { id: businessId } })} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH },
  thumb: { width: 48, height: 48, borderRadius: radius.sm },
  thumbIcon: { alignItems: 'center', justifyContent: 'center' },
});
