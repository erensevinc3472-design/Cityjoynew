import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import {
  AGE_BANDS,
  AUDIENCE_MIN_GROUP,
  dayKey,
  foldSmall,
  homeSplit,
  mayorProfileId,
  periodChange,
  weeklyNet,
  within,
  type OfficialProfile,
  type OfficialStats,
} from '@cityjoy/shared';
import { createFirestoreOfficialProfileRepository, createOrganizationAdmin, getOfficialStats } from '@cityjoy/shared/firebase';

import { Change, ColumnChart, DrillList, show, StatTile, type Datum, type DrillRow } from '../components/charts';
import { audienceTargetsFor, canSeeMayor, sampleStats, type AudienceTarget } from '../lib/audience';
import { useCity } from '../lib/city';
import { firestore } from '../lib/firebase';
import { locationRepository } from '../lib/locations';
import { isAdminUser, useSession, type PanelUser } from '../lib/session';
import { t } from '../lib/t';

const PERIODS = [7, 30, 90] as const;
type View = { kind: 'genel' } | { kind: 'il-ici' } | { kind: 'ilce'; id: string } | { kind: 'il-disi' } | { kind: 'yas' } | { kind: 'gunluk' };

/**
 * Takipçiler (PROJE.md 6.1, Karar Eren 3 Kasım 2026): resmî hesabın (belediye, kurum, muhtarlık, başkan) takipçi
 * istatistiği. Takipçinin kayıtlı konumu ve yaş aralığı isimsiz sayılır; 10 kişiden küçük gruplar "Diğer"e katılır.
 * Her kutu ve çubuk tıklanınca kendi ayrıntı grafiğini açar (il içi > ilçe > mahalle, il dışı > iller).
 */
export function AudiencePage() {
  const { user } = useSession();
  if (!user) return null;
  return <Audience user={user} />;
}

function Audience({ user }: { user: PanelUser }) {
  const admin = isAdminUser(user);
  const { provinceCode } = useCity();
  const own = useMemo(() => audienceTargetsFor(user), [user]);
  const [orgTargets, setOrgTargets] = useState<AudienceTarget[]>([]);
  const targets = useMemo(() => [...own, ...orgTargets.filter((o) => !own.some((x) => x.id === o.id))], [own, orgTargets]);
  const [params, setParams] = useSearchParams();
  const target = targets.find((x) => x.id === params.get('hesap')) ?? targets[0];
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [stats, setStats] = useState<OfficialStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [mayor, setMayor] = useState<OfficialProfile | null>(null);
  const [view, setView] = useState<View>({ kind: 'genel' });

  // Admin seçili ildeki kurumları görür (başkan istatistiği admin'e açık değildir).
  useEffect(() => {
    if (!admin) return;
    if (user.isDemo) {
      setOrgTargets([{ id: 'bld-16-osmangazi', kind: 'kurum', name: 'Osmangazi Belediyesi', provinceCode: '16', orgId: 'bld-16-osmangazi' }]);
      return;
    }
    const svc = createOrganizationAdmin(firestore, user.uid);
    (provinceCode ? svc.listForProvince(provinceCode) : svc.listAll())
      .then((list) =>
        setOrgTargets(list.map((o) => ({ id: o.id, kind: 'kurum', name: o.name, provinceCode: o.scope.level === 'ulke' ? undefined : o.scope.provinceCode, orgId: o.id }))),
      )
      .catch(() => setOrgTargets([]));
  }, [admin, user, provinceCode]);

  useEffect(() => {
    setStats(null);
    setFailed(false);
    setView({ kind: 'genel' });
    if (!target) return;
    let live = true;
    (user.isDemo ? sampleStats(target) : getOfficialStats(firestore, target.id)).then(
      (s) => live && setStats(s),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [target, user.isDemo]);

  // Başkan kartı (belediyede) ve başkan sayfasının başlığı: başkan profili herkese açıktır.
  const mayorId = target?.orgId?.startsWith('bld-') && target.kind !== 'muhtar' ? mayorProfileId(target.orgId) : null;
  useEffect(() => {
    setMayor(null);
    if (!mayorId) return;
    if (user.isDemo) {
      setMayor({ id: mayorId, type: 'baskan', name: t('audience.sampleMayor'), updatedAt: '' });
      return;
    }
    createFirestoreOfficialProfileRepository(firestore).get(mayorId).then(setMayor, () => setMayor(null));
  }, [mayorId, user.isDemo]);

  if (!admin && !own.length) return <Navigate to="/" replace />;

  const choose = (id: string) => setParams(id ? { hesap: id } : {});
  const labelOf = (x: AudienceTarget) =>
    x.kind === 'baskan' ? t('audience.mayorOf', { org: x.name }) : x.kind === 'muhtar' ? t('audience.muhtarOf', { id: x.name }) : x.name;

  return (
    <section className="page wide">
      <header className="page-head">
        <div>
          <h1>
            {t('audience.title')}
            {user.isDemo ? <span className="sample-tag">{t('audience.sample')}</span> : null}
          </h1>
          <p className="meta">{t('audience.intro')}</p>
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
          <label htmlFor="au-target">{t('audience.which')}</label>
          <select id="au-target" value={target?.id ?? ''} onChange={(e) => choose(e.target.value)}>
            {targets.map((x) => (
              <option key={x.id} value={x.id}>{labelOf(x)}</option>
            ))}
          </select>
        </div>
      ) : null}

      {!target ? (
        <div className="state">{t('audience.noTargets')}</div>
      ) : failed ? (
        <p className="error" role="alert">{t('audience.error')}</p>
      ) : !stats ? (
        <div className="state" aria-live="polite">{t('profile.loading')}</div>
      ) : (
        <>
          {target.kind === 'baskan' ? <MayorHead mayor={mayor} org={target.name} /> : null}
          {view.kind === 'genel' ? (
            <Overview target={target} stats={stats} days={days} open={setView} />
          ) : (
            <Detail target={target} stats={stats} days={days} view={view} open={setView} />
          )}
          {target.kind === 'kurum' && mayorId && mayor && view.kind === 'genel' ? (
            <MayorCard mayor={mayor} canOpen={canSeeMayor(user, target.orgId!)} onOpen={() => choose(mayorId)} />
          ) : null}
        </>
      )}
      <p className="meta">{t('audience.privacy', { min: AUDIENCE_MIN_GROUP })}</p>
    </section>
  );
}

