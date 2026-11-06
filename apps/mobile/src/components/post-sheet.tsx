import { MaterialIcons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Post } from '@cityjoy/shared';

import { FormMessage } from '@/components/form-message';
import { PostActions } from '@/components/post-actions';
import { PostComments } from '@/components/post-comments';
import { useSession } from '@/lib/session';
import { GUTTER, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

interface Props {
  item: Post;
  open: boolean;
  onClose(): void;
  onChange(item: Post): void;
  onRemoved(): void;
}

/**
 * Yorumlar paneli (Eren, 7 Kasım: gönderi ayrı sayfada açılmasın). Akıştan ayrılmadan alttan açılır; iPhone'da aşağı
 * çekince kapanır. İçinde yorumlar, yorum yazma ve gönderi işlemleri (şikâyet, sahibi için kapatma ve kaldırma).
 */
export function PostSheet({ item, open, onClose, onChange, onRemoved }: Props) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useSession();

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: c.background, paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
        <View style={styles.head}>
          <View style={[styles.grabber, { backgroundColor: c.border }]} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={8} style={[styles.close, { backgroundColor: c.surfaceStrong }]}>
            <MaterialIcons name="close" size={20} color={c.textStrong} />
          </Pressable>
        </View>
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
            {user ? (
              <>
                <PostComments post={item} uid={user.uid} displayName={profile?.displayName} onCount={(n) => onChange({ ...item, commentCount: n })} />
                <PostActions item={item} uid={user.uid} onChange={onChange} onRemoved={onRemoved} />
              </>
            ) : (
              <FormMessage kind="info" text={t('explore.signIn')} />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  grabber: { width: 40, height: 5, borderRadius: 3 },
  close: { position: 'absolute', end: GUTTER, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: GUTTER, gap: spacing.md },
});
