import { useEffect, useMemo, useState } from 'react';
import { COST_SAMPLE_PCT, summarizeCost, type CostDay } from '@cityjoy/shared';
import { createBillingAdmin } from '@cityjoy/shared/firebase';

import { firestore, functions } from '../lib/firebase';
import { t } from '../lib/t';

const usd = (n: number) => `$${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number) => Math.round(n).toLocaleString('tr-TR');
const gb = (b: number) => `${(b / 1024 ** 3).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} GB`;
const fnLabel = (name: string) => {
  const key = `billing.cost.fn.${name.toLowerCase()}`;
  const v = t(key);
  return v === key ? name : v;
};

/**
 * Panel > Harcama > Özelliklere göre (Eren, 13 Kasım 2026: "hangi özellik ne kadar harcıyor görelim, gerekirse
 * kapatırız"). Kayıtlar billing/cost-{gün} belgelerinden (gün başına bir okuma); hesap packages/shared/src/billing/cost.ts.
 */
export function CostBreakdown() {
  const [range, setRange] = useState<7 | 30>(30);
  const [days, setDays] = useState<CostDay[] | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setDays(undefined);
    createBillingAdmin(firestore, functions)
      .costDays(range)
      .then((d) => alive && setDays(d), () => alive && setDays(null));
    return () => {
      alive = false;
    };
  }, [range]);

  const sum = useMemo(() => (days?.length ? summarizeCost(days) : null), [days]);
  const lastError = days?.slice().sort((a, b) => b.day.localeCompare(a.day))[0]?.serverError;
  const scale = sum && sum.days ? 30 / sum.days : 1;

  return (
    <fieldset className="form-section">
      <legend>{t('billing.cost.title')}</legend>
      <p className="meta">{t('billing.cost.intro', { pct: COST_SAMPLE_PCT })}</p>
      <div className="actions" role="group" aria-label={t('billing.cost.range')}>
        {([7, 30] as const).map((r) => (
          <button key={r} type="button" className={`btn ${range === r ? '' : 'secondary'}`} aria-pressed={range === r} onClick={() => setRange(r)}>
            {t('billing.cost.days', { n: r })}
          </button>
        ))}
      </div>
      {days === undefined ? (
        <div className="state" aria-live="polite">{t('billing.loading')}</div>
      ) : days === null ? (
        <p className="error" role="alert">{t('billing.cost.loadError')}</p>
      ) : !sum ? (
        <p className="note">{t('billing.cost.empty')}</p>
      ) : (
        <>
          {lastError ? <p className="note">{t('billing.cost.serverError', { error: lastError })}</p> : null}
          <div className="stat-grid">
            <div className="card stat">
              <span className="stat-label">{t('billing.cost.monthly')}</span>
              <strong className="stat-value">{usd(sum.usd * scale)}</strong>
              <span className="meta">{t('billing.cost.basedOn', { n: sum.days })}</span>
            </div>
            <div className="card stat">
              <span className="stat-label">{t('billing.cost.database')}</span>
              <strong className="stat-value">{usd(sum.firestore.usd * scale)}</strong>
              <span className="meta">{t('billing.cost.dbOps', { r: num(sum.firestore.reads), w: num(sum.firestore.writes) })}</span>
              <span className="meta">{t('billing.cost.dbOther', { v: usd(sum.firestore.otherUsd * scale) })}</span>
            </div>
            <div className="card stat">
              <span className="stat-label">{t('billing.cost.files')}</span>
              <strong className="stat-value">{usd(sum.storage.usd * scale)}</strong>
              <span className="meta">{t('billing.cost.filesOps', { e: gb(sum.storage.egressBytes), s: gb(sum.storage.storedBytes) })}</span>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <caption className="sr-only">{t('billing.cost.featuresCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('billing.cost.feature')}</th>
                  <th scope="col" className="num">{t('billing.cost.reads')}</th>
                  <th scope="col" className="num">{t('billing.cost.writes')}</th>
                  <th scope="col" className="num">{t('billing.cost.calls')}</th>
                  <th scope="col" className="num">{t('billing.cost.month')}</th>
                  <th scope="col" className="num">{t('billing.cost.share')}</th>
                </tr>
              </thead>
              <tbody>
                {sum.features.map((f) => (
                  <tr key={f.feature}>
                    <td>
                      <strong>{t(`billing.cost.features.${f.feature}`)}</strong>
                      {f.top.length ? <div className="meta">{f.top.map((c) => c.name).join(', ')}</div> : null}
                    </td>
                    <td className="num">{num(f.reads)}</td>
                    <td className="num">{num(f.writes)}</td>
                    <td className="num">{num(f.calls)}</td>
                    <td className="num">{usd(f.usd * scale)}</td>
                    <td className="num">{sum.usd ? `%${Math.round((f.usd / sum.usd) * 100)}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sum.functions.length ? (
            <details>
              <summary>{t('billing.cost.functionsTitle', { n: sum.functions.length })}</summary>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t('billing.cost.job')}</th>
                      <th scope="col">{t('billing.cost.feature')}</th>
                      <th scope="col" className="num">{t('billing.cost.calls')}</th>
                      <th scope="col" className="num">{t('billing.cost.seconds')}</th>
                      <th scope="col" className="num">{t('billing.cost.month')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sum.functions.map((f) => (
                      <tr key={f.name}>
                        <td>{fnLabel(f.name)}</td>
                        <td>{t(`billing.cost.features.${f.feature}`)}</td>
                        <td className="num">{num(f.calls)}</td>
                        <td className="num">{num(f.seconds)}</td>
                        <td className="num">{usd(f.usd * scale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
          <p className="meta">{t('billing.cost.note')}</p>
        </>
      )}
    </fieldset>
  );
}
