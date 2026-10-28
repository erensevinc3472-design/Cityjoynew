import { ProfileView } from '@/components/profile-view';
import { useSession } from '@/lib/session';

/** Alt menüdeki Profil sekmesi: kendi profilim (Ayarlar sağ üstteki ☰ içinde). */
export default function MyProfileScreen() {
  const { user } = useSession();
  return <ProfileView uid={user?.uid ?? ''} asTab />;
}
