import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEAL_CATEGORIES,
  DEAL_KINDS,
  DEAL_LIMITS,
  latestDealEnd,
  suggestDealCategory,
  validateDeal,
  type Business,
  type Deal,
  type DealCategory,
  type DealInput,
  type DealKind,
  type DealUsage,
} from '@cityjoy/shared';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Chips } from '@/components/chips';
import { FormMessage } from '@/components/form-message';
import { FormScreen } from '@/components/form-screen';
import { StateMessage } from '@/components/state-message';
import { TextField } from '@/components/text-field';
import { forgetProvinceDeals } from '@/lib/deals';
import { goBackOr } from '@/lib/navigation';
import { businessRepository, dealRepository } from '@/lib/services';
import { useSession } from '@/lib/session';

/**
 * Yeni fırsat / fırsatı düzenle (13. madde 35): kategori, tür, oran, neyde geçerli, gün/saat, zorunlu bitiş tarihi
 * (en çok 90 gün), şartlar, kullanım (kasada kod ya da ekran). Yayındaki fırsatın değeri / şartı değişirse
 * kullanıcılara "Güncellendi" yazar.
 */
export default function DealEditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, deal: dealId } = useLocalSearchParams<{ id: string; deal?: string }>();
  const { user } = useSession();
  const [biz, setBiz] = useState<Business | null>(null);
  const [before, setBefore] = useState<Deal | undefined>();
  const [ready, setReady] = useState(false);
  const [category, setCategory] = useState<DealCategory>('food');
  const [kind, setKind] = useState<DealKind>('yuzde');
  const [value, setValue] = useState('');
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [terms, setTerms] = useState('');
  const [usage, setUsage] = useState<DealUsage>('kod');
  const [code, setCode] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const b = await businessRepository.get(id).catch(() => null);
      setBiz(b);
      const d = dealId ? (await dealRepository.listMine(id, user.uid).catch(() => [])).find((x) => x.id === dealId) : undefined;
      if (d) {
        setBefore(d);
        setCategory(d.category);
        setKind(d.kind);
        setValue(d.value);
        setTitle(d.title);
        setWhen(d.when ?? '');
        setTerms(d.terms ?? '');
        setUsage(d.usage);
        setCode(d.code ?? '');
        setEndsOn(d.endsOn);
      } else if (b) {
        setCategory(suggestDealCategory(b.type));
        setEndsOn(latestDealEnd(new Date(Date.now() - 60 * 86_400_000)));
      }
      setReady(true);
    })();
  }, [id, dealId, user]);

  const title_ = dealId ? t('deals.form.titleEdit') : t('deals.form.titleNew');
  if (!ready || !biz || !user) return <FormScreen title={title_}><StateMessage kind={ready ? 'empty' : 'loading'} /></FormScreen>;

  const input: DealInput = { businessId: biz.id, category, kind, value, title, when, terms, usage, code: code.toUpperCase(), endsOn: endsOn.trim() };
  const err = (k: string) => (errors.includes(k) ? t(`deals.form.errors.${k}`) : undefined);

  const submit = async () => {
    const e = validateDeal(input);
    setErrors(e);
    setFailed(false);
    if (e.length) return;
    setBusy(true);
    try {
      await dealRepository.save(dealId ?? null, input, biz, before);
      forgetProvinceDeals(biz.location.provinceCode);
      goBackOr(router, { pathname: '/business/deals', params: { id: biz.id } });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen title={title_} subtitle={biz.name}>
      {failed ? <FormMessage kind="error" text={t('deals.form.errors.save')} /> : null}
      <Chips<DealCategory> label={t('deals.form.category')} value={category} onChange={setCategory} options={DEAL_CATEGORIES.map((k) => ({ value: k, label: t(`social.deals.${k}.name`) }))} />
      <Chips<DealKind> label={t('deals.form.kind')} value={kind} onChange={setKind} options={DEAL_KINDS.map((k) => ({ value: k, label: t(`deals.kinds.${k}`) }))} />
      <TextField label={t('deals.form.value')} hint={t('deals.form.valueHint')} placeholder={t('deals.form.valueHint')} value={value} onChangeText={setValue} maxLength={DEAL_LIMITS.value[1]} error={err('value')} />
      <TextField label={t('deals.form.dealTitle')} placeholder={t('deals.form.dealTitleHint')} value={title} onChangeText={setTitle} maxLength={DEAL_LIMITS.title[1]} error={err('title')} />
      <TextField label={t('deals.form.when')} hint={t('deals.form.whenHint')} placeholder={t('deals.form.whenHint')} value={when} onChangeText={setWhen} maxLength={DEAL_LIMITS.when[1]} error={err('when')} />
      <TextField
        label={t('deals.form.endsOn')}
        hint={t('deals.form.endsOnHint', { date: latestDealEnd() })}
        value={endsOn}
        onChangeText={setEndsOn}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        error={err('endsOn')}
      />
      <TextField label={t('deals.form.terms')} placeholder={t('deals.form.termsHint')} value={terms} onChangeText={setTerms} maxLength={DEAL_LIMITS.terms[1]} multiline error={err('terms')} />
      <Chips<DealUsage> label={t('deals.form.usage')} value={usage} onChange={setUsage} options={[{ value: 'kod', label: t('deals.form.usageKod') }, { value: 'ekran', label: t('deals.form.usageEkran') }]} />
      {usage === 'kod' ? (
        <TextField label={t('deals.form.code')} hint={t('deals.form.codeHint')} value={code} onChangeText={(x) => setCode(x.toUpperCase())} autoCapitalize="characters" maxLength={16} error={err('code')} />
      ) : null}
      {dealId ? <AppText variant="caption" muted>{t('deals.form.changedNote')}</AppText> : null}
      <AppButton title={dealId ? t('deals.form.saveEdit') : t('deals.form.save')} onPress={submit} loading={busy} disabled={busy} />
      <AppText variant="caption" muted>{t('deals.form.legal')}</AppText>
    </FormScreen>
  );
}
