import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { canSeeModule, CITY_GUIDE_SECTIONS, POST_CATEGORIES, type CityGuideMeta } from '@cityjoy/shared';
import { createCityGuideAdmin, createFirebaseStats } from '@cityjoy/shared/firebase';

import { BarList, Change, ColumnChart, daysAgo, lastWeeks, show, StatTile, type Datum } from '../components/charts';
import { canSeeStats, MENU_GROUPS, visibleItems } from '../components/shell';
import { useCity } from '../lib/city';
import { firestore } from '../lib/firebase';
import { locationRepository } from '../lib/locations';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';

interface Summary {
  approvals: number | null;
  reports: number | null;
  posts30: number | null;
  postsPrev30: number | null;
  businesses: number | null;
  businessesMonth: number | null;
  verified: number | null;
  profiles: number | null;
  weekly: Datum[];
  categories: Datum[];
}

function greeting(now: Date) {
  const h = now.getHours();
  return t(h < 12 ? 'today.morning' : h < 18 ? 'today.afternoon' : 'today.evening');
}

/** Bugün: panelin ilk sayfası. Bekleyen işler, ana sayılar ve iki grafik (seçili il için). */
export function TodayPage() {
  const { user } = useSession();
  const { provinceCode } = useCity();
  const [data, setData] = useState<Summary | null>(null);
  const stats = canSeeStats(user!);

  useEffect(() => {
    if (!stats || user!.isDemo) return;
    let live = true;
    const s = createFirebaseStats(firestore);
    const now = new Date();
    const weeks = lastWeeks(6, now);
    Promise.all([
      s.pendingApprovals(provinceCode),
      s.openReports(provinceCode),
      s.posts(provinceCode, { from: daysAgo(30, now) }),
      s.posts(provinceCode, { from: daysAgo(60, now), to: daysAgo(30, now) }),
      s.businesses(provinceCode),
      s.businesses(provinceCode, { from: daysAgo(30, now) }),
      s.businesses(provinceCode, {}, true),
      isAdminUser(user!) && !provinceCode ? s.profiles() : Promise.resolve(null),
      Promise.all(weeks.map((w) => s.posts(provinceCode, w))),
      Promise.all(POST_CATEGORIES.map((c) => s.posts(provinceCode, { from: daysAgo(30, now) }, c))),
    ]).then(([approvals, reports, posts30, postsPrev30, businesses, businessesMonth, verified, profiles, weekly, cats]) => {
      if (!live) return;
      setData({
        approvals, reports, posts30, postsPrev30, businesses, businessesMonth, verified, profiles,
        weekly: weeks.map((w, i) => ({ label: w.label, value: weekly[i] })),
        categories: POST_CATEGORIES.map((c, i) => ({ label: t(`charts.categories.${c}`), value: cats[i] }))
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
      });
    });
    return () => {
      live = false;
    };
  }, [provinceCode, stats, user]);

  if (!user) return null;
  const now = new Date();
  const place = provinceCode ? (locationRepository.getProvince(provinceCode)?.name ?? '') : t('scope.ulke');
  const waiting = data ? (data.approvals ?? 0) + (data.reports ?? 0) : 0;

  return (
    <section className="page wide">
      <header className="page-head">
        <div>
          <h1>{greeting(now)}, {user.displayName}</h1>
          <p className="meta">
            {now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })} · {place}
            {data && waiting ? ` · ${t('today.waitingCount', { count: waiting })}` : ''}
          </p>
        </div>
      </header>

      {isAdminUser(user) || canSeeModule(user.grants, 'sehir-rehberi') ? <ContentStatus provinceCode={provinceCode} /> : null}

      {stats ? (
        <>
          <div className="stat-grid">
            <StatTile label={t('today.posts30')} value={data?.posts30 ?? null} highlight
              hint={<><Change now={data?.posts30 ?? null} before={data?.postsPrev30 ?? null} /> {t('today.vsPrev')}</>} />
            <StatTile label={t('today.businesses')} value={data?.businesses ?? null}
              hint={data ? t('today.businessesHint', { month: show(data.businessesMonth), verified: show(data.verified) }) : ''} />
            {data?.profiles !== null && data?.profiles !== undefined ? (
              <StatTile label={t('today.profiles')} value={data.profiles} hint={t('today.profilesHint')} />
            ) : null}
            <StatTile label={t('today.waiting')} value={data ? waiting : null} hint={t('today.waitingHint')} />
          </div>

          <div className="card-grid two">
            <div className="card">
              <ColumnChart title={t('today.weeklyPosts')} data={data?.weekly ?? []} />
            </div>
            <div className="card">
              <h2 className="card-title">{t('today.waitingTitle')}</h2>
              <ul className="todo">
                {data?.approvals !== null ? (
                  <li><Link to="/onaylar"><span className="todo-dot gold" aria-hidden="true" />{t('today.approvals')}<b>{show(data?.approvals)}</b></Link></li>
                ) : null}
                {data?.reports !== null ? (
                  <li><Link to="/moderasyon"><span className="todo-dot red" aria-hidden="true" />{t('today.reports')}<b>{show(data?.reports)}</b></Link></li>
                ) : null}
                {data && !waiting ? <li className="meta">{t('today.allDone')}</li> : null}
              </ul>
              <Link className="btn secondary" to="/istatistikler">{t('today.moreStats')}</Link>
            </div>
          </div>

          <div className="card">
            <BarList title={t('today.categories')} data={data?.categories ?? []} tone="teal" />
          </div>
        </>
      ) : (
        <QuickLinks />
      )}
    </section>
  );
}

