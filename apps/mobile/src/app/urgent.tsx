import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Animated, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { localized, telUrl, type EmergencyNumber, type LanguageCode } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { SceneArt, useReduceMotion } from '@/components/scene-art';
import { Screen } from '@/components/screen';
import { isFirebaseConfigured } from '@/lib/firebase-config';
import { emergencyNumbers } from '@/lib/services';
import { useSettings } from '@/lib/settings';
import { MIN_TOUCH, fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** Sonraki parçalarda gelecek bölümler (PROJE.md 5.4). SOS ve Hizmetler hazır, ayrı satırlarda. */
const COMING: { key: 'pharmacy'; icon: IconName }[] = [
  { key: 'pharmacy', icon: 'local-pharmacy' },
];

/**
 * Acil İhtiyaçlar (PROJE.md 5.4). Numaralar dokununca telefonun arama ekranını açan düz bağlantıdır;
 * uygulama kendiliğinden arama yapmaz. Liste önce telefonda saklı (ya da gömülü) listeden gösterilir,
 * böylece internet olmadan da çalışır.
 */
export default function UrgentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language, rtl } = useSettings();
  const lang: LanguageCode = language ?? 'tr';
  const [numbers, setNumbers] = useState<EmergencyNumber[]>([]);
  const [stale, setStale] = useState(false);
  const [callError, setCallError] = useState<string>();

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

  const header = <HeroHeader title={t('urgent.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />;

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View accessible accessibilityRole="summary" style={[styles.warning, { backgroundColor: c.dangerSoft, borderColor: c.danger }]}>
          <MaterialIcons name="warning-amber" size={22} color={c.danger} />
          <View style={styles.flex}>
            <AppText variant="label" style={{ color: c.danger }}>{t('urgent.disclaimerTitle')}</AppText>
            <AppText variant="caption">{t('urgent.disclaimer')}</AppText>
          </View>
        </View>

        {/* SOS: ekranın en belirgin düğmesi; arkada kalp atışı çizgisi, düğmenin çevresinde yavaş nabız. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('urgent.sos')}. ${t('urgent.sosHint')}`}
          onPress={() => router.push('/sos')}
          style={({ pressed }) => [styles.sos, { borderColor: c.danger, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <SceneArt kind="urgent" still />
          <View style={styles.sosInner}>
            <View style={styles.sosButton}>
              <Animated.View style={[styles.pulse, { borderColor: c.danger, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] }]} />
              <View style={[styles.sosCircle, { backgroundColor: c.danger }]}>
                <AppText style={[styles.sosText, { color: c.onDanger }]}>SOS</AppText>
              </View>
            </View>
            <View style={styles.flex}>
              <AppText style={styles.sosTitle}>{t('urgent.sos')}</AppText>
              <AppText style={styles.sosHint}>{t('urgent.sosHint')}</AppText>
            </View>
            <MaterialIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={24} color="#FFFFFF" />
          </View>
        </Pressable>

        <AppText variant="subtitle" accessibilityRole="header">{t('urgent.numbersTitle')}</AppText>
        {callError ? <FormMessage kind="error" text={callError} /> : null}
        <View style={styles.grid}>
          {numbers.map((n) => {
            const name = localized(n.names, lang) ?? n.number;
            const note = localized(n.notes, lang);
            const primary = n.number === '112';
            const fg = primary ? c.onDanger : c.textStrong;
            const icon = (
              <View style={[styles.icon, { backgroundColor: primary ? c.background + '26' : c.dangerSoft }]}>
                <MaterialIcons name={n.icon as IconName} size={22} color={primary ? c.onDanger : c.danger} />
              </View>
            );
            const callIcon = <MaterialIcons name="call" size={20} color={primary ? c.onDanger : c.danger} />;
            const texts = (
              <View style={styles.flex}>
                <AppText style={[styles.number, { color: fg }]}>{n.number}</AppText>
                <AppText variant="caption" style={{ color: primary ? c.onDanger : c.text }}>{name}</AppText>
                {note ? <AppText variant="caption" style={{ color: primary ? c.onDanger : c.textMuted }}>{note}</AppText> : null}
              </View>
            );
            return (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                accessibilityLabel={t('urgent.call', { name, number: n.number })}
                accessibilityHint={note}
                onPress={() => call(n)}
                style={({ pressed }) => [
                  styles.card,
                  primary ? styles.cardWide : styles.cardSmall,
                  {
                    backgroundColor: primary ? c.danger : c.surface,
                    borderColor: primary ? c.danger : c.border,
                    shadowColor: c.shadow,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}>
                {primary ? (
                  <>
                    {icon}
                    {texts}
                    {callIcon}
                  </>
                ) : (
                  <>
                    {/* Dar kartta simgeler üstte, yazı altta: adlar bölünmeden sığar. */}
                    <View style={styles.cardTop}>
                      {icon}
                      {callIcon}
                    </View>
                    {texts}
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
        {stale ? <AppText variant="caption" muted>{t('urgent.cachedNote')}</AppText> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('urgent.services')}. ${t('urgent.servicesHint')}`}
          onPress={() => router.push('/services')}
          style={({ pressed }) => [styles.row, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}>
          <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
            <MaterialIcons name="handyman" size={22} color={c.icon} />
          </View>
          <View style={styles.flex}>
            <AppText variant="label">{t('urgent.services')}</AppText>
            <AppText variant="caption" muted>{t('urgent.servicesHint')}</AppText>
          </View>
          <MaterialIcons name={rtl ? 'chevron-left' : 'chevron-right'} size={24} color={c.textSoft} />
        </Pressable>

        <AppText variant="subtitle" accessibilityRole="header">{t('urgent.comingTitle')}</AppText>
        {COMING.map((m) => (
          <View
            key={m.key}
            accessible
            accessibilityLabel={`${t(`urgent.${m.key}`)}. ${t(`urgent.${m.key}Hint`)}. ${t('urgent.comingSoon')}`}
            style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
              <MaterialIcons name={m.icon} size={22} color={c.icon} />
            </View>
            <View style={styles.flex}>
              <AppText variant="label">{t(`urgent.${m.key}`)}</AppText>
              <AppText variant="caption" muted>{t(`urgent.${m.key}Hint`)}</AppText>
            </View>
            <View style={[styles.badge, { borderColor: c.accentBorder }]}>
              <AppText variant="caption" style={{ color: c.highlight }}>{t('urgent.comingSoon')}</AppText>
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1, gap: 2 },
  warning: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: MIN_TOUCH + 24,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  cardWide: { flexBasis: '100%', flexDirection: 'row', alignItems: 'center' },
  cardSmall: { flexDirection: 'column' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  number: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  sos: { height: 116, borderRadius: radius.xl, borderWidth: 1.5, overflow: 'hidden' },
  sosInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, backgroundColor: 'rgba(40, 8, 10, 0.55)' },
  sosButton: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 3 },
  sosCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  sosText: { fontFamily: fonts.heading, fontSize: 20, letterSpacing: 1 },
  sosTitle: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, color: '#FFFFFF' },
  sosHint: { fontSize: 12, lineHeight: 17, color: '#F3D6D6' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
});
