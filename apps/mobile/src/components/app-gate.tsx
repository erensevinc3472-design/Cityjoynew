import { MaterialIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { activeBanner, bannerText, closedSectionOf, needsReaccept, updateNeed, type AppConfig } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { appPlatform, appVersion, useAppConfig } from '@/lib/app-config';
import { profileRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { fonts, GUTTER, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** Zamanlanmış bant ve bakım dakikasında başlasın diye saat dakikada bir yenilenir. */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Bu kişiye şu an görünen bant (duyuru ya da bakım). */
export function useActiveBanner(cfg: AppConfig) {
  const now = useMinuteClock();
  const { user } = useSession();
  const { location } = useUserLocation();
  return activeBanner(cfg, { now, provinceCode: location?.provinceCode, uid: user?.uid });
}

/**
 * Panel > Uygulama ayarları'nın uygulamadaki karşılığı. Ekranların üstüne, sırasıyla: zorunlu güncelleme, bakım modu,
 * yasal metin yeniden onayı, geçici olarak kapalı bölüm. Hiçbiri yoksa hiçbir şey çizmez.
 * SOS ekranları hiçbir zaman kapatılmaz (güvenlik).
 */
export function AppGate() {
  const cfg = useAppConfig();
  const pathname = usePathname();
  const banner = useActiveBanner(cfg);
  const { user, profile } = useSession();
  if (pathname.startsWith('/sos')) return null;
  if (appPlatform && updateNeed(cfg, appPlatform, appVersion) === 'zorunlu') return <UpdateRequired url={cfg.storeUrl[appPlatform]} />;
  if (banner?.kind === 'bakim') return <Maintenance text={banner} />;
  if (user && profile && !pathname.startsWith('/legal') && needsReaccept(cfg, profile.consents?.terms?.textVersion)) return <Reaccept version={cfg.legal.version} />;
  const closed = closedSectionOf(cfg, pathname);
  if (closed) return <SectionClosed />;
  return null;
}

function Cover({ icon, title, body, children }: { icon: IconName; title: string; body: string; children?: React.ReactNode }) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.background }]} accessibilityViewIsModal>
      <ScrollView contentContainerStyle={[styles.cover, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
          <MaterialIcons name={icon} size={34} color={c.accent} />
        </View>
        <AppText accessibilityRole="header" style={[styles.title, { color: c.textStrong }]}>{title}</AppText>
        <AppText style={[styles.body, { color: c.textMuted }]}>{body}</AppText>
        <View style={styles.actions}>{children}</View>
      </ScrollView>
    </View>
  );
}

function UpdateRequired({ url }: { url: string }) {
  const { t } = useTranslation();
  return (
    <Cover icon="system-update" title={t('appConfig.updateTitle')} body={t('appConfig.updateBody')}>
      {url ? <AppButton title={t('appConfig.update')} onPress={() => Linking.openURL(url).catch(() => {})} /> : null}
    </Cover>
  );
}

function Maintenance({ text }: { text: NonNullable<ReturnType<typeof activeBanner>> }) {
  const { t } = useTranslation();
  const { language } = useSettings();
  return (
    <Cover icon="build" title={t('appConfig.maintTitle')} body={bannerText(text, language ?? 'tr')}>
      <AppText variant="caption" muted style={styles.center}>{t('appConfig.maintEmergency')}</AppText>
      <AppButton variant="secondary" title={t('appConfig.call112')} onPress={() => Linking.openURL('tel:112').catch(() => {})} />
    </Cover>
  );
}

function Reaccept({ version }: { version: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, profile, refreshProfile } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const accept = async () => {
    if (!user || !profile) return;
    setBusy(true);
    setError(false);
    try {
      await profileRepository.update(user.uid, { legal: { granted: true, at: new Date().toISOString(), textVersion: version } }, profile!);
      await refreshProfile();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Cover icon="gavel" title={t('appConfig.reacceptTitle')} body={t('appConfig.reacceptBody')}>
      <AppButton variant="secondary" title={t('account.terms')} onPress={() => router.push('/legal/terms')} />
      <AppButton variant="secondary" title={t('account.privacy')} onPress={() => router.push('/legal/privacy')} />
      {error ? <FormMessage kind="error" text={t('appConfig.acceptError')} /> : null}
      <AppButton title={t('appConfig.accept')} loading={busy} onPress={accept} />
    </Cover>
  );
}

function SectionClosed() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Cover icon="construction" title={t('appConfig.closedTitle')} body={t('appConfig.closedBody')}>
      <AppButton title={t('appConfig.goHome')} onPress={() => router.replace('/home')} />
    </Cover>
  );
}

/**
 * Ana sayfanın üstündeki bant: panelden girilen duyuru ve "yeni sürüm var" önerisi. Öneri kapatılabilir (oturum boyunca).
 */
let suggestionDismissed = false;
export function AppNotices() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const cfg = useAppConfig();
  const { language } = useSettings();
  const banner = useActiveBanner(cfg);
  const [dismissed, setDismissed] = useState(suggestionDismissed);
  const suggest = !!appPlatform && !dismissed && updateNeed(cfg, appPlatform, appVersion) === 'oneri';
  return (
    <>
      {banner?.kind === 'duyuru' ? (
        <View style={[styles.band, { backgroundColor: c.accentSoft, borderColor: c.accentBorder }]} accessibilityRole="alert">
          <MaterialIcons name="campaign" size={20} color={c.accent} />
          <AppText style={[styles.bandText, { color: c.textStrong }]}>{bannerText(banner, language ?? 'tr')}</AppText>
        </View>
      ) : null}
      {suggest ? (
        <View style={[styles.band, { backgroundColor: c.surface, borderColor: c.border }]}>
          <MaterialIcons name="system-update" size={20} color={c.primary} />
          <Pressable
            style={styles.grow}
            accessibilityRole="button"
            disabled={!cfg.storeUrl[appPlatform!]}
            onPress={() => Linking.openURL(cfg.storeUrl[appPlatform!]).catch(() => {})}>
            <AppText style={[styles.bandText, { color: c.textStrong, fontFamily: fonts.bodySemi }]}>{t('appConfig.newVersion')}</AppText>
            <AppText variant="caption" muted>{t('appConfig.newVersionBody')}</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('appConfig.dismiss')}
            hitSlop={10}
            onPress={() => {
              suggestionDismissed = true;
              setDismissed(true);
            }}>
            <MaterialIcons name="close" size={20} color={c.textMuted} />
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  cover: { flexGrow: 1, alignItems: 'stretch', justifyContent: 'center', paddingHorizontal: GUTTER, gap: spacing.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 31, textAlign: 'center' },
  body: { fontSize: 15.5, lineHeight: 23, textAlign: 'center' },
  center: { textAlign: 'center' },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  band: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1 },
  bandText: { flex: 1, fontSize: 14, lineHeight: 20 },
  grow: { flex: 1 },
});