const PROVINCE_SECTIONS = CITY_GUIDE_SECTIONS.filter((s) => s.id !== 'nasil-yapilir');

/**
 * İl içerik durumu (panel yenileme, Eren 12 Kasım 2026): seçili ilde Benim Şehrim bölümlerinden kaçının dolu olduğu
 * ve boş olanlar. İlin tek özet belgesi okunur (1 okuma). İl seçili değilse 81 il durumuna yönlendirir.
 */
function ContentStatus({ provinceCode }: { provinceCode: string }) {
  const { user } = useSession();
  const [meta, setMeta] = useState<CityGuideMeta | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    setMeta(undefined);
    setError(false);
    if (!provinceCode || !user || user.isDemo) return;
    let live = true;
    createCityGuideAdmin(firestore, user.uid)
      .meta(provinceCode)
      .then((m) => live && setMeta(m))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [provinceCode, user]);

  if (!provinceCode) {
    return (
      <div className="card content-status">
        <h2 className="card-title">{t('today.content.title')}</h2>
        <p className="meta">{t('today.content.pickProvince')}</p>
        <Link className="btn secondary" to="/sehir-rehberi">{t('today.content.open')}</Link>
      </div>
    );
  }

  const count = (id: (typeof PROVINCE_SECTIONS)[number]['id']) => meta?.sections[id]?.count ?? 0;
  const filled = PROVINCE_SECTIONS.filter((s) => count(s.id) > 0);
  const missing = PROVINCE_SECTIONS.filter((s) => count(s.id) === 0);
  const total = PROVINCE_SECTIONS.reduce((n, s) => n + count(s.id), 0);
  const pct = Math.round((filled.length / PROVINCE_SECTIONS.length) * 100);
  const place = locationRepository.getProvince(provinceCode)?.name ?? '';

  return (
    <div className="card content-status">
      <h2 className="card-title">{t('today.content.titleFor', { place })}</h2>
      {error ? (
        <p className="meta" role="alert">{t('today.content.error')}</p>
      ) : meta === undefined && !user?.isDemo ? (
        <p className="meta" aria-live="polite">{t('today.content.loading')}</p>
      ) : (
        <>
          <p className="content-status-line">
            <b>{t('today.content.filled', { filled: filled.length, all: PROVINCE_SECTIONS.length })}</b>
            <span className="meta"> · {t('today.content.records', { count: total })}</span>
          </p>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('today.content.filledLabel')}>
            <span style={{ width: pct + '%' }} />
          </div>
          {missing.length ? (
            <>
              <p className="meta">{t('today.content.missing')}</p>
              <ul className="pill-list">
                {missing.map((s) => <li key={s.id} className="pill">{s.names.tr}</li>)}
              </ul>
            </>
          ) : (
            <p className="meta">{t('today.content.complete')}</p>
          )}
        </>
      )}
      <Link className="btn secondary" to="/sehir-rehberi">{t('today.content.open')}</Link>
    </div>
  );
}

/** İstatistik yetkisi olmayanlar (örn. kurum personeli) için bölümlerine kısayollar. */
function QuickLinks() {
  const { user } = useSession();
  const items = MENU_GROUPS.flatMap((g) => visibleItems(user!, g.items)).filter((m) => m.path && m.path !== '/');
  return (
    <div className="card-grid three">
      {items.map((m) => (
        <Link key={m.key} to={m.path!} className="card quick">
          {t(`menu.items.${m.key}`)}
          <span aria-hidden="true">›</span>
        </Link>
      ))}
    </div>
  );
}
