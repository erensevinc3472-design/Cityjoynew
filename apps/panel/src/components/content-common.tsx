import { useEffect, useState } from 'react';
import type { AnnouncementAuthor, AnnouncementRegion, Neighbourhood, Publisher } from '@cityjoy/shared';

import { locationRepository as repo } from '../lib/locations';
import { t } from '../lib/t';

/** Duyuru ve etkinlik sayfalarının ortak parçaları: yayınlayan adı, bölge adı, bölge seçici, tarih biçimleri. */

export const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
export const dateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '');

type WithRegion = { region: AnnouncementRegion };

/** Yayınlayanın adı: kurum adı; muhtarlık ve il yöneticisinde bölgeden. */
export function authorLabel(a: WithRegion & { author: AnnouncementAuthor }, neighbourhoodName?: string) {
  if (a.author.type === 'kurum') return a.author.name;
  if (a.author.role === 'muhtar') return t('announcements.muhtarOf', { place: neighbourhoodName ?? a.region.neighbourhoodId ?? '' });
  return t('announcements.cityjoyOf', { place: repo.getProvince(a.region.provinceCode)?.name ?? a.region.provinceCode });
}

export function regionLabel(r: AnnouncementRegion, neighbourhoodName?: string) {
  const parts = [neighbourhoodName, r.districtId ? repo.getDistrict(r.districtId)?.name : null, repo.getProvince(r.provinceCode)?.name].filter(Boolean);
  return r.districtId ? parts.join(', ') : t('announcements.wholeProvince', { place: parts.join(', ') });
}

/** Yayınlayan hesabın bölgesi, içerik bölgesi biçiminde. */
export function scopeRegion(p: Publisher): AnnouncementRegion {
  const sc = p.scope;
  return sc.level === 'ulke'
    ? { provinceCode: '' }
    : { provinceCode: sc.provinceCode, ...(sc.level !== 'il' ? { districtId: sc.districtId } : {}), ...(sc.level === 'mahalle' ? { neighbourhoodId: sc.neighbourhoodId } : {}) };
}

/** Mahalle adları ilçe başına bir kez indirilir. */
export function useNeighbourhoodNames(list: WithRegion[]) {
  const [names, setNames] = useState<Record<string, string>>({});
  const districts = [...new Set(list.flatMap((a) => (a.region.neighbourhoodId && a.region.districtId ? [a.region.districtId] : [])))].sort().join();
  useEffect(() => {
    if (!districts) return;
    Promise.all(districts.split(',').map((d) => repo.getNeighbourhoods(d).catch(() => [] as Neighbourhood[]))).then((all) =>
      setNames(Object.fromEntries(all.flat().map((n) => [n.id, n.name]))),
    );
  }, [districts]);
  return (a: WithRegion) => (a.region.neighbourhoodId ? names[a.region.neighbourhoodId] : undefined);
}

type Level = 'il' | 'ilce' | 'mahalle';

/** Seçilen bölge eksiksiz mi (ilçe / mahalle düzeyinde seçim yapılmış mı)? */
export function regionComplete(r: AnnouncementRegion) {
  return (r.districtId === undefined || !!r.districtId) && (r.neighbourhoodId === undefined || !!r.neighbourhoodId);
}

/** Boş seçimleri atılmış bölge. */
export function cleanRegion(r: AnnouncementRegion): AnnouncementRegion {
  return { provinceCode: r.provinceCode, ...(r.districtId ? { districtId: r.districtId } : {}), ...(r.districtId && r.neighbourhoodId ? { neighbourhoodId: r.neighbourhoodId } : {}) };
}

/** Hedef bölge seçici: yayınlayanın bölgesinden geniş düzey seçilemez. */
export function RegionFields({ idPrefix, publisher, region, onChange }: { idPrefix: string; publisher: Publisher; region: AnnouncementRegion; onChange(r: AnnouncementRegion): void }) {
  const sc = publisher.scope;
  const r = region;
  const [neighbourhoods, setNeighbourhoods] = useState<Neighbourhood[] | null>(null);
  const level: Level = r.neighbourhoodId !== undefined ? 'mahalle' : r.districtId !== undefined ? 'ilce' : 'il';
  const levels: Level[] = sc.level === 'mahalle' ? ['mahalle'] : sc.level === 'ilce' ? ['ilce', 'mahalle'] : ['il', 'ilce', 'mahalle'];

  useEffect(() => {
    setNeighbourhoods(null);
    if (level === 'mahalle' && r.districtId) repo.getNeighbourhoods(r.districtId).then(setNeighbourhoods, () => setNeighbourhoods([]));
  }, [level, r.districtId]);

  const changeLevel = (l: Level) => {
    const base = { provinceCode: r.provinceCode };
    const districtId = sc.level === 'ilce' || sc.level === 'mahalle' ? sc.districtId : (r.districtId ?? '');
    onChange(l === 'il' ? base : l === 'ilce' ? { ...base, districtId } : { ...base, districtId, neighbourhoodId: sc.level === 'mahalle' ? sc.neighbourhoodId : '' });
  };

  return (
    <>
      <div className="field">
        <label htmlFor={`${idPrefix}-level`}>{t('announcements.level')}</label>
        <select id={`${idPrefix}-level`} value={level} disabled={levels.length === 1} onChange={(e) => changeLevel(e.target.value as Level)}>
          {levels.map((l) => (
            <option key={l} value={l}>{t(`announcements.levels.${l}`)}</option>
          ))}
        </select>
      </div>
      {level !== 'il' ? (
        <div className="field">
          <label htmlFor={`${idPrefix}-district`}>{t('announcements.district')}</label>
          <select
            id={`${idPrefix}-district`}
            value={r.districtId ?? ''}
            disabled={sc.level !== 'il' && sc.level !== 'ulke'}
            onChange={(e) => onChange({ provinceCode: r.provinceCode, districtId: e.target.value, ...(level === 'mahalle' ? { neighbourhoodId: '' } : {}) })}>
            <option value="">{t('announcements.choose')}</option>
            {repo.getDistricts(r.provinceCode).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      ) : null}
      {level === 'mahalle' && r.districtId ? (
        <div className="field">
          <label htmlFor={`${idPrefix}-neighbourhood`}>{t('announcements.neighbourhood')}</label>
          <select id={`${idPrefix}-neighbourhood`} value={r.neighbourhoodId ?? ''} disabled={sc.level === 'mahalle' || !neighbourhoods} onChange={(e) => onChange({ ...r, neighbourhoodId: e.target.value })}>
            <option value="">{neighbourhoods ? t('announcements.choose') : t('announcements.loading')}</option>
            {(neighbourhoods ?? []).map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </div>
      ) : null}
    </>
  );
}