const provinceName = (code: string) => locationRepository.getProvince(code)?.name ?? code;

function Overview({ target, stats: s, days, open }: { target: AudienceTarget; stats: OfficialStats; days: number; open: (v: View) => void }) {
  const now = new Date();
  const period = periodChange(s, days, now);
  const previous = periodChange(s, days, new Date(now.getTime() - days * 86400000));
  const split = homeSplit(s, target.provinceCode);
  const home = target.provinceCode ? provinceName(target.provinceCode) : '';
  const weeks: Datum[] = weeklyNet(s, 12, now).map((w, i, all) => ({
    label: i === all.length - 1 ? t('charts.thisWeek') : w.start.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
    value: w.follows,
  }));
  const where: DrillRow[] = target.provinceCode
    ? [
        { key: 'ic', label: t('audience.inside', { place: home }), value: split.inside, onOpen: () => open({ kind: 'il-ici' }) },
        { key: 'dis', label: t('audience.outside', { place: home }), value: split.outside, onOpen: () => open({ kind: 'il-disi' }) },
        { key: 'yok', label: t('audience.noLocation'), value: split.unknown, muted: true },
      ]
    : [
        { key: 'iller', label: t('audience.byProvince'), value: split.outside, onOpen: () => open({ kind: 'il-disi' }) },
        { key: 'yok', label: t('audience.noLocation'), value: split.unknown, muted: true },
      ];
  const insidePct = s.total > 0 && target.provinceCode ? `%${Math.round((split.inside / s.total) * 100)}` : undefined;

  return (
    <>
      <div className="stat-grid">
        <StatTile label={t('audience.followers')} value={s.total} highlight onClick={() => open({ kind: 'gunluk' })}
          hint={t('audience.netHint', { count: days, net: `${period.net >= 0 ? '+' : ''}${period.net.toLocaleString('tr-TR')}` })} />
        <StatTile label={t('audience.newFollows', { count: days })} value={period.follows} onClick={() => open({ kind: 'gunluk' })}
          hint={<><Change now={period.follows} before={previous.follows} /> {t('today.vsPrev')}</>} />
        <StatTile label={t('audience.unfollows', { count: days })} value={period.unfollows} onClick={() => open({ kind: 'gunluk' })}
          hint={t('audience.unfollowsTotal', { total: show(s.unfollows) })} />
        {target.provinceCode ? (
          <StatTile label={t('audience.insideShare', { place: home })} value={split.inside} display={insidePct} onClick={() => open({ kind: 'il-ici' })}
            hint={t('audience.insideHint', { count: show(split.inside) })} />
        ) : null}
      </div>

      <div className="card-grid two">
        <div className="card"><ColumnChart title={t('audience.weekly')} data={weeks} /></div>
        <div className="card"><DrillList title={t('audience.where')} rows={where} total={s.total} /></div>
      </div>
      <div className="card">
        <DrillList title={t('audience.age')} rows={ageRows(s, () => open({ kind: 'yas' }))} total={s.total} tone="gold" />
      </div>
    </>
  );
}

