import { isLimitReached } from '@cityjoy/shared';
import type { TFunction } from 'i18next';

const pad = (n: number) => String(n).padStart(2, '0');

/** Günlük sınır dolduysa "hakkın doldu, şu an yenilenir" metni; değilse undefined. */
export function limitText(t: TFunction, e: unknown): string | undefined {
  if (!isLimitReached(e)) return undefined;
  const at = new Date(e.resetAt);
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const sameDay = at.toDateString() === new Date().toDateString();
  return t('limits.reached', { when: sameDay ? time : `${pad(at.getDate())}.${pad(at.getMonth() + 1)} ${time}` });
}

/** Hata metni: sınır dolduysa onun açıklaması, değilse verilen genel hata. */
export const errorText = (t: TFunction, e: unknown, key: string) => limitText(t, e) ?? t(key);
