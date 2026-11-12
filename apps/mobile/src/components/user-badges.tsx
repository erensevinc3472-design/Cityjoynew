import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { badgeName, profileBadges, type BadgeDefinition } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { badgeReader } from '@/lib/services';
import { useSettings } from '@/lib/settings';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** Rozet listesi oturumda bir kez okunur (okunamazsa hazır liste). */
function useBadgeDefs(): BadgeDefinition[] {
  const [defs, setDefs] = useState<BadgeDefinition[]>([]);
  useEffect(() => {
    let live = true;
    badgeReader.definitions().then((d) => live && setDefs(d));
    return () => {
      live = false;
    };
  }, []);
  return defs;
}

/**
 * Admin'in verdiği rozetler (Eren, 13 Kasım 2026). Gönderide adın yanında küçük simge; ekran okuyucu rozetin adını
 * okur. Kişi rozet isteyemez, ekip verir.
 */
export function BadgeIcons({ ids, size = 14 }: { ids: string[] | undefined; size?: number }) {
  const defs = useBadgeDefs();
  const { t } = useTranslation();
  const { language } = useSettings();
  const c = useThemeColors();
  const list = profileBadges(ids, defs);
  if (!list.length) return null;
  return (
    <>
      {list.map((b) => (
        <MaterialIcons key={b.id} name={b.icon as IconName} size={size} color={c.accent} accessibilityLabel={t('explore.badge', { name: badgeName(b, language ?? 'tr') })} />
      ))}
    </>
  );
}

/** Profilde: rozetler adlarıyla, küçük etiketler hâlinde. */
export function BadgeChips({ ids }: { ids: string[] | undefined }) {
  const defs = useBadgeDefs();
  const { language } = useSettings();
  const c = useThemeColors();
  const list = profileBadges(ids, defs);
  if (!list.length) return null;
  return (
    <View style={styles.row}>
      {list.map((b) => (
        <View key={b.id} style={[styles.chip, { backgroundColor: c.accentSoft }]}>
          <MaterialIcons name={b.icon as IconName} size={13} color={c.accent} />
          <AppText variant="caption" style={{ color: c.accent }}>{badgeName(b, language ?? 'tr')}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
});
