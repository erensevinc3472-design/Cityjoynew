import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { isRecent, type SosAlert } from '@cityjoy/shared';

import { AppText } from '@/components/app-text';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { isFirebaseConfigured } from './firebase-config';
import { onNotificationTap, registerForPush } from './push';
import { sosRepository } from './services';
import { useSettings } from './settings';
import { useSession } from './session';

const IncomingContext = createContext<SosAlert[]>([]);

/**
 * Bana gelen SOS'lar: uygulama açıkken anında gelir ve "teslim edildi" işaretlenir. Telefon kapalıyken
 * bildirim (push) telefon sürümüyle (geliştirme derlemesi) eklenecek.
 */
export function IncomingSosProvider({ children }: PropsWithChildren) {
  const { user } = useSession();
  const [alerts, setAlerts] = useState<SosAlert[]>([]);

  useEffect(() => {
    setAlerts([]);
    if (!user || !isFirebaseConfigured) return;
    return sosRepository.watchIncoming(
      user.uid,
      (list) => {
        setAlerts(list);
        for (const a of list) {
          if (!a.deliveredTo[user.uid] && isRecent(a)) sosRepository.markDelivered(a.id, user.uid).catch(() => {});
        }
      },
      () => {},
    );
  }, [user]);

  return <IncomingContext.Provider value={alerts}>{children}</IncomingContext.Provider>;
}

export function useIncomingSos(): SosAlert[] {
  return useContext(IncomingContext);
}

/** Her ekranın üstünde: görülmemiş yeni SOS varsa kırmızı şerit. */
export function IncomingSosBanner() {
  const alerts = useIncomingSos();
  const { user } = useSession();
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const alert = alerts.find((a) => user && !a.seenBy[user.uid] && isRecent(a));
  if (!alert) return null;
  const title = alert.test ? t('sos.incomingTest', { name: alert.fromName }) : t('sos.incomingTitle', { name: alert.fromName });
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + spacing.xs }]}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={`${title}. ${t('sos.incomingOpen')}`}
        onPress={() => router.push({ pathname: '/sos/[id]', params: { id: alert.id } })}
        style={[styles.banner, { backgroundColor: alert.test ? c.surfaceStrong : c.danger, borderColor: c.danger }]}>
        <MaterialIcons name="sos" size={26} color={alert.test ? c.danger : c.onDanger} />
        <AppText variant="label" style={[styles.flex, { color: alert.test ? c.textStrong : c.onDanger }]}>{title}</AppText>
        <AppText variant="caption" style={{ color: alert.test ? c.danger : c.onDanger }}>{t('sos.incomingOpen')}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.md, zIndex: 100 },
  banner: {
    width: '100%',
    maxWidth: 640,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  flex: { flex: 1 },
});

/**
 * Telefonun bildirim adresini kaydeder (izin önceden verildiyse; izni SOS hazırlığı ekranı ister) ve
 * bildirime dokununca ilgili SOS ekranını açar.
 */
export function PushRegistrar() {
  const { user } = useSession();
  const { language } = useSettings();
  const router = useRouter();

  useEffect(() => {
    if (user && isFirebaseConfigured) registerForPush(user.uid, language ?? 'tr', false).catch(() => {});
  }, [user, language]);

  useEffect(() => onNotificationTap((href) => router.push(href as Parameters<typeof router.push>[0])), [router]);

  return null;
}
