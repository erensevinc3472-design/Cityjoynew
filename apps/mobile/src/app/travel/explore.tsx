import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TR_REGIONS, TRAVEL_COUNTRIES } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { SceneArt, sceneSky } from '@/components/scene-art';
import { StateMessage } from '@/components/state-message';
import { TravelHeader } from '@/components/travel-header';
import { locationRepository as repo } from '@/lib/locations';
import { REGION_SCENES, useTravelRegions } from '@/lib/travel';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Keşfet ve Öğren (tasarım: kesfet-ogren.html): solda ülke şeridi, sağda bölge kartları. Coğrafya sabittir; her bölge
 * açılır, tanıtımı yayındaysa kartta kısa etiketi görünür. Türkiye dışındaki ülkeler içerik girilene kadar "yakında".
 */
export default function TravelExploreScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { value: regions, failed, retry } = useTravelRegions();
  const [country, setCountry] = useState('TR');
  const total = TR_REGIONS.reduce((n, r) => n + r.provinceCodes.length, 0);
  const selected = TRAVEL_COUNTRIES.find((x) => x.code === country)!;
  const countryName = t(`travel.country.${country}`);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="light" />
      <TravelHeader subtitle={t('travel.route')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
      <View style={styles.body}>
        {/* Ülke şeridi */}
        <ScrollView style={[styles.rail, { backgroundColor: c.hero, borderRightColor: c.border }]} contentContainerStyle={styles.railContent} accessibilityRole="tablist">
          <AppText style={[styles.railLabel, { color: c.heroMuted }]}>{t('travel.countries').toLocaleUpperCase(i18n.language)}</AppText>
          {TRAVEL_COUNTRIES.map((x) => {
            const active = x.code === country;
            const name = t(`travel.country.${x.code}`);
            return (
              <Pressable
                key={x.code}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={x.open ? name : `${name}, ${t('travel.soon')}`}
                onPress={() => setCountry(x.code)}
                style={[styles.country, { opacity: active ? 1 : 0.6 }]}>
                <View style={[styles.flag, { borderColor: active ? c.heroAccent : 'rgba(255,255,255,0.15)' }]}>
                  <AppText style={styles.flagText}>{x.flag}</AppText>
                </View>
                <AppText style={[styles.countryName, { color: active ? c.heroAccent : c.heroMuted }]} numberOfLines={2}>{name.toLocaleUpperCase(i18n.language)}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
          <View style={styles.head}>
            <View style={styles.row}>
              <MaterialIcons name="travel-explore" size={16} color={c.accent} />
              <AppText style={[styles.kicker, { color: c.accent }]}>{t('travel.regionPick').toLocaleUpperCase(i18n.language)}</AppText>
            </View>
            <AppText accessibilityRole="header" style={[styles.h1, { color: c.textStrong }]}>{t('travel.regionsOf', { country: countryName })}</AppText>
            <AppText style={{ color: c.textMuted }}>{selected.open ? t('travel.regionIntro') : t('travel.countrySoon', { country: countryName })}</AppText>
          </View>

          {!selected.open ? (
            <View style={[styles.soonCard, { backgroundColor: sceneSky('travel'), borderColor: c.border }]}>
              <View style={[StyleSheet.absoluteFill, styles.cardArt]}>
                <SceneArt kind="travel" />
              </View>
              <View style={[StyleSheet.absoluteFill, styles.shade]} />
              <AppText style={styles.soonFlag}>{selected.flag}</AppText>
              <AppText style={styles.cardTitle}>{countryName}</AppText>
              <View style={[styles.tag, styles.soonTag]}>
                <AppText style={styles.tagText}>{t('travel.soon').toLocaleUpperCase(i18n.language)}</AppText>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.stats}>
                {[
                  { icon: 'grid-view' as const, text: t('travel.statRegions', { count: TR_REGIONS.length }) },
                  { icon: 'location-city' as const, text: t('travel.statCities', { count: total }) },
                ].map((s) => (
                  <View key={s.icon} style={[styles.stat, { backgroundColor: c.surface, borderColor: c.border }]}>
                    <MaterialIcons name={s.icon} size={16} color={c.accent} />
                    <AppText style={[styles.statText, { color: c.textStrong }]}>{s.text}</AppText>
                  </View>
                ))}
              </View>

              {failed && !regions ? <StateMessage kind="error" onRetry={retry} /> : null}
              {TR_REGIONS.map((r) => {
                const content = regions?.find((x) => x.id === r.id);
                const names = r.provinceCodes.slice(0, 3).map((p) => repo.getProvince(p)?.name).filter(Boolean);
                return (
                  <Pressable
                    key={r.id}
                    accessibilityRole="button"
                    accessibilityLabel={[t(`travel.regions.${r.id}`), content?.tagline].filter(Boolean).join('. ')}
                    onPress={() => router.push({ pathname: '/travel/region/[id]', params: { id: r.id } })}
                    style={({ pressed }) => [styles.card, { borderColor: c.border, backgroundColor: sceneSky(REGION_SCENES[r.id]), opacity: pressed ? 0.9 : 1 }]}>
                    <View style={[StyleSheet.absoluteFill, styles.cardArt]}>
                      <SceneArt kind={REGION_SCENES[r.id]} />
                    </View>
                    <View style={[StyleSheet.absoluteFill, styles.shade]} />
                    <View style={styles.cardTop}>
                      {content?.tagline ? (
                        <View style={styles.tag}>
                          <AppText style={styles.tagText} numberOfLines={1}>{content.tagline.toLocaleUpperCase(i18n.language)}</AppText>
                        </View>
                      ) : (
                        <View />
                      )}
                      <View style={styles.count}>
                        <MaterialIcons name="location-city" size={11} color="#E0B07A" />
                        <AppText style={styles.countText}>{r.provinceCodes.length}</AppText>
                      </View>
                    </View>
                    <View>
                      <AppText style={styles.cardTitle}>{t(`travel.regions.${r.id}`)}</AppText>
                      <AppText style={styles.cardSub} numberOfLines={1}>{names.join(' · ')}</AppText>
                    </View>
                    <View style={styles.go}>
                      <MaterialIcons name="arrow-forward" size={18} color="#081F24" />
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const white = '#FFFFFF';
const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, flexDirection: 'row' },
  flex: { flex: 1 },
  rail: { width: 72, flexGrow: 0, borderRightWidth: StyleSheet.hairlineWidth },
  railContent: { alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  railLabel: { fontFamily: fonts.bodySemi, fontSize: 8, letterSpacing: 1 },
  country: { alignItems: 'center', gap: 4, minHeight: 44, width: 64 },
  flag: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  flagText: { fontSize: 22, lineHeight: 28 },
  countryName: { fontFamily: fonts.bodySemi, fontSize: 8, textAlign: 'center' },
  soonCard: { height: 220, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  soonFlag: { fontSize: 44, lineHeight: 54 },
  soonTag: { flexShrink: 0 },
  content: { padding: GUTTER, gap: spacing.md, paddingBottom: spacing.xl },
  head: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 2 },
  h1: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  stats: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1 },
  statText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  card: { height: 140, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', padding: spacing.md, justifyContent: 'space-between' },
  cardArt: { opacity: 0.85 },
  shade: { backgroundColor: 'rgba(8, 31, 36, 0.45)' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  tag: { flexShrink: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(224,176,122,0.35)', backgroundColor: 'rgba(224,176,122,0.12)' },
  tagText: { color: '#E0B07A', fontFamily: fonts.bodySemi, fontSize: 9, letterSpacing: 1 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.35)' },
  countText: { color: white, fontFamily: fonts.bodySemi, fontSize: 11 },
  cardTitle: { color: white, fontFamily: fonts.heading, fontSize: 19, lineHeight: 24 },
  cardSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 16 },
  go: { position: 'absolute', right: spacing.md, bottom: spacing.md, width: 34, height: 34, borderRadius: 17, backgroundColor: '#E0B07A', alignItems: 'center', justifyContent: 'center' },
});
