import { MaterialIcons } from '@expo/vector-icons';
import { useState, type ComponentProps, type PropsWithChildren, type ReactNode } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useSettings } from '@/lib/settings';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';
import { HeroHeader } from './hero-header';
import { OptionRow } from './option-row';
import { SceneArt, type SceneKind } from './scene-art';
import { Screen } from './screen';

/*
 * İç ekranların ortak parçaları (13. madde 35): tek filtre satırı (ilçe açılır düğmesi + türler, normal harf, altın
 * seçili), bölüm başlığı, tek yüzeyde liste satırları, öne çıkan büyük kart, etiket.
 */

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** Altın seçili filtre düğmesi. */
export function FilterChip({ label, active, onPress, icon }: { label: string; active: boolean; onPress(): void; icon?: IconName }) {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active ? { backgroundColor: c.primary, borderColor: c.primary } : { backgroundColor: c.surface, borderColor: c.border }]}>
      {icon ? <MaterialIcons name={icon} size={15} color={active ? c.onPrimary : c.textMuted} /> : null}
      <AppText style={[styles.chipText, { color: active ? c.onPrimary : c.textStrong }]}>{label}</AppText>
    </Pressable>
  );
}

export interface PickOption {
  id: string;
  name: string;
}

/**
 * Tek filtre satırı: başta ilçe açılır düğmesi (seçenek 2'den azsa çıkmaz), ardından yana kayan tür düğmeleri.
 * Türlerin ilki "Tümü"dür; `kinds` boşsa yalnızca ilçe düğmesi kalır.
 */
