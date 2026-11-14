import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMoney, PRO_PLANS, PRO_PRODUCTS, summarizeRevenue, type Payment, type ProPlan } from '@cityjoy/shared';
import { createMembershipAdmin, type ProBusinessRow } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { locationRepository } from '../lib/locations';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';
import { Intro } from '../components/intro';

const day = (s?: string) => (s ? new Date(s).toLocaleDateString('tr-TR', { dateStyle: 'medium' }) : '-');
const provinceName = (code: string) => locationRepository.getProvince(code)?.name ?? code;
/** { TRY: 1200, EUR: 30 } → "1.200,00 ₺ · 30,00 €" */
const totals = (m: Record<string, number>) => {
  const parts = Object.entries(m).filter(([, v]) => v !== 0).map(([c, v]) => formatMoney(v, c));
  return parts.length ? parts.join(' · ') : '-';
};
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
};

const APP_STORE_URL = 'https://appstoreconnect.apple.com/apps';
const PLAY_URL = 'https://play.google.com/console';

/**
 * Üyelikler ve Gelir (Karar Eren, 12 Kasım 2026). Yalnızca admin. Pro işletmeler, mağazalardan gelen ödemeler (ilk
 * satın alma, yenileme, iade), aylık gelir ve fiyatlar. Fiyat Apple ve Google kuralları gereği mağaza panelinde
 * değiştirilir (App Store Connect / Play Console); buradan bağlantıyla gidilir. Ödemeleri sunucu mağaza bildiriminden
 * yazar, panelden ödeme eklenemez ve silinemez.
 */
