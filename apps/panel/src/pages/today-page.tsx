import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { POST_CATEGORIES } from '@cityjoy/shared';
import { createFirebaseStats } from '@cityjoy/shared/firebase';

import { BarList, Change, ColumnChart, daysAgo, lastWeeks, show, StatTile, type Datum } from '../components/charts';
import { canSeeStats, MENU_GROUPS, visibleItems } from '../components/shell';
import { canSeeAudience } from '../lib/audience';
import { useCity } from '../lib/city';
import { canSeeContentStats } from './content-stats-page';
import { canSeePress } from './press-page';
import { DEFAULT_IMPORTANT_DAYS, upcomingDays, type ImportantDay } from '@cityjoy/shared';
import { createImportantDaysService } from '@cityjoy/shared/firebase';
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

      {canSeePress(user) ? <UpcomingDaysCard /> : null}

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

/** İstatistik yetkisi olmayanlar (örn. kurum personeli) için bölümlerine kısayollar. */
function QuickLinks() {
  const { user } = useSession();
  const admin = isAdminUser(user!);
  // Belediye ve muhtar için en çok işe yarayanlar önde: içerik performansı ve takipçiler.
  const reports = [
    ...(canSeePress(user!) ? [{ key: 'basin', path: '/basin-masasi', label: t('menu.press') }] : []),
    ...(canSeeContentStats(user!, admin) ? [{ key: 'icerik', path: '/icerik-performansi', label: t('menu.content') }] : []),
    ...(canSeeAudience(user!, admin) ? [{ key: 'kitle', path: '/takipciler', label: t('menu.audience') }] : []),
  ];
  const items = [
    ...reports,
    ...MENU_GROUPS.flatMap((g) => visibleItems(user!, g.items)).filter((m) => m.path).map((m) => ({ key: m.key, path: m.path!, label: t(`menu.items.${m.key}`) })),
  ];
  return (
    <div className="card-grid three">
      {items.map((m) => (
        <Link key={m.key} to={m.path} className="card quick">
          {m.label}
          <span aria-hidden="true">›</span>
        </Link>
      ))}
    </div>
  );
}

/** Basın birimi için yaklaşan önemli günler (14 gün): ülke geneli liste ve kurumun yerel günleri. */
function UpcomingDaysCard() {
  const { user } = useSession();
  const [days, setDays] = useState<ImportantDay[] | null>(null);
  useEffect(() => {
    if (!user) return;
    if (user.isDemo) return setDays(DEFAULT_IMPORTANT_DAYS);
    const svc = createImportantDaysService(firestore, user.uid);
    const orgId = user.memberships[0]?.org.id;
    Promise.all([svc.loadNational().catch(() => null), orgId ? svc.loadLocal(orgId).catch(() => []) : Promise.resolve([])]).then(
      ([national, local]) => setDays([...(national ?? DEFAULT_IMPORTANT_DAYS), ...local]),
    );
  }, [user]);
  const list = days ? upcomingDays(days, new Date(), 14).slice(0, 4) : [];
  if (!days || !list.length) return null;
  return (
    <div className="card">
      <h2 className="card-title">{t('press.todayCard')}</h2>
      <ul className="upcoming">
        {list.map((o) => (
          <li key={`${o.day.id}-${o.date}`}>
            <span className={`dot k-${o.day.kind === 'yerel' ? 'yerel' : 'gun'}`} aria-hidden="true" />
            <span className="grow">
              <strong>{o.day.title}</strong>
              {o.day.idea ? <small>{o.day.idea}</small> : null}
            </span>
            <span className="when">{o.inDays === 0 ? t('press.todayShort') : t('press.inDays', { count: o.inDays })}</span>
          </li>
        ))}
      </ul>
      <Link className="btn secondary" to="/basin-masasi">{t('press.todayMore')}</Link>
    </div>
  );
}
