import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  BUSINESS_LIMITS,
  BUSINESS_TYPES,
  HOME_BASED_TYPES,
  validateBusiness,
  type Business,
  type BusinessError,
  type BusinessInput,
} from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { OptionRow } from '@/components/option-row';
import { CategoryPicker, RegionPicker } from '@/components/pickers';
import { StateMessage } from '@/components/state-message';
import { TextField } from '@/components/text-field';
import { goBackOr } from '@/lib/navigation';
import { useServiceCategories } from '@/lib/service-categories';
import { businessRepository, DuplicateBusinessError } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useUserLocation } from '@/lib/user-location';
import { spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Form = Omit<BusinessInput, 'location'> & { provinceCode?: string; districtId?: string };

/**
 * Profil > İşletme ekle / düzenle (PROJE.md 5.7). Bilgiler bir kez girilir; seçilen hizmetlerin
 * listesinde, işletmenin ilinde kendiliğinden görünür. Fotoğraf, belgeler ve doğrulama sonraki adımda.
 */
export default function EditBusinessScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useSession();
  const { location } = useUserLocation();
  const { all: categories } = useServiceCategories();

  const [existing, setExisting] = useState<Business | null | undefined>(id ? undefined : null);
  const [form, setForm] = useState<Form>({
    type: 'hizmet',
    name: '',
    categoryIds: [],
    provinceCode: location?.provinceCode,
    districtId: location?.districtId,
    phone: '',
    whatsapp: true,
    is24h: false,
    priceList: [],
  });
  const [errors, setErrors] = useState<BusinessError[]>([]);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    businessRepository
      .get(id)
      .then((b) => {
        setExisting(b);
        if (b) {
          const { location: loc, ...rest } = b;
          setForm({ ...rest, provinceCode: loc.provinceCode, districtId: loc.districtId });
        }
      })
      .catch(() => setExisting(null));
  }, [id]);

  if (!user) {
    return (
      <FormScreen title={t('business.newTitle')}>
        <FormMessage kind="info" text={t('business.signInRequired')} />
      </FormScreen>
    );
  }
  if (existing === undefined) {
    return (
      <FormScreen title={t('business.editTitle')}>
        <StateMessage kind="loading" />
      </FormScreen>
    );
  }
  if (id && (!existing || existing.ownerUid !== user.uid)) {
    return (
      <FormScreen title={t('business.editTitle')}>
        <StateMessage kind="empty" message={t('business.notFound')} />
      </FormScreen>
    );
  }

  const removed = existing?.status === 'kaldirildi';
  const homeBased = HOME_BASED_TYPES.includes(form.type);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const err = (k: BusinessError) => (errors.includes(k) ? t(`business.errors.${k}`) : undefined);

  const toInput = (): BusinessInput => {
    const { provinceCode, districtId, ...rest } = form;
    return { ...rest, phone: form.phone.replace(/\D/g, ''), ...(homeBased ? { address: undefined } : {}), location: { provinceCode: provinceCode ?? '', districtId: districtId ?? '' } };
  };

  const save = async () => {
    const input = toInput();
    const problems = validateBusiness({ ...input, priceList: input.priceList.filter((p) => p.name.trim() || p.price.trim()) });
    setErrors(problems);
    setMessage(undefined);
    if (problems.length) return setMessage({ kind: 'error', text: t(`business.errors.${problems[0]}`) });
    setBusy(true);
    try {
      if (existing) await businessRepository.update(existing.id, input);
      else await businessRepository.create(user.uid, input);
      goBackOr(router, '/business');
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof DuplicateBusinessError ? t('business.duplicatePhone') : t('business.saveError') });
    } finally {
      setBusy(false);
    }
  };

  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
      after?.();
    } catch {
      setMessage({ kind: 'error', text: t('business.saveError') });
    } finally {
      setBusy(false);
    }
  };

  const setPrice = (i: number, patch: Partial<{ name: string; price: string }>) =>
    set({ priceList: form.priceList.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  return (
    <FormScreen title={existing ? t('business.editTitle') : t('business.newTitle')}>
      {removed ? <FormMessage kind="error" text={t('business.removedNote')} /> : null}
      {message ? <FormMessage kind={message.kind} text={message.text} /> : null}

      <AppText variant="label" accessibilityRole="header">{t('business.type')}</AppText>
      {BUSINESS_TYPES.map((type) => (
        <OptionRow key={type} title={t(`business.types.${type}`)} selected={form.type === type} onPress={() => set({ type })} />
      ))}

      <TextField label={t('business.name')} value={form.name} onChangeText={(name) => set({ name })} maxLength={BUSINESS_LIMITS.name[1]} error={err('name')} />

      <AppText variant="label" accessibilityRole="header">{t('business.categories')}</AppText>
      <AppText variant="caption" muted>{t('business.categoriesHint')}</AppText>
      <CategoryPicker all={categories} selected={form.categoryIds} max={BUSINESS_LIMITS.categories[1]} onChange={(categoryIds) => set({ categoryIds })} />
      {err('categories') ? <AppText variant="caption" style={{ color: c.danger }}>{err('categories')}</AppText> : null}

      <AppText variant="label" accessibilityRole="header">{t('business.location')}</AppText>
      <RegionPicker provinceCode={form.provinceCode} districtId={form.districtId} onChange={(v) => set(v)} />
      {err('location') ? <AppText variant="caption" style={{ color: c.danger }}>{err('location')}</AppText> : null}
      {homeBased ? (
        <AppText variant="caption" muted>{t('business.addressHomeNote')}</AppText>
      ) : (
        <TextField label={t('business.address')} value={form.address ?? ''} onChangeText={(address) => set({ address })} maxLength={BUSINESS_LIMITS.address} error={err('address')} />
      )}

      <TextField label={t('business.phone')} hint={t('business.phoneHint')} value={form.phone} onChangeText={(phone) => set({ phone })} keyboardType="phone-pad" autoComplete="tel" error={err('phone')} />
      <SwitchRow label={t('business.whatsapp')} value={form.whatsapp} onChange={(whatsapp) => set({ whatsapp })} />
      <SwitchRow label={t('business.is24h')} value={form.is24h} onChange={(is24h) => set({ is24h })} />
      {form.is24h ? null : (
        <TextField label={t('business.hours')} placeholder={t('business.hoursPlaceholder')} value={form.hoursNote ?? ''} onChangeText={(hoursNote) => set({ hoursNote })} maxLength={BUSINESS_LIMITS.hoursNote} error={err('hoursNote')} />
      )}
      <TextField label={t('business.description')} value={form.description ?? ''} onChangeText={(description) => set({ description })} maxLength={BUSINESS_LIMITS.description} multiline error={err('description')} />

      <AppText variant="label" accessibilityRole="header">{t('business.priceList')}</AppText>
      <AppText variant="caption" muted>{t('business.priceNote')}</AppText>
      {form.priceList.map((p, i) => (
        <View key={i} style={[styles.priceRow, { borderColor: c.border }]}>
          <TextField label={t('business.priceName')} value={p.name} onChangeText={(name) => setPrice(i, { name })} maxLength={BUSINESS_LIMITS.priceName} />
          <TextField label={t('business.priceValue')} value={p.price} onChangeText={(price) => setPrice(i, { price })} maxLength={BUSINESS_LIMITS.priceValue} />
          <AppButton variant="ghost" title={t('business.removePrice')} onPress={() => set({ priceList: form.priceList.filter((_, j) => j !== i) })} />
        </View>
      ))}
      {err('priceList') ? <AppText variant="caption" style={{ color: c.danger }}>{err('priceList')}</AppText> : null}
      {form.priceList.length < BUSINESS_LIMITS.priceItems ? (
        <AppButton variant="secondary" title={t('business.addPrice')} onPress={() => set({ priceList: [...form.priceList, { name: '', price: '' }] })} />
      ) : null}

      <AppButton title={t('business.save')} onPress={save} loading={busy} disabled={busy || removed} />
      <AppText variant="caption" muted>{t('business.myVerifyNote')}</AppText>

      {existing && !removed ? (
        <AppButton
          variant="secondary"
          title={existing.status === 'gizli' ? t('business.show') : t('business.hide')}
          disabled={busy}
          onPress={() => run(() => businessRepository.setHidden(existing.id, existing.status !== 'gizli'), () => goBackOr(router, '/business'))}
        />
      ) : null}
      {existing ? (
        confirmDelete ? (
          <View style={styles.confirm}>
            <FormMessage kind="error" text={t('business.deleteConfirm')} />
            <AppButton title={t('business.deleteYes')} disabled={busy} onPress={() => run(() => businessRepository.delete(existing.id), () => goBackOr(router, '/business'))} />
          </View>
        ) : (
          <AppButton variant="ghost" title={t('business.delete')} onPress={() => setConfirmDelete(true)} />
        )
      ) : null}
    </FormScreen>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange(v: boolean): void }) {
  const c = useThemeColors();
  return (
    <View style={styles.switchRow}>
      <AppText style={styles.flex}>{label}</AppText>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: c.primary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  priceRow: { gap: spacing.sm, borderWidth: 1, borderRadius: 14, padding: spacing.sm },
  confirm: { gap: spacing.sm },
});
