import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  canRenewListing,
  isListingLive,
  LISTING_LIMITS,
  LISTING_REPORT_REASONS,
  listingExpiresAt,
  type Listing,
  type ListingReportReason,
} from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { ListingArt } from '@/components/listing-card';
import { useRelativeTime } from '@/components/post-card';
import { Screen } from '@/components/screen';
import { StateMessage } from '@/components/state-message';
import { priceText, useFavorites } from '@/lib/listings';
import { locationRepository as repo } from '@/lib/locations';
import { listingRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';
import { errorText } from '@/lib/limits';

/**
 * İlan sayfası: görsel (fotoğraf gelene kadar kategori simgesi), fiyat, durum, açıklama, yer; "Mesaj gönder" alıcıyla
 * satıcıyı Mesajlar > Çarşı'da buluşturur. Sahibi düzenler, satıldı işaretler, süresi dolmak üzereyken yeniler, kaldırır.
 * Başkası favoriye ekler ya da şikâyet eder. Altta güvenli alışveriş önerileri.
 */
export default function ListingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { language } = useSettings();
  const ago = useRelativeTime();
  const { user } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const fav = useFavorites(user?.uid);
  const [item, setItem] = useState<Listing | null>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reporting, setReporting] = useState<ListingReportReason | null>(null);
  const [reported, setReported] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const mine = !!item && !!user && item.ownerUid === user.uid;

  useEffect(() => {
    if (!user) return;
    listingRepository.get(id).then(setItem, () => setItem(null));
    listingRepository.hasReported(id, user.uid).then(setReported, () => {});
  }, [id, user]);

  const header = <HeroHeader title={t('carsi.listing')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/carsi'))} />;

  // Kaldırılan ilan kimseye, süresi dolan ya da şikâyetle düşen ilan yalnızca sahibine görünür. Satılan ilan açılır.
  const visible = !!item && item.status !== 'kaldirildi' && (mine || item.status === 'satildi' || isListingLive(item));
  if (!user || item === undefined || !visible) {
    return (
      <Screen header={header}>
        <View style={styles.content}>
          {!user ? <FormMessage kind="info" text={t('carsi.signIn')} /> : item === undefined ? <StateMessage kind="loading" /> : <StateMessage kind="empty" message={t('carsi.gone')} />}
        </View>
      </Screen>
    );
  }

  const run = async (fn: () => Promise<void>, errKey = 'carsi.saveError') => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(errorText(t, e, errKey));
    } finally {
      setBusy(false);
    }
  };

  const sold = item.status === 'satildi';
  const expired = !sold && listingExpiresAt(item) <= new Date().toISOString();
  const hidden = item.reportCount >= LISTING_LIMITS.reportThreshold && !item.cleared;
  const place = [repo.getDistrict(item.region.districtId)?.name, repo.getProvince(item.region.provinceCode)?.name].filter(Boolean).join(', ');
  const daysLeft = Math.max(0, Math.ceil((new Date(listingExpiresAt(item)).getTime() - Date.now()) / 86_400_000));

  const toggleSold = () =>
    run(async () => {
      await listingRepository.setSold(item.id, !sold);
      setItem({ ...item, status: sold ? 'yayinda' : 'satildi' });
    });
  const renew = () =>
    run(async () => {
      await listingRepository.renew(item.id);
      setItem({ ...item, listedAt: new Date().toISOString() });
    });
  const remove = () =>
    run(async () => {
      await listingRepository.remove(item.id);
      router.canGoBack() ? router.back() : router.replace('/carsi');
    });
  const report = () =>
    run(async () => {
      await listingRepository.report(item, user.uid, reporting!);
      setReported(true);
      setReporting(null);
    }, 'carsi.reportError');

  return (
    <Screen header={header}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.art, { backgroundColor: c.surface, borderColor: c.border }]}>
          <ListingArt category={item.category} size={96} />
          <AppText variant="caption" muted>{t('carsi.photosSoon')}</AppText>
        </View>
        <View style={styles.block}>
          <AppText variant="title">{item.title}</AppText>
          <View style={styles.row}>
            <AppText variant="label" style={{ color: item.price == null ? c.success : c.highlight }}>{priceText(item, t, language ?? 'tr')}</AppText>
            {sold ? <Tag text={t('carsi.sold')} /> : null}
            <Tag text={t(`carsi.conditions.${item.condition}`)} />
            <Tag text={t(`carsi.categories.${item.category}`)} />
          </View>
          <AppText variant="caption" muted>{[place, ago(item.listedAt), item.ownerName].filter(Boolean).join(' · ')}</AppText>
        </View>
        {item.kind === 'takas' && item.swapFor.trim() ? (
          <View style={styles.block}>
            <AppText variant="label">{t('carsi.fields.swapFor')}</AppText>
            <AppText>{item.swapFor}</AppText>
          </View>
        ) : null}
        {item.description.trim() ? <AppText>{item.description}</AppText> : null}

        {error ? <FormMessage kind="error" text={error} /> : null}

        {mine ? (
          <View style={styles.block}>
            {hidden ? <FormMessage kind="info" text={t('carsi.hiddenForReview')} /> : null}
            {expired ? <FormMessage kind="info" text={t('carsi.expired')} /> : !sold ? <AppText variant="caption" muted>{t('carsi.daysLeft', { count: daysLeft })}</AppText> : null}
            {canRenewListing(item) ? <AppButton title={t('carsi.renew')} loading={busy} disabled={busy} onPress={renew} /> : null}
            <View style={styles.row}>
              {!sold ? <AppButton variant="secondary" title={t('carsi.edit')} disabled={busy} onPress={() => router.push({ pathname: '/carsi/new', params: { id: item.id } })} /> : null}
              <AppButton variant="secondary" title={sold ? t('carsi.markAvailable') : t('carsi.markSold')} disabled={busy} onPress={toggleSold} />
            </View>
            {confirmRemove ? (
              <View style={styles.block}>
                <AppText>{t('carsi.removeConfirm')}</AppText>
                <AppButton title={t('carsi.remove')} loading={busy} disabled={busy} onPress={remove} />
                <AppButton variant="ghost" title={t('account.cancel')} onPress={() => setConfirmRemove(false)} />
              </View>
            ) : (
              <AppButton variant="ghost" title={t('carsi.remove')} onPress={() => setConfirmRemove(true)} />
            )}
          </View>
        ) : (
          <View style={styles.block}>
            {sold ? (
              <FormMessage kind="info" text={t('carsi.soldNote')} />
            ) : (
              <AppButton title={t('carsi.message')} onPress={() => router.push({ pathname: '/messages/[uid]', params: { uid: item.ownerUid, listing: item.id } })} />
            )}
            <AppButton
              variant="secondary"
              title={fav.isFavorite(item.id) ? t('carsi.unfavorite') : t('carsi.favorite')}
              disabled={busy}
              onPress={() => run(() => fav.toggle(item.id))}
            />
          </View>
        )}

        <View style={[styles.safety, { borderColor: c.border }]}>
          <View style={styles.row}>
            <MaterialIcons name="shield" size={18} color={c.textMuted} />
            <AppText variant="label">{t('carsi.safety.title')}</AppText>
          </View>
          {(['meet', 'deposit', 'check', 'link'] as const).map((k) => (
            <AppText key={k} variant="caption" muted>• {t(`carsi.safety.${k}`)}</AppText>
          ))}
        </View>

        {mine ? null : reported ? (
          <AppText variant="caption" muted>{t('carsi.reported')}</AppText>
        ) : reporting ? (
          <View style={styles.block}>
            <AppText variant="label">{t('carsi.reportTitle')}</AppText>
            <Chips<ListingReportReason> label={t('carsi.reportTitle')} value={reporting} onChange={setReporting} options={LISTING_REPORT_REASONS.map((r) => ({ value: r, label: t(`carsi.reasons.${r}`) }))} />
            <AppButton title={t('carsi.reportSend')} loading={busy} disabled={busy} onPress={report} />
            <AppButton variant="ghost" title={t('account.cancel')} onPress={() => setReporting(null)} />
          </View>
        ) : (
          <AppButton variant="ghost" title={t('carsi.report')} onPress={() => setReporting('dolandiricilik')} />
        )}
      </ScrollView>
    </Screen>
  );
}

function Tag({ text }: { text: string }) {
  const c = useThemeColors();
  return (
    <View style={[styles.tag, { borderColor: c.border }]}>
      <AppText variant="caption" muted>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  block: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  art: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  tag: { paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1 },
  safety: { gap: spacing.xs, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
});
