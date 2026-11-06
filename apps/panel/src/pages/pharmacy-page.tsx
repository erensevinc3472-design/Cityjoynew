import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { httpsCallable } from 'firebase/functions';
import { DEFAULT_DUTY_HOURS, isDutyTime, isPharmacyListCurrent, pharmacyKey, turkeyDate, type DutyPharmacyDay } from '@cityjoy/shared';
import { createPharmacyAdmin, type DataSourceRun, type PharmacySourceStatus } from '@cityjoy/shared/firebase';

import { useCity } from '../lib/city';
import { firestore, functions } from '../lib/firebase';
import { locationRepository as repo } from '../lib/locations';
import { isAdminUser, useSession, type PanelUser } from '../lib/session';
import { t } from '../lib/t';

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/**
 * Nöbetçi eczane (docs/oneri-nobetci-eczane.md, bölüm 4): admin 81 ilin son çekimini, hatalarını ve çalışma geçmişini
 * görür, "Şimdi yeniden çek" der (sunucu, Blaze). Admin ve il yöneticisi seçili ilin bugünkü listesinde servisin yanlış
 * verdiği eczaneyi o gün için gizler (işlem kaydı).
 */
export function PharmacyPage() {
  const { user } = useSession();
  if (!user) return null;
  return <Pharmacy user={user} />;
}

