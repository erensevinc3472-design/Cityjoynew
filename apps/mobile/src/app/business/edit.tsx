import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AMENITIES,
  BUSINESS_LIMITS,
  BUSINESS_TYPES,
  HOME_BASED_TYPES,
  PAYMENT_METHODS,
  ROADSIDE_FEATURES,
  ROADSIDE_KINDS,
  geoPoint,
  validateBusiness,
  type Approval,
  type Business,
  type BusinessError,
  type BusinessInput,
  type BusinessType,
  type DayHours,
} from '@cityjoy/shared';
import { vitrinLimit } from '@cityjoy/shared/firebase';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { BusinessManagers } from '@/components/business-managers';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { MediaPicker } from '@/components/media-picker';
import { OptionRow } from '@/components/option-row';
import { CategoryPicker, FoodKindPicker, IconChipPicker, RegionPicker } from '@/components/pickers';
import { StateMessage } from '@/components/state-message';
import { TextField } from '@/components/text-field';
import { firestore } from '@/lib/firebase';
import { currentLocation } from '@/lib/location';
import { goBackOr } from '@/lib/navigation';
import { useServiceCategories } from '@/lib/service-categories';
import { businessRepository, DuplicateBusinessError, verificationRequests } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useUserLocation } from '@/lib/user-location';
import { useSettings } from '@/lib/settings';
import { fonts, radius, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/use-theme';

type Form = Omit<BusinessInput, 'location'> & { provinceCode?: string; districtId?: string; neighbourhoodId?: string };
const DEFAULT_DAY: DayHours = { open: '09:00', close: '18:00' };
/** Kategori listesi türe göre değişir (yeme-içme ve yol üstü kendi çeşitlerinden seçer); grup değişince seçim sıfırlanır. */
const kindGroup = (type: BusinessType) => (type === 'yeme-icme' || type === 'yol-ustu' ? type : 'hizmet');

/**
 * Profil > İşletme ekle / düzenle (PROJE.md 5.7). Bilgiler bir kez girilir; seçilen hizmetlerin listesinde, işletmenin
 * ilinde kendiliğinden görünür ve işletme sayfasını doldurur (çalışma saatleri "şu an açık" için, ödeme, olanaklar,
 * menü / fiyat listesi). Sahibi yetkili atar; düzenleme izni olan yetkili de bilgileri değiştirir (telefon hariç).
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
  const [locating, setLocating] = useState<'idle' | 'busy' | 'denied' | 'failed'>('idle');
  const tier = existing?.membership.tier ?? 'ucretsiz';
  const [vitrinMax, setVitrinMax] = useState(0);
  useEffect(() => {
    vitrinLimit(firestore, tier).then(setVitrinMax, () => setVitrinMax(0));
  }, [tier]);

  useEffect(() => {
    if (!id) return;
    businessRepository
      .get(id)
      .then((b) => {
        setExisting(b);
        if (b) {
          const { location: loc, ...rest } = b;
          setForm({ ...rest, provinceCode: loc.provinceCode, districtId: loc.districtId, neighbourhoodId: loc.neighbourhoodId });
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
  const isOwner = !!existing && existing.ownerUid === user.uid;
  const canEdit = isOwner || !!existing?.managers.some((m) => m.uid === user.uid && m.edit);
  const amManager = !!existing?.managers.some((m) => m.uid === user.uid);
  if (id && (!existing || (!isOwner && !amManager))) {
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

  // Yol üstü tesis: "yol-ustu" türünde her zaman açık; diğer türlerde işaretlenirse (roadside tanımlı).
  const roadsideOn = form.type === 'yol-ustu' || form.roadside !== undefined;
  const takeLocation = async () => {
    setLocating('busy');
    const r = await currentLocation();
    if (r.status === 'ready') {
      set({ geo: geoPoint(r.location.lat, r.location.lng) });
      setLocating('idle');
    } else setLocating(r.status === 'denied' ? 'denied' : 'failed');
  };

  const toInput = (): BusinessInput => {
    const { provinceCode, districtId, neighbourhoodId, ...rest } = form;
    return {
      ...rest,
      ...(roadsideOn ? { roadside: form.roadside ?? [] } : { roadside: undefined, geo: undefined }),
      phone: form.phone.replace(/\D/g, ''),
      ...(homeBased ? { address: undefined } : {}),
      location: { provinceCode: provinceCode ?? '', districtId: districtId ?? '', ...(neighbourhoodId ? { neighbourhoodId } : {}) },
    };
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
      goBackOr(router, existing ? { pathname: '/business/[id]', params: { id: existing.id } } : '/business');
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

  const toggleIn = <T extends string>(list: T[] | undefined, x: T) => ((list ?? []).includes(x) ? (list ?? []).filter((y) => y !== x) : [...(list ?? []), x]);
  const setDay = (i: number, d: DayHours | null) => set({ weeklyHours: (form.weeklyHours ?? Array(7).fill(DEFAULT_DAY)).map((x, j) => (j === i ? d : x)) });
  const setPrice = (i: number, patch: Partial<{ name: string; price: string }>) =>
    set({ priceList: form.priceList.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  // Düzenleme izni olmayan yetkili: yalnızca bilgi ve ayrılma.
  if (existing && !canEdit) {
    return (
      <FormScreen title={existing.name}>
        <FormMessage kind="info" text={t('business.managers.noEdit')} />
        <LeaveManaged businessId={existing.id} uid={user.uid} />
      </FormScreen>
    );
  }

  return (
    <FormScreen title={existing ? t('business.editTitle') : t('business.newTitle')}>
      {removed ? <FormMessage kind="error" text={t('business.removedNote')} /> : null}
      {existing && !isOwner ? <FormMessage kind="info" text={t('business.managers.editingAs', { name: existing.name })} /> : null}
      {message ? <FormMessage kind={message.kind} text={message.text} /> : null}

      <AppText variant="label" accessibilityRole="header">{t('business.type')}</AppText>
      {BUSINESS_TYPES.map((type) => (
        // Yeme-içme, yol üstü ve diğer türler farklı listeden seçer: grup değişince seçimler sıfırlanır.
        <OptionRow
          key={type}
          title={t(`business.types.${type}`)}
          selected={form.type === type}
          onPress={() => set({ type, ...(kindGroup(type) !== kindGroup(form.type) ? { categoryIds: [] } : {}) })}
        />
      ))}

      <TextField label={t('business.name')} value={form.name} onChangeText={(name) => set({ name })} maxLength={BUSINESS_LIMITS.name[1]} error={err('name')} />

      <AppText variant="label" accessibilityRole="header">{t('business.categories')}</AppText>
      <AppText variant="caption" muted>{form.type === 'yeme-icme' ? t('food.kindsHint') : form.type === 'yol-ustu' ? t('roadside.kindsHint') : t('business.categoriesHint')}</AppText>
      {form.type === 'yeme-icme' ? (
        <FoodKindPicker selected={form.categoryIds} max={BUSINESS_LIMITS.categories[1]} onChange={(categoryIds) => set({ categoryIds })} />
      ) : form.type === 'yol-ustu' ? (
        <IconChipPicker
          options={ROADSIDE_KINDS.map((k) => ({ id: k.id, icon: k.icon, label: t(`roadside.kinds.${k.id}`) }))}
          selected={form.categoryIds}
          max={BUSINESS_LIMITS.categories[1]}
          onChange={(categoryIds) => set({ categoryIds })}
        />
      ) : (
        <CategoryPicker all={categories} selected={form.categoryIds} max={BUSINESS_LIMITS.categories[1]} onChange={(categoryIds) => set({ categoryIds })} />
      )}
      {err('categories') ? <AppText variant="caption" style={{ color: c.danger }}>{err('categories')}</AppText> : null}

      <AppText variant="label" accessibilityRole="header">{t('business.location')}</AppText>
      <RegionPicker provinceCode={form.provinceCode} districtId={form.districtId} neighbourhoodId={form.neighbourhoodId} withNeighbourhood onChange={(v) => set(v)} />
      <AppText variant="caption" muted>{t('business.neighbourhoodHint')}</AppText>
      {err('location') ? <AppText variant="caption" style={{ color: c.danger }}>{err('location')}</AppText> : null}
      {homeBased ? (
        <AppText variant="caption" muted>{t('business.addressHomeNote')}</AppText>
      ) : (
        <TextField label={t('business.address')} value={form.address ?? ''} onChangeText={(address) => set({ address })} maxLength={BUSINESS_LIMITS.address} error={err('address')} />
      )}

      <TextField label={t('business.phone')} hint={isOwner || !existing ? t('business.phoneHint') : t('business.managers.phoneOwnerOnly')} value={form.phone} onChangeText={(phone) => set({ phone })} keyboardType="phone-pad" autoComplete="tel" error={err('phone')} editable={isOwner || !existing} />
      <SwitchRow label={t('business.whatsapp')} value={form.whatsapp} onChange={(whatsapp) => set({ whatsapp })} />
      <SwitchRow label={t('business.is24h')} value={form.is24h} onChange={(is24h) => set({ is24h })} />
      {form.is24h ? null : (
        <>
          <SwitchRow label={t('business.weekly.toggle')} value={!!form.weeklyHours} onChange={(on) => set({ weeklyHours: on ? Array(7).fill(DEFAULT_DAY) : undefined })} />
          {form.weeklyHours ? <WeeklyHours value={form.weeklyHours} onDay={setDay} onCopy={() => set({ weeklyHours: form.weeklyHours!.map(() => form.weeklyHours![0]) })} error={err('hours')} /> : null}
          <TextField label={t('business.hours')} placeholder={t('business.hoursPlaceholder')} value={form.hoursNote ?? ''} onChangeText={(hoursNote) => set({ hoursNote })} maxLength={BUSINESS_LIMITS.hoursNote} error={err('hoursNote')} />
        </>
      )}
      <TextField label={t('business.description')} value={form.description ?? ''} onChangeText={(description) => set({ description })} maxLength={BUSINESS_LIMITS.description} multiline error={err('description')} />
      <MediaPicker label={t('business.logo')} hint={t('business.logoHint')} kind="isletme-logo" uid={user.uid} photos={form.logo ? [form.logo] : []} max={1} onChange={(p) => set({ logo: p[0] })} disabled={busy || removed} round />
      {vitrinMax > 0 || form.gallery?.length ? (
        <MediaPicker label={t('business.gallery')} hint={t('business.galleryHint')} kind="isletme-vitrin" uid={user.uid} photos={form.gallery ?? []} max={Math.max(vitrinMax, form.gallery?.length ?? 0)} onChange={(gallery) => set({ gallery })} disabled={busy || removed} />
      ) : null}

      <AppText variant="label" accessibilityRole="header">{t('business.page.payment')}</AppText>
      <ToggleChips options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`business.payment.${m}`) }))} selected={form.paymentMethods ?? []} onToggle={(m) => set({ paymentMethods: toggleIn(form.paymentMethods, m) })} />
      <AppText variant="label" accessibilityRole="header">{t('business.page.amenities')}</AppText>
      <ToggleChips options={AMENITIES.map((m) => ({ value: m, label: t(`business.amenity.${m}`) }))} selected={form.amenities ?? []} onToggle={(m) => set({ amenities: toggleIn(form.amenities, m) })} />

      {/* Yol Arkadaşı: yolcular ihtiyacına göre (tuvalet, yakıt, şarj…) yakındaki tesisleri bulur. */}
      <AppText variant="label" accessibilityRole="header">{t('roadside.title')}</AppText>
      {form.type === 'yol-ustu' ? null : (
        <SwitchRow label={t('roadside.toggle')} value={roadsideOn} onChange={(on) => set(on ? { roadside: form.roadside ?? [] } : { roadside: undefined, geo: undefined })} />
      )}
      <AppText variant="caption" muted>{t('roadside.hint')}</AppText>
      {roadsideOn ? (
        <>
          <IconChipPicker
            options={ROADSIDE_FEATURES.map((k) => ({ id: k.id, icon: k.icon, label: t(`roadside.features.${k.id}`) }))}
            selected={form.roadside ?? []}
            onChange={(ids) => set({ roadside: ids as BusinessInput['roadside'] })}
          />
          {err('roadside') ? <AppText variant="caption" style={{ color: c.danger }}>{err('roadside')}</AppText> : null}
          <View style={[styles.geoBox, { borderColor: err('geo') ? c.danger : c.border, backgroundColor: c.surface }]}>
            <AppText variant="caption" muted>{t('roadside.locationHint')}</AppText>
            {form.geo ? (
              <AppText style={{ color: c.text }}>{t('roadside.located', { lat: form.geo.lat.toFixed(5), lng: form.geo.lng.toFixed(5) })}</AppText>
            ) : null}
            <AppButton
              variant="secondary"
              title={form.geo ? t('roadside.relocate') : t('roadside.locate')}
              onPress={takeLocation}
              loading={locating === 'busy'}
              disabled={locating === 'busy'}
            />
            {form.geo ? (
              <AppButton variant="ghost" title={t('roadside.checkMap')} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${form.geo!.lat},${form.geo!.lng}`)} />
            ) : null}
            {locating === 'denied' || locating === 'failed' ? (
              <AppText variant="caption" style={{ color: c.danger }}>{t(locating === 'denied' ? 'roadside.locationDenied' : 'roadside.locationFailed')}</AppText>
            ) : null}
            {err('geo') ? <AppText variant="caption" style={{ color: c.danger }}>{err('geo')}</AppText> : null}
          </View>
        </>
      ) : null}

      <AppText variant="label" accessibilityRole="header">{form.type === 'yeme-icme' ? t('business.page.tabMenu') : t('business.priceList')}</AppText>
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
      {existing && isOwner && !removed ? <BusinessManagers business={existing} onSaved={(managers) => setExisting({ ...existing, managers })} /> : null}
      {existing && !isOwner ? <LeaveManaged businessId={existing.id} uid={user.uid} /> : null}
      {existing && isOwner && !removed ? <VerificationSection business={existing} uid={user.uid} /> : <AppText variant="caption" muted>{t('business.myVerifyNote')}</AppText>}

      {existing && isOwner && !removed ? (
        <AppButton
          variant="secondary"
          title={existing.status === 'gizli' ? t('business.show') : t('business.hide')}
          disabled={busy}
          onPress={() => run(() => businessRepository.setHidden(existing.id, existing.status !== 'gizli'), () => goBackOr(router, '/business'))}
        />
      ) : null}
      {existing && isOwner ? (
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

/** Doğrulama isteği: sahibi ister, durumu ve ret gerekçesini görür, geri çeker ya da yeniden ister. */
function VerificationSection({ business, uid }: { business: Business; uid: string }) {
  const { t } = useTranslation();
  const [request, setRequest] = useState<Approval | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    verificationRequests.get(business.id).then(setRequest).catch(() => setError(true));
  }, [business.id]);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(false);
    try {
      await fn();
      load();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const verified = business.verification.status === 'dogrulandi';
  const pending = request?.status === 'il-onayi-bekliyor' || request?.status === 'admin-onayi-bekliyor';
  const status = verified
    ? t('business.verifyDone')
    : request?.status === 'il-onayi-bekliyor'
      ? t('business.verifyPendingFirst')
      : request?.status === 'admin-onayi-bekliyor'
        ? t('business.verifyPendingAdmin')
        : request?.status === 'reddedildi'
          ? t('business.verifyRejected', { reason: request.decision?.reason ?? '' })
          : null;

  return (
    <View style={styles.confirm}>
      <AppText variant="label" accessibilityRole="header">{t('business.verifyTitle')}</AppText>
      {verified ? null : <AppText variant="caption" muted>{t('business.verifyIntro')}</AppText>}
      {error ? (
        <StateMessage kind="error" onRetry={load} />
      ) : request === undefined ? (
        <StateMessage kind="loading" />
      ) : (
        <>
          {status ? <FormMessage kind={request?.status === 'reddedildi' && !verified ? 'error' : 'info'} text={status} /> : null}
          {verified ? null : pending ? (
            <AppButton variant="ghost" title={t('business.verifyCancel')} disabled={busy} onPress={() => run(() => verificationRequests.cancel(business.id))} />
          ) : (
            <AppButton
              variant="secondary"
              title={request ? t('business.verifyAgain') : t('business.verifyRequest')}
              loading={busy}
              disabled={busy}
              onPress={() => run(() => verificationRequests.request(uid, business))}
            />
          )}
        </>
      )}
    </View>
  );
}

/** Yetkili kendini işletmeden çıkarır. */
function LeaveManaged({ businessId, uid }: { businessId: string; uid: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const leave = async () => {
    setBusy(true);
    setError(false);
    try {
      await businessRepository.leaveManaged(businessId, uid);
      router.replace('/business');
    } catch {
      setError(true);
      setBusy(false);
    }
  };
  return (
    <View style={styles.confirm}>
      {error ? <FormMessage kind="error" text={t('business.saveError')} /> : null}
      {confirm ? (
        <>
          <FormMessage kind="info" text={t('business.managers.leaveConfirm')} />
          <AppButton title={t('business.managers.leaveYes')} loading={busy} disabled={busy} onPress={leave} />
          <AppButton variant="ghost" title={t('account.cancel')} onPress={() => setConfirm(false)} />
        </>
      ) : (
        <AppButton variant="ghost" title={t('business.managers.leave')} onPress={() => setConfirm(true)} />
      )}
    </View>
  );
}

/** Haftalık çalışma saatleri: her gün açık/kapalı ve saatler ("09:00"). İlk günün saatleri tüm haftaya kopyalanabilir. */
function WeeklyHours({ value, onDay, onCopy, error }: { value: (DayHours | null)[]; onDay(i: number, d: DayHours | null): void; onCopy(): void; error?: string }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { language } = useSettings();
  const days = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(language ?? 'tr', { weekday: 'long' }));
  return (
    <View style={[styles.week, { borderColor: c.border }]}>
      {value.map((d, i) => (
        <View key={i} style={styles.dayRow}>
          <AppText style={[styles.dayName, { color: c.textStrong }]} numberOfLines={1}>{days[i]}</AppText>
          {d ? (
            <>
              <View style={styles.time}>
                <TextField label={t('business.weekly.open')} value={d.open} onChangeText={(open) => onDay(i, { ...d, open })} maxLength={5} keyboardType="numbers-and-punctuation" />
              </View>
              <View style={styles.time}>
                <TextField label={t('business.weekly.close')} value={d.close} onChangeText={(close) => onDay(i, { ...d, close })} maxLength={5} keyboardType="numbers-and-punctuation" />
              </View>
            </>
          ) : (
            <AppText style={styles.closed} muted>{t('business.page.closed')}</AppText>
          )}
          <Switch accessibilityLabel={`${days[i]}: ${d ? t('business.weekly.isOpen') : t('business.page.closed')}`} value={!!d} onValueChange={(on) => onDay(i, on ? DEFAULT_DAY : null)} trackColor={{ true: c.primary }} />
        </View>
      ))}
      <AppText variant="caption" muted>{t('business.weekly.hint')}</AppText>
      {error ? <AppText variant="caption" style={{ color: c.danger }}>{error}</AppText> : null}
      <AppButton variant="ghost" title={t('business.weekly.copy', { day: days[0] })} onPress={onCopy} />
    </View>
  );
}

/** Çoklu seçim çipleri (ödeme yöntemleri, olanaklar). */
function ToggleChips<T extends string>({ options, selected, onToggle }: { options: { value: T; label: string }[]; selected: T[]; onToggle(v: T): void }) {
  const c = useThemeColors();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <Pressable
            key={o.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => onToggle(o.value)}
            style={({ pressed }) => [styles.chip, { backgroundColor: on ? c.accentSoft : c.surface, borderColor: on ? c.accent : c.border, opacity: pressed ? 0.8 : 1 }]}>
            <AppText style={[styles.chipText, { color: on ? c.accent : c.text }]}>{o.label}</AppText>
          </Pressable>
        );
      })}
    </View>
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
  geoBox: { gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  confirm: { gap: spacing.sm },
  week: { gap: spacing.sm, borderWidth: 1, borderRadius: 14, padding: spacing.sm },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayName: { width: 82, fontFamily: fonts.bodySemi, fontSize: 13 },
  time: { flex: 1 },
  closed: { flex: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
});
