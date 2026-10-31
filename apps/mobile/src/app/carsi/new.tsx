import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  canUseActivities,
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  LISTING_KINDS,
  LISTING_LIMITS,
  listingHasPrice,
  parsePrice,
  PROHIBITED_ITEMS,
  RENT_UNITS,
  validateListing,
  type Listing,
  type ListingCategory,
  type ListingCondition,
  type ListingError,
  type ListingKind,
  type RentUnit,
} from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { StateMessage } from '@/components/state-message';
import { TextField } from '@/components/text-field';
import { useBannedWordCheck } from '@/lib/banned-words';
import { checkListingPlace, type PlaceCheck } from '@/lib/listings';
import { listingRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSocial } from '@/lib/social';
import { useUserLocation } from '@/lib/user-location';
import { spacing } from '@/theme/tokens';

type FormError = ListingError | 'banned';

/**
 * İlan ver ve düzenle (`?id=`). İlanı e-postası doğrulanmış yetişkin, kayıtlı mahallesiyle verir; yeni ilanda telefonun
 * konumu bir kez kayıtlı ille karşılaştırılır. Yasaklı ürünler formda yazılı; emlak ve araç şimdilik yok. Günlük sınır
 * dolduysa kurallar reddeder ve kişiye söylenir.
 */
export default function NewListingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, profile } = useSession();
  const { me } = useSocial();
  const { location } = useUserLocation();
  const hasBanned = useBannedWordCheck();
  const [editing, setEditing] = useState<Listing | null | undefined>(id ? undefined : null);
  const [kind, setKind] = useState<ListingKind>('satilik');
  const [category, setCategory] = useState<ListingCategory>('elektronik');
  const [condition, setCondition] = useState<ListingCondition>('kullanilmis');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [rentUnit, setRentUnit] = useState<RentUnit>('gun');
  const [swapFor, setSwapFor] = useState('');
  const [errors, setErrors] = useState<FormError[]>([]);
  const [place, setPlace] = useState<PlaceCheck | null>(null);
  const [failed, setFailed] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    listingRepository.get(id).then(
      (l) => {
        if (!l || l.ownerUid !== user.uid || l.status === 'kaldirildi') return setEditing(null);
        setEditing(l);
        setKind(l.kind);
        setCategory(l.category);
        setCondition(l.condition);
        setTitle(l.title);
        setDescription(l.description);
        setPrice(l.price == null ? '' : String(l.price));
        setRentUnit(l.rentUnit ?? 'gun');
        setSwapFor(l.swapFor);
      },
      () => setEditing(null),
    );
  }, [id, user]);

  const heading = id ? t('carsi.editTitle') : t('carsi.new');
  if (id && editing === undefined) {
    return (
      <FormScreen title={heading}>
        <StateMessage kind="loading" />
      </FormScreen>
    );
  }
  if (id && !editing) {
    return (
      <FormScreen title={heading}>
        <StateMessage kind="empty" message={t('carsi.gone')} />
      </FormScreen>
    );
  }
  // Yeni ilan için koşullar: giriş, doğrulanmış e-posta, 18 yaş, kayıtlı mahalle.
  const blocker = !user
    ? t('carsi.signIn')
    : !editing && !user.emailVerified
      ? t('carsi.needVerified')
      : !canUseActivities(profile?.birthYear)
        ? t('carsi.needAdult')
        : !editing && (!location?.districtId || !location.neighbourhoodId)
          ? t('carsi.needNeighbourhood')
          : null;
  if (blocker || !user) {
    return (
      <FormScreen title={heading}>
        <FormMessage kind="info" text={blocker ?? ''} />
        {user && user.emailVerified && canUseActivities(profile?.birthYear) ? <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} /> : null}
      </FormScreen>
    );
  }

  const hasPrice = listingHasPrice(kind);

  const submit = async () => {
    if (!me) return setFailed(t('carsi.profileMissing'));
    const region = editing
      ? editing.region
      : { provinceCode: location!.provinceCode, districtId: location!.districtId!, neighbourhoodId: location!.neighbourhoodId! };
    const input = {
      kind,
      category,
      condition,
      title: title.trim(),
      description: description.trim(),
      price: hasPrice ? parsePrice(price) : null,
      rentUnit: kind === 'kiralik' ? rentUnit : null,
      swapFor: kind === 'takas' ? swapFor.trim() : '',
      region,
    };
    const errs: FormError[] = [...validateListing(input), ...(hasBanned(`${input.title} ${input.description} ${input.swapFor}`) ? ['banned' as const] : [])];
    setErrors(errs);
    setFailed(undefined);
    if (errs.length) return;
    setBusy(true);
    try {
      if (editing) {
        await listingRepository.update(editing.id, input);
        router.replace({ pathname: '/carsi/[id]', params: { id: editing.id } });
        return;
      }
      // Telefonun konumu kayıtlı ilde mi (bir kez; izin verilmezse ilan verilmez).
      const check = place === 'ok' ? 'ok' : await checkListingPlace(region.provinceCode);
      setPlace(check);
      if (check !== 'ok') return;
      const newId = await listingRepository.create(user.uid, me.displayName, input);
      router.replace({ pathname: '/carsi/[id]', params: { id: newId } });
    } catch {
      setFailed(editing ? t('carsi.saveError') : t('carsi.createError'));
    } finally {
      setBusy(false);
    }
  };

  const err = (k: ListingError) => (errors.includes(k) ? t(`carsi.errors.${k}`) : undefined);

  return (
    <FormScreen title={heading} subtitle={editing ? undefined : t('carsi.newIntro')}>
      <View style={styles.block}>
        <AppText variant="label">{t('carsi.kind')}</AppText>
        <Chips<ListingKind> label={t('carsi.kind')} value={kind} onChange={setKind} options={LISTING_KINDS.map((k) => ({ value: k, label: t(`carsi.kinds.${k}`) }))} />
      </View>
      <View style={styles.block}>
        <AppText variant="label">{t('carsi.fields.category')}</AppText>
        <Chips<ListingCategory> label={t('carsi.fields.category')} value={category} onChange={setCategory} options={LISTING_CATEGORIES.map((x) => ({ value: x, label: t(`carsi.categories.${x}`) }))} />
      </View>
      <TextField label={t('carsi.fields.title')} value={title} onChangeText={setTitle} maxLength={LISTING_LIMITS.title[1]} error={err('title')} hint={t('carsi.fields.titleHint')} />
      {hasPrice ? (
        <TextField
          label={kind === 'kiralik' ? t('carsi.fields.rentPrice') : t('carsi.fields.price')}
          value={price}
          onChangeText={setPrice}
          keyboardType="number-pad"
          maxLength={12}
          error={err('price')}
        />
      ) : null}
      {kind === 'kiralik' ? (
        <View style={styles.block}>
          <AppText variant="label">{t('carsi.fields.rentUnit')}</AppText>
          <Chips<RentUnit> label={t('carsi.fields.rentUnit')} value={rentUnit} onChange={setRentUnit} options={RENT_UNITS.map((u) => ({ value: u, label: t(`carsi.rentUnitsLong.${u}`) }))} />
        </View>
      ) : null}
      {kind === 'takas' ? <TextField label={t('carsi.fields.swapFor')} value={swapFor} onChangeText={setSwapFor} maxLength={LISTING_LIMITS.swapFor} error={err('swapFor')} hint={t('carsi.fields.swapForHint')} /> : null}
      <View style={styles.block}>
        <AppText variant="label">{t('carsi.fields.condition')}</AppText>
        <Chips<ListingCondition> label={t('carsi.fields.condition')} value={condition} onChange={setCondition} options={LISTING_CONDITIONS.map((x) => ({ value: x, label: t(`carsi.conditions.${x}`) }))} />
      </View>
      <TextField label={t('carsi.fields.description')} value={description} onChangeText={setDescription} maxLength={LISTING_LIMITS.description} multiline error={err('description')} hint={t('carsi.fields.descriptionHint')} />
      {errors.includes('realEstate') ? <FormMessage kind="error" text={t('carsi.errors.realEstate')} /> : null}
      {errors.includes('banned') ? <FormMessage kind="error" text={t('carsi.errors.banned')} /> : null}
      {errors.includes('region') ? <FormMessage kind="error" text={t('carsi.errors.region')} /> : null}

      <View style={styles.block}>
        <AppText variant="label">{t('carsi.prohibited.title')}</AppText>
        <AppText variant="caption" muted>{PROHIBITED_ITEMS.map((p) => t(`carsi.prohibited.${p}`)).join(', ')}</AppText>
        <AppText variant="caption" muted>{t('carsi.soonNote')}</AppText>
        <AppText variant="caption" muted>{t('carsi.noPhoneNote')}</AppText>
      </View>
      {place && place !== 'ok' ? <FormMessage kind="error" text={t(`carsi.place.${place}`)} /> : null}
      {failed ? <FormMessage kind="error" text={failed} /> : null}
      <AppButton title={editing ? t('carsi.save') : t('carsi.publish')} onPress={submit} loading={busy} disabled={busy} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
});
