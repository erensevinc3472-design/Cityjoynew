import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppButton } from './app-button';
import { AppText } from './app-text';

type Props =
  | { kind: 'loading' }
  | { kind: 'empty'; message?: string }
  | { kind: 'error'; message?: string; onRetry?(): void };

/** Her listede aynı görünen yükleniyor / boş / hata durumu. */
export function StateMessage(props: Props) {
  const c = useThemeColors();
  const { t } = useTranslation();

  if (props.kind === 'loading') {
    return (
      <View style={styles.box} accessibilityLiveRegion="polite">
        <ActivityIndicator color={c.accent} />
        <AppText muted>{t('common.loading')}</AppText>
      </View>
    );
  }

  const isError = props.kind === 'error';
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <MaterialIcons name={isError ? 'cloud-off' : 'search-off'} size={32} color={isError ? c.danger : c.textMuted} />
      <AppText muted style={styles.center}>
        {props.message ?? t(isError ? 'common.errorGeneric' : 'common.noResults')}
      </AppText>
      {isError && props.onRetry ? <AppButton variant="secondary" title={t('common.retry')} onPress={props.onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  center: { textAlign: 'center' },
});
