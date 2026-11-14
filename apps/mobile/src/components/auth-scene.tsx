import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState, type ComponentProps, type PropsWithChildren, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { fonts, GUTTER, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { SurfaceContext } from '@/theme/use-theme';
import { AUTH_ART } from '@/lib/app-art';
import { AppText } from './app-text';
import { SceneArt, sceneSky, type SceneKind } from './scene-art';

const GOLD = '#E2B277';

/**
 * Giriş akışının ortak zemini (13. madde 35, giriş akışı): arkada tam ekran sahne çizimi ve karartma, üstte CityJoy
 * yazısı, altta içerik. Renk şeması her zaman koyudur; resimler Panel > Uygulama görselleri'nden değişecek (Blaze ile).
 */
export function AuthScene({ kind = 'cover', image = AUTH_ART.welcome, remote, shade = true, glass, logo = true, top, children }: PropsWithChildren<{ kind?: SceneKind; image?: number | null; remote?: string; shade?: boolean; glass?: boolean; logo?: boolean; top?: ReactNode }>) {
  const insets = useSafeAreaInsets();
  const source = useRemoteOr(remote, image);
  const { width } = useWindowDimensions();
  return (
    <SurfaceContext.Provider value={{ scheme: 'dark', glass }}>
      <View style={[styles.root, { backgroundColor: sceneSky(kind) }]}>
        <StatusBar style="light" />
        {source ? (
          // Dikey resim (Eren, 8 Kasım 2026): üstü boş gökyüzü, konu altta; ekranı tam kaplar.
          <Image source={source.src} onError={source.onError} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="bottom" accessible={false} />
        ) : (
          <View pointerEvents="none" style={[styles.scene, { height: Math.round(width * 1.35) }]}>
            <SceneArt kind={kind} />
          </View>
        )}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, source ? styles.dimPhoto : styles.dim]} />
        {source && shade ? <BottomShade /> : null}
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {top}
            {logo ? (
              <AppText accessibilityRole="header" style={styles.logo}>
                City<AppText style={[styles.logo, { color: GOLD }]}>Joy</AppText>
              </AppText>
            ) : null}
            {/* İçerik ekranın ortasında (Karar Eren, 8 Kasım 2026): üstte ve altta eşit boşluk. */}
            <View style={styles.spacer} />
            {children}
            <View style={styles.spacer} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SurfaceContext.Provider>
  );
}

/** Panelden yüklenen resim (adres) varsa o; yüklenemezse ya da yoksa uygulamadaki hazır resim. */
export function useRemoteOr(remote: string | undefined, fallback: number | null | undefined): { src: number | { uri: string }; onError?: () => void } | null {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [remote]);
  if (remote && !failed) return { src: { uri: remote }, onError: () => setFailed(true) };
  return fallback ? { src: fallback } : null;
}

/** Resmin alt yarısını koyulaştırır: yazılar resmin dolu kısmının üstüne gelince okunsun. */
function BottomShade() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="authBottomShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.3" stopColor="#081A1E" stopOpacity={0} />
            <Stop offset="0.62" stopColor="#081A1E" stopOpacity={0.6} />
            <Stop offset="1" stopColor="#081A1E" stopOpacity={0.88} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#authBottomShade)" />
      </Svg>
    </View>
  );
}

