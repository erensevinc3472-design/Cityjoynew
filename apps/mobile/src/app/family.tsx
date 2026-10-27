import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  FamilyError,
  FAMILY_MAX,
  formatInviteCode,
  inviteLink,
  type FamilyInvite,
  type FamilyMember,
} from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { OptionRow } from '@/components/option-row';
import { QrCode } from '@/components/qr-code';
import { StateMessage } from '@/components/state-message';
import { TextField } from '@/components/text-field';
import { registerForPush } from '@/lib/push';
import { familyRepository } from '@/lib/services';
import { useSettings } from '@/lib/settings';
import { useSession } from '@/lib/session';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Hesabım > Ailem (SOS) (PROJE.md 5.4). Ekleme karşılıklıdır: biri davet kodu oluşturur (QR / bağlantı /
 * kod), diğeri kabul eder. Herkes istediği an listeden çıkabilir. Davet bağlantısı: cityjoy://family?kod=...
 */
export default function FamilyScreen() {
  const { t, i18n } = useTranslation();
  const c = useThemeColors();
  const { user, profile } = useSession();
  const { kod } = useLocalSearchParams<{ kod?: string }>();
  const { language } = useSettings();
  const name = profile?.displayName ?? user?.displayName ?? '';

  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [invite, setInvite] = useState<FamilyInvite | null>(null);
  const [code, setCode] = useState(kod ?? '');
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string }>();
  const [confirming, setConfirming] = useState<string>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!user) return;
    setLoadError(false);
    familyRepository.listMembers(user.uid).then(setMembers).catch(() => setLoadError(true));
  }, [user]);
  useFocusEffect(load);

  if (!user) {
    return (
      <FormScreen title={t('family.title')}>
        <FormMessage kind="info" text={t('family.signIn')} />
      </FormScreen>
    );
  }

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      const ok = await fn();
      if (ok) setMessage({ kind: 'info', text: ok });
      load();
    } catch (e) {
      const key = e instanceof FamilyError ? e.code : 'generic';
      setMessage({ kind: 'error', text: t(`family.errors.${key}`, { max: FAMILY_MAX }) });
    } finally {
      setBusy(false);
    }
  };

  const share = (inv: FamilyInvite) =>
    Share.share({ message: t('family.shareMessage', { code: formatInviteCode(inv.code), link: inviteLink(inv.code) }) }).catch(() => {});

  return (
    <FormScreen title={t('family.title')} subtitle={t('family.intro')}>
      {message ? <FormMessage kind={message.kind} text={message.text} /> : null}

      <AppText variant="label" accessibilityRole="header">{t('family.members', { count: members?.length ?? 0, max: FAMILY_MAX })}</AppText>
      {loadError ? (
        <StateMessage kind="error" onRetry={load} />
      ) : members === null ? (
        <StateMessage kind="loading" />
      ) : members.length === 0 ? (
        <AppText muted>{t('family.empty')}</AppText>
      ) : (
        members.map((m) =>
          confirming === m.uid ? (
            <View key={m.uid} style={styles.confirm}>
              <FormMessage kind="error" text={t('family.removeConfirm', { name: m.name })} />
              <View style={styles.row}>
                <View style={styles.flex}>
                  <AppButton variant="secondary" title={t('sos.cancel')} onPress={() => setConfirming(undefined)} />
                </View>
                <View style={styles.flex}>
                  <AppButton title={t('family.removeYes')} disabled={busy} onPress={() => run(async () => {
                    await familyRepository.remove(user.uid, m.uid);
                    setConfirming(undefined);
                  })} />
                </View>
              </View>
            </View>
          ) : (
            <OptionRow key={m.uid} title={m.name} subtitle={t('family.remove')} onPress={() => setConfirming(m.uid)} />
          ),
        )
      )}

      <AppText variant="subtitle" accessibilityRole="header">{t('family.addTitle')}</AppText>
      {invite ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText variant="caption" muted>{t('family.inviteCode')}</AppText>
          <AppText selectable style={[styles.code, { color: c.textStrong }]}>{formatInviteCode(invite.code)}</AppText>
          <QrCode value={inviteLink(invite.code)} label={t('family.qrLabel', { code: formatInviteCode(invite.code) })} />
          <AppText variant="caption" muted style={styles.center}>
            {t('family.inviteExpires', { date: new Date(invite.expiresAt).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' }) })}
          </AppText>
          <AppButton title={t('family.share')} onPress={() => share(invite)} />
          <AppButton variant="ghost" title={t('family.cancelInvite')} disabled={busy} onPress={() => run(async () => {
            await familyRepository.cancelInvite(invite.code);
            setInvite(null);
          })} />
        </View>
      ) : (
        <>
          <AppText variant="caption" muted>{t('family.inviteIntro')}</AppText>
          <AppButton
            variant="secondary"
            title={t('family.invite')}
            disabled={busy || (members?.length ?? 0) >= FAMILY_MAX}
            onPress={() => run(async () => {
              setInvite(await familyRepository.createInvite(user.uid, name));
              registerForPush(user.uid, language ?? 'tr', true).catch(() => {});
            })}
          />
        </>
      )}

      <AppText variant="label" accessibilityRole="header">{t('family.haveCode')}</AppText>
      <TextField label={t('family.codeLabel')} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={12} />
      <AppButton
        title={t('family.accept')}
        disabled={busy || code.trim().length < 8}
        onPress={() => run(async () => {
          const m = await familyRepository.acceptInvite(code, user.uid, name);
          // Aile kurulduğu an bildirim izni istenir: aile SOS gönderirse telefon çalsın.
          registerForPush(user.uid, language ?? 'tr', true).catch(() => {});
          setCode('');
          return t('family.added', { name: m.name });
        })}
      />
      <AppText variant="caption" muted>{t('family.scanLater')}</AppText>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  confirm: { gap: spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  code: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 38, letterSpacing: 3, textAlign: 'center' },
  center: { textAlign: 'center' },
});
