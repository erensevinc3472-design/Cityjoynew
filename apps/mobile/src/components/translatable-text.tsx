import { MaterialIcons } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { canOfferTranslation, isLanguageCode, LANGUAGES, type LanguageCode } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { limitText } from '@/lib/limits';
import { useSession } from '@/lib/session';
import { translateText } from '@/lib/translate';
import { fonts } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Props = ComponentProps<typeof AppText> & {
  /** Gösterilecek kullanıcı / panel içeriği. */
  text: string;
  /** Kart üzerinde düğmeyi gizlemek için (örn. kısaltılmış önizleme). */
  noTranslate?: boolean;
};

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'shown'; text: string; source: string }
  | { kind: 'original'; text: string; source: string }
  | { kind: 'note'; message: string };

const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.nativeName ?? code.toUpperCase();

/**
 * Kullanıcı içeriği + altında "Çevir" (Karar Eren, 6 Kasım 2026). Kendiliğinden çevirmez; düğme yalnızca metin
 * okuyanın dilinde görünmüyorsa çıkar. Basınca çeviri, "Aslını gör" ile asıl metin.
 */
export function TranslatableText({ text, noTranslate, ...rest }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const c = useThemeColors();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const target: LanguageCode = isLanguageCode(i18n.language) ? i18n.language : 'tr';
  const offer = !noTranslate && canOfferTranslation(text, target);

  async function run() {
    if (state.kind === 'original') return setState({ kind: 'shown', text: state.text, source: state.source });
    if (!user) return setState({ kind: 'note', message: t('translate.signIn') });
    setState({ kind: 'loading' });
    try {
      const r = await translateText(text, target);
      setState(r.same ? { kind: 'note', message: t('translate.same') } : { kind: 'shown', text: r.text, source: r.source });
    } catch (e) {
      setState({ kind: 'note', message: limitText(t, e) ?? t('translate.error') });
    }
  }

  const shown = state.kind === 'shown';
  return (
    <View>
      <AppText {...rest}>{shown ? state.text : text}</AppText>
      {offer ? (
        <View style={styles.row}>
          {shown ? (
            <>
              <AppText variant="caption" muted style={styles.flexShrink}>
                {t('translate.from', { lang: langName(state.source) })}
              </AppText>
              <Link label={t('translate.original')} onPress={() => setState({ kind: 'original', text: state.text, source: state.source })} color={c.accent} />
            </>
          ) : state.kind === 'loading' ? (
            <AppText variant="caption" muted accessibilityLiveRegion="polite">
              {t('translate.loading')}
            </AppText>
          ) : state.kind === 'note' ? (
            <AppText variant="caption" muted accessibilityLiveRegion="polite" style={styles.flexShrink}>
              {state.message}
            </AppText>
          ) : (
            <Link
              icon
              label={t('translate.action')}
              a11y={t('translate.a11y', { lang: langName(target) })}
              onPress={run}
              color={c.accent}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

function Link({ label, a11y, onPress, color, icon }: { label: string; a11y?: string; onPress: () => void; color: string; icon?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      {icon ? <MaterialIcons name="translate" size={14} color={color} /> : null}
      <AppText variant="caption" style={[styles.linkText, { color }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 24 },
  linkText: { fontFamily: fonts.bodySemi },
  pressed: { opacity: 0.6 },
  flexShrink: { flexShrink: 1 },
});
