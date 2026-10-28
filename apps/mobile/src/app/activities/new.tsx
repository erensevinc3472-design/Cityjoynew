import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_LIMITS,
  authorNameOf,
  canUseActivities,
  validateActivity,
  type ActivityCategory,
  type ActivityError,
} from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { CheckboxRow } from '@/components/checkbox-row';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { TextField } from '@/components/text-field';
import { forgetActivities } from '@/lib/activities';
import { locationRepository as repo } from '@/lib/locations';
import { activityRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { useUserLocation } from '@/lib/user-location';
import { spacing } from '@/theme/tokens';

const DAYS = 14;
const HOURS = [1, 2, 3, 4, 6] as const;

/** "Aktivite aç" (PROJE.md 5.3): kendi mahallende, en çok 30 gün sonrası için; tam yer yalnızca katılanlara görünür. */
export default function NewActivityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language } = useSettings();
  const lang = language ?? 'tr';
  const { user, profile } = useSession();
  const { location } = useUserLocation();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ActivityCategory>('kahve-sohbet');
  const [day, setDay] = useState(1);
  const [time, setTime] = useState('10:00');
  const [hours, setHours] = useState<number>(2);
  const [address, setAddress] = useState('');
  const [capacity, setCapacity] = useState('8');
  const [description, setDescription] = useState('');
  const [tipsRead, setTipsRead] = useState(false);
  const [errors, setErrors] = useState<(ActivityError | 'time' | 'tips')[]>([]);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nbName, setNbName] = useState<string>();

  useEffect(() => {
    if (!location?.districtId || !location.neighbourhoodId) return;
    repo.getNeighbourhoods(location.districtId).then((l) => setNbName(l.find((n) => n.id === location.neighbourhoodId)?.name), () => {});
  }, [location]);

  const today = new Date();
  const dayOptions = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    return { value: i, label: i === 0 ? t('activities.today') : i === 1 ? t('activities.tomorrow') : d.toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' }) };
  });

  const submit = async () => {
    if (!user || !profile || !location?.districtId || !location.neighbourhoodId) return;
    const m = /^([01]?\d|2[0-3])[:.]([0-5]\d)$/.exec(time.trim());
    // Geçersiz saatte tarih boş kalır; doğrulama "tarih" hatası verir.
    const start = m ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + day, Number(m[1]), Number(m[2])) : null;
    const input = {
      title,
      description,
      category,
      startsAt: start ? start.toISOString() : '',
      endsAt: start ? new Date(start.getTime() + hours * 3600000).toISOString() : '',
      region: { provinceCode: location.provinceCode, districtId: location.districtId, neighbourhoodId: location.neighbourhoodId },
      address,
      capacity: Number(capacity),
    };
    const errs: (ActivityError | 'time' | 'tips')[] = [...(m ? [] : ['time' as const]), ...validateActivity(input), ...(tipsRead ? [] : ['tips' as const])];
    setErrors(errs);
    setFailed(false);
    if (errs.length) return;
    setBusy(true);
    try {
      const id = await activityRepository.create(user.uid, authorNameOf(profile.displayName), input);
      forgetActivities(location.provinceCode);
      router.replace({ pathname: '/activities/[id]', params: { id } });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (!user || !canUseActivities(profile?.birthYear) || !location?.neighbourhoodId) {
    return (
      <FormScreen title={t('activities.create')}>
        <FormMessage kind="info" text={!user ? t('activities.signIn') : !location?.neighbourhoodId ? t('activities.needNeighbourhood') : t('activities.adultsOnly')} />
        {user && !location?.neighbourhoodId ? <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} /> : null}
      </FormScreen>
    );
  }

  const err = (k: ActivityError | 'time') => (errors.includes(k) ? t(`activities.errors.${k}`) : undefined);
  const L = ACTIVITY_LIMITS;
  const place = [nbName, repo.getDistrict(location.districtId!)?.name].filter(Boolean).join(', ');

  return (
    <FormScreen title={t('activities.create')} subtitle={t('activities.createIntro')}>
      <TextField label={t('activities.fields.title')} value={title} onChangeText={setTitle} maxLength={L.title[1]} error={err('title')} hint={t('activities.fields.titleHint')} />
      <View style={styles.block}>
        <AppText variant="label">{t('activities.fields.category')}</AppText>
        <Chips<ActivityCategory> label={t('activities.fields.category')} value={category} onChange={setCategory} options={ACTIVITY_CATEGORIES.map((c) => ({ value: c, label: t(`activities.categories.${c}`) }))} />
      </View>
      <View style={styles.block}>
        <AppText variant="label">{t('activities.fields.day')}</AppText>
        <Chips<number> label={t('activities.fields.day')} value={day} onChange={setDay} options={dayOptions} />
      </View>
      <TextField label={t('activities.fields.time')} value={time} onChangeText={setTime} maxLength={5} keyboardType="numbers-and-punctuation" error={err('time') ?? err('dates')} hint={t('activities.fields.timeHint')} />
      <View style={styles.block}>
        <AppText variant="label">{t('activities.fields.duration')}</AppText>
        <Chips<number> label={t('activities.fields.duration')} value={hours} onChange={setHours} options={HOURS.map((h) => ({ value: h, label: t('activities.hours', { count: h }) }))} />
      </View>
      <View style={styles.block}>
        <AppText variant="label">{t('activities.fields.neighbourhood')}</AppText>
        <AppText>{place}</AppText>
        <AppText variant="caption" muted>{t('activities.fields.neighbourhoodHint')}</AppText>
      </View>
      <TextField label={t('activities.fields.address')} value={address} onChangeText={setAddress} maxLength={L.address[1]} error={err('address')} hint={t('activities.fields.addressHint')} />
      <TextField label={t('activities.fields.capacity')} value={capacity} onChangeText={(v) => setCapacity(v.replace(/\D/g, ''))} maxLength={2} keyboardType="number-pad" error={err('capacity')} hint={t('activities.fields.capacityHint', { max: L.capacity[1] })} />
      <TextField label={t('activities.fields.description')} value={description} onChangeText={setDescription} maxLength={L.description[1]} multiline error={err('description')} hint={t('activities.fields.descriptionHint')} />
      <View style={styles.block}>
        <AppText variant="label">{t('activities.safetyTitle')}</AppText>
        <AppText variant="caption" muted>{t('activities.safetyTips')}</AppText>
      </View>
      <CheckboxRow checked={tipsRead} onToggle={() => setTipsRead((x) => !x)} label={t('activities.tipsConfirm')} />
      {errors.includes('tips') ? <FormMessage kind="error" text={t('activities.errors.tips')} /> : null}
      {errors.length && !errors.includes('tips') ? <FormMessage kind="error" text={t('activities.errors.fix')} /> : null}
      {failed ? <FormMessage kind="error" text={t('activities.saveError')} /> : null}
      <AppButton title={t('activities.publish')} onPress={submit} loading={busy} disabled={busy} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
});
