import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Animated, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  buildCategoryTree,
  localized,
  searchCategoryTree,
  telUrl,
  type EmergencyNumber,
  type LanguageCode,
  type ServiceCategory,
} from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { useReduceMotion } from '@/components/scene-art';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { StateMessage } from '@/components/state-message';
import { isFirebaseConfigured } from '@/lib/firebase-config';
import { locationRepository } from '@/lib/locations';
import { useServiceCategories } from '@/lib/service-categories';
import { emergencyNumbers } from '@/lib/services';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { MIN_TOUCH, fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
const iconOf = (c: ServiceCategory) => (c.icon in MaterialIcons.glyphMap ? c.icon : 'handyman') as IconName;

/** İlk açılışta gösterilen ana kategori sayısı; kalanı "Diğer N kategori" ile açılır. */
const FIRST_CATEGORIES = 3;
/** "Hemen lazım olabilir" kutucuk sınırı (panelde "acil" işaretli alt kategoriler, panel sırasıyla). */
const QUICK_LIMIT = 11;

/**
 * Acil İhtiyaçlar (PROJE.md 5.4; tasarım: acil-ihtiyaclar.html, 29 Ekim 2026 yeni düzen): ince SOS şeridi; "Dokun ve
 * ara" (112 büyük, üç numara küçük, kalanlar "Diğer" ile açılır; uygulama kendiliğinden aramaz); hizmet araması;
 * "Hemen lazım olabilir" (panelde acil işaretli hizmetler, nöbetçi eczane yakında); açılır kategoriler; "Aradığın
 * hizmet yok mu? Bildir". Numaralar internet olmadan da görünür (saklı liste).
 */
export default function UrgentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language, rtl } = useSettings();
  const lang: LanguageCode = language ?? 'tr';
  const { location } = useUserLocation();
  const { all } = useServiceCategories();
  const [numbers, setNumbers] = useState<EmergencyNumber[]>([]);
  const [stale, setStale] = useState(false);
  const [callError, setCallError] = useState<string>();
  const [moreNumbers, setMoreNumbers] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [allCategories, setAllCategories] = useState(false);

  useEffect(() => {
    let alive = true;
    emergencyNumbers.cached().then((list) => alive && setNumbers((cur) => (cur.length ? cur : list)));
    if (isFirebaseConfigured) {
      emergencyNumbers
        .refresh()
        .then((list) => alive && (setNumbers(list), setStale(false)))
        .catch(() => alive && setStale(true));
    }
    return () => {
      alive = false;
    };
  }, []);

  const call = async (n: EmergencyNumber) => {
    setCallError(undefined);
    try {
      await Linking.openURL(telUrl(n.number));
    } catch {
      setCallError(t('urgent.callFailed', { number: n.number }));
    }
  };

  // SOS düğmesinin çevresindeki nabız; "hareketi azalt" açıksa durur.
  const reduce = useReduceMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduce, pulse]);

  const tree = useMemo(() => buildCategoryTree(all), [all]);
  const results = useMemo(() => searchCategoryTree(tree, query, lang), [tree, query, lang]);
  const searching = query.trim().length > 0;
  const quick = useMemo(() => tree.flatMap((n) => n.children.filter((x) => x.urgent)).slice(0, QUICK_LIMIT), [tree]);
  const shownTree = allCategories ? tree : tree.slice(0, FIRST_CATEGORIES);
  const province = location ? locationRepository.getProvince(location.provinceCode)?.name : undefined;
  const chevron = rtl ? 'chevron-left' : 'chevron-right';

  const primary = numbers.find((n) => n.number === '112');
  const rest = numbers.filter((n) => n !== primary);
  const main = rest.slice(0, 3);
  const extra = rest.slice(3);
  const nameOf = (n: EmergencyNumber) => localized(n.names, lang) ?? n.number;
  const openService = (x: ServiceCategory) => router.push({ pathname: '/services/[id]', params: { id: x.id } });
  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const smallNumber = (n: EmergencyNumber) => (
    <Pressable
      key={n.id}
      accessibilityRole="button"
      accessibilityLabel={t('urgent.call', { name: nameOf(n), number: n.number })}
      accessibilityHint={localized(n.notes, lang)}
      onPress={() => call(n)}
      style={({ pressed }) => [styles.small, { backgroundColor: c.surface, borderColor: c.sosBorder, opacity: pressed ? 0.75 : 1 }]}>
      <View style={styles.smallTop}>
        <AppText style={[styles.smallNumber, { color: c.sosText }]}>{n.number}</AppText>
        <MaterialIcons name="call" size={14} color={c.sosText} />
      </View>
      <AppText style={[styles.smallName, { color: c.textMuted }]} numberOfLines={1}>{nameOf(n)}</AppText>
    </Pressable>
  );

  const tile = (key: string, icon: IconName, label: string, onPress?: () => void, soon?: boolean) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress }}
      accessibilityLabel={soon ? `${label}. ${t('urgent.comingSoon')}` : label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.75 : 1 }]}>
      <View style={[styles.tileIcon, { backgroundColor: soon ? c.background : c.accentSoft }]}>
        <MaterialIcons name={icon} size={22} color={soon ? c.textSoft : c.icon} />
      </View>
      <AppText style={[styles.tileText, { color: soon ? c.textMuted : c.text }]} numberOfLines={2}>{label}</AppText>
      {soon ? <AppText style={[styles.soon, { color: c.highlight }]}>{t('urgent.comingSoon')}</AppText> : null}
    </Pressable>
  );

  const header = <HeroHeader title={t('urgent.title')} subtitle={province} onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />;

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* SOS: ince ama ekranın en belirgin öğesi; düğmenin çevresinde yavaş nabız. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('urgent.sos')}. ${t('urgent.sosHint')}`}
          onPress={() => router.push('/sos')}
          style={({ pressed }) => [styles.sos, { backgroundColor: c.sosDeep, opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
          <View style={styles.sosButton}>
            <Animated.View
              style={[
                styles.pulse,
                {
                  borderColor: c.sos,
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }],
                },
              ]}
            />
            <View style={[styles.sosCircle, { backgroundColor: c.sos }]}>
              <AppText style={[styles.sosText, { color: c.onSos }]}>SOS</AppText>
            </View>
          </View>
          <View style={styles.flex}>
            <AppText style={[styles.sosTitle, { color: c.onSos }]}>{t('urgent.sos')}</AppText>
            <AppText style={styles.sosHint}>{t('urgent.sosHint')}</AppText>
          </View>
          <MaterialIcons name={chevron} size={24} color={c.onSos} />
        </Pressable>

        {/* Dokun ve ara */}
        <AppText variant="subtitle" accessibilityRole="header">{t('urgent.numbersTitle')}</AppText>
        {callError ? <FormMessage kind="error" text={callError} /> : null}
        <View style={styles.numbers}>
          {primary ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('urgent.call', { name: nameOf(primary), number: primary.number })}
              accessibilityHint={localized(primary.notes, lang)}
              onPress={() => call(primary)}
              style={({ pressed }) => [styles.big, { backgroundColor: c.sos, opacity: pressed ? 0.85 : 1 }]}>
              <View style={styles.bigTop}>
                <MaterialIcons name={(primary.icon in MaterialIcons.glyphMap ? primary.icon : 'emergency') as IconName} size={24} color={c.onSos} />
                <View style={styles.bigCall}>
                  <MaterialIcons name="call" size={16} color={c.onSos} />
                </View>
              </View>
              <View>
                <AppText style={[styles.bigNumber, { color: c.onSos }]}>{primary.number}</AppText>
                <AppText style={[styles.bigName, { color: c.onSos }]} numberOfLines={2}>{nameOf(primary)}</AppText>
              </View>
            </Pressable>
          ) : null}
          <View style={styles.smallGrid}>
            {main.map(smallNumber)}
            {extra.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: moreNumbers }}
                accessibilityLabel={moreNumbers ? t('urgent.lessNumbers') : t('urgent.moreNumbers', { list: extra.map((n) => n.number).join(', ') })}
                onPress={() => setMoreNumbers((v) => !v)}
                style={({ pressed }) => [styles.small, { backgroundColor: c.sosSoft, borderColor: c.sosBorder, opacity: pressed ? 0.75 : 1 }]}>
                <View style={styles.smallTop}>
                  <AppText style={[styles.smallNumber, styles.flex, { color: c.sosText }]} numberOfLines={1}>{moreNumbers ? t('urgent.less') : t('urgent.more')}</AppText>
                  <MaterialIcons name={moreNumbers ? 'expand-less' : 'expand-more'} size={18} color={c.sosText} />
                </View>
                <AppText style={[styles.smallName, { color: c.textMuted }]} numberOfLines={1}>{extra.map((n) => n.number).join(' · ')}</AppText>
              </Pressable>
            ) : null}
          </View>
        </View>
        {moreNumbers ? <View style={styles.extraGrid}>{extra.map(smallNumber)}</View> : null}
        <View style={styles.noteRow}>
          <MaterialIcons name="info-outline" size={14} color={c.textSoft} />
          <AppText style={[styles.note, { color: c.textSoft }]}>{t('urgent.dialNote')}</AppText>
        </View>
        {stale ? <AppText variant="caption" muted>{t('urgent.cachedNote')}</AppText> : null}

        {/* Hizmet araması */}
        <SearchField value={query} onChangeText={setQuery} placeholder={t('urgent.searchPlaceholder')} />

        {searching ? (
          <>
            {results.length === 0 ? <StateMessage kind="empty" message={t('services.noMatch')} /> : null}
            <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
              {results.flatMap((n) => n.children).map((x, i) => (
                <Pressable
                  key={x.id}
                  accessibilityRole="button"
                  onPress={() => openService(x)}
                  style={({ pressed }) => [styles.listRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }, { opacity: pressed ? 0.7 : 1 }]}>
                  <MaterialIcons name={iconOf(x)} size={20} color={c.icon} />
                  <AppText style={styles.flex}>{localized(x.names, lang)}</AppText>
                  {x.urgent ? <View style={[styles.dot, { backgroundColor: c.sos }]} /> : null}
                  <MaterialIcons name={chevron} size={22} color={c.textSoft} />
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            {/* Hemen lazım olabilir */}
            <AppText variant="subtitle" accessibilityRole="header">{t('urgent.quickTitle')}</AppText>
            <View style={styles.tiles}>
              {tile('pharmacy', 'local-pharmacy', t('urgent.pharmacy'), undefined, true)}
              {quick.map((x) => tile(x.id, iconOf(x), localized(x.names, lang) ?? x.names.tr, () => openService(x)))}
            </View>

            {/* Tüm hizmetler: açılır kategoriler, içinde simgeli alt hizmetler */}
            <AppText variant="subtitle" accessibilityRole="header">{t('urgent.allTitle')}</AppText>
            <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
              {shownTree.map(({ category, children }, i) => {
                const expanded = open.has(category.id);
                const name = localized(category.names, lang) ?? category.names.tr;
                return (
                  <View key={category.id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border } : null}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      accessibilityLabel={`${name}, ${t('services.subcategories', { count: children.length })}`}
                      onPress={() => toggle(category.id)}
                      style={({ pressed }) => [styles.listRow, { opacity: pressed ? 0.75 : 1 }]}>
                      <View style={[styles.catIcon, { backgroundColor: c.accentSoft }]}>
                        <MaterialIcons name={iconOf(category)} size={20} color={c.icon} />
                      </View>
                      <AppText variant="label" style={styles.flex}>{name}</AppText>
                      <AppText style={[styles.count, { color: c.textSoft }]}>{children.length}</AppText>
                      <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={24} color={c.textSoft} />
                    </Pressable>
                    {expanded ? (
                      <View style={styles.childGrid}>
                        {children.map((x) => (
                          <Pressable
                            key={x.id}
                            accessibilityRole="button"
                            accessibilityLabel={x.urgent ? `${localized(x.names, lang)}, ${t('services.urgentBadge')}` : localized(x.names, lang)}
                            onPress={() => openService(x)}
                            style={({ pressed }) => [styles.child, { backgroundColor: c.background, opacity: pressed ? 0.7 : 1 }]}>
                            <MaterialIcons name={iconOf(x)} size={20} color={c.icon} />
                            <AppText style={[styles.childText, { color: c.text }]} numberOfLines={2}>{localized(x.names, lang)}</AppText>
                            {x.urgent ? <View style={[styles.dot, styles.childDot, { backgroundColor: c.sos }]} /> : null}
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {tree.length > FIRST_CATEGORIES ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: allCategories }}
                  onPress={() => setAllCategories((v) => !v)}
                  style={({ pressed }) => [styles.listRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, opacity: pressed ? 0.75 : 1 }]}>
                  <View style={[styles.catIcon, { backgroundColor: c.background }]}>
                    <MaterialIcons name={allCategories ? 'unfold-less' : 'apps'} size={20} color={c.textMuted} />
                  </View>
                  <AppText variant="label" style={styles.flex}>
                    {allCategories ? t('urgent.fewerCategories') : t('urgent.moreCategories', { count: tree.length - FIRST_CATEGORIES })}
                  </AppText>
                  <MaterialIcons name={allCategories ? 'expand-less' : 'expand-more'} size={24} color={c.textSoft} />
                </Pressable>
              ) : null}
            </View>
          </>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/services/suggest')}
          style={({ pressed }) => [styles.missing, { borderColor: c.accentBorder, opacity: pressed ? 0.75 : 1 }]}>
          <MaterialIcons name="add-circle-outline" size={20} color={c.accent} />
          <AppText style={[styles.missingText, { color: c.accent }]}>{t('urgent.missing')}</AppText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1, gap: 2 },
  sos: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, borderRadius: radius.xl, minHeight: 76 },
  sosButton: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', width: 50, height: 50, borderRadius: 25, borderWidth: 3 },
  sosCircle: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  sosText: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: 1 },
  sosTitle: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 20 },
  sosHint: { fontSize: 12, lineHeight: 16, color: 'rgba(255, 255, 255, 0.82)' },
  numbers: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  big: { flex: 1.15, borderRadius: radius.lg, padding: spacing.md, justifyContent: 'space-between', minHeight: 132 },
  bigTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bigCall: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255, 255, 255, 0.22)', alignItems: 'center', justifyContent: 'center' },
  bigNumber: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40 },
  bigName: { fontSize: 12, lineHeight: 16, opacity: 0.92 },
  smallGrid: { flex: 1.6, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  extraGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  small: { flexBasis: '46%', flexGrow: 1, minHeight: 62, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center', gap: 2 },
  smallTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  smallNumber: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 22 },
  smallName: { fontSize: 11, lineHeight: 14 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -spacing.xs },
  note: { flex: 1, fontSize: 11, lineHeight: 15 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexBasis: '22%', flexGrow: 1, maxWidth: '24%', minHeight: 92, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 4, gap: 6 },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 14, textAlign: 'center' },
  soon: { fontFamily: fonts.bodySemi, fontSize: 9, letterSpacing: 0.5 },
  list: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, minHeight: MIN_TOUCH + 8 },
  catIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 12 },
  childGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  child: { flexBasis: '30%', flexGrow: 1, maxWidth: '33%', minHeight: 72, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', padding: 8, gap: 4 },
  childText: { fontSize: 11, lineHeight: 14, textAlign: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  childDot: { position: 'absolute', top: 8, end: 8 },
  missing: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: MIN_TOUCH, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed' },
  missingText: { fontFamily: fonts.bodySemi, fontSize: 13 },
});
