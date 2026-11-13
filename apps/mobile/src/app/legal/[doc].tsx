import { useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LEGAL_TEXT_VERSION } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';

// Herkese açık yasal sayfalar (mağaza kayıtlarındaki adresler; apps/panel/*.html). Metin avukat kontrolünden sonra
// kesinleşir (PROJE.md bölüm 8).
const host = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const PAGES: Record<string, string> = { privacy: 'gizlilik.html', terms: 'kullanim-sartlari.html' };

/** Yasal metinler: kısa not ve web'deki tam metin. */
export default function LegalScreen() {
  const { t } = useTranslation();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const title = doc === 'privacy' ? t('account.privacy') : t('account.terms');
  const url = host && !host.startsWith('demo-') ? `https://${host}.web.app/${PAGES[doc] ?? PAGES.terms}` : null;
  return (
    <FormScreen title={title}>
      <FormMessage kind="info" text={t('legal.draftNotice')} />
      {url ? <AppButton variant="secondary" title={t('legal.openFull')} onPress={() => Linking.openURL(url).catch(() => {})} /> : null}
      <AppText variant="caption" muted>{LEGAL_TEXT_VERSION}</AppText>
    </FormScreen>
  );
}
