import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LEGAL_TEXT_VERSION } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';

/** Yasal metinler. Asıl metinler avukat kontrolünden sonra eklenecek (PROJE.md bölüm 8). */
export default function LegalScreen() {
  const { t } = useTranslation();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const title = doc === 'privacy' ? t('account.privacy') : t('account.terms');
  return (
    <FormScreen title={title}>
      <FormMessage kind="info" text={t('legal.draftNotice')} />
      <AppText variant="caption" muted>{LEGAL_TEXT_VERSION}</AppText>
    </FormScreen>
  );
}
