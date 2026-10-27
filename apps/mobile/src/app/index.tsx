import { Redirect } from 'expo-router';

import { useSettings } from '@/lib/settings';

/** Açılış yönlendirmesi: dil seçilmediyse dil, konum adımı geçilmediyse konum, sonra ana sayfa. */
export default function Index() {
  const { language, locationStepDone } = useSettings();
  if (!language) return <Redirect href="/language" />;
  if (!locationStepDone) return <Redirect href="/location" />;
  return <Redirect href="/home" />;
}
