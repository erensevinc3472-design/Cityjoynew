import { useTranslation } from 'react-i18next';

import { useSettings } from './settings';

/** "şimdi", "5 dk", "3 sa", "2 g"; bir haftadan eskiyse tarih. */
export function useRelativeTime() {
  const { t } = useTranslation();
  const { language } = useSettings();
  return (iso: string) => {
    if (!iso) return '';
    const at = new Date(iso);
    const min = Math.floor((Date.now() - at.getTime()) / 60000);
    if (min < 1) return t('time.now');
    if (min < 60) return t('time.minutes', { count: min });
    if (min < 60 * 24) return t('time.hours', { count: Math.floor(min / 60) });
    if (min < 60 * 24 * 7) return t('time.days', { count: Math.floor(min / 1440) });
    return at.toLocaleDateString(language ?? 'tr', { day: 'numeric', month: 'short' });
  };
}
