import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { buildCategoryTree, localized, searchCategoryTree, type ServiceCategory } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { HeroHeader } from '@/components/hero-header';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { StateMessage } from '@/components/state-message';
import { locationRepository } from '@/lib/locations';
import { useServiceCategories } from '@/lib/service-categories';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
const iconOf = (c: ServiceCategory) => (c.icon in MaterialIcons.glyphMap ? c.icon : 'handyman') as IconName;

/** Acil İhtiyaçlar > Hizmetler (PROJE.md 5.4): iki seviyeli kategori ağacı ve arama. */
export default function ServicesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language, rtl } = useSettings();
  const lang = language ?? 'tr';
  const { location } = useUserLocation();
  const { all, stale } = useServiceCategories();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildCategoryTree(all), [all]);
  const shown = useMemo(() => searchCategoryTree(tree, query, lang), [tree, query, lang]);
  const searching = query.trim().length > 0;
  const province = location ? locationRepository.getProvince(location.provinceCode)?.name : undefined;

  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const header = (
    <HeroHeader title={t('services.title')} subtitle={province} onBack={() => (router.canGoBack() ? router.back() : router.replace('/urgent'))} />
  );

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <SearchField value={query} onChangeText={setQuery} placeholder={t('services.search')} />
        {stale ? <AppText variant="caption" muted>{t('services.cachedNote')}</AppText> : null}
        {shown.length === 0 ? <StateMessage kind="empty" message={t('services.noMatch')} /> : null}

        {shown.map(({ category, children }) => {
          const expanded = searching || open.has(category.id);
          const name = localized(category.names, lang)!;
          return (
            <View key={category.id} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, shadowColor: c.shadow }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${name}, ${t('services.subcategories', { count: children.length })}`}
                disabled={searching}
                onPress={() => toggle(category.id)}
                style={({ pressed }) => [styles.head, { opacity: pressed ? 0.8 : 1 }]}>
                <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
                  <MaterialIcons name={iconOf(category)} size={22} color={c.icon} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="label">{name}</AppText>
                  <AppText variant="caption" muted>{t('services.subcategories', { count: children.length })}</AppText>
                </View>
                {searching ? null : <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={24} color={c.textSoft} />}
              </Pressable>
              {expanded
                ? children.map((child) => (
                    <Pressable
                      key={child.id}
                      accessibilityRole="button"
                      accessibilityLabel={child.urgent ? `${localized(child.names, lang)}, ${t('services.urgentBadge')}` : localized(child.names, lang)}
                      onPress={() => router.push({ pathname: '/services/[id]', params: { id: child.id } })}
                      style={({ pressed }) => [styles.child, { borderTopColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
                      <MaterialIcons name={iconOf(child)} size={20} color={c.textMuted} />
                      <AppText style={styles.flex}>{localized(child.names, lang)}</AppText>
                      {child.urgent ? (
                        <View style={[styles.badge, { backgroundColor: c.dangerSoft }]}>
                          <AppText variant="caption" style={{ color: c.danger }}>{t('services.urgentBadge')}</AppText>
                        </View>
                      ) : null}
                      <MaterialIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={22} color={c.textSoft} />
                    </Pressable>
                  ))
                : null}
            </View>
          );
        })}

        <AppButton variant="secondary" title={t('services.suggestCta')} onPress={() => router.push('/services/suggest')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1, gap: 2 },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, minHeight: MIN_TOUCH + 16 },
  icon: { width: 42, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  child: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
});