/** Yaş aralıkları sırasıyla; 10 kişiden küçük aralık gösterilmez. 18 yaş altı hiç gösterilmez. */
function ageRows(s: OfficialStats, onOpen?: () => void): DrillRow[] {
  return AGE_BANDS.flatMap((b) => {
    const v = s.a[b] ?? 0;
    return v >= AUDIENCE_MIN_GROUP ? [{ key: b, label: t('audience.ageBand', { band: b }), value: v, onOpen }] : [];
  });
}

function Detail({ target, stats: s, days, view, open }: { target: AudienceTarget; stats: OfficialStats; days: number; view: View; open: (v: View) => void }) {
  const home = target.provinceCode;
  const [hoodNames, setHoodNames] = useState<Record<string, string>>({});
  const districtId = view.kind === 'ilce' ? view.id : null;
  useEffect(() => {
    if (!districtId) return;
    locationRepository.getNeighbourhoods(districtId).then(
      (list) => setHoodNames(Object.fromEntries(list.map((n) => [n.id, n.name]))),
      () => setHoodNames({}),
    );
  }, [districtId]);

  const other = (value: number | null): DrillRow[] => (value ? [{ key: 'diger', label: t('audience.other'), value, muted: true }] : []);
  const crumbs: { label: string; view?: View }[] = [{ label: t('audience.overview'), view: { kind: 'genel' } }];
  let title = '';
  let total = s.total;
  let rows: DrillRow[] = [];
  let chart: { follows: Datum[]; unfollows: Datum[] } | null = null;

  if (view.kind === 'il-ici' || view.kind === 'ilce') {
    const place = home ? provinceName(home) : '';
    crumbs.push({ label: t('audience.inside', { place }), view: view.kind === 'ilce' ? { kind: 'il-ici' } : undefined });
    if (view.kind === 'il-ici' && home) {
      title = t('audience.byDistrict', { place });
      total = s.p[home] ?? 0;
      const ds = within(s.d, `${home}-`);
      const f = foldSmall(ds);
      const unknown = total - Object.values(ds).reduce((a, b) => a + Math.max(0, b), 0);
      rows = [
        ...f.rows.map((r) => ({ key: r.key, label: locationRepository.getDistrict(r.key)?.name ?? r.key, value: r.value, onOpen: () => open({ kind: 'ilce', id: r.key }) })),
        ...other(f.other),
        ...(unknown >= AUDIENCE_MIN_GROUP ? [{ key: 'yok', label: t('audience.noDistrict'), value: unknown, muted: true }] : []),
      ];
    } else if (view.kind === 'ilce') {
      const name = locationRepository.getDistrict(view.id)?.name ?? view.id;
      crumbs.push({ label: name });
      title = t('audience.byNeighbourhood', { place: name });
      total = s.d[view.id] ?? 0;
      const ns = within(s.n, `${view.id}-`);
      const f = foldSmall(ns);
      const unknown = total - Object.values(ns).reduce((a, b) => a + Math.max(0, b), 0);
      rows = [
        ...f.rows.map((r) => ({ key: r.key, label: hoodNames[r.key] ?? r.key.slice(view.id.length + 1), value: r.value })),
        ...other(f.other),
        ...(unknown >= AUDIENCE_MIN_GROUP ? [{ key: 'yok', label: t('audience.noNeighbourhood'), value: unknown, muted: true }] : []),
      ];
    }
  } else if (view.kind === 'il-disi') {
    const place = home ? provinceName(home) : '';
    crumbs.push({ label: home ? t('audience.outside', { place }) : t('audience.byProvince') });
    title = home ? t('audience.topProvinces', { place }) : t('audience.byProvince');
    const ps = Object.fromEntries(Object.entries(s.p).filter(([k]) => k !== home));
    total = Object.values(ps).reduce((a, b) => a + Math.max(0, b), 0);
    const f = foldSmall(ps, 15);
    rows = [...f.rows.map((r) => ({ key: r.key, label: provinceName(r.key), value: r.value })), ...other(f.other)];
  } else if (view.kind === 'yas') {
    crumbs.push({ label: t('audience.age') });
    title = t('audience.age');
    rows = ageRows(s);
  } else if (view.kind === 'gunluk') {
    crumbs.push({ label: t('audience.daily', { count: days }) });
    title = t('audience.daily', { count: days });
    const now = Date.now();
    const list = Array.from({ length: days }, (_, i) => new Date(now - (days - 1 - i) * 86400000));
    const label = (d: Date, i: number) => (i === days - 1 ? t('audience.today') : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }));
    chart = {
      follows: list.map((d, i) => ({ label: label(d, i), value: s.f[dayKey(d)] ?? 0 })),
      unfollows: list.map((d, i) => ({ label: label(d, i), value: s.u[dayKey(d)] ?? 0 })),
    };
  }

  return (
    <>
      <nav className="crumbs" aria-label={t('audience.crumbs')}>
        {crumbs.map((c, i) => (
          <span key={c.label} style={{ display: 'contents' }}>
            {i > 0 ? <span aria-hidden="true">›</span> : null}
            {c.view ? <button type="button" onClick={() => open(c.view!)}>{c.label}</button> : <span aria-current="page">{c.label}</span>}
          </span>
        ))}
      </nav>
      {chart ? (
        <div className="card-grid two">
          <div className="card"><ColumnChart title={t('audience.dailyFollows')} data={chart.follows} /></div>
          <div className="card"><ColumnChart title={t('audience.dailyUnfollows')} data={chart.unfollows} /></div>
        </div>
      ) : (
        <div className="card">
          <DrillList title={title} rows={rows} total={total} empty={t('audience.tooFew', { min: AUDIENCE_MIN_GROUP })} />
          {view.kind === 'yas' ? <p className="meta">{t('audience.ageNote')}</p> : null}
        </div>
      )}
    </>
  );
}

