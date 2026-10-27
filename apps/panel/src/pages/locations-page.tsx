import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  can,
  filterByName,
  isGrantActive,
  LOCATION_DATA_SOURCE,
  LOCATION_DATA_VERSION,
  type Neighbourhood,
  type RegionScope,
} from '@cityjoy/shared';

import { locationRepository as repo } from '../lib/locations';
import { useSession } from '../lib/session';
import { t } from '../lib/t';

/** Kullanıcının "konumlar" bölümünü görebildiği bölgeler. */
function useViewScopes(): RegionScope[] {
  const { user } = useSession();
  return useMemo(
    () =>
      (user?.grants ?? [])
        .filter((g) => isGrantActive(g, new Date()) && g.modules.konumlar?.includes('goruntule'))
        .map((g) => g.scope),
    [user],
  );
}

export function LocationsPage() {
  const { user } = useSession();
  const scopes = useViewScopes();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');

  const national = scopes.some((s) => s.level === 'ulke');
  const provinceScopes = scopes.filter((s) => s.level !== 'ulke');

  // Tek ile ya da tek ilçeye yetkili kullanıcı doğrudan kendi bölgesinden başlar.
  const lockedProvince = !national && new Set(provinceScopes.map((s) => s.provinceCode)).size === 1 ? provinceScopes[0]?.provinceCode : undefined;
  const districtScopes = provinceScopes.filter((s) => s.level === 'ilce' || s.level === 'mahalle');
  const lockedDistrict =
    lockedProvince && !provinceScopes.some((s) => s.level === 'il') && new Set(districtScopes.map((s) => s.districtId)).size === 1
      ? districtScopes[0]?.districtId
      : undefined;

  const provinceCode = lockedProvince ?? params.get('il') ?? undefined;
  const districtId = lockedDistrict ?? params.get('ilce') ?? undefined;

  const visibleProvince = (code: string) => national || provinceScopes.some((s) => s.provinceCode === code);
  const visibleDistrict = (id: string) =>
    national || scopes.some((s) => (s.level === 'il' && id.startsWith(`${s.provinceCode}-`)) || ((s.level === 'ilce' || s.level === 'mahalle') && s.districtId === id));
  const visibleNeighbourhood = (n: Neighbourhood) =>
    national || scopes.some((s) => s.level !== 'mahalle' || s.neighbourhoodId === n.id);

  const region = { provinceCode, districtId };
  const canEdit = !!user && can(user.grants, { module: 'konumlar', action: 'duzenle', region: provinceCode ? region : undefined });

  const [neighbourhoods, setNeighbourhoods] = useState<Neighbourhood[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setNeighbourhoods(null);
    setLoadError(false);
    if (!districtId) return;
    repo.getNeighbourhoods(districtId).then(setNeighbourhoods, () => setLoadError(true));
  }, [districtId, attempt]);

  useEffect(() => setQuery(''), [provinceCode, districtId]);

  const go = (next: { il?: string; ilce?: string }) => {
    const p = new URLSearchParams();
    if (next.il) p.set('il', next.il);
    if (next.ilce) p.set('ilce', next.ilce);
    setParams(p);
  };

  const province = provinceCode ? repo.getProvince(provinceCode) : undefined;
  const district = districtId ? repo.getDistrict(districtId) : undefined;

  let body;
  if (!provinceCode) {
    const rows = filterByName(repo.getProvinces().filter((p) => visibleProvince(p.code)), query);
    body = (
      <Table head={[t('locations.code'), t('locations.name'), t('locations.districtCount')]} count={rows.length}>
        {rows.map((p) => (
          <tr key={p.code}>
            <td className="num">{p.code}</td>
            <td><button className="link" onClick={() => go({ il: p.code })}>{p.name}</button></td>
            <td className="num">{repo.getDistricts(p.code).length}</td>
          </tr>
        ))}
      </Table>
    );
  } else if (!districtId) {
    const rows = filterByName(repo.getDistricts(provinceCode).filter((d) => visibleDistrict(d.id)), query);
    body = (
      <Table head={[t('locations.name')]} count={rows.length}>
        {rows.map((d) => (
          <tr key={d.id}>
            <td><button className="link" onClick={() => go({ il: provinceCode, ilce: d.id })}>{d.name}</button></td>
          </tr>
        ))}
      </Table>
    );
  } else if (loadError) {
    body = (
      <div className="state" role="alert">
        <p>{t('locations.loadError')}</p>
        <button className="btn secondary" onClick={() => setAttempt((n) => n + 1)}>{t('locations.retry')}</button>
      </div>
    );
  } else if (!neighbourhoods) {
    body = <div className="state" aria-live="polite">{t('locations.loading')}</div>;
  } else {
    const rows = filterByName(neighbourhoods.filter(visibleNeighbourhood), query);
    body = (
      <Table head={[t('locations.name'), t('locations.kind'), t('locations.postalCode')]} count={rows.length}>
        {rows.map((n) => (
          <tr key={n.id}>
            <td>{n.name}</td>
            <td>{t(`locations.kinds.${n.kind}`)}</td>
            <td className="num">{n.postalCode}</td>
          </tr>
        ))}
      </Table>
    );
  }

  const level = !provinceCode ? 'provinces' : !districtId ? 'districts' : 'neighbourhoods';

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('locations.title')}</h1>
          <nav className="crumbs" aria-label="Konum">
            {lockedProvince ? <span>{province?.name}</span> : <button className="link" onClick={() => go({})}>{t('locations.all')}</button>}
            {province && !lockedProvince ? <><span aria-hidden>›</span>{districtId && !lockedDistrict ? <button className="link" onClick={() => go({ il: provinceCode })}>{province.name}</button> : <span>{province.name}</span>}</> : null}
            {district ? <><span aria-hidden>›</span><span>{district.name}</span></> : null}
          </nav>
        </div>
        {canEdit ? (
          // Veritabanı bağlanana kadar kapalı.
          <div className="actions">
            <button className="btn secondary" disabled title={t('locations.needsDatabase')}>{t('locations.importButton')}</button>
            <button className="btn" disabled title={t('locations.needsDatabase')}>{t('locations.editButton')}</button>
          </div>
        ) : null}
      </header>

      <p className="note">{canEdit ? t('locations.needsDatabase') : t('locations.readOnly')}</p>

      <div className="toolbar">
        <label className="sr-only" htmlFor="loc-search">{t('locations.search')}</label>
        <input id="loc-search" type="search" placeholder={`${t('locations.search')}: ${t(`locations.${level}`)}`} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {body}

      <p className="meta">
        {t('locations.source')}: {LOCATION_DATA_SOURCE} · {t('locations.updated')}: {new Date(LOCATION_DATA_VERSION).toLocaleDateString('tr-TR')}
      </p>
    </section>
  );
}

function Table({ head, count, children }: { head: string[]; count: number; children: React.ReactNode }) {
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">{t('locations.total', { count })}</caption>
        <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{count ? children : <tr><td colSpan={head.length} className="state">{t('locations.empty')}</td></tr>}</tbody>
      </table>
      <p className="count">{t('locations.total', { count })}</p>
    </div>
  );
}
