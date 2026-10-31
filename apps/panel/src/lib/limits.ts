import { isLimitReached } from '@cityjoy/shared';

import { t } from './t';

const pad = (n: number) => String(n).padStart(2, '0');

/** Günlük ya da haftalık yayın sınırı dolduysa açıklaması (ne zaman yenileneceğiyle); değilse undefined. */
export function limitText(e: unknown): string | undefined {
  if (!isLimitReached(e)) return undefined;
  const at = new Date(e.resetAt);
  const when = `${pad(at.getDate())}.${pad(at.getMonth() + 1)} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
  return t(e.kind === 'duyuru-hafta' ? 'limitReached.weekly' : 'limitReached.daily', { when });
}
