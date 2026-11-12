import { useCallback, useEffect, useMemo, useState } from 'react';
import { can, dealExpired, isGrantActive, type Deal } from '@cityjoy/shared';
import { createDealModeration } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { locationRepository as repo } from '../lib/locations';
import { useCity } from '../lib/city';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';
import { Intro } from '../components/intro';

type Msg = { kind: 'ok' | 'error'; text: string } | undefined;

/**
 * Panel > Fırsatlar (13. madde 35): il yöneticisi kendi ilinin fırsatlarını görür, şikâyet alanları üstte; gizler ya da
 * geri açar (geri açılan fırsatı işletme yeniden başlatır). Sponsorlu işaretini yalnızca admin verir (yalnızca Pro
 * işletmeye, ödeme sistemi gelene kadar elle). Her işlem işlem kaydına yazılır.
 */
export function DealsPage() {
  const { user } = useSession();
  const city = useCity();
  const admin = isAdminUser(user);
  const provinces = useMemo(() => {
    if (!user) return [] as string[];
    if (admin) return repo.getProvinces().map((p) => p.code);
    return user.grants
      .filter((g) => isGrantActive(g, new Date()) && g.scope.level === 'il' && g.modules.moderasyon?.includes('goruntule'))
      .map((g) => (g.scope.level === 'il' ? g.scope.provinceCode : ''));
  }, [user, admin]);
  const [provinceCode, setProvinceCode] = useState(() => (city.provinceCode && (admin || provinces.includes(city.provinceCode)) ? city.provinceCode : admin ? '16' : (provinces[0] ?? '')));
  const canEdit = !!user && !user.isDemo && (admin || can(user.grants, { module: 'moderasyon', action: 'duzenle', region: { provinceCode } }));
  const service = useMemo(() => (user ? createDealModeration(firestore, user.uid) : null), [user]);
  const [list, setList] = useState<Deal[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<Msg>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    if (!service || !provinceCode) return;
    if (user?.isDemo) return setList([]);
    try {
      setList(await service.list(provinceCode));
    } catch {
      setLoadError(true);
    }
  }, [service, provinceCode, user?.isDemo]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
      setMessage({ kind: 'ok', text: ok });
      await load();
    } catch {
      setMessage({ kind: 'error', text: t('deals.error') });
    } finally {
      setBusy(false);
    }
  };
  const hide = (d: Deal) => {
    const reason = window.prompt(t('deals.reasonPrompt'), '');
    if (reason === null) return;
    act(() => service!.setHidden(d, true, reason.trim().slice(0, 120)), t('deals.hidden'));
  };
  const statusText = (d: Deal) => (d.status === 'aktif' && dealExpired(d) ? t('deals.status.expired') : t(`deals.status.${d.status}`));

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('deals.title')}</h1>
          <Intro text={t('deals.intro')} />
        </div>
      </header>
      <p className="note">{t('deals.rules')}</p>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {provinces.length > 1 ? (
        <div className="field">
          <label htmlFor="dl-province">{t('deals.province')}</label>
          <select id="dl-province" value={provinceCode} onChange={(e) => setProvinceCode(e.target.value)}>
            {provinces.map((p) => (
              <option key={p} value={p}>{repo.getProvince(p)?.name ?? p}</option>
            ))}
          </select>
        </div>
      ) : null}

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('deals.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('deals.retry')}</button>
        </div>
      ) : list === null ? (
        <div className="state" aria-live="polite">{t('deals.loading')}</div>
      ) : list.length === 0 ? (
        <div className="state">{t('deals.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('deals.dealCol')}</th>
                <th scope="col">{t('deals.businessCol')}</th>
                <th scope="col">{t('deals.statusCol')}</th>
                <th scope="col" className="num">{t('deals.reportsCol')}</th>
                <th scope="col"><span className="sr-only">{t('deals.actionsCol')}</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.value} · {d.title}</strong>
                    <div className="meta">
                      {[t(`deals.categories.${d.category}`), t('deals.endsOn', { date: new Date(`${d.endsOn}T12:00:00`).toLocaleDateString('tr-TR') }), d.terms].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td>
                    {d.businessName}
                    <div className="meta">{repo.getDistrict(d.districtId ?? '')?.name ?? ''}</div>
                  </td>
                  <td>
                    <span className={d.status === 'aktif' && !dealExpired(d) ? 'pill ok' : 'pill'}>{statusText(d)}</span>
                    {d.sponsored ? <span className="pill">{t('deals.sponsored')}</span> : null}
                  </td>
                  <td className="num">{d.reportCount}</td>
                  <td className="row-actions">
                    {canEdit ? (
                      d.status === 'gizlendi' ? (
                        <button className="link" disabled={busy} onClick={() => act(() => service!.setHidden(d, false, ''), t('deals.restored'))}>{t('deals.restore')}</button>
                      ) : (
                        <button className="link" disabled={busy} onClick={() => hide(d)}>{t('deals.hide')}</button>
                      )
                    ) : null}
                    {admin && !user?.isDemo && d.status === 'aktif' ? (
                      <button className="link" disabled={busy} onClick={() => act(() => service!.setSponsored(d, !d.sponsored), t('deals.saved'))}>
                        {d.sponsored ? t('deals.unsponsor') : t('deals.sponsor')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
