import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { profileIdOfAuthor, type AnnouncementAuthor } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { useSettings } from '@/lib/settings';
import { spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Yayınlayan (resmî hesap) satırı: rozet, ad ve "Resmî hesap". Kurum ve muhtarlıkta dokununca resmî profil açılır
 * (PROJE.md 6.2 madde 2); il yöneticisinin profili yoktur.
 */
export function AuthorLink({ author, label }: { author: AnnouncementAuthor; label: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { rtl } = useSettings();
  const id = profileIdOfAuthor(author);

  const body = (
    <>
      <MaterialIcons name="verified" size={20} color={c.icon} />
      <View style={styles.text}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="caption" muted>{id ? t('official.badgeOpen') : t('announcements.official')}</AppText>
      </View>
      {id ? <MaterialIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={22} color={c.textSoft} /> : null}
    </>
  );

  if (!id) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${label}. ${t('official.badgeOpen')}`}
      onPress={() => router.push({ pathname: '/official/[id]', params: { id, label } })}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  text: { flex: 1, gap: 2 },
});
