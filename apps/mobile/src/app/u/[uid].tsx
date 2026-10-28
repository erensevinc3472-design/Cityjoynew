import { useLocalSearchParams } from 'expo-router';

import { ProfileView } from '@/components/profile-view';

/** Başkasının (ya da bağlantıyla açılan kendi) profili; ayrıntısı ProfileView'de. */
export default function ProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  return <ProfileView uid={uid} />;
}
