import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FUEL_TYPES, validateTravelPrices, type FuelType, type TravelPrices } from '@cityjoy/shared';
import { createTravelPrices } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';

type Form = Record<FuelType, string> & { busMin: string; busMax: string; month: string };
const thisMonth = () => new Date().toISOString().slice(0, 7);
const num = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : undefined);

/**
 * Panel > Seyahat > Yolculuk fiyatları (yalnızca admin): Planla ekranının tahmini ücretleri. Akaryakıt (TL/litre,
 * elektrikte TL/kWh) ve şehirlerarası otobüs km ücreti aralığı ayda bir girilir; uygulamada "tahmini" ve ayıyla görünür.
 * Boş bırakılan yakıt türünde ücret tahmini gösterilmez. Kayıt işlem kaydına geçer.
 */
export function TravelPricesPage() {
  const { user } = useSession();
  const admin = isAdminUser(user);
  const editable = admin && !!user && !user.isDemo;
  const service = useMemo(() => createTravelPrices(firestore), []);
  const [form, setForm] = useState<Form>({ benzin: '', dizel: '', lpg: '', elektrik: '', busMin: '', busMax: '', month: thisMonth() });
  const [updatedAt, setUpdatedAt] = useState<string>();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    service
      .get()
      .then((p) => {
        if (!p) return;
        setUpdatedAt(p.updatedAt);
        setForm({
          ...(Object.fromEntries(FUEL_TYPES.map((k) => [k, p.fuel[k] !== undefined ? String(p.fuel[k]) : ''])) as Record<FuelType, string>),
          busMin: p.busPerKm ? String(p.busPerKm.min) : '',
          busMax: p.busPerKm ? String(p.busPerKm.max) : '',
          month: p.month || thisMonth(),
        });
      })
      .catch(() => setMessage({ kind: 'error', text: t('prices.loadError') }));
  }, [service]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !editable) return;
    const fuel = Object.fromEntries(FUEL_TYPES.flatMap((k) => (num(form[k]) !== undefined ? [[k, num(form[k])]] : []))) as TravelPrices['fuel'];
    const min = num(form.busMin);
    const max = num(form.busMax);
    const prices: TravelPrices = { fuel, ...(min !== undefined || max !== undefined ? { busPerKm: { min: min ?? NaN, max: max ?? NaN } } : {}), month: form.month };
    const errors = validateTravelPrices(prices);
    if (errors.length) return setMessage({ kind: 'error', text: t(`prices.errors.${errors[0]}`) });
    setBusy(true);
    setMessage(undefined);
    try {
      await service.save(user.uid, prices);
      setMessage({ kind: 'ok', text: t('prices.saved') });
      setUpdatedAt(new Date().toISOString());
    } catch {
      setMessage({ kind: 'error', text: t('prices.saveError') });
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof Form, label: string, hint?: string) => (
    <div className="field">
      <label htmlFor={`price-${k}`}>{label}</label>
      <input id={`price-${k}`} inputMode="decimal" value={form[k]} disabled={!editable} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      {hint ? <p className="meta">{hint}</p> : null}
    </div>
  );

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('prices.title')}</h1>
          <p className="meta">{t('prices.intro')}</p>
        </div>
      </header>
      {!admin ? <p className="note">{t('prices.adminOnly')}</p> : user?.isDemo ? <p className="note">{t('prices.demo')}</p> : null}
      {updatedAt ? <p className="meta">{t('prices.updated', { date: new Date(updatedAt).toLocaleDateString('tr') })}</p> : null}
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      <form onSubmit={submit}>
        <div className="form-section">
          <h2>{t('prices.fuelTitle')}</h2>
          {field('benzin', t('prices.fuel.benzin'))}
          {field('dizel', t('prices.fuel.dizel'))}
          {field('lpg', t('prices.fuel.lpg'))}
          {field('elektrik', t('prices.fuel.elektrik'), t('prices.elektrikHint'))}
        </div>
        <div className="form-section">
          <h2>{t('prices.busTitle')}</h2>
          <p className="meta">{t('prices.busHint')}</p>
          {field('busMin', t('prices.busMin'))}
          {field('busMax', t('prices.busMax'))}
        </div>
        <div className="form-section">
          <div className="field">
            <label htmlFor="price-month">{t('prices.month')}</label>
            <input id="price-month" type="month" value={form.month} disabled={!editable} onChange={(e) => setForm({ ...form, month: e.target.value })} />
          </div>
          {editable ? <button className="btn" type="submit" disabled={busy}>{busy ? t('prices.saving') : t('prices.save')}</button> : null}
        </div>
      </form>
    </section>
  );
}
