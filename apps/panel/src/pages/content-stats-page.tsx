import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { contentInsights, type ContentInsight, type ContentKind, type ContentPerformance } from '@cityjoy/shared';
import { createContentStatsReader, createOrganizationAdmin, getOfficialStats, type ContentOwner } from '@cityjoy/shared/firebase';

import { BarList, Change, ColumnChart, daysAgo, show, StatTile, type Datum } from '../components/charts';
import { audienceTargetsFor, type AudienceTarget } from '../lib/audience';
import { useCity } from '../lib/city';
import { sampleContent } from '../lib/content-stats';
import { firestore } from '../lib/firebase';
import { isAdminUser, useSession, type PanelUser } from '../lib/session';
import { t } from '../lib/t';

const PERIODS = [7, 30, 90] as const;
const KINDS: ContentKind[] = ['duyuru', 'haber', 'etkinlik', 'acil'];
type Sort = 'yeni' | 'okunma' | 'paylasim';

/** İçerik istatistiği görülebilen hesaplar: kurum ve muhtarlık (başkan hesabı içerik yayınlamıyor). */
export const contentTargetsFor = (user: PanelUser) => audienceTargetsFor(user).filter((x) => x.kind !== 'baskan');
export const canSeeContentStats = (user: PanelUser, admin: boolean) => admin || contentTargetsFor(user).length > 0;

const ownerOf = (x: AudienceTarget): ContentOwner => (x.kind === 'muhtar' ? { type: 'kisi', grantKey: x.id } : { type: 'kurum', orgId: x.id });

export interface Loaded {
  rows: ContentPerformance[];
  /** Dönemde ve önceki dönemde ilk kez okunan (bütün içerikler). */
  reads: number | null;
  readsBefore: number | null;
  chart: Datum[];
  followers: number | null;
}

/** Aynı anda en çok n istek (sayım sorguları sırayla gitsin, tarayıcı boğulmasın). */
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/** Grafik dilimleri: 7 ve 30 günde günlük, 90 günde haftalık. */
function buckets(days: number, now = new Date()): { label: string; from: Date; to: Date }[] {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  const step = days > 30 ? 7 : 1;
  const n = Math.ceil(days / step);
  return Array.from({ length: n }, (_, i) => {
    const to = new Date(end.getTime() - (n - 1 - i) * step * 86400000);
    const from = new Date(to.getTime() - step * 86400000);
    const label = i === n - 1 ? (step === 1 ? t('content.today') : t('charts.thisWeek')) : from.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    return { label, from, to };
  });
}

async function load(target: AudienceTarget, days: number): Promise<Loaded> {
  const reader = createContentStatsReader(firestore);
  const owner = ownerOf(target);
  const now = new Date();
  const [list, reads, readsBefore, followers] = await Promise.all([
    reader.listContent(owner, daysAgo(days, now)),
    reader.readsBetween(owner, daysAgo(days, now), now),
    reader.readsBetween(owner, daysAgo(days * 2, now), daysAgo(days, now)),
    getOfficialStats(firestore, target.id).then((s) => s.total, () => null),
  ]);
  const counts = await pool(list, 6, (r) => reader.counts(owner, r.id));
  const rows = list.map((r, i) => ({ ...r, reads: counts[i].reads ?? 0, shares: counts[i].shares ?? 0 }));
  const bs = buckets(days, now);
  const values = await pool(bs, 6, (b) => reader.readsBetween(owner, b.from, b.to));
  return { rows, reads, readsBefore, followers, chart: bs.map((b, i) => ({ label: b.label, value: values[i] })) };
}

/**
 * İçerik performansı (PROJE.md 6.1 ve 6.2 madde 22): belediyenin, kurumun ya da muhtarlığın duyuru, haber, acil duyuru
 * ve etkinliklerinin kaç kişiye ulaştığı, ne kadar paylaşıldığı; hangi tür, gün ve saatin daha çok okunduğuna dair
 * öneriler. Okunma kişi başına bir kez sayılır, kimin okuduğu kaydedilmez.
 */
export function ContentStatsPage() {
  const { user } = useSession();
  if (!user) return null;
  return <ContentStats user={user} />;
}

