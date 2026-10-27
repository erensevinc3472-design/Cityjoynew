import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  buildCategoryTree,
  filterByName,
  localized,
  searchCategoryTree,
  type LanguageCode,
  type ServiceCategory,
} from '@cityjoy/shared';

import { locationRepository as repo } from '@/lib/locations';
import { useSettings } from '@/lib/settings';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';
import { SearchField } from './search-field';

/** Açılır seçim satırı: başlık, seçili değer ve aşağı ok. */
function Trigger({ label, value, open, onPress }: { label: string; value?: string; open: boolean; onPress(): void }) {
  const c = useThemeColors();
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${label}: ${value ?? t('business.choose')}`}
      onPress={onPress}
      style={({ pressed }) => [styles.trigger, { backgroundColor: c.surfaceStrong, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}>
      <View style={styles.flex}>
        <AppText variant="caption" muted>{label}</AppText>
        <AppText style={{ color: value ? c.textStrong : c.textMuted }}>{value ?? t('business.choose')}</AppText>
      </View>
      <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={24} color={c.textSoft} />
    </Pressable>
  );
}

function ChoiceList<T extends { id: string; name: string }>({ items, selected, onSelect }: { items: T[]; selected?: string; onSelect(item: T): void }) {
  const c = useThemeColors();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filterByName(items, query).slice(0, 40), [items, query]);
  return (
    <View style={[styles.list, { borderColor: c.border, backgroundColor: c.surface }]}>
      <SearchField value={query} onChangeText={setQuery} placeholder={t('common.search')} />
      {shown.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityState={{ selected: item.id === selected }}
          onPress={() => onSelect(item)}
          style={({ pressed }) => [styles.choice, { opacity: pressed ? 0.7 : 1 }]}>
          <AppText style={styles.flex}>{item.name}</AppText>
          {item.id === selected ? <MaterialIcons name="check" size={20} color={c.primary} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

/** İşletme konumu: il ve ilçe (mahalle ev işletmelerinde bile gösterilmez, PROJE.md 5.7). */
export function RegionPicker({
  provinceCode,
  districtId,
  onChange,
}: {
  provinceCode?: string;
  districtId?: string;
  onChange(v: { provinceCode?: string; districtId?: string }): void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<'province' | 'district' | null>(null);
  const provinces = useMemo(() => repo.getProvinces().map((p) => ({ id: p.code, name: p.name })), []);
  const districts = useMemo(() => (provinceCode ? repo.getDistricts(provinceCode) : []), [provinceCode]);
  return (
    <View style={styles.group}>
      <Trigger label={t('business.province')} value={provinceCode ? repo.getProvince(provinceCode)?.name : undefined} open={open === 'province'} onPress={() => setOpen(open === 'province' ? null : 'province')} />
      {open === 'province' ? (
        <ChoiceList
          items={provinces}
          selected={provinceCode}
          onSelect={(p) => {
            onChange({ provinceCode: p.id, districtId: p.id === provinceCode ? districtId : undefined });
            setOpen('district');
          }}
        />
      ) : null}
      {provinceCode ? (
        <Trigger label={t('business.district')} value={districtId ? repo.getDistrict(districtId)?.name : undefined} open={open === 'district'} onPress={() => setOpen(open === 'district' ? null : 'district')} />
      ) : null}
      {open === 'district' && provinceCode ? (
        <ChoiceList
          items={districts}
          selected={districtId}
          onSelect={(d) => {
            onChange({ provinceCode, districtId: d.id });
            setOpen(null);
          }}
        />
      ) : null}
    </View>
  );
}

/** Hizmet alt kategorisi seçimi (çoklu, en çok `max`). */
export function CategoryPicker({
  all,
  selected,
  max,
  onChange,
}: {
  all: ServiceCategory[];
  selected: string[];
  max: number;
  onChange(ids: string[]): void;
}) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { language } = useSettings();
  const lang: LanguageCode = language ?? 'tr';
  const [query, setQuery] = useState('');
  const tree = useMemo(() => buildCategoryTree(all), [all]);
  const nameOf = (id: string) => {
    const cat = tree.flatMap((n) => n.children).find((x) => x.id === id);
    return cat ? localized(cat.names, lang)! : id;
  };
  const results = useMemo(
    () => (query.trim() ? searchCategoryTree(tree, query, lang).flatMap((n) => n.children.map((child) => ({ child, parent: n.category }))).slice(0, 30) : []),
    [tree, query, lang],
  );
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : selected.length < max ? [...selected, id] : selected);

  return (
    <View style={styles.group}>
      <View style={styles.chips}>
        {selected.map((id) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={`${nameOf(id)}, ${t('business.removeService')}`}
            onPress={() => toggle(id)}
            style={[styles.chip, { backgroundColor: c.accentSoft, borderColor: c.accentBorder }]}>
            <AppText variant="caption" style={{ color: c.textStrong }}>{nameOf(id)}</AppText>
            <MaterialIcons name="close" size={16} color={c.textMuted} />
          </Pressable>
        ))}
      </View>
      <SearchField value={query} onChangeText={setQuery} placeholder={t('business.categorySearch')} />
      {results.length ? (
        <View style={[styles.list, { borderColor: c.border, backgroundColor: c.surface }]}>
          {results.map(({ child, parent }) => {
            const isOn = selected.includes(child.id);
            const disabled = !isOn && selected.length >= max;
            return (
              <Pressable
                key={child.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isOn, disabled }}
                disabled={disabled}
                onPress={() => toggle(child.id)}
                style={({ pressed }) => [styles.choice, { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
                <View style={styles.flex}>
                  <AppText>{localized(child.names, lang)}</AppText>
                  <AppText variant="caption" muted>{localized(parent.names, lang)}</AppText>
                </View>
                <MaterialIcons name={isOn ? 'check-box' : 'check-box-outline-blank'} size={22} color={isOn ? c.primary : c.textSoft} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: spacing.sm },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH + 8, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  list: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: 2 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH, paddingHorizontal: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, minHeight: 32 },
});
