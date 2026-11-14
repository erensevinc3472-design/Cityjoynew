import type { UserLocation } from '@cityjoy/shared';

import { usePreviewLocation } from './preview';
import { useSession } from './session';
import { useSettings } from './settings';

/**
 * Geçerli konum: giriş yapılmışsa profildeki (cihazlar arası), değilse telefondaki.
 * Panel önizlemesinde "şu konumdan bak" seçildiyse o (yalnızca önizlemede, kimsenin konumu değişmez).
 */
export function useUserLocation(): { location: UserLocation | null; stepDone: boolean } {
  const { profile } = useSession();
  const { location, locationStepDone } = useSettings();
  const preview = usePreviewLocation();
  if (preview) return { location: preview, stepDone: true };
  if (profile?.location) return { location: profile.location, stepDone: true };
  return { location, stepDone: locationStepDone };
}
