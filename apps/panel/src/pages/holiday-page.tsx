import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HOLIDAY_CURATION_LIMITS,
  HOLIDAY_THEMES,
  holidayPlaces,
  TRAVEL_COUNTRIES,
  type Business,
  type HolidayCuration,
  type HolidayPlaceCuration,
  type HolidayTheme,
} from '@cityjoy/shared';
import { createHolidayAdmin, createHolidayRepository, readOpenCountries } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { locationRepository as repo } from '../lib/locations';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';
import { Intro } from '../components/intro';

type Message = { kind: 'ok' | 'error'; text: string };

/**
 * Panel > Seyahat > Tatil fikirleri (yalnızca admin; PROJE.md 5.2). Uygulamadaki Planla ekranı: her tatil fikrinin
 * yerleri, o temayla etiketlenmiş doğrulanmış tesislerden kendiliğinden çıkar. Ekip burada sırayı, sezonu ve kısa notu
 * düzenler, uymayan yeri gizler, yanlış etiketlenen tesisin etiketini kaldırır. Altta yurt dışı ülkeler açılır.
 * Her kayıt işlem kaydına geçer.
 */
export function HolidayPage() {
  const { user } = useSession();
  const admin = isAdminUser(user);
  const editable = admin && !!user && !user.isDemo;
  const reader = useMemo(() => createHolidayRepository(firestore), []);
  const service = useMemo(() => (user ? createHolidayAdmin(firestore, user.uid) : null), [user]);
  const [theme, setTheme] = useState<HolidayTheme>('deniz');
  const [stays, setStays] = useState<Business[]>();
  const [curation, setCuration] = useState<HolidayCuration>({});
  const [message, setMessage] = useState<Message>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setStays(undefined);
    setMessage(undefined);
    Promise.all([reader.listByTheme(theme), reader.curation(theme)])
      .then(([list, cur]) => {
        setStays(list);
        setCuration(cur);
      })
      .catch(() => setMessage({ kind: 'error', text: t('holiday.loadError') }));
  }, [reader, theme]);
  useEffect(() => load(), [load]);

  // Gizlenenler de görünsün diye yerler düzenlemesiz hesaplanır, düzenleme üstüne yazılır.
  const places = useMemo(() => {
    const all = holidayPlaces(stays ?? []);
    return all.sort((a, b) => (curation[a.provinceCode]?.rank ?? 999) - (curation[b.provinceCode]?.rank ?? 999) || b.count - a.count);
  }, [stays, curation]);

  const edit = (code: string, patch: Partial<HolidayPlaceCuration>) => setCuration((c) => ({ ...c, [code]: { ...c[code], ...patch } }));

  const save = async () => {
    if (!service || !editable) return;
    const clean: HolidayCuration = {};
    for (const [code, v] of Object.entries(curation)) {
      const item: HolidayPlaceCuration = {};
      if (v.rank !== undefined && Number.isFinite(v.rank) && v.rank > 0) item.rank = Math.round(v.rank);
      if (v.hidden) item.hidden = true;
      const season = v.season?.trim().slice(0, HOLIDAY_CURATION_LIMITS.season);
      if (season) item.season = season;
      const note = v.note?.trim().slice(0, HOLIDAY_CURATION_LIMITS.note);
      if (note) item.note = note;
      if (Object.keys(item).length) clean[code] = item;
    }
    setBusy(true);
    try {
      await service.saveCuration(theme, clean);
      setCuration(clean);
      setMessage({ kind: 'ok', text: t('holiday.saved') });
    } catch {
      setMessage({ kind: 'error', text: t('holiday.saveError') });
    } finally {
      setBusy(false);
    }
  };

  const removeTag = async (b: Business) => {
    if (!service || !editable || !window.confirm(t('holiday.removeConfirm', { name: b.name }))) return;
    try {
      await service.removeTheme(b, theme);
      setStays((list) => list?.filter((x) => x.id !== b.id));
      setMessage({ kind: 'ok', text: t('holiday.removed') });
    } catch {
      setMessage({ kind: 'error', text: t('holiday.saveError') });
    }
  };

  if (!admin) return <section className="page"><p className="note">{t('holiday.adminOnly')}</p></section>;

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('holiday.title')}</h1>
          <Intro text={t('holiday.intro')} />
        </div>
      </header>

      <div className="card">
        <div className="field">
          <label htmlFor="holiday-theme">{t('holiday.theme')}</label>
          <select id="holiday-theme" value={theme} onChange={(e) => setTheme(e.target.value as HolidayTheme)}>
            {HOLIDAY_THEMES.map((x) => (
              <option key={x.id} value={x.id}>{t(`holiday.themes.${x.id}`)}</option>
            ))}
          </select>
        </div>
        {message ? <p className={message.kind === 'ok' ? 'note' : 'error'} role="status">{message.text}</p> : null}
      </div>

      <div className="card">
        <h2 className="card-title">{t('holiday.places')}</h2>
        <p className="meta">{t('holiday.placesIntro')}</p>
        {!stays ? (
          <p className="state">{t('holiday.loading')}</p>
        ) : !places.length ? (
          <p className="state">{t('holiday.noPlaces')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('holiday.province')}</th>
                  <th>{t('holiday.count')}</th>
                  <th>{t('holiday.rank')}</th>
                  <th>{t('holiday.season')}</th>
                  <th>{t('holiday.note')}</th>
                  <th>{t('holiday.hidden')}</th>
                </tr>
              </thead>
              <tbody>
                {places.map((p) => {
                  const cur = curation[p.provinceCode] ?? {};
                  return (
                    <tr key={p.provinceCode}>
                      <td>{repo.getProvince(p.provinceCode)?.name ?? p.provinceCode}</td>
                      <td>{p.count}</td>
                      <td>
                        <input aria-label={t('holiday.rank')} type="number" min={1} style={{ width: 64 }} disabled={!editable} value={cur.rank ?? ''} onChange={(e) => edit(p.provinceCode, { rank: e.target.value ? Number(e.target.value) : undefined })} />
                      </td>
                      <td>
                        <input aria-label={t('holiday.season')} maxLength={HOLIDAY_CURATION_LIMITS.season} placeholder={t('holiday.seasonHint')} disabled={!editable} value={cur.season ?? ''} onChange={(e) => edit(p.provinceCode, { season: e.target.value })} />
                      </td>
                      <td>
                        <input aria-label={t('holiday.note')} maxLength={HOLIDAY_CURATION_LIMITS.note} disabled={!editable} value={cur.note ?? ''} onChange={(e) => edit(p.provinceCode, { note: e.target.value })} />
                      </td>
                      <td>
                        <input aria-label={t('holiday.hidden')} type="checkbox" disabled={!editable} checked={!!cur.hidden} onChange={(e) => edit(p.provinceCode, { hidden: e.target.checked })} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="row-actions">
          <button className="btn" type="button" disabled={!editable || busy || !stays} onClick={save}>{busy ? t('holiday.saving') : t('holiday.save')}</button>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">{t('holiday.stays')}</h2>
        <p className="meta">{t('holiday.staysIntro')}</p>
        {stays?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('holiday.stay')}</th>
                  <th>{t('holiday.province')}</th>
                  <th>{t('holiday.license')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {stays.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td>{repo.getProvince(b.location.provinceCode)?.name ?? b.location.provinceCode}</td>
                    <td>{b.lodging?.licenseNo ?? '–'}</td>
                    <td>
                      <button className="btn secondary" type="button" disabled={!editable} onClick={() => removeTag(b)}>{t('holiday.removeTag')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : stays ? (
          <p className="state">{t('holiday.noPlaces')}</p>
        ) : null}
      </div>

      <CountriesCard editable={editable} service={service} />
    </section>
  );
}

/** Yurt dışı ülkeler: içeriği hazır olan açılır, açılmayan uygulamada "yakında" görünür. Türkiye hep açıktır. */
function CountriesCard({ editable, service }: { editable: boolean; service: ReturnType<typeof createHolidayAdmin> | null }) {
  const [open, setOpen] = useState<string[]>();
  const [message, setMessage] = useState<Message>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    readOpenCountries(firestore).then(
      (v) => setOpen(v ?? TRAVEL_COUNTRIES.filter((c) => c.open && c.code !== 'TR').map((c) => c.code)),
      () => setMessage({ kind: 'error', text: t('holiday.loadError') }),
    );
  }, []);

  const toggle = (code: string, on: boolean) => setOpen((o) => (on ? [...(o ?? []), code] : (o ?? []).filter((x) => x !== code)));

  const save = async () => {
    if (!service || !editable || !open) return;
    setBusy(true);
    try {
      await service.saveOpenCountries(open);
      setMessage({ kind: 'ok', text: t('holiday.saved') });
    } catch {
      setMessage({ kind: 'error', text: t('holiday.saveError') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">{t('holiday.countries')}</h2>
      <p className="meta">{t('holiday.countriesIntro')}</p>
      {!open ? (
        <p className="state">{message?.text ?? t('holiday.loading')}</p>
      ) : (
        <>
          {TRAVEL_COUNTRIES.filter((c) => c.code !== 'TR').map((c) => (
            <label key={c.code} className="check">
              <input type="checkbox" disabled={!editable} checked={open.includes(c.code)} onChange={(e) => toggle(c.code, e.target.checked)} />
              {c.flag} {t(`holiday.country.${c.code}`)}
            </label>
          ))}
          {message ? <p className={message.kind === 'ok' ? 'note' : 'error'} role="status">{message.text}</p> : null}
          <div className="row-actions">
            <button className="btn" type="button" disabled={!editable || busy} onClick={save}>{busy ? t('holiday.saving') : t('holiday.saveCountries')}</button>
          </div>
        </>
      )}
    </div>
  );
}
