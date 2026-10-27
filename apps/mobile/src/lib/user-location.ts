import type { UserLocation } from '@cityjoy/shared';

import { useSession } from './session';
import { useSettings } from './settings';

/** Geçerli konum: giriş yapılmışsa profildeki (cihazlar arası), değilse telefondaki. */
export function useUserLocation(): { location: UserLocation | null; stepDone: boolean } {
  const { profile } = useSession();
  const { location, locationStepDone } = useSettings();
  if (profile?.location) return { location: profile.location, stepDone: true };
  return { location, stepDone: locationStepDone };
}