export function FilterRow({
  districts,
  district,
  onDistrict,
  kinds = [],
  kind,
  onKind,
  extra,
}: {
  districts?: PickOption[];
  district?: string | null;
  onDistrict?(id: string | null): void;
  kinds?: PickOption[];
  kind?: string | null;
  onKind?(id: string | null): void;
  /** Satırın sonuna eklenen özel düğmeler (ör. "Şu an açık"). */
  extra?: ReactNode;
}) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  const picked = districts?.find((d) => d.id === district);
  const hasDistricts = !!districts && districts.length > 1 && !!onDistrict;
  if (!hasDistricts && kinds.length < 2 && !extra) return null;
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {hasDistricts ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('city.district')}: ${picked?.name ?? t('city.allDistricts')}`}
            onPress={() => setOpen(true)}
            style={[styles.chip, { backgroundColor: picked ? c.accentSoft : c.surface, borderColor: picked ? c.primary : c.border }]}>
            <AppText style={[styles.chipText, { color: c.textStrong }]}>{picked?.name ?? t('city.allDistricts')}</AppText>
            <MaterialIcons name="expand-more" size={18} color={c.textMuted} />
          </Pressable>
        ) : null}
        {kinds.length > 1 && onKind ? (
          <>
            <FilterChip label={t('city.all')} active={!kind} onPress={() => onKind(null)} />
            {kinds.map((k) => (
              <FilterChip key={k.id} label={k.name} active={kind === k.id} onPress={() => onKind(kind === k.id ? null : k.id)} />
            ))}
          </>
        ) : null}
        {extra}
      </ScrollView>
      {hasDistricts ? (
        <PickerModal
          visible={open}
          title={t('city.district')}
          options={[{ id: '', name: t('city.allDistricts') }, ...districts!]}
          selectedId={district ?? ''}
          onSelect={(id) => {
            onDistrict!(id || null);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/** Tam ekran seçim listesi (ilçe vb.). */
export function PickerModal({ visible, title, options, selectedId, onSelect, onClose }: { visible: boolean; title: string; options: PickOption[]; selectedId?: string; onSelect(id: string): void; onClose(): void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen header={<HeroHeader title={title} onBack={onClose} />}>
        <FlatList
          data={options}
          keyExtractor={(o) => o.id || 'all'}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
          renderItem={({ item }) => <OptionRow title={item.name} selected={item.id === selectedId} onPress={() => onSelect(item.id)} />}
        />
      </Screen>
    </Modal>
  );
}

/** Bölüm başlığı; sağda küçük açıklama ya da bağlantı. */
export function SectionTitle({ title, aside, onAside }: { title: string; aside?: string; onAside?(): void }) {
  const c = useThemeColors();
  return (
    <View style={styles.section}>
      <AppText accessibilityRole="header" style={[styles.sectionTitle, { color: c.textStrong }]}>{title}</AppText>
      {aside ? (
        <AppText onPress={onAside} accessibilityRole={onAside ? 'link' : undefined} style={[styles.sectionAside, { color: onAside ? c.primary : c.textMuted }]}>
          {aside}
        </AppText>
      ) : null}
    </View>
  );
}

/** Satırların tek kart yüzeyinde durduğu liste. */
export function ListSurface({ children }: PropsWithChildren) {
  const c = useThemeColors();
  return <View style={[styles.surface, { backgroundColor: c.surface, borderColor: c.border }]}>{children}</View>;
}

/** Liste satırı: solda simge / küçük resim, ad, alt bilgi, sağda etiket ya da ok. */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  first,
  onPress,
  accessibilityLabel,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  first?: boolean;
  onPress?(): void;
  accessibilityLabel?: string;
}) {
  const c = useThemeColors();
  const { rtl } = useSettings();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }, { opacity: pressed ? 0.75 : 1 }]}>
      {leading}
      <View style={styles.listText}>
        <AppText style={[styles.listTitle, { color: c.textStrong }]} numberOfLines={2}>{title}</AppText>
        {subtitle ? <AppText style={[styles.listSub, { color: c.textMuted }]} numberOfLines={2}>{subtitle}</AppText> : null}
      </View>
      {trailing}
      {onPress ? <MaterialIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={20} color={c.textSoft} /> : null}
    </Pressable>
  );
}

/** Küçük etiket ("Ücretsiz", "Reklam", "Yeni"). */
export function Tag({ label, tone = 'gold' }: { label: string; tone?: 'gold' | 'green' | 'muted' | 'red' }) {
  const c = useThemeColors();
  const bg = { gold: c.accentSoft, green: `${c.success}22`, muted: c.surfaceStrong, red: `${c.danger}22` }[tone];
  const fg = { gold: c.primary, green: c.success, muted: c.textMuted, red: c.danger }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <AppText style={[styles.tagText, { color: fg }]}>{label}</AppText>
    </View>
  );
}

/** Öne çıkan büyük kart: sahne çizimi üstünde ad ve bilgi (Müzeler önizlemesi). */
export function FeaturedCard({ kind, badge, title, meta, tag, onPress }: { kind: SceneKind; badge: string; title: string; meta?: string; tag?: ReactNode; onPress?(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[badge, title, meta].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.featured, { transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
      <SceneArt kind={kind} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.featuredDim]} />
      <View style={styles.featuredBadge}>
        <AppText style={styles.featuredBadgeText}>{badge}</AppText>
      </View>
      <View style={styles.featuredBottom}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={styles.featuredTitle} numberOfLines={2}>{title}</AppText>
          {meta ? <AppText style={styles.featuredMeta} numberOfLines={1}>{meta}</AppText> : null}
        </View>
        {tag}
      </View>
    </Pressable>
  );
}

/** Liste satırının baş simgesi: yuvarlak köşeli renkli kutu. */
export function RowIcon({ icon, tint, size = 40 }: { icon: IconName; tint: string; size?: number }) {
  return (
    <View style={[styles.rowIcon, { width: size, height: size, backgroundColor: `${tint}24` }]}>
      <MaterialIcons name={icon} size={Math.round(size * 0.5)} color={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs + 2, paddingVertical: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  section: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, paddingTop: spacing.xs },
  sectionTitle: { flex: 1, fontFamily: fonts.heading, fontSize: 17, lineHeight: 23 },
  sectionAside: { fontSize: 12.5 },
  surface: { borderRadius: radius.xl, borderWidth: 1, paddingHorizontal: spacing.md, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingVertical: spacing.sm + 2 },
  listText: { flex: 1, gap: 2 },
  listTitle: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20 },
  listSub: { fontSize: 12.5, lineHeight: 17 },
  tag: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2, alignSelf: 'center' },
  tagText: { fontFamily: fonts.bodySemi, fontSize: 11 },
  featured: { height: 190, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  featuredDim: { backgroundColor: 'rgba(8, 26, 30, 0.35)' },
  featuredBadge: { position: 'absolute', top: 12, start: 12, backgroundColor: 'rgba(8, 26, 30, 0.7)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  featuredBadgeText: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: '#FFFFFF' },
  featuredBottom: { position: 'absolute', start: 14, end: 14, bottom: 12, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  featuredTitle: { fontFamily: fonts.heading, fontSize: 19, lineHeight: 24, color: '#FFFFFF' },
  featuredMeta: { fontSize: 12.5, color: '#D5E2E3' },
  rowIcon: { borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
