import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, type LanguageCode } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { HeroHeader } from '@/components/hero-header';
import { OptionRow } from '@/components/option-row';
import { Screen } from '@/components/screen';
import { profileRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { restartFlow } from '@/lib/navigation';
import { spacing } from '@/theme/tokens';

export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { language, suggestedLanguage, setLanguage } = useSettings();
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
    if (router.canGoBack()) router.back();
    else restartFlow(router);
  };

  return (
    <Screen header={<HeroHeader title={t('language.title')} subtitle={t('language.subtitle')} onBack={router.canGoBack() ? () => router.back() : undefined} />}>
      <FlatList
        data={LANGUAGES}
        keyExtractor={(l) => l.code}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <OptionRow
            title={item.nativeName}
            subtitle={item.code === suggestedLanguage ? t('language.suggested') : undefined}
            selected={item.code === choice}
            onPress={() => preview(item.code)}
          />
        )}
      />
      <View style={styles.footer}>
        <AppButton title={t('common.continue')} onPress={confirm} loading={saving} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingVertical: spacing.sm },
  footer: { paddingBottom: spacing.md },
});
