import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { fonts, radius, spacing } from '@/theme/tokens';
import { useResolvedScheme, useThemeColors } from '@/theme/use-theme';
import { AppText } from './app-text';
import { FrostFill } from './glass';
import { LineIcon } from './line-icon';
import { Tag } from './inner';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/*
 * Benim Şehrim alt sayfalarının yeni görünümü (Eren 7 Kasım 2026, cam taslağı): yumuşak tırnaklı başlıklar, ince çizgili
 * simgeler, buzlu cam kutular. Uzun listeler önce türe ve ilçeye göre kutularla açılır.
 */

/** Cam yüzey: koyu modda petrol yeşili geçişli dolgu, ince açık kenar. */
export function GlassBox({ children, style, gold, onPress, label }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; gold?: boolean; onPress?(): void; label?: string }>) {
  const c = useThemeColors();
  const dark = useResolvedScheme() === 'dark';
  const box = [styles.glass, frost(dark, c.surface, gold ? c.accentBorder : c.border), style];
  if (!onPress) {
    return (
      <View style={box}>
        <FrostFill />
        {children}
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [box, { opacity: pressed ? 0.8 : 1 }]}>
      <FrostFill />
      {children}
    </Pressable>
  );
}

/**
 * Cam yüzey renkleri: koyu modda yarı saydam zemin (arkadaki ışık görünür), ince açık kenar ve üstte daha parlak bir çizgi
 * (ışığın kenara vurması). Açık modda kartın kendi beyaz zemini.
 */
export function frost(dark: boolean, surface: string, border: string): ViewStyle {
  if (!dark) return { backgroundColor: surface, borderColor: border };
  const gold = border.startsWith('rgba(226');
  return { backgroundColor: 'rgba(10, 38, 42, 0.42)', borderColor: gold ? border : 'rgba(220, 240, 236, 0.12)', borderTopColor: gold ? border : 'rgba(235, 248, 245, 0.24)' };
}

/** Bölüm başlığı (tırnaklı yazı); sağda isteğe bağlı bağlantı. */
export function HubTitle({ title, aside, onAside }: { title: string; aside?: string; onAside?(): void }) {
  const c = useThemeColors();
  return (
    <View style={styles.titleRow}>
      <AppText accessibilityRole="header" style={[styles.title, { color: c.textStrong }]}>{title}</AppText>
      {aside ? (
        <AppText onPress={onAside} accessibilityRole={onAside ? 'link' : undefined} style={[styles.aside, { color: onAside ? c.primary : c.textMuted }]}>
          {aside}
        </AppText>
      ) : null}
    </View>
  );
}

/** Satır başındaki sade simge kutusu. */
export function LineTile({ icon, size = 38, gold }: { icon: IconName; size?: number; gold?: boolean }) {
  const c = useThemeColors();
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size * 0.32), backgroundColor: gold ? c.accentSoft : c.surfaceStrong }]}>
      <LineIcon name={icon} size={Math.round(size * 0.52)} color={gold ? c.primary : c.textStrong} />
    </View>
  );
}

/** "Türüne göre" kutusu: simge, büyük sayı, ad. */
export function KindTile({ icon, name, count, onPress }: { icon: IconName; name: string; count: number; onPress(): void }) {
  const c = useThemeColors();
  return (
    <GlassBox style={styles.kind} onPress={onPress} label={`${name}, ${count}`}>
      <LineTile icon={icon} size={40} gold />
      <View style={styles.gap2}>
        <AppText style={[styles.bigCount, { color: c.textStrong }]}>{count}</AppText>
        <AppText style={[styles.kindName, { color: c.textStrong }]} numberOfLines={2}>{name}</AppText>
      </View>
    </GlassBox>
  );
}

/** "İlçene göre" kutusu: ad ve sayı; kullanıcının ilçesi altın çerçeveli. */
export function DistrictTile({ name, note, mine, onPress }: { name: string; note: string; mine?: boolean; onPress(): void }) {
  const c = useThemeColors();
  return (
    <GlassBox style={styles.district} gold={mine} onPress={onPress} label={`${name}, ${note}`}>
      <AppText style={[styles.districtName, { color: mine ? c.primary : c.textStrong }]} numberOfLines={1}>{name}</AppText>
      <AppText style={[styles.small, { color: c.textMuted }]} numberOfLines={1}>{note}</AppText>
    </GlassBox>
  );
}

