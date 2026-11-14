import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  buildCategoryTree,
  filterByName,
  FOOD_KINDS,
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

/**
 * İşletme konumu: il, ilçe ve isteğe bağlı mahalle. Mahalle herkese gösterilmez; işletme adına Mahallem paylaşımı ve
 * mahalle sayfası için kullanılır (PROJE.md 5.7).
 */
export function RegionPicker({
  provinceCode,
  districtId,
  neighbourhoodId,
  withNeighbourhood,
  onChange,
}: {
  provinceCode?: string;
  districtId?: string;
  neighbourhoodId?: string;
  withNeighbourhood?: boolean;
  onChange(v: { provinceCode?: string; districtId?: string; neighbourhoodId?: string }): void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<'province' | 'district' | 'neighbourhood' | null>(null);
  const [hoods, setHoods] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!withNeighbourhood || !districtId) return setHoods([]);
    let alive = true;
    repo.getNeighbourhoods(districtId).then((l) => alive && setHoods(l.map((n) => ({ id: n.id, name: n.name }))), () => alive && setHoods([]));
    return () => {
      alive = false;
    };
  }, [withNeighbourhood, districtId]);
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
            onChange({ provinceCode: p.id, districtId: p.id === provinceCode ? districtId : undefined, neighbourhoodId: p.id === provinceCode ? neighbourhoodId : undefined });
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
            onChange({ provinceCode, districtId: d.id, neighbourhoodId: d.id === districtId ? neighbourhoodId : undefined });
            setOpen(withNeighbourhood ? 'neighbourhood' : null);
          }}
        />
      ) : null}
      {withNeighbourhood && districtId ? (
        <Trigger label={t('business.neighbourhood')} value={hoods.find((h) => h.id === neighbourhoodId)?.name} open={open === 'neighbourhood'} onPress={() => setOpen(open === 'neighbourhood' ? null : 'neighbourhood')} />
      ) : null}
      {open === 'neighbourhood' && districtId ? (
        <ChoiceList
          items={hoods}
          selected={neighbourhoodId}
          onSelect={(n) => {
            onChange({ provinceCode, districtId, neighbourhoodId: n.id });
            setOpen(null);
          }}
        />
      ) : null}
    </View>
  );
}