export function MembershipsPage() {
  const { user } = useSession();
  const isAdmin = !!user && isAdminUser(user);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [pros, setPros] = useState<ProBusinessRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const a = createMembershipAdmin(firestore);
      const [p, b] = await Promise.all([a.payments(new Date()), a.proBusinesses()]);
      setPayments(p);
      setPros(b);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [load, isAdmin]);

  const now = useMemo(() => new Date(), []);
  const summary = useMemo(() => (payments ? summarizeRevenue(payments, now) : null), [payments, now]);
  const live = useMemo(() => (payments ?? []).filter((p) => !p.sandbox), [payments]);
  /** Her planın mağazada son alınan fiyatı (para birimine göre); fiyat değişince burada da görünür. */
  const lastPrices = useMemo(() => {
    const out: Record<ProPlan, Record<string, number>> = { aylik: {}, yillik: {} };
    for (const p of live) {
      if (!p.plan || p.kind === 'iade' || p.amount <= 0) continue;
      if (out[p.plan][p.currency] === undefined) out[p.plan][p.currency] = p.amount;
    }
    return out;
  }, [live]);
  const active = useMemo(() => (pros ?? []).filter((b) => !b.membership.endsAt || new Date(b.membership.endsAt) > now), [pros, now]);
  const q = filter.trim().toLocaleLowerCase('tr-TR');
  const shownPros = q ? active.filter((b) => b.name.toLocaleLowerCase('tr-TR').includes(q)) : active;
  const shownPayments = q ? live.filter((p) => p.businessName.toLocaleLowerCase('tr-TR').includes(q)) : live;
  const sandboxCount = (payments ?? []).length - live.length;

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('memberships.title')}</h1>
          <Intro text={t('memberships.intro')} />
        </div>
      </header>
      {!isAdmin ? (
        <p className="note">{t('memberships.adminOnly')}</p>
      ) : loadError ? (
        <div className="state" role="alert">
          <p>{t('memberships.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('memberships.retry')}</button>
        </div>
      ) : !summary || !pros ? (
        <div className="state" aria-live="polite">{t('memberships.loading')}</div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="card stat">
              <span className="stat-label">{t('memberships.activePro')}</span>
              <strong className="stat-value">{active.length.toLocaleString('tr-TR')}</strong>
              <span className="meta">{t('memberships.byPlan', { aylik: active.filter((b) => b.membership.plan === 'aylik').length, yillik: active.filter((b) => b.membership.plan === 'yillik').length, other: active.filter((b) => !b.membership.plan).length })}</span>
            </div>
            <div className="card stat">
              <span className="stat-label">{t('memberships.thisMonth')}</span>
              <strong className="stat-value">{totals(summary.thisMonth)}</strong>
              <span className="meta">{t('memberships.lastMonth', { amount: totals(summary.lastMonth) })}</span>
            </div>
            <div className="card stat">
              <span className="stat-label">{t('memberships.net')}</span>
              <strong className="stat-value">{formatMoney(summary.thisMonthNetUsd, 'USD')}</strong>
              <span className="meta">{t('memberships.netHint')}</span>
            </div>
            <div className="card stat">
              <span className="stat-label">{t('memberships.counts')}</span>
              <strong className="stat-value">{summary.newThisMonth} / {summary.renewalsThisMonth} / {summary.refundsThisMonth}</strong>
              <span className="meta">{t('memberships.countsHint')}</span>
            </div>
          </div>

          <fieldset className="form-section">
            <legend>{t('memberships.pricesTitle')}</legend>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('memberships.plan')}</th>
                    <th scope="col">{t('memberships.productId')}</th>
                    <th scope="col">{t('memberships.lastPrice')}</th>
                  </tr>
                </thead>
                <tbody>
                  {PRO_PLANS.map((p) => (
                    <tr key={p}>
                      <td>{t(`memberships.plans.${p}`)}</td>
                      <td><code>{PRO_PRODUCTS[p]}</code></td>
                      <td className="num">{Object.keys(lastPrices[p]).length ? totals(lastPrices[p]) : t('memberships.noSale')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="meta">{t('memberships.pricesHint')}</p>
            <div className="actions">
              <a className="btn secondary" href={APP_STORE_URL} target="_blank" rel="noreferrer">{t('memberships.openAppStore')}</a>
              <a className="btn secondary" href={PLAY_URL} target="_blank" rel="noreferrer">{t('memberships.openPlay')}</a>
            </div>
          </fieldset>

          <h2>{t('memberships.monthsTitle')}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('memberships.month')}</th>
                  <th scope="col">{t('memberships.payments')}</th>
                  <th scope="col">{t('memberships.total')}</th>
                </tr>
              </thead>
              <tbody>
                {[...summary.months].reverse().map((m) => (
                  <tr key={m.month}>
                    <td>{monthLabel(m.month)}</td>
                    <td className="num">{m.count}</td>
                    <td className="num">{totals(m.totals)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="toolbar">
            <input type="search" aria-label={t('memberships.search')} placeholder={t('memberships.search')} value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>

          <h2>{t('memberships.prosTitle')}</h2>
          <div className="table-wrap">
            {shownPros.length === 0 ? (
              <div className="state">{t('memberships.noPros')}</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('memberships.business')}</th>
                    <th scope="col">{t('memberships.province')}</th>
                    <th scope="col">{t('memberships.plan')}</th>
                    <th scope="col">{t('memberships.source')}</th>
                    <th scope="col">{t('memberships.started')}</th>
                    <th scope="col">{t('memberships.ends')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shownPros.map((b) => (
                    <tr key={b.id}>
                      <td>{b.name}</td>
                      <td>{provinceName(b.provinceCode)}</td>
                      <td>{b.membership.plan ? t(`memberships.plans.${b.membership.plan}`) : '-'}</td>
                      <td>{b.membership.source ? t(`memberships.sources.${b.membership.source}`) : '-'}</td>
                      <td>{day(b.membership.startedAt)}</td>
                      <td>
                        {b.membership.endsAt ? day(b.membership.endsAt) : t('memberships.noEnd')}{' '}
                        {b.membership.autoRenew === false ? <span className="pill warn">{t('memberships.cancelled')}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="count">{t('memberships.prosCount', { count: shownPros.length })}</p>
          </div>

          <h2>{t('memberships.paymentsTitle')}</h2>
          <div className="table-wrap">
            {shownPayments.length === 0 ? (
              <div className="state">{t('memberships.noPayments')}</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('memberships.date')}</th>
                    <th scope="col">{t('memberships.business')}</th>
                    <th scope="col">{t('memberships.kind')}</th>
                    <th scope="col">{t('memberships.plan')}</th>
                    <th scope="col">{t('memberships.source')}</th>
                    <th scope="col">{t('memberships.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shownPayments.slice(0, 300).map((p) => (
                    <tr key={p.id}>
                      <td>{day(p.at)}</td>
                      <td>{p.businessName || p.businessId}</td>
                      <td>
                        <span className={`pill${p.kind === 'iade' ? ' warn' : p.kind === 'ilk' ? ' ok' : ''}`}>{t(`memberships.kinds.${p.kind}`)}</span>
                      </td>
                      <td>{p.plan ? t(`memberships.plans.${p.plan}`) : '-'}</td>
                      <td>{t(`memberships.sources.${p.store}`)}</td>
                      <td className="num">{formatMoney(p.amount, p.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="count">{t('memberships.paymentsCount', { count: shownPayments.length })}{sandboxCount > 0 ? ` · ${t('memberships.sandbox', { count: sandboxCount })}` : ''}</p>
          </div>
          <p className="meta">{t('memberships.footNote')}</p>
        </>
      )}
    </section>
  );
}