function Pharmacy({ user }: { user: PanelUser }) {
  const admin = isAdminUser(user);
  const { provinceCode } = useCity();
  const svc = useMemo(() => createPharmacyAdmin(firestore, user.uid), [user.uid]);
  const [status, setStatus] = useState<PharmacySourceStatus | null>(null);
  const [runs, setRuns] = useState<DataSourceRun[]>([]);
  const [code, setCode] = useState(provinceCode || '16');
  const [day, setDay] = useState<DutyPharmacyDay | null | undefined>(undefined);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState(false);
  const today = turkeyDate();

  const loadStatus = useCallback(async () => {
    if (!admin || user.isDemo) return;
    const [s, r] = await Promise.all([svc.status().catch(() => null), svc.runs().catch(() => [])]);
    setStatus(s);
    setRuns(r);
  }, [admin, svc, user.isDemo]);
  const loadDay = useCallback(async () => {
    setDay(undefined);
    if (user.isDemo) return setDay(null);
    setDay(await svc.get(code).catch(() => null));
  }, [code, svc, user.isDemo]);
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);
  useEffect(() => {
    loadDay();
  }, [loadDay]);

  const resync = async (provinceCode?: string) => {
    setBusy(true);
    setMsg(undefined);
    try {
      const r = await httpsCallable<{ provinceCode?: string }, { ok: string[]; failed: { code: string }[] }>(functions, 'pharmacyResync')(provinceCode ? { provinceCode } : {});
      setMsg({ ok: true, text: t('pharmacy.resynced', { ok: r.data.ok.length, failed: r.data.failed.length }) });
      await Promise.all([loadStatus(), loadDay()]);
    } catch {
      setMsg({ ok: false, text: t('pharmacy.resyncError') });
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (key: string, name: string, hide: boolean) => {
    if (!day) return;
    setBusy(true);
    setMsg(undefined);
    try {
      const hidden = hide ? [...(day.hidden ?? []), key] : (day.hidden ?? []).filter((k) => k !== key);
      await svc.setHidden(code, hidden, `${hide ? 'gizlendi' : 'gösterildi'} ${name}`);
      setDay({ ...day, hidden });
    } catch {
      setMsg({ ok: false, text: t('pharmacy.hideError') });
    } finally {
      setBusy(false);
    }
  };

  const saveHours = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!day) return;
    const f = new FormData(e.currentTarget);
    const hours = { start: String(f.get('start')), end: String(f.get('end')) };
    if (!isDutyTime(hours.start) || !isDutyTime(hours.end)) return setMsg({ ok: false, text: t('pharmacy.hoursInvalid') });
    setBusy(true);
    setMsg(undefined);
    try {
      await svc.setHours(code, hours);
      setDay({ ...day, hours });
      setMsg({ ok: true, text: t('pharmacy.hoursSaved') });
    } catch {
      setMsg({ ok: false, text: t('pharmacy.hideError') });
    } finally {
      setBusy(false);
    }
  };

  const provinces = repo.getProvinces();
  const stateOf = (c: string) => {
    const s = status?.provinces[c];
    if (!s) return { text: t('pharmacy.never'), cls: 'pill' };
    if (s.error) return { text: t('pharmacy.failed', { error: s.error }), cls: 'pill warn' };
    return s.date === today ? { text: t('pharmacy.today', { count: s.count }), cls: 'pill ok' } : { text: t('pharmacy.old', { date: s.date ?? '—' }), cls: 'pill warn' };
  };

  return (
    <section className="page wide">
      <header className="page-head">
        <div>
          <h1>{t('pharmacy.title')}</h1>
          <p className="meta">{t('pharmacy.intro')}</p>
        </div>
        {admin && !user.isDemo ? <button className="btn" disabled={busy} onClick={() => resync()}>{t('pharmacy.resyncAll')}</button> : null}
      </header>
      {msg ? <p className={msg.ok ? 'note' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p> : null}

      <div className="toolbar">
        <label htmlFor="ph-prov">{t('pharmacy.province')}</label>
        <select id="ph-prov" value={code} onChange={(e) => setCode(e.target.value)}>
          {provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
        {admin && !user.isDemo ? <button className="btn secondary" disabled={busy} onClick={() => resync(code)}>{t('pharmacy.resyncOne')}</button> : null}
      </div>

      <div className="card">
        <h2 className="card-title">{t('pharmacy.todayList', { province: repo.getProvince(code)?.name ?? code })}</h2>
        {day === undefined ? <p className="meta">{t('profile.loading')}</p> : !day ? <p className="meta">{t('pharmacy.noList')}</p> : (
          <>
            <p className="meta">{t('pharmacy.fetched', { date: when(day.fetchedAt), source: day.source })}{isPharmacyListCurrent(day) ? '' : ` · ${t('pharmacy.notCurrent')}`}</p>
            <div className="table-wrap">
              <table>
                <thead><tr><th scope="col">{t('pharmacy.colName')}</th><th scope="col">{t('pharmacy.colDistrict')}</th><th scope="col">{t('pharmacy.colPhone')}</th><th scope="col"><span className="sr-only">{t('pharmacy.colActions')}</span></th></tr></thead>
                <tbody>
                  {day.items.map((p) => {
                    const key = pharmacyKey(p);
                    const hidden = (day.hidden ?? []).includes(key);
                    return (
                      <tr key={key} className={hidden ? 'muted' : undefined}>
                        <td><strong>{p.name}</strong><div className="meta">{p.address}</div></td>
                        <td>{p.district}</td>
                        <td>{p.phone ?? '—'}</td>
                        <td>
                          {!user.isDemo && day.date === today ? (
                            <button className="link" disabled={busy} onClick={() => toggle(key, p.name, !hidden)}>{hidden ? t('pharmacy.show') : t('pharmacy.hide')}</button>
                          ) : null}
                          {hidden ? <span className="pill warn">{t('pharmacy.hiddenTag')}</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="meta">{t('pharmacy.hideHint')}</p>
            {!user.isDemo ? (
              <form className="toolbar" key={`${code}-${day.hours?.start}-${day.hours?.end}`} onSubmit={saveHours}>
                <label htmlFor="ph-start">{t('pharmacy.hoursStart')}</label>
                <input id="ph-start" name="start" type="time" defaultValue={day.hours?.start ?? DEFAULT_DUTY_HOURS.start} required />
                <label htmlFor="ph-end">{t('pharmacy.hoursEnd')}</label>
                <input id="ph-end" name="end" type="time" defaultValue={day.hours?.end ?? DEFAULT_DUTY_HOURS.end} required />
                <button className="btn secondary" type="submit" disabled={busy}>{t('pharmacy.hoursSave')}</button>
              </form>
            ) : null}
            <p className="meta">{t('pharmacy.hoursHint')}</p>
          </>
        )}
      </div>

      {admin ? (
        <>
          <h2>{t('pharmacy.statusTitle')}</h2>
          {!status ? <div className="state">{t('pharmacy.noStatus')}</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th scope="col">{t('pharmacy.province')}</th><th scope="col">{t('pharmacy.colStatus')}</th><th scope="col">{t('pharmacy.colAt')}</th></tr></thead>
                <tbody>
                  {provinces.map((p) => {
                    const st = stateOf(p.code);
                    return (
                      <tr key={p.code}>
                        <td><button className="link" onClick={() => setCode(p.code)}>{p.name}</button></td>
                        <td><span className={st.cls}>{st.text}</span></td>
                        <td>{when(status.provinces[p.code]?.at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {runs.length ? (
            <div className="card">
              <h2 className="card-title">{t('pharmacy.runs')}</h2>
              <ul className="upcoming">
                {runs.map((r) => <li key={r.id}><span className="grow"><strong>{when(r.at)}</strong><small>{t('pharmacy.runLine', { ok: r.ok, failed: r.failed, by: r.by === 'zamanlayici' ? t('pharmacy.byScheduler') : t('pharmacy.byAdmin') })}</small></span></li>)}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