/** Altın ya da cam yuvarlak düğme (Ara, Yol tarifi, Tümünü listele). */
export function PillButton({ label, icon, gold, small, onPress }: { label: string; icon?: IconName; gold?: boolean; small?: boolean; onPress(): void }) {
  const c = useThemeColors();
  const color = gold ? c.onPrimary : c.textStrong;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pill, small && styles.pillSmall, gold ? { backgroundColor: c.primary } : { backgroundColor: 'rgba(220, 240, 236, 0.10)', borderColor: 'rgba(220, 240, 236, 0.16)', borderWidth: 1 }, { opacity: pressed ? 0.85 : 1 }]}>
      {icon ? <MaterialIcons name={icon} size={16} color={color} /> : null}
      <AppText style={[styles.pillText, { color }]}>{label}</AppText>
    </Pressable>
  );
}

/** Satırın sağında tek dokunuşla arama. */
export function CallButton({ onPress }: { onPress(): void }) {
  const c = useThemeColors();
  const { t } = useTranslation();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('city.callShort')} hitSlop={6} onPress={onPress} style={({ pressed }) => [styles.call, { backgroundColor: c.accentSoft, opacity: pressed ? 0.7 : 1 }]}>
      <MaterialIcons name="call" size={17} color={c.primary} />
    </Pressable>
  );
}

/** Öne çıkan kayıt: altın çerçeveli cam kart; ad, adres, Ara ve Yol tarifi. */
export function Spotlight({ tag, title, sub, onCall, onMap, onPress }: { tag?: string; title: string; sub?: string; onCall?(): void; onMap?(): void; onPress(): void }) {
  const c = useThemeColors();
  const { t } = useTranslation();
  return (
    <GlassBox gold style={styles.spot}>
      <Pressable accessibilityRole="button" accessibilityLabel={[title, sub].filter(Boolean).join(', ')} onPress={onPress} style={styles.gap8}>
        {tag ? (
          <View style={styles.tagWrap}>
            <Tag label={tag} />
          </View>
        ) : null}
        <AppText style={[styles.spotTitle, { color: c.textStrong }]} numberOfLines={2}>{title}</AppText>
        {sub ? <AppText style={[styles.small, { color: c.textMuted }]} numberOfLines={2}>{sub}</AppText> : null}
      </Pressable>
      {onCall || onMap ? (
        <View style={styles.btns}>
          {onCall ? <PillButton gold icon="call" label={t('city.callShort')} onPress={onCall} /> : null}
          {onMap ? <PillButton icon="directions" label={t('city.directions')} onPress={onMap} /> : null}
        </View>
      ) : null}
    </GlassBox>
  );
}

/** Seçili tür / ilçe şeridi: ne gösterildiğini söyler, çarpı ile kutulara döner. */
export function SelectionBar({ label, onClear }: { label: string; onClear(): void }) {
  const c = useThemeColors();
  const { t } = useTranslation();
  return (
    <GlassBox style={styles.bar}>
      <AppText style={[styles.barText, { color: c.textStrong }]} numberOfLines={1}>{label}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={t('city.hub.clear')} hitSlop={8} onPress={onClear} style={({ pressed }) => [styles.clear, { backgroundColor: c.surfaceStrong, opacity: pressed ? 0.7 : 1 }]}>
        <MaterialIcons name="close" size={16} color={c.textStrong} />
      </Pressable>
    </GlassBox>
  );
}

export interface InfoLine {
  icon: IconName;
  text: string;
}

/**
 * Aşağı açılan liste satırı (Eren 7 Kasım 2026: liste kısa olsun diye bilgi eksik kalmasın). Kapalıyken ad, kısa
 * bilgi ve hızlı arama; dokununca adres, telefon, saat ve açıklama ile Ara, Yol tarifi, Ayrıntılar açılır.
 */
