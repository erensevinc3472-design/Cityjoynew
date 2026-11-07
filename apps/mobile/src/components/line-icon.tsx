import { MaterialIcons } from '@expo/vector-icons';
import {
  BookOpen,
  Building,
  Building2,
  Bus,
  CalendarDays,
  Cross,
  Flag,
  Flame,
  Gavel,
  HeartPulse,
  Hospital,
  IdCard,
  Info,
  Landmark,
  Mail,
  Pill,
  Receipt,
  School,
  Shield,
  Siren,
  SquareParking,
  Stethoscope,
  Store,
  TreePine,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * İnce çizgili simgeler (alt sayfaların yeni görünümü, Eren 7 Kasım 2026): bölüm tanımları Material simge adı taşır,
 * burada karşılık gelen çizgi simgeye çevrilir. Karşılığı olmayan (ör. cami) Material simgesiyle çizilir.
 */
const LINE: Partial<Record<IconName, LucideIcon>> = {
  'account-balance': Building,
  'corporate-fare': Building2,
  museum: Landmark,
  'event-available': CalendarDays,
  'medical-services': Hospital,
  'local-pharmacy': Pill,
  'directions-bus': Bus,
  park: TreePine,
  'local-parking': SquareParking,
  'help-outline': Info,
  'emergency-share': Siren,
  storefront: Store,
  'location-city': Flag,
  'local-police': Shield,
  'fire-truck': Flame,
  badge: IdCard,
  gavel: Gavel,
  mail: Mail,
  'receipt-long': Receipt,
  'health-and-safety': HeartPulse,
  healing: Stethoscope,
  'local-hospital': Cross,
  school: School,
  'menu-book': BookOpen,
  'account-balance-wallet': Wallet,
};

export function LineIcon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  const Icon = LINE[name];
  if (Icon) return <Icon size={size} color={color} strokeWidth={1.6} />;
  return <MaterialIcons name={name} size={size} color={color} />;
}
