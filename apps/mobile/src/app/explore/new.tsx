import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  authorNameOf,
  ltr,
  POST_CATEGORIES,
  POST_LIMITS,
  POST_TARGETS,
  postModeFor,
  validatePost,
  type Business,
  type PostCategory,
  type PostError,
  type PostTarget,
} from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { CheckboxRow } from '@/components/checkbox-row';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { StateMessage } from '@/components/state-message';
import { TextField } from '@/components/text-field';
import { useBannedWordCheck } from '@/lib/banned-words';
import { forgetFeeds } from '@/lib/posts';
import { forgetSearches } from '@/lib/search';
import { businessRepository, postRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useUserLocation } from '@/lib/user-location';
import { spacing } from '@/theme/tokens';

/**
 * Gönderi paylaş (PROJE.md 5.5): yazı, kategori ve "Nerede paylaşırsın?" (bir ya da birden çok hedef). Gönderi kayıtlı
 * mahalleyle paylaşılır. Emlak ilanı Keşfet'te verilemez; taziyeyi yalnızca yakını paylaşır (beyan).
 * İşletmesi olan ya da paylaşım izni olan yetkili "Kimin adına?" sorusunda işletmeyi seçer: gönderi işletmenin adı ve
 * konumuyla paylaşılır; yetkilinin izni "onayla" ise sahibi onaylayana kadar akışta görünmez.
 */
