import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, type LanguageCode } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { AuthScene } from '@/components/auth-scene';
import { SceneArt, type SceneKind } from '@/components/scene-art';
import { profileRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { restartFlow } from '@/lib/navigation';
import { fonts, radius, spacing } from '@/theme/tokens';

/** Her dil için resimli şerit (G-Dil). Resimler Panel > Uygulama görselleri'nden değişecek; şimdilik çizim. */
const STRIP: Record<LanguageCode, SceneKind> = { tr: 'city', en: 'travel', de: 'townhall', ru: 'events', ar: 'neighbourhood' };
const GOLD = '#E2B277';

export default function LanguageScreen() {
  // Karşılamadan gelindiyse dil seçilince kayda geçilir.
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { language, suggestedLanguage, setLanguage, rtl } = useSettings();
  const { user, profile, refreshProfile } = useSession();
  const [choice, setChoice] = useState<LanguageCode>(language ?? suggestedLanguage);
  const [saving, setSaving] = useState(false);
  const confirmed = useRef(false);

  const savedLanguage = useRef(language ?? suggestedLanguage);

  // Onaylamadan geri dönülürse önizlenen dil geri alınır (yalnızca ekrandan çıkarken).
  useEffect(
    () => () => {
      if (!confirmed.current) i18n.changeLanguage(savedLanguage.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const preview = async (code: LanguageCode) => {
    setChoice(code);
    // Metinler seçilen dilde hemen görünsün.
    await i18n.changeLanguage(code);
  };

  const confirm = async () => {
    setSaving(true);
    confirmed.current = true;
    await setLanguage(choice);
    if (user && profile && profile.language !== choice) {
      // Profil kaydı başarısız olsa da dil telefonda değişmiş olur; sonraki değişiklikte tekrar denenir.
      await profileRepository.update(user.uid, { language: choice }, profile).then(refreshProfile, () => {});
    }
    setSaving(false);
    if (next === 'sign-up') router.replace('/sign-up');
    else if (router.canGoBack()) router.back();
    else restartFlow(router);
  };

  return (
    <AuthScene logo={false} kind="cover">
      <View style={styles.head}>
        {router.canGoBack() ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <MaterialIcons name={rtl ? 'arrow-forward' : 'arrow-back'} size={24} color="#FFFFFF" />
          </Pressable>
        ) : null}
        <AppText accessibilityRole="header" style={styles.title}>{t('language.title')}</AppText>
        <AppText style={styles.subtitle}>{t('language.subtitle')}</AppText>
      </View>
      <View style={styles.list} accessibilityRole="radiogroup">
        {LANGUAGES.map((l) => {
          const on = l.code === choice;
          return (
            <Pressable
              key={l.code}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={l.nativeName}
              onPress={() => preview(l.code)}
              style={[styles.strip, { borderColor: on ? GOLD : 'rgba(255, 255, 255, 0.12)' }]}>
              <SceneArt kind={STRIP[l.code]} still />
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: on ? 'rgba(8, 26, 30, 0.35)' : 'rgba(8, 26, 30, 0.55)' }]} />
              <View style={styles.stripRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  {l.code === suggestedLanguage ? <AppText style={styles.suggested}>{t('language.suggested')}</AppText> : null}
                  <AppText style={styles.name}>{l.nativeName}</AppText>
                </View>
                <View style={[styles.radio, on && { backgroundColor: GOLD, borderColor: GOLD }]}>
                  {on ? <MaterialIcons name="check" size={18} color="#1A1408" /> : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      <AppButton title={t('common.continue')} onPress={confirm} loading={saving} />
    </AuthScene>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs, paddingTop: spacing.sm },
  back: { width: 44, height: 44, justifyContent: 'center', marginStart: -spacing.sm },
  title: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 35, color: '#FFFFFF' },
  subtitle: { fontSize: 14.5, lineHeight: 21, color: '#C4D0D3' },
  list: { gap: 10 },
  strip: { height: 76, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1.5 },
  stripRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.md },
  suggested: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: GOLD, letterSpacing: 0.4 },
  name: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26, color: '#FFFFFF' },
  radio: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.5)', alignItems: 'center', justifyContent: 'center' },
});
