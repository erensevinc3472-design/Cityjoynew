import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, type LanguageCode } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { AuthScene } from '@/components/auth-scene';
import { AUTH_ART, LANGUAGE_ART } from '@/lib/app-art';
import { profileRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { restartFlow } from '@/lib/navigation';
import { fonts, radius, spacing } from '@/theme/tokens';

/**
 * Dil seçimi (Eren'in tasarımı, 8 Kasım 2026; docs/tasarim-ornekleri/dil-secimi.png): her dil bir satır; solda bayrak
 * (Karar Eren: bayrak kalsın), ortada dilin kendi adı, sağda o dile ait manzara ve ok. Satıra tek dokunuş seçip devam eder.
 */
const FLAG: Record<LanguageCode, string> = { tr: '🇹🇷', en: '🇬🇧', de: '🇩🇪', ru: '🇷🇺', ar: '🇸🇦' };
const ROW_BG = '#023236';
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

  const confirm = async (choice: LanguageCode) => {
    if (saving) return;
    setChoice(choice);
    await i18n.changeLanguage(choice);
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
    <AuthScene kind="cover" image={AUTH_ART.languageBg} shade={false}>
      <View style={styles.head}>
        {router.canGoBack() ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <MaterialIcons name={rtl ? 'arrow-forward' : 'arrow-back'} size={24} color="#FFFFFF" />
          </Pressable>
        ) : null}
        <AppText accessibilityRole="header" style={styles.title}>{t('language.title')}</AppText>
        <AppText style={styles.subtitle}>{t('language.subtitle')}</AppText>
      </View>
      <View style={styles.list}>
        {LANGUAGES.map((l) => {
          const on = l.code === choice;
          return (
            <Pressable
              key={l.code}
              accessibilityRole="button"
              accessibilityState={{ selected: on, busy: saving }}
              accessibilityLabel={l.code === suggestedLanguage ? `${l.nativeName}. ${t('language.suggested')}` : l.nativeName}
              disabled={saving}
              onPress={() => confirm(l.code)}
              style={({ pressed }) => [styles.row, { borderColor: on ? GOLD : 'rgba(79, 194, 168, 0.28)', transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
              <Image
                source={LANGUAGE_ART[l.code]}
                style={[styles.art, rtl && { transform: [{ scaleX: -1 }] }]}
                contentFit="cover"
                contentPosition="right"
                accessible={false}
              />
              <View style={styles.flag}>
                <AppText style={styles.flagText} accessible={false}>{FLAG[l.code]}</AppText>
              </View>
              <View style={styles.grow}>
                {l.code === suggestedLanguage ? <AppText style={styles.suggested}>{t('language.suggested')}</AppText> : null}
                <AppText style={styles.name}>{l.nativeName}</AppText>
              </View>
              <View style={styles.arrow}>
                <MaterialIcons name={rtl ? 'arrow-back' : 'arrow-forward'} size={20} color={GOLD} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </AuthScene>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs, alignItems: 'center' },
  back: { position: 'absolute', start: -spacing.sm, top: -2, width: 44, height: 44, justifyContent: 'center', zIndex: 1 },
  title: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 33, color: '#FFFFFF', textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 20, color: '#C4D0D3', textAlign: 'center' },
  list: { gap: 12 },
  row: { height: 76, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1.5, backgroundColor: ROW_BG, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.md },
  art: { position: 'absolute', top: 0, bottom: 0, end: 0, width: '62%' },
  flag: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.18)' },
  flagText: { fontSize: 28, lineHeight: 34 },
  grow: { flex: 1, gap: 2 },
  suggested: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: GOLD, letterSpacing: 0.4 },
  name: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26, color: '#FFFFFF' },
  arrow: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: GOLD, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8, 26, 30, 0.55)' },
});
