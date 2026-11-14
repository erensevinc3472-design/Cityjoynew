import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Post } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { PostActions } from '@/components/post-actions';
import { PostComments } from '@/components/post-comments';
import { useReduceMotion } from '@/components/scene-art';
import { useSession } from '@/lib/session';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

interface Props {
  item: Post;
  open: boolean;
  onClose(): void;
  onChange(item: Post): void;
  onRemoved(): void;
  /** "Yorum ekle..." ile açıldı: yazma kutusu odaklanır. */
  focusInput?: boolean;
}

/** Aşağı bu kadar çekilince (ya da hızlı fırlatılınca) pencere kapanır. */
const CLOSE_DRAG = 110;

/**
 * Yorumlar penceresi (Eren, 12 Kasım 2026, Instagram örneği): akışın üstünde, ekranın dörtte üçü kadar, alttan açılır.
 * Üstte tutamaç ve "Yorumlar"; tutamaçtan aşağı çekmek ya da karartılmış arkaya dokunmak kapatır. Altta emoji satırı ve
 * yazma kutusu sabit. Gönderi işlemleri (şikâyet, sahibi için yorumları kapatma ve kaldırma) sağ üstteki "⋯" düğmesinde.
 */
export function PostSheet({ item, open, onClose, onChange, onRemoved, focusInput }: Props) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { user, profile } = useSession();
  const reduce = useReduceMotion();
  const [more, setMore] = useState(false);
  const drag = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (open) {
      drag.setValue(0);
      setMore(false);
    }
  }, [open, drag]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > CLOSE_DRAG || g.vy > 1.2) {
          Animated.timing(drag, { toValue: 800, duration: 160, useNativeDriver: true }).start(() => closeRef.current());
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  return (
    <Modal visible={open} transparent animationType={reduce ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} style={[StyleSheet.absoluteFill, styles.backdrop]} />
      <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top + spacing.lg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          style={[styles.sheet, { flexBasis: Math.round(height * 0.75), backgroundColor: c.background, transform: [{ translateY: drag }] }]}>
          <View {...pan.panHandlers} style={styles.head}>
            <View style={[styles.grabber, { backgroundColor: c.textSoft }]} />
            <View style={styles.headRow}>
              {more ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t('explore.comments.backToComments')} onPress={() => setMore(false)} hitSlop={8} style={styles.headBtn}>
                  <MaterialIcons name="arrow-back" size={22} color={c.textStrong} />
                </Pressable>
              ) : (
                <View style={styles.headBtn} />
              )}
              <AppText accessibilityRole="header" style={[styles.title, { color: c.textStrong }]}>
                {more ? t('explore.comments.moreActions') : t('explore.comments.sheetTitle')}
              </AppText>
              {user && !more ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t('explore.comments.moreActions')} onPress={() => setMore(true)} hitSlop={8} style={styles.headBtn}>
                  <MaterialIcons name="more-horiz" size={24} color={c.textStrong} />
                </Pressable>
              ) : (
                <View style={styles.headBtn} />
              )}
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          {!user ? (
            <View style={styles.pad}>
              <FormMessage kind="info" text={t('explore.signIn')} />
            </View>
          ) : more ? (
            <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + spacing.xl }]}>
              <PostActions item={item} uid={user.uid} onChange={onChange} onRemoved={onRemoved} />
            </ScrollView>
          ) : (
            <PostComments
              variant="sheet"
              autoFocus={focusInput}
              post={item}
              uid={user.uid}
              displayName={profile?.displayName}
              onCount={(n) => onChange({ ...item, commentCount: n })}
            />
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { flexGrow: 0, flexShrink: 1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden' },
  head: { paddingTop: spacing.xs, paddingHorizontal: spacing.sm },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, opacity: 0.6 },
  headRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  headBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 15.5 },
  divider: { height: StyleSheet.hairlineWidth },
  pad: { paddingHorizontal: GUTTER, paddingTop: spacing.md, gap: spacing.md },
});
