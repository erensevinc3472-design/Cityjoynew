import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  authorNameOf,
  ltr,
  POST_CATEGORIES,
  POST_LIMITS,
  POST_TARGETS,
  validatePost,
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
import { TextField } from '@/components/text-field';
import { useBannedWordCheck } from '@/lib/banned-words';
import { forgetFeeds } from '@/lib/posts';
import { forgetSearches } from '@/lib/search';
import { postRepository } from '@/lib/services';
import { useSession } from '@/lib/session';
import { useUserLocation } from '@/lib/user-location';
import { spacing } from '@/theme/tokens';

/**
 * Gönderi paylaş (PROJE.md 5.5): yazı, kategori ve "Nerede paylaşırsın?" (bir ya da birden çok hedef). Gönderi kayıtlı
 * mahalleyle paylaşılır. Emlak ilanı Keşfet'te verilemez; taziyeyi yalnızca yakını paylaşır (beyan).
 */
export default function NewPostScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, profile } = useSession();
  const { location } = useUserLocation();
  const [text, setText] = useState('');
  const [category, setCategory] = useState<PostCategory>('genel');
  const [targets, setTargets] = useState<PostTarget[]>(['mahallem']);
  const [relative, setRelative] = useState(false);
  const [errors, setErrors] = useState<(PostError | 'relative' | 'banned')[]>([]);
  const hasBanned = useBannedWordCheck();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user || !profile || !location?.districtId || !location.neighbourhoodId) {
    return (
      <FormScreen title={t('explore.newPost')}>
        <FormMessage kind="info" text={!user ? t('explore.signIn') : t('explore.needNeighbourhood')} />
        {user ? <AppButton title={t('home.changeLocation')} onPress={() => router.push('/location?edit=1')} /> : null}
      </FormScreen>
    );
  }

  const toggle = (x: PostTarget) => setTargets((cur) => (cur.includes(x) ? cur.filter((y) => y !== x) : [...cur, x]));

  const submit = async () => {
    const input = {
      text,
      category,
      targets,
      region: { provinceCode: location.provinceCode, districtId: location.districtId!, neighbourhoodId: location.neighbourhoodId! },
    };
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
      const id = await postRepository.create(user.uid, authorNameOf(profile.displayName), input);
      forgetFeeds();
      forgetSearches();
      router.replace({ pathname: '/explore/[id]', params: { id } });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const err = (k: PostError | 'relative') => (errors.includes(k) ? t(`explore.errors.${k}`) : undefined);

  return (
    <FormScreen title={t('explore.newPost')} subtitle={t('explore.newIntro', { name: ltr(authorNameOf(profile.displayName)) })}>
      <TextField label={t('explore.fields.text')} value={text} onChangeText={setText} maxLength={POST_LIMITS.text[1]} multiline error={err('text')} hint={t('explore.fields.textHint')} />
      {errors.includes('realEstate') ? <FormMessage kind="error" text={t('explore.errors.realEstate')} /> : null}
      {errors.includes('banned') ? <FormMessage kind="error" text={t('explore.errors.banned')} /> : null}
      <View style={styles.block}>
        <AppText variant="label">{t('explore.fields.category')}</AppText>
        <Chips<PostCategory> label={t('explore.fields.category')} value={category} onChange={setCategory} options={POST_CATEGORIES.map((c) => ({ value: c, label: t(`explore.categories.${c}`) }))} />
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
      <AppButton title={t('explore.publish')} onPress={submit} loading={busy} disabled={busy} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
});
