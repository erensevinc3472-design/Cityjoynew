import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { filterByName, nextNeighbourhoodChange, type Neighbourhood, type UserLocation } from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { OptionRow } from '@/components/option-row';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { FormMessage } from '@/components/form-message';
import { HeroHeader } from '@/components/hero-header';
import { StateMessage } from '@/components/state-message';
import { locationRepository as repo } from '@/lib/locations';
import { isAdminAccount } from '@cityjoy/shared/firebase';
import { firestore } from '@/lib/firebase';
import { profileRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { restartFlow } from '@/lib/navigation';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Step = 'province' | 'district' | 'neighbourhood';
type Row = { id: string; name: string; subtitle?: string };

export default function LocationScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  // Ana sayfa ya da hesap ekranından açıldıysa iş bitince geri dönülür; ilk kurulumda açılış akışı sürer.
  const params = useLocalSearchParams<{ edit?: string; province?: string; district?: string }>();
  const editing = params.edit === '1';
  // Konum izniyle bulunan il/ilçe (permission-location): doğrudan mahalle listesi açılır, "Değiştir" ile il listesine dönülür.
  const detected = !editing && params.province && repo.getProvince(params.province) ? params : undefined;
  const c = useThemeColors();
  const { setLocation } = useSettings();
  const { location } = useUserLocation();
  const { user, profile, refreshProfile } = useSession();
  const [saveError, setSaveError] = useState<string>();

  const [provinceCode, setProvinceCode] = useState(detected?.province ?? location?.provinceCode);
  const [districtId, setDistrictId] = useState(detected ? detected.district : location?.districtId);
  const [step, setStep] = useState<Step>(detected ? (detected.district ? 'neighbourhood' : 'district') : 'province');
  const [showDetected, setShowDetected] = useState(!!detected);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const [neighbourhoods, setNeighbourhoods] = useState<Neighbourhood[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const loadNeighbourhoods = useCallback(async (id: string) => {
    setNeighbourhoods(null);
    setLoadError(false);
    try {
      setNeighbourhoods(await repo.getNeighbourhoods(id));
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    if (step === 'neighbourhood' && districtId) loadNeighbourhoods(districtId);
  }, [step, districtId, loadNeighbourhoods]);

  const rows: Row[] | null = useMemo(() => {
    if (step === 'province') return repo.getProvinces().map((p) => ({ id: p.code, name: p.name, subtitle: p.code }));
    if (step === 'district') return provinceCode ? repo.getDistricts(provinceCode) : [];
    if (!neighbourhoods) return null;
    return neighbourhoods.map((n) => ({
      id: n.id,
      name: n.name,
      subtitle: n.kind === 'koy' ? `${t('location.village')} · ${n.postalCode}` : n.postalCode,
    }));
  }, [step, provinceCode, neighbourhoods, t]);

  const visible = useMemo(() => (rows ? filterByName(rows, query) : null), [rows, query]);

  const finish = async (neighbourhoodId?: string) => {
    const next: UserLocation | null = provinceCode ? { provinceCode, districtId, neighbourhoodId } : null;
    setSaveError(undefined);

    if (user && profile) {
      const changed = JSON.stringify(next ?? null) !== JSON.stringify(profile.location ?? null);
      const neighbourhoodChanged = (next?.neighbourhoodId ?? null) !== (profile.location?.neighbourhoodId ?? null);
      const nextAllowed = nextNeighbourhoodChange(profile);
      // Mahalle ayda bir kez değişir; aynı kural veritabanında da denetlenir.
      // CityJoy yöneticisi (deneme için konum değiştirir) bu sınıra takılmaz; kurallar da aynı (Eren, 12 Kasım 2026).
      if (neighbourhoodChanged && nextAllowed && nextAllowed > new Date() && !(await isAdminAccount(firestore, user.uid).catch(() => false))) {
        setSaveError(t('account.neighbourhoodLocked', { date: nextAllowed.toLocaleDateString(i18n.language) }));
        return;
      }
      setSaving(true);
      try {
        if (changed) await profileRepository.update(user.uid, { location: next }, profile);
        await refreshProfile();
      } catch {
        setSaveError(t('common.errorGeneric'));
        setSaving(false);
        return;
      }
    } else {
      setSaving(true);
    }
    await setLocation(next);
    setSaving(false);
    if (editing && router.canGoBack()) router.back();
    else restartFlow(router);
  };

  const goTo = (next: Step) => {
    setQuery('');
    if (next === 'province') setShowDetected(false);
    setStep(next);
  };

  const onSelect = (row: Row) => {
    if (step === 'province') {
      if (row.id !== provinceCode) setDistrictId(undefined);
      setProvinceCode(row.id);
      goTo('district');
    } else if (step === 'district') {
      setDistrictId(row.id);
      goTo('neighbourhood');
    } else {
      finish(row.id);
    }
  };

  const goBack = () => {
    if (step === 'neighbourhood') goTo('district');
    else if (step === 'district') goTo('province');
    else if (editing && router.canGoBack()) router.back();
  };

  const province = provinceCode ? repo.getProvince(provinceCode) : undefined;
  const district = districtId ? repo.getDistrict(districtId) : undefined;
  const crumbs = [province?.name, step !== 'province' ? district?.name : undefined].filter(Boolean);

  const titleKey = { province: 'selectProvince', district: 'selectDistrict', neighbourhood: 'selectNeighbourhood' } as const;
  const searchKey = { province: 'searchProvince', district: 'searchDistrict', neighbourhood: 'searchNeighbourhood' } as const;
  const canGoBack = step !== 'province' || (editing && router.canGoBack());

  return (
    <Screen
      header={
        <HeroHeader
          title={step === 'province' ? t('location.title') : t(`location.${titleKey[step]}`)}
          subtitle={crumbs.length ? crumbs.join(' › ') : t('location.subtitle')}
          onBack={canGoBack ? goBack : undefined}
        />
      }>
      <View style={[styles.notice, { backgroundColor: c.accentSoft }]}>
        <MaterialIcons name="info-outline" size={20} color={c.primary} />
        <AppText variant="caption" style={styles.noticeText}>{t('location.fullCapacityWarning')}</AppText>
      </View>

      {showDetected ? (
        <View style={[styles.notice, { backgroundColor: c.accentSoft }]}>
          <MaterialIcons name="my-location" size={20} color={c.primary} />
          <AppText variant="caption" style={styles.noticeText}>{t('onboarding.locationFound', { place: crumbs.join(' › ') })}</AppText>
          <AppText accessibilityRole="button" onPress={() => goTo('province')} style={{ color: c.primary, fontWeight: '600' }}>{t('onboarding.change')}</AppText>
        </View>
      ) : null}

      {saveError ? <FormMessage kind="error" text={saveError} /> : null}

      <SearchField value={query} onChangeText={setQuery} placeholder={t(`location.${searchKey[step]}`)} />

      <FlatList automaticallyAdjustKeyboardInsets
        data={visible ?? []}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        initialNumToRender={20}
        renderItem={({ item }) => (
          <OptionRow
            title={item.name}
            subtitle={item.subtitle}
            selected={
              (step === 'province' && item.id === provinceCode) ||
              (step === 'district' && item.id === districtId) ||
              (step === 'neighbourhood' && item.id === location?.neighbourhoodId)
            }
            showChevron={step !== 'neighbourhood'}
            onPress={() => onSelect(item)}
          />
        )}
        ListEmptyComponent={
          loadError ? (
            <StateMessage kind="error" message={t('location.neighbourhoodLoadError')} onRetry={() => districtId && loadNeighbourhoods(districtId)} />
          ) : visible === null ? (
            <StateMessage kind="loading" />
          ) : (
            <StateMessage kind="empty" />
          )
        }
        ListFooterComponent={<AppText variant="caption" muted style={styles.source}>{t('location.source')}</AppText>}
      />

      <View style={styles.footer}>
        {step === 'neighbourhood' ? (
          // Mahalle önerilir ama zorunlu değildir; il ve ilçe ile kaydedilebilir.
          <AppButton variant="secondary" title={t('location.save')} onPress={() => finish(undefined)} loading={saving} />
        ) : (
          <AppButton variant="ghost" title={t('location.skip')} onPress={() => finish(undefined)} loading={saving} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  noticeText: { flex: 1 },
  list: { gap: spacing.sm, paddingVertical: spacing.sm },
  source: { textAlign: 'center', paddingVertical: spacing.md },
  footer: { paddingBottom: spacing.md },
});