export function ExpandRow({
  icon,
  title,
  subtitle,
  trailing,
  info,
  open,
  first,
  onToggle,
  onCall,
  onMap,
  onDetail,
  accessibilityLabel,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  info: InfoLine[];
  open: boolean;
  first?: boolean;
  onToggle(): void;
  onCall?(): void;
  onMap?(): void;
  onDetail(): void;
  accessibilityLabel?: string;
}) {
  const c = useThemeColors();
  const { t } = useTranslation();
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };
  return (
    <View style={!first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
        onPress={toggle}
        style={({ pressed }) => [styles.erow, { opacity: pressed ? 0.75 : 1 }]}>
        <LineTile icon={icon} />
        <View style={styles.etext}>
          <AppText style={[styles.etitle, { color: c.textStrong }]} numberOfLines={open ? 3 : 2}>{title}</AppText>
          {subtitle && !open ? <AppText style={[styles.small, { color: c.textMuted }]} numberOfLines={1}>{subtitle}</AppText> : null}
        </View>
        {open ? null : trailing}
        <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={22} color={c.textSoft} />
      </Pressable>
      {open ? (
        <View style={styles.panel}>
          {info.map((l) => (
            <View key={l.icon} style={styles.infoLine}>
              <MaterialIcons name={l.icon} size={16} color={c.primary} style={styles.infoIcon} />
              <AppText selectable style={[styles.infoText, { color: c.textStrong }]}>{l.text}</AppText>
            </View>
          ))}
          <View style={styles.btns}>
            {onCall ? <PillButton gold small icon="call" label={t('city.callShort')} onPress={onCall} /> : null}
            {onMap ? <PillButton small icon="directions" label={t('city.directions')} onPress={onMap} /> : null}
            <PillButton small label={t('city.hub.details')} onPress={onDetail} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Gruplu listede küçük grup adı (DEVLET, ÖZEL…). */
export function GroupLabel({ label }: { label: string }) {
  const c = useThemeColors();
  return <AppText style={[styles.group, { color: c.textMuted }]}>{label.toLocaleUpperCase('tr')}</AppText>;
}

const styles = StyleSheet.create({
  tagWrap: { alignSelf: 'flex-start' },
  glass: { borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, paddingTop: spacing.sm },
  title: { flex: 1, fontFamily: fonts.serif, fontSize: 18, lineHeight: 24 },
  aside: { fontSize: 12.5 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  kind: { flex: 1, padding: 14, gap: 12 },
  gap2: { gap: 2 },
  gap8: { gap: 8, alignItems: 'flex-start' },
  bigCount: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 30 },
  kindName: { fontFamily: fonts.bodyMedium, fontSize: 13.5, lineHeight: 18 },
  district: { flex: 1, minHeight: 58, paddingHorizontal: 12, paddingVertical: 9, gap: 1, borderRadius: radius.lg },
  districtName: { fontFamily: fonts.bodyMedium, fontSize: 13.5, lineHeight: 18 },
  small: { fontSize: 12, lineHeight: 16 },
  pill: { flex: 1, minHeight: 44, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: spacing.md },
  pillSmall: { minHeight: 38, paddingHorizontal: spacing.sm },
  erow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 58, paddingVertical: spacing.sm + 2 },
  etext: { flex: 1, gap: 2 },
  etitle: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 19 },
  panel: { gap: spacing.sm, paddingBottom: spacing.md, paddingStart: 38 + spacing.md },
  infoLine: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  infoIcon: { marginTop: 2 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 13.5 },
  call: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  spot: { padding: spacing.md, gap: spacing.md },
  spotTitle: { fontFamily: fonts.serif, fontSize: 19, lineHeight: 25 },
  btns: { flexDirection: 'row', gap: spacing.sm },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingStart: spacing.md, paddingEnd: 6, minHeight: 46, borderRadius: radius.pill },
  barText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13.5 },
  clear: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  group: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 1.1, marginTop: spacing.sm, marginBottom: spacing.xs, marginHorizontal: 4 },
});
