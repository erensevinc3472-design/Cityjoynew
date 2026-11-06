import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { cleanPushTarget, validatePushTarget, type AudienceFilter, type Occupation } from '@cityjoy/shared';
import { createFirestoreOccupationRepository } from '@cityjoy/shared/firebase';

import { firestore, functions } from '../lib/firebase';
import { t } from '../lib/t';

type Region = { provinceCode?: string; districtId?: string; neighbourhoodId?: string };
const cleanRegion = (r: Region) => Object.fromEntries(Object.entries(r).filter(([, v]) => !!v)) as Region;

let occupationCache: Occupation[] | null = null;

/**
 * Hedefli bildirim (PROJE.md 7; Karar Eren 5 Kasım: yalnızca bildirimi daraltır). Bölge duyurunun bölgesidir; yaş,
 * cinsiyet ve meslek isteğe bağlı. "Kaç kişiye ulaşır?" sunucuda sayılır (Blaze), panele kişi bilgisi gelmez.
 */
export function AudienceFields({ publisherKey, region, value, onChange, commercial = false }: {
  publisherKey: string; region: Region; value?: AudienceFilter; onChange: (v: AudienceFilter | undefined) => void;
  /** Kampanya / reklam: yalnızca kampanya izni veren 18+ sayılır. */
  commercial?: boolean;
}) {
  const [group, setGroup] = useState(!!value);
  const [occupations, setOccupations] = useState<Occupation[]>(occupationCache ?? []);
  const [estimate, setEstimate] = useState<{ state: 'idle' | 'busy' | 'ok' | 'small' | 'error'; n?: number }>({ state: 'idle' });
  const f = value ?? {};
  useEffect(() => {
    if (!group || occupationCache) return;
    createFirestoreOccupationRepository(firestore).listActive().then((l) => { occupationCache = l; setOccupations(l); }, () => setOccupations([]));
  }, [group]);
  useEffect(() => setEstimate({ state: 'idle' }), [value, region, commercial]);
  const patch = (p: Partial<AudienceFilter>) => onChange({ ...f, ...p });
  const num = (v: string) => (v === '' ? undefined : Math.round(Number(v)));
  const toggle = <T extends string>(list: T[] | undefined, x: T, on: boolean) => (on ? [...(list ?? []), x] : (list ?? []).filter((y) => y !== x));
  const invalid = validatePushTarget(f).length > 0;

  const ask = async () => {
    setEstimate({ state: 'busy' });
    try {
      const r = await httpsCallable<unknown, { tooSmall: boolean; approx: number }>(functions, 'estimateAudience')({ publisherKey, region: cleanRegion(region), target: group ? cleanPushTarget(f) : null, commercial });
      setEstimate(r.data.tooSmall ? { state: 'small' } : { state: 'ok', n: r.data.approx });
    } catch {
      setEstimate({ state: 'error' });
    }
  };

  return (
    <fieldset className="checkbox-group form-section audience">
      <legend>{t('announcements.target2.title')}</legend>
      <label>
        <input type="radio" name="an-aud" checked={!group} onChange={() => { setGroup(false); onChange(undefined); }} />
        {t('announcements.target2.everyone')}
      </label>
      <label>
        <input type="radio" name="an-aud" checked={group} onChange={() => setGroup(true)} />
        {t('announcements.target2.group')}
      </label>
      {group ? (
        <div className="audience-box">
          <div className="audience-row">
            <div className="field">
              <label htmlFor="aud-min">{t('announcements.target2.ageMin')}</label>
              <input id="aud-min" type="number" min={13} max={120} inputMode="numeric" value={f.ageMin ?? ''} onChange={(e) => patch({ ageMin: num(e.target.value) })} />
            </div>
            <div className="field">
              <label htmlFor="aud-max">{t('announcements.target2.ageMax')}</label>
              <input id="aud-max" type="number" min={13} max={120} inputMode="numeric" value={f.ageMax ?? ''} onChange={(e) => patch({ ageMax: num(e.target.value) })} />
            </div>
            <fieldset className="checkbox-group">
              <legend>{t('announcements.target2.gender')}</legend>
              {(['kadin', 'erkek'] as const).map((g) => (
                <label key={g}>
                  <input type="checkbox" checked={!!f.genders?.includes(g)} onChange={(e) => patch({ genders: toggle(f.genders, g, e.target.checked) })} />
                  {t(`announcements.target2.g.${g}`)}
                </label>
              ))}
            </fieldset>
          </div>
          {invalid ? <span className="error" role="alert">{t('announcements.target2.invalid')}</span> : null}
          <fieldset className="checkbox-group">
            <legend>{t('announcements.target2.occupations')} <small className="meta">{t('announcements.target2.occHint')}</small></legend>
            <div className="occ-list">
              {occupations.map((o) => (
                <label key={o.id}>
                  <input type="checkbox" checked={!!f.occupations?.includes(o.id)} disabled={!f.occupations?.includes(o.id) && (f.occupations?.length ?? 0) >= 10} onChange={(e) => patch({ occupations: toggle(f.occupations, o.id, e.target.checked) })} />
                  {o.names.tr}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}
      <div className="audience-estimate">
        <button type="button" className="btn secondary" disabled={estimate.state === 'busy' || invalid} onClick={ask}>{t('announcements.target2.ask')}</button>
        <span role="status">
          {estimate.state === 'ok' ? t('announcements.target2.approx', { count: (estimate.n ?? 0).toLocaleString('tr-TR') })
            : estimate.state === 'small' ? t('announcements.target2.small')
            : estimate.state === 'error' ? t('announcements.target2.noServer')
            : estimate.state === 'busy' ? t('profile.loading') : ''}
        </span>
      </div>
      <p className="meta">{t(commercial ? 'announcements.target2.noteCommercial' : 'announcements.target2.note')}</p>
    </fieldset>
  );
}