function ContentStats({ user }: { user: PanelUser }) {
  const admin = isAdminUser(user);
  const { provinceCode } = useCity();
  const own = useMemo(() => contentTargetsFor(user), [user]);
  const [orgTargets, setOrgTargets] = useState<AudienceTarget[]>([]);
  const targets = useMemo(() => [...own, ...orgTargets.filter((o) => !own.some((x) => x.id === o.id))], [own, orgTargets]);
  const [params, setParams] = useSearchParams();
  const target = targets.find((x) => x.id === params.get('hesap')) ?? targets[0];
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [kind, setKind] = useState<ContentKind | ''>('');
  const [sort, setSort] = useState<Sort>('yeni');

  // Admin seçili ildeki kurumları da görür.
  useEffect(() => {
    if (!admin) return;
    if (user.isDemo) {
      setOrgTargets([{ id: 'bld-16-osmangazi', kind: 'kurum', name: 'Osmangazi Belediyesi', provinceCode: '16', orgId: 'bld-16-osmangazi' }]);
      return;
    }
    const svc = createOrganizationAdmin(firestore, user.uid);
    (provinceCode ? svc.listForProvince(provinceCode) : svc.listAll())
      .then((list) => setOrgTargets(list.map((o) => ({ id: o.id, kind: 'kurum', name: o.name, provinceCode: o.scope.level === 'ulke' ? undefined : o.scope.provinceCode, orgId: o.id }))))
      .catch(() => setOrgTargets([]));
  }, [admin, user, provinceCode]);

  useEffect(() => {
    setData(null);
    setFailed(false);
    if (!target) return;
    let live = true;
    const run = user.isDemo ? Promise.resolve(sampleContent(target.id, days, buckets(days).map((b) => b.label))) : load(target, days);
    run.then(
      (d) => live && setData(d),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [target, days, user.isDemo]);

  if (!admin && !own.length) return <Navigate to="/" replace />;

  const labelOf = (x: AudienceTarget) => (x.kind === 'muhtar' ? t('audience.muhtarOf', { id: x.name }) : x.name);

  return (
    <section className="page wide">
      <header className="page-head">
        <div>
          <h1>
            {t('content.title')}
            {user.isDemo ? <span className="sample-tag">{t('audience.sample')}</span> : null}
          </h1>
          <p className="meta">{t('content.intro')}</p>
        </div>
        <div className="seg" role="group" aria-label={t('stats.period')}>
          {PERIODS.map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>
              {t('stats.days', { count: d })}
            </button>
          ))}
        </div>
      </header>

      {targets.length > 1 ? (
        <div className="toolbar">
          <label htmlFor="cs-target">{t('audience.which')}</label>
          <select id="cs-target" value={target?.id ?? ''} onChange={(e) => setParams(e.target.value ? { hesap: e.target.value } : {})}>
            {targets.map((x) => (
              <option key={x.id} value={x.id}>{labelOf(x)}</option>
            ))}
          </select>
        </div>
      ) : null}

      {!target ? (
        <div className="state">{t('audience.noTargets')}</div>
      ) : failed ? (
        <p className="error" role="alert">{t('content.error')}</p>
      ) : !data ? (
        <div className="state" aria-live="polite">{t('profile.loading')}</div>
      ) : (
        <Body data={data} days={days} kind={kind} setKind={setKind} sort={sort} setSort={setSort} />
      )}
      <p className="meta">{t('content.privacy')}</p>
    </section>
  );
}

const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function insightText(i: ContentInsight): { title: string; body: string } {
  switch (i.type) {
    case 'enIyi':
      return { title: t('content.ins.bestTitle'), body: t('content.ins.best', { title: i.title, count: i.reads.toLocaleString('tr-TR') }) };
    case 'erisim':
      return { title: t('content.ins.reachTitle'), body: t('content.ins.reach', { pct: i.pct }) };
    case 'paylasim':
      return { title: t('content.ins.shareTitle'), body: t('content.ins.share', { pct: i.pct.toLocaleString('tr-TR') }) };
    case 'tur':
      return { title: t('content.ins.kindTitle'), body: t('content.ins.kind', { kind: t(`content.kinds.${i.kind}`), x: i.ratio.toLocaleString('tr-TR') }) };
    case 'gun':
      return { title: t('content.ins.dayTitle'), body: t('content.ins.day', { day: WEEKDAYS[i.weekday], x: i.ratio.toLocaleString('tr-TR') }) };
    case 'saat':
      return { title: t('content.ins.hourTitle'), body: t('content.ins.hour', { band: t(`content.bands.${i.band}`), x: i.ratio.toLocaleString('tr-TR') }) };
    case 'dusuk':
      return { title: t('content.ins.lowTitle'), body: t('content.ins.low', { count: i.count }) };
  }
}

