import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, type LanguageCode } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { OptionRow } from '@/components/option-row';
import { Screen } from '@/components/screen';
import { useSettings } from '@/lib/settings';
import { spacing } from '@/theme/tokens';

export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { language, suggestedLanguage, setLanguage, locationStepDone } = useSettings();
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
    setSaving(false);
    if (router.canGoBack()) router.back();
    else router.replace(locationStepDone ? '/home' : '/location');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title">{t('language.title')}</AppText>
        <AppText muted>{t('language.subtitle')}</AppText>
      </View>
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
  header: { gap: spacing.xs, paddingTop: spacing.lg },
  list: { gap: spacing.sm, paddingVertical: spacing.sm },
  footer: { paddingBottom: spacing.md },
});