/** Yalnızca il seçimi (Seyahat > Planla: nereden, nereye). */
export function ProvincePicker({ label, value, onChange }: { label: string; value?: string; onChange(code: string): void }) {
  const [open, setOpen] = useState(false);
  const provinces = useMemo(() => repo.getProvinces().map((p) => ({ id: p.code, name: p.name })), []);
  return (
    <View style={styles.group}>
      <Trigger label={label} value={value ? repo.getProvince(value)?.name : undefined} open={open} onPress={() => setOpen(!open)} />
      {open ? (
        <ChoiceList
          items={provinces}
          selected={value}
          onSelect={(p) => {
            onChange(p.id);
            setOpen(false);
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
    () => (query.trim() ? searchCategoryTree(tree, query, lang).flatMap((n) => n.children.map((child) => ({ child, parent: n.category }))).slice(0, 40) : []),
    [tree, query, lang],
  );
  // Gezinme (Eren, 12 Kasım 2026: "insanlar kendi alanını bulmakta zorlanır"): yazmadan da gruplar görünür, gruba dokununca hizmetleri açılır.
  const [openId, setOpenId] = useState<string | null>(null);
  const openNode = openId ? tree.find((n) => n.category.id === openId) : undefined;
  const searching = !!query.trim();
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : selected.length < max ? [...selected, id] : selected);

  const choice = (child: ServiceCategory, parent?: ServiceCategory) => {
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
        <MaterialIcons name={iconOf(child.icon)} size={20} color={isOn ? c.primary : c.icon} />
        <View style={styles.flex}>
          <AppText>{localized(child.names, lang)}</AppText>
          {parent ? <AppText variant="caption" muted>{localized(parent.names, lang)}</AppText> : null}
        </View>
        <MaterialIcons name={isOn ? 'check-box' : 'check-box-outline-blank'} size={22} color={isOn ? c.primary : c.textSoft} />
      </Pressable>
    );
  };

  return (
    <View style={styles.group}>
      {selected.length ? (
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
      ) : null}
      <SearchField value={query} onChangeText={setQuery} placeholder={t('business.categorySearch')} />
      {searching ? (
        results.length ? (
          <View style={[styles.list, { borderColor: c.border, backgroundColor: c.surface }]}>{results.map(({ child, parent }) => choice(child, parent))}</View>
        ) : (
          <AppText variant="caption" muted>{t('business.categoryNotFound')}</AppText>
        )
      ) : openNode ? (
        <View style={[styles.list, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('business.categoryGroupsBack')}
            onPress={() => setOpenId(null)}
            style={({ pressed }) => [styles.choice, { opacity: pressed ? 0.7 : 1 }]}>
            <MaterialIcons name={I18nManager.isRTL ? 'chevron-right' : 'chevron-left'} size={24} color={c.primary} />
            <AppText variant="label" style={[styles.flex, { color: c.textStrong }]}>{localized(openNode.category.names, lang)}</AppText>
            <AppText variant="caption" style={{ color: c.primary }}>{t('business.categoryGroupsBack')}</AppText>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          {openNode.children.map((child) => choice(child))}
        </View>
      ) : (
        <>
          <AppText variant="caption" muted>{t('business.categoryBrowseHint')}</AppText>
          <View style={styles.groupGrid}>
            {tree.map((n) => {
              const count = n.children.filter((x) => selected.includes(x.id)).length;
              return (
                <Pressable
                  key={n.category.id}
                  accessibilityRole="button"
                  accessibilityLabel={localized(n.category.names, lang)}
                  accessibilityHint={count ? t('business.categorySelectedCount', { count }) : undefined}
                  onPress={() => setOpenId(n.category.id)}
                  style={({ pressed }) => [
                    styles.groupTile,
                    { backgroundColor: count ? c.accentSoft : c.surface, borderColor: count ? c.accentBorder : c.border, opacity: pressed ? 0.8 : 1 },
                  ]}>
                  <MaterialIcons name={iconOf(n.category.icon)} size={20} color={c.primary} />
                  <AppText variant="caption" numberOfLines={2} style={[styles.flex, { color: c.textStrong }]}>{localized(n.category.names, lang)}</AppText>
                  {count ? <AppText variant="caption" style={{ color: c.primary }}>{count}</AppText> : null}
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      {/* Listede yoksa: grubun "Diğer" seçeneği + eksik hizmeti bildir (panelde "Eksik hizmet önerileri"ne düşer). */}
      <View style={[styles.notListed, { borderColor: c.border }]}>
        <AppText variant="caption" muted style={styles.flex}>{t('business.categoryNotListed')}</AppText>
        <Pressable accessibilityRole="link" onPress={() => router.push('/services/suggest')} hitSlop={8}>
          <AppText variant="caption" style={{ color: c.primary, fontWeight: '600' }}>{t('business.categorySuggest')}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const iconOf = (name: string) => (name in MaterialIcons.glyphMap ? name : 'category') as never;

/** Yeme-içme işletmesinin türleri (kafe, restoran, kebap…): hizmet kategorileri yerine seçilir. */
export function FoodKindPicker({ selected, max, onChange }: { selected: string[]; max: number; onChange(ids: string[]): void }) {
  const { t } = useTranslation();
  return <IconChipPicker options={FOOD_KINDS.map((k) => ({ id: k.id, icon: k.icon, label: t(`food.kinds.${k.id}`) }))} selected={selected} max={max} onChange={onChange} />;
}

/**
 * Simgeli çoklu seçim (yeme-içme türleri, yol üstü tesis çeşidi ve olanakları). Listede olmayan seçimler dışarıda
 * kalır; max dolunca seçilmemişler soluklaşır.
 */
export function IconChipPicker({ options, selected, max, onChange }: { options: { id: string; icon: string; label: string }[]; selected: string[]; max?: number; onChange(ids: string[]): void }) {
  const c = useThemeColors();
  const own = selected.filter((id) => options.some((k) => k.id === id));
  const full = max !== undefined && own.length >= max;
  const toggle = (id: string) => onChange(own.includes(id) ? own.filter((x) => x !== id) : full ? own : [...own, id]);
  return (
    <View style={styles.chips}>
      {options.map((k) => {
        const on = own.includes(k.id);
        const disabled = !on && full;
        return (
          <Pressable
            key={k.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled }}
            disabled={disabled}
            onPress={() => toggle(k.id)}
            style={[styles.chip, styles.foodChip, on ? { backgroundColor: c.primary, borderColor: c.primary } : { borderColor: c.border, backgroundColor: c.surface, opacity: disabled ? 0.5 : 1 }]}>
            <MaterialIcons name={(k.icon in MaterialIcons.glyphMap ? k.icon : 'check') as never} size={16} color={on ? c.onPrimary : c.icon} />
            <AppText variant="caption" style={{ color: on ? c.onPrimary : c.text }}>{k.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  foodChip: { minHeight: 38, paddingHorizontal: spacing.md },
  group: { gap: spacing.sm },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH + 8, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  list: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: 2 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH, paddingHorizontal: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, minHeight: 32 },
  groupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  groupTile: { flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: MIN_TOUCH + 4, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  notListed: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
