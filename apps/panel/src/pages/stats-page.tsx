import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { POST_CATEGORIES } from '@cityjoy/shared';
import { createFirebaseStats } from '@cityjoy/shared/firebase';

import { BarList, Change, ColumnChart, daysAgo, lastWeeks, show, StatTile, type Datum } from '../components/charts';
import { canSeeStats } from '../components/shell';
import { useCity } from '../lib/city';
import { firestore } from '../lib/firebase';
import { locationRepository } from '../lib/locations';
import { useSession } from '../lib/session';
import { t } from '../lib/t';

const PERIODS = [7, 30, 90] as const;

interface Report {
  posts: number | null;
  postsPrev: number | null;
  newBusinesses: number | null;
  newBusinessesPrev: number | null;
  businesses: number | null;
  verified: number | null;
  reports: number | null;
  weeklyPosts: Datum[];
  weeklyBusinesses: Datum[];
  categories: Datum[];
}

/** İstatistikler: seçili il ve dönem için gönderi ve işletme sayıları (PROJE.md 6.1). */
export function StatsPage() {
  const { user } = useSession();
  const { provinceCode } = useCity();
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [data, setData] = useState<Report | null>(null);
  const allowed = !!user && canSeeStats(user);

  useEffect(() => {
    if (!allowed || user?.isDemo) return;
    let live = true;
    setData(null);
    const s = createFirebaseStats(firestore);
    const now = new Date();
    const period = { from: daysAgo(days, now) };
    const previous = { from: daysAgo(days * 2, now), to: daysAgo(days, now) };
    const weeks = lastWeeks(12, now);
    Promise.all([
      s.posts(provinceCode, period),
      s.posts(provinceCode, previous),
      s.businesses(provinceCode, period),
      s.businesses(provinceCode, previous),
      s.businesses(provinceCode),
      s.businesses(provinceCode, {}, true),
      s.openReports(provinceCode),
      Promise.all(weeks.map((w) => s.posts(provinceCode, w))),
      Promise.all(weeks.map((w) => s.businesses(provinceCode, w))),
      Promise.all(POST_CATEGORIES.map((c) => s.posts(provinceCode, period, c))),
    ]).then(([posts, postsPrev, newBusinesses, newBusinessesPrev, businesses, verified, reports, wp, wb, cats]) => {
      if (!live) return;
      setData({
        posts, postsPrev, newBusinesses, newBusinessesPrev, businesses, verified, reports,
        weeklyPosts: weeks.map((w, i) => ({ label: w.label, value: wp[i] })),
        weeklyBusinesses: weeks.map((w, i) => ({ label: w.label, value: wb[i] })),
        categories: POST_CATEGORIES.map((c, i) => ({ label: t(`charts.categories.${c}`), value: cats[i] }))
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
      });
    });
    return () => {
      live = false;
    };
  }, [allowed, user, provinceCode, days]);

  if (!allowed) return <Navigate to="/" replace />;
  const place = provinceCode ? (locationRepository.getProvince(provinceCode)?.name ?? '') : t('scope.ulke');
  const ratio = data?.businesses && data.verified !== null ? Math.round((data.verified / data.businesses) * 100) : null;

  return (
    <section className="page wide">
      <header className="page-head">
        <div>
          <h1>{t('stats.title')}</h1>
          <p className="meta">{place} · {t('stats.intro')}</p>
        </div>
        <div className="seg" role="group" aria-label={t('stats.period')}>
          {PERIODS.map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>
              {t('stats.days', { count: d })}
            </button>
          ))}
        </div>
      </header>

      <div className="stat-grid">
        <StatTile label={t('stats.posts')} value={data?.posts ?? null} highlight
          hint={<><Change now={data?.posts ?? null} before={data?.postsPrev ?? null} /> {t('today.vsPrev')}</>} />
        <StatTile label={t('stats.newBusinesses')} value={data?.newBusinesses ?? null}
          hint={<><Change now={data?.newBusinesses ?? null} before={data?.newBusinessesPrev ?? null} /> {t('today.vsPrev')}</>} />
        <StatTile label={t('stats.verified')} value={data?.verified ?? null}
          hint={ratio !== null ? t('stats.verifiedHint', { ratio, total: show(data?.businesses) }) : ''} />
        <StatTile label={t('stats.reports')} value={data?.reports ?? null} hint={t('stats.reportsHint')} />
      </div>

      <div className="card-grid two">
        <div className="card"><ColumnChart title={t('stats.weeklyPosts')} data={data?.weeklyPosts ?? []} /></div>
        <div className="card"><ColumnChart title={t('stats.weeklyBusinesses')} data={data?.weeklyBusinesses ?? []} /></div>
      </div>
      <div className="card">
        <BarList title={t('stats.categories', { count: days })} data={data?.categories ?? []} tone="teal" />
      </div>
      <p className="meta">{t('stats.note')}</p>
    </section>
  );
}
