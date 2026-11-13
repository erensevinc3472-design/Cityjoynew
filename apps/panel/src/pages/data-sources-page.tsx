import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router';
import { WEATHER_REFRESH_HOURS, WEATHER_STALE_HOURS } from '@cityjoy/shared';
import { createDataSourceReader, DATA_SOURCE_IDS, type DataSourceStatus } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { locationRepository as repo } from '../lib/locations';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';
import { Intro } from '../components/intro';

const fmt = (ms: number | null) => (ms ? new Date(ms).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '-');

/**
 * Veri kaynakları (yalnızca admin; Eren, 13 Kasım 2026). Sunucunun dış kaynaklardan zamanlanmış çekimlerinin son
 * durumu: hava durumu (3 saatte bir), nöbetçi eczane (günlük, hesap açılınca). Okunamayan iller listelenir.
 */
export function DataSourcesPage() {
  const { user } = useSession();
  const reader = useMemo(() => createDataSourceReader(firestore), []);
  const [rows, setRows] = useState<Record<string, DataSourceStatus | null> | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const list = await Promise.all(DATA_SOURCE_IDS.map(async (id) => [id, await reader.get(id)] as const));
      setRows(Object.fromEntries(list));
    } catch {
      setLoadError(true);
    }
  }, [reader]);

  useEffect(() => {
    if (user && !user.isDemo) load();
    else setRows({});
  }, [load, user]);

  if (!user || !isAdminUser(user)) return <Navigate to="/" replace />;

  const status = (s: DataSourceStatus | null | undefined, staleHours: number) => {
    if (!s || !s.lastRunAt) return { cls: '', text: t('dataSources.never') };
    if (!s.lastSuccessAt || Date.now() - s.lastSuccessAt > staleHours * 3600_000) return { cls: 'warn', text: t('dataSources.stale') };
    if (s.failed.length) return { cls: 'warn', text: t('dataSources.partial', { count: s.failed.length }) };
    return { cls: 'ok', text: t('dataSources.ok') };
  };

  const items = [
    { id: 'weather', name: t('dataSources.weather'), every: t('dataSources.everyHours', { count: WEATHER_REFRESH_HOURS }), stale: WEATHER_STALE_HOURS },
    { id: 'pharmacy', name: t('dataSources.pharmacy'), every: t('dataSources.daily'), stale: 30 },
  ];

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('dataSources.title')}</h1>
          <Intro text={t('dataSources.intro')} />
        </div>
        <button className="btn secondary" onClick={load}>{t('dataSources.refresh')}</button>
      </header>

      {loadError ? (
        <p className="error" role="alert">{t('dataSources.loadError')}</p>
      ) : rows === null ? (
        <p className="state" aria-live="polite">{t('dataSources.loading')}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('dataSources.colName')}</th>
                <th scope="col">{t('dataSources.colStatus')}</th>
                <th scope="col">{t('dataSources.colLastRun')}</th>
                <th scope="col">{t('dataSources.colLastSuccess')}</th>
                <th scope="col">{t('dataSources.colFailed')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const s = rows[it.id];
                const st = status(s, it.stale);
                return (
                  <tr key={it.id}>
                    <td>
                      {it.name}
                      <div className="meta">{[s?.source, it.every].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td><span className={`pill ${st.cls}`}>{st.text}</span></td>
                    <td className="num">{fmt(s?.lastRunAt ?? null)}</td>
                    <td className="num">{fmt(s?.lastSuccessAt ?? null)}</td>
                    <td>{s?.failed.length ? s.failed.map((c) => repo.getProvince(c)?.name ?? c).join(', ') : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