function MayorHead({ mayor, org }: { mayor: OfficialProfile | null; org: string }) {
  return (
    <div className="card mayor-card">
      {mayor?.logo ? <img className="mayor-photo" src={mayor.logo.url} alt="" /> : <span className="mayor-photo" aria-hidden="true">{(mayor?.name ?? '?').slice(0, 1)}</span>}
      <div className="grow">
        <span className="meta">{t('audience.mayorLabel', { org })}</span>
        <strong>{mayor?.name ?? t('audience.mayorNoProfile')}</strong>
        <span className="meta">{t('audience.mayorOnly')}</span>
      </div>
    </div>
  );
}

function MayorCard({ mayor, canOpen, onOpen }: { mayor: OfficialProfile; canOpen: boolean; onOpen: () => void }) {
  return (
    <div className="card mayor-card">
      {mayor.logo ? <img className="mayor-photo" src={mayor.logo.url} alt="" /> : <span className="mayor-photo" aria-hidden="true">{mayor.name.slice(0, 1)}</span>}
      <div className="grow">
        <span className="meta">{t('audience.mayor')}</span>
        <strong>{mayor.name}</strong>
        <span className="meta">{canOpen ? t('audience.mayorHint') : t('audience.mayorLocked')}</span>
      </div>
      {canOpen ? <button type="button" className="btn" onClick={onOpen}>{t('audience.mayorOpen')}</button> : null}
    </div>
  );
}