export default function NewPostScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, profile } = useSession();
  const { location } = useUserLocation();
  const [text, setText] = useState('');
  const [category, setCategory] = useState<PostCategory>('genel');
  // Keşfet'te hangi sekmedeyken + düğmesine basıldıysa o hedef seçili gelir; kişi istediği yerleri işaretler.
  const { target, as } = useLocalSearchParams<{ target?: string; as?: string }>();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [author, setAuthor] = useState<string>(as ?? 'me');
  useEffect(() => {
    if (!user) return;
    Promise.all([businessRepository.listMine(user.uid).catch(() => []), businessRepository.listManaged(user.uid).catch(() => [])]).then(([mine, managed]) => {
      const list = [...mine, ...managed].filter((b) => b.status === 'yayinda' && postModeFor(b, user.uid));
      setBusinesses(list);
      // Bağlantıdaki işletme adına paylaşılamıyorsa kişinin kendi adına döner.
      setAuthor((a) => (a === 'me' || list.some((b) => b.id === a) ? a : 'me'));
    });
  }, [user]);
  const [targets, setTargets] = useState<PostTarget[]>([POST_TARGETS.includes(target as PostTarget) ? (target as PostTarget) : 'mahallem']);
  const [relative, setRelative] = useState(false);
  const [errors, setErrors] = useState<(PostError | 'relative' | 'banned')[]>([]);
  const hasBanned = useBannedWordCheck();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const biz = author === 'me' ? null : businesses.find((b) => b.id === author) ?? null;
  if (author !== 'me' && !biz) {
    return (
      <FormScreen title={t('explore.newPost')}>
        <StateMessage kind="loading" />
      </FormScreen>
    );
  }
  if (!user || !profile || (author === 'me' && (!location?.districtId || !location.neighbourhoodId))) {
    return (
      <FormScreen title={t('explore.newPost')}>
        <FormMessage kind="info" text={!user ? t('explore.signIn') : t('explore.needNeighbourhood')} />
        {user ? <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} /> : null}
        {businesses.length ? <AuthorPicker businesses={businesses} value={author} onChange={setAuthor} /> : null}
      </FormScreen>
    );
  }
  const mode = biz ? postModeFor(biz, user.uid) : null;
  // İşletme adına paylaşım işletmenin konumuyla yapılır; mahallesi seçilmemişse önce seçilmeli.
  const bizNoHood = !!biz && !biz.location.neighbourhoodId;

  const toggle = (x: PostTarget) => setTargets((cur) => (cur.includes(x) ? cur.filter((y) => y !== x) : [...cur, x]));

  const submit = async () => {
    if (bizNoHood) return;
    const region = biz
      ? { provinceCode: biz.location.provinceCode, districtId: biz.location.districtId, neighbourhoodId: biz.location.neighbourhoodId! }
      : { provinceCode: location!.provinceCode, districtId: location!.districtId!, neighbourhoodId: location!.neighbourhoodId! };
    const input = { text, category, targets, region };
    const errs: (PostError | 'relative' | 'banned')[] = [
      ...validatePost(input),
      ...(category === 'taziye' && !relative ? ['relative' as const] : []),
      ...(hasBanned(text) ? ['banned' as const] : []),
    ];
    setErrors(errs);
    setFailed(false);
    if (errs.length) return;
    setBusy(true);
    try {
      const id = await postRepository.create(user.uid, authorNameOf(profile.displayName), input, biz ? { business: { id: biz.id, name: biz.name }, pending: mode === 'onayla' } : undefined);
      forgetFeeds();
      forgetSearches();
      // Onay bekleyen paylaşım akışta görünmez: işletme sayfasında "onay bekliyor" olarak durur.
      if (biz && mode === 'onayla') router.replace({ pathname: '/business/[id]', params: { id: biz.id } });
      else router.replace({ pathname: '/explore/[id]', params: { id } });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const err = (k: PostError | 'relative') => (errors.includes(k) ? t(`explore.errors.${k}`) : undefined);

  return (
    <FormScreen title={t('explore.newPost')} subtitle={t('explore.newIntro', { name: ltr(biz ? biz.name : authorNameOf(profile.displayName)) })}>
      {businesses.length ? <AuthorPicker businesses={businesses} value={author} onChange={setAuthor} /> : null}
      {bizNoHood ? (
        <>
          <FormMessage kind="info" text={t('explore.business.needHood')} />
          <AppButton variant="secondary" title={t('explore.business.setHood')} onPress={() => router.push({ pathname: '/business/edit', params: { id: biz!.id } })} />
        </>
      ) : null}
      {mode === 'onayla' ? <FormMessage kind="info" text={t('explore.business.pendingNote', { name: biz!.name })} /> : null}
      <TextField label={t('explore.fields.text')} value={text} onChangeText={setText} maxLength={POST_LIMITS.text[1]} multiline error={err('text')} hint={t('explore.fields.textHint')} />
      {errors.includes('realEstate') ? <FormMessage kind="error" text={t('explore.errors.realEstate')} /> : null}
      {errors.includes('banned') ? <FormMessage kind="error" text={t('explore.errors.banned')} /> : null}
      <View style={styles.block}>
        <AppText variant="label">{t('explore.fields.category')}</AppText>
        <Chips<PostCategory> label={t('explore.fields.category')} value={category} onChange={setCategory} options={POST_CATEGORIES.filter((c) => !biz || c !== 'taziye').map((c) => ({ value: c, label: t(`explore.categories.${c}`) }))} />
      </View>
      {category === 'taziye' ? (
        <>
          <CheckboxRow checked={relative} onToggle={() => setRelative((x) => !x)} label={t('explore.fields.relative')} />
          {err('relative') ? <FormMessage kind="error" text={err('relative')!} /> : null}
        </>
      ) : null}
      <View style={styles.block}>
        <AppText variant="label">{t('explore.fields.where')}</AppText>
        {POST_TARGETS.map((x) => (
          <CheckboxRow key={x} checked={targets.includes(x)} onToggle={() => toggle(x)} label={`${t(`explore.targets.${x}`)}: ${t(`explore.tabHints.${x}`)}`} />
        ))}
        {err('targets') ? <FormMessage kind="error" text={err('targets')!} /> : null}
        {targets.includes('mahallem') ? <AppText variant="caption" muted>{t('explore.fields.mahallemNote')}</AppText> : null}
      </View>
      <AppText variant="caption" muted>{t('explore.rules')}</AppText>
      {failed ? <FormMessage kind="error" text={t('explore.saveError')} /> : null}
      <AppButton title={mode === 'onayla' ? t('explore.business.sendForApproval') : t('explore.publish')} onPress={submit} loading={busy} disabled={busy || bizNoHood} />
    </FormScreen>
  );
}

/** Kimin adına: kendim ya da paylaşım iznim olan işletmeler. */
function AuthorPicker({ businesses, value, onChange }: { businesses: Business[]; value: string; onChange(v: string): void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.block}>
      <AppText variant="label">{t('explore.business.who')}</AppText>
      <Chips<string> label={t('explore.business.who')} value={value} onChange={onChange} options={[{ value: 'me', label: t('explore.business.me') }, ...businesses.map((b) => ({ value: b.id, label: b.name }))]} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
});