/** Buzlu cam kart (Eren'in giriş tasarımı): beyaz yarı saydam, ince açık kenar. */
export function GlassCard({ title, subtitle, children }: PropsWithChildren<{ title?: string; subtitle?: string }>) {
  return (
    <View style={styles.glass}>
      {title ? (
        <View style={{ gap: 4 }}>
          <AppText accessibilityRole="header" style={styles.glassTitle}>{title}</AppText>
          {subtitle ? <AppText style={styles.glassSub}>{subtitle}</AppText> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** "veya" ayıracı. */
export function OrDivider({ label }: { label: string }) {
  return (
    <View style={styles.or} accessible accessibilityLabel={label}>
      <View style={styles.orLine} />
      <AppText style={styles.orText}>{label}</AppText>
      <View style={styles.orLine} />
    </View>
  );
}

/** Apple / Google düğmesi: açık zemin, koyu yazı (mağaza kuralları bu görünümü önerir). */
export function SocialButton({ icon, title, onPress, disabled }: { icon: 'apple' | 'google'; title: string; onPress(): void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.social, { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}>
      <FontAwesome name={icon} size={19} color="#111111" />
      <AppText style={styles.socialText}>{title}</AppText>
    </Pressable>
  );
}

/** Alt satırdaki altın bağlantı ("Hesabın yok mu? Kayıt ol"). */
export function AuthLink({ lead, action, onPress, end }: { lead: string; action: string; onPress(): void; end?: boolean }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} style={[styles.link, end && { alignSelf: 'flex-end', minHeight: 32, marginTop: -6 }]}>
      <AppText style={styles.linkText}>
        {lead} <AppText style={[styles.linkText, { color: GOLD, fontFamily: fonts.bodySemi }]}>{action}</AppText>
      </AppText>
    </Pressable>
  );
}

/** İzin ekranı satırı: altın simge kutusu ve neden. */
export function WhyRow({ icon, text }: { icon: ComponentProps<typeof MaterialIcons>['name']; text: string }) {
  return (
    <View style={styles.why}>
      <View style={styles.whyIcon}>
        <MaterialIcons name={icon} size={20} color={GOLD} />
      </View>
      <AppText style={styles.whyText}>{text}</AppText>
    </View>
  );
}

/** Kurulum adımı göstergesi (konum, mahalle, bildirim). */
export function StepDots({ total, current, label }: { total: number; current: number; label: string }) {
  return (
    <View style={styles.dots} accessible accessibilityLabel={label}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, i === current && { backgroundColor: GOLD }]} />
      ))}
    </View>
  );
}

/** İzin ekranlarının ortak yazı biçimleri (G-IzinKonum, G-IzinBildirim). */
export const onboardingStyles = StyleSheet.create({
  texts: { gap: spacing.sm, paddingTop: spacing.md },
  title: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 33, color: '#FFFFFF', textAlign: 'center' },
  desc: { fontSize: 15.5, lineHeight: 23, color: '#C4D0D3', textAlign: 'center' },
  rows: { gap: 14, paddingVertical: spacing.sm },
  note: { fontSize: 13, lineHeight: 19, color: '#A3B9BB', textAlign: 'center' },
});

const white = '#FFFFFF';
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scene: { position: 'absolute', start: 0, end: 0, bottom: 0, overflow: 'hidden' },
  dim: { backgroundColor: 'rgba(8, 26, 30, 0.5)' },
  dimPhoto: { backgroundColor: 'rgba(8, 26, 30, 0.3)' },
  content: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: GUTTER, gap: spacing.md },
  spacer: { flexGrow: 1, minHeight: spacing.lg },
  logo: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 38, color: white, textAlign: 'center', letterSpacing: -0.4 },
  glass: {
    padding: 18,
    paddingVertical: 22,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    gap: 14,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(25px)' } as object) : {}),
  },
  glassTitle: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 30, color: white },
  glassSub: { fontSize: 14, lineHeight: 20, color: 'rgba(255, 255, 255, 0.72)' },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  orText: { fontSize: 13, color: '#A3B9BB' },
  social: { minHeight: 50, borderRadius: radius.md, backgroundColor: '#F3F6F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  socialText: { fontFamily: fonts.bodySemi, fontSize: 15, color: '#111111' },
  link: { alignSelf: 'center', minHeight: MIN_TOUCH, justifyContent: 'center' },
  linkText: { fontSize: 14, color: '#D5DEE0', textAlign: 'center' },
  why: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  whyIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(226, 178, 119, 0.14)', alignItems: 'center', justifyContent: 'center' },
  whyText: { flex: 1, fontSize: 14.5, lineHeight: 20, color: '#E6ECEC' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 22, height: 4, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.2)' },
});