function Body({ data, days, kind, setKind, sort, setSort }: {
  data: Loaded; days: number; kind: ContentKind | ''; setKind: (k: ContentKind | '') => void; sort: Sort; setSort: (s: Sort) => void;
}) {
  const { rows } = data;
  const shares = rows.reduce((a, r) => a + r.shares, 0);
  const itemReads = rows.reduce((a, r) => a + r.reads, 0);
  const attendees = rows.reduce((a, r) => a + (r.attendees ?? 0), 0);
  const events = rows.filter((r) => r.kind === 'etkinlik').length;
  const average = rows.length ? Math.round(itemReads / rows.length) : null;
  const insights = contentInsights(rows, data.followers);
  const top: Datum[] = [...rows].sort((a, b) => b.reads - a.reads).slice(0, 8).filter((r) => r.reads > 0)
    .map((r) => ({ label: r.title.length > 48 ? `${r.title.slice(0, 46)}…` : r.title, value: r.reads }));
  const byKind: Datum[] = KINDS.map((k) => {
    const xs = rows.filter((r) => r.kind === k);
    return { label: t(`content.kinds.${k}`), value: xs.length ? Math.round(xs.reduce((a, r) => a + r.reads, 0) / xs.length) : null };
  }).filter((d) => d.value !== null);
  const list = rows
    .filter((r) => !kind || r.kind === kind)
    .sort((a, b) => (sort === 'okunma' ? b.reads - a.reads : sort === 'paylasim' ? b.shares - a.shares : b.publishedAt.localeCompare(a.publishedAt)));

  return (
    <>
      <div className="stat-grid">
        <StatTile label={t('content.reads', { count: days })} value={data.reads} highlight
          hint={<><Change now={data.reads} before={data.readsBefore} /> {t('today.vsPrev')}</>} />
        <StatTile label={t('content.published', { count: days })} value={rows.length}
          hint={events ? t('content.publishedHint', { events }) : undefined} />
        <StatTile label={t('content.average')} value={average}
          hint={data.followers ? t('content.followersHint', { count: show(data.followers) }) : undefined} />
        <StatTile label={t('content.shares')} value={shares}
          hint={attendees ? t('content.attendeesHint', { count: show(attendees) }) : undefined} />
      </div>

      {insights.length ? (
        <div className="card">
          <h2 className="card-title">{t('content.ins.title')}</h2>
          <ul className="insights">
            {insights.map((i) => {
              const x = insightText(i);
              return (
                <li key={i.type}>
                  <strong>{x.title}</strong>
                  <span>{x.body}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="card-grid two">
        <div className="card"><ColumnChart title={days > 30 ? t('content.chartWeekly') : t('content.chartDaily')} data={data.chart} /></div>
        <div className="card"><BarList title={t('content.top')} data={top} tone="gold" /></div>
      </div>
      {byKind.length > 1 ? (
        <div className="card"><BarList title={t('content.byKind')} data={byKind} tone="teal" /></div>
      ) : null}

      <div className="toolbar">
        <label htmlFor="cs-kind">{t('content.filter')}</label>
        <select id="cs-kind" value={kind} onChange={(e) => setKind(e.target.value as ContentKind | '')}>
          <option value="">{t('content.all')}</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>{t(`content.kinds.${k}`)}</option>
          ))}
        </select>
        <label htmlFor="cs-sort">{t('content.sort')}</label>
        <select id="cs-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="yeni">{t('content.sortNew')}</option>
          <option value="okunma">{t('content.sortReads')}</option>
          <option value="paylasim">{t('content.sortShares')}</option>
        </select>
      </div>
      {list.length ? (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">{t('content.tableTitle')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('content.colTitle')}</th>
                <th scope="col">{t('content.colKind')}</th>
                <th scope="col">{t('content.colDate')}</th>
                <th scope="col" className="num">{t('content.colReads')}</th>
                <th scope="col" className="num">{t('content.colShares')}</th>
                <th scope="col" className="num">{t('content.colAttendees')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td>{t(`content.kinds.${r.kind}`)}</td>
                  <td>{r.publishedAt ? new Date(r.publishedAt).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                  <td className="num">{show(r.reads)}</td>
                  <td className="num">{show(r.shares)}</td>
                  <td className="num">{r.kind === 'etkinlik' ? show(r.attendees ?? 0) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="state">{t('content.empty', { count: days })}</div>
      )}
    </>
  );
}
