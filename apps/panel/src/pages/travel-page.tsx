import { useCallback, useEffect, useState, type FormEvent } from 'react';
import readXlsxFile from 'read-excel-file/browser';
import { Link } from 'react-router';
import {
  can,
  NEARBY_KINDS,
  parseTravelWorkbook,
  TR_REGIONS,
  TRAVEL_CATEGORIES,
  TRAVEL_MODES,
  validateTravelPlace,
  validateTravelText,
  type NearbyKind,
  type TravelCategory,
  type TravelCityContent,
  type Photo,
  type TravelFact,
  type TravelMode,
  type TravelPlace,
  type TravelPlaceInput,
  type TravelRegionContent,
  type TravelReviewStatus,
  type TravelStatus,
} from '@cityjoy/shared';
import { createTravelAdmin, type TravelAdminKind } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { locationRepository } from '../lib/locations';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';
import { ImageField } from '../components/image-field';
import { TourEditor } from '../components/tour-editor';
import { PlacePlanFields } from '../components/place-plan-fields';
import { GripIcon, SortBar, useSortableList } from '../components/sortable';
import { FramesTab, LocalTab, MunicipalTab, MunicipalTravelPage, RoutesTab, StatusPill } from './travel-extra';
import { Intro } from '../components/intro';

type Tab = TravelAdminKind | 'kareler';
type Data = Awaited<ReturnType<ReturnType<typeof createTravelAdmin>['listAll']>>;
const TABS: Tab[] = ['bolge', 'sehir', 'yer', 'rota', 'yoresel', 'belediye', 'kareler'];
type RegionDraft = { id: string; tagline: string; description: string; videoUrl: string; cover?: Photo; isNew: boolean; status: TravelStatus };
type CityDraft = { id: string; regionId: string; tagline: string; description: string; videoUrl: string; cover?: Photo; categories: TravelCategory[]; highlights: string; facts: string; isNew: boolean; status: TravelStatus };
type PlaceDraft = Omit<TravelPlaceInput, 'howToGet' | 'nearby' | 'tips' | 'bring' | 'rules'> & { id: string | null; howToGet: string; nearby: string; tips: string; bring: string; rules: string };

const provinceName = (code: string) => locationRepository.getProvince(code)?.name ?? code;
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
/** "otobus: Heykel durağında inin" biçimindeki satırlar. */
const pairs = <K extends string>(s: string, keys: readonly K[]) =>
  lines(s)
    .map((l) => {
      const i = l.indexOf(':');
      const k = l.slice(0, i).trim() as K;
      return i > 0 && keys.includes(k) ? { k, text: l.slice(i + 1).trim() } : null;
    })
    .filter((x): x is { k: K; text: string } => !!x && !!x.text);

/**
 * Seyahat > Keşfet ve Öğren içeriği (admin, ülke geneli; PROJE.md 5.2). Bölge ve şehir tanıtımları, gezilecek yerler,
 * hazır rotalar, yöresel, Başkanlarla Keşif (belediye tanıtımları). Her içerik önce taslak kaydedilir; doğruluğu kontrol
 * edilince yayına alınır. Uygulama yalnızca yayındakini gösterir. Belediye personeli bu sayfada yalnızca kendi
 * tanıtımını ve rotalarını görür (MunicipalTravelPage).
 */
export function TravelPage() {
  const { user } = useSession();
  const isAdmin = !!user?.grants.some((g) => g.role === 'admin');
  if (user && !isAdmin && user.memberships.some(({ org }) => org.modules.includes('seyahat'))) return <MunicipalTravelPage user={user} />;
  return <AdminTravelPage />;
}

function AdminTravelPage() {
  const { user } = useSession();
  const canEdit = !!user && !user.isDemo && can(user.grants, { module: 'seyahat', action: 'duzenle' });
  const admin = user ? createTravelAdmin(firestore, user.uid) : null;
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<Tab>('bolge');
  const [regionId, setRegionId] = useState('marmara');
  const [cityId, setCityId] = useState('16');
  const [regionDraft, setRegionDraft] = useState<RegionDraft | null>(null);
  const [cityDraft, setCityDraft] = useState<CityDraft | null>(null);
  const [placeDraft, setPlaceDraft] = useState<PlaceDraft | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setData(user?.isDemo ? { regions: [], cities: [], places: [], routes: [], local: [], municipal: [] } : await createTravelAdmin(firestore, 'okuma').listAll());
    } catch {
      setLoadError(true);
    }
  }, [user]);
  useEffect(() => {
    load();
  }, [load]);

  // Yalnızca geliştirme bilgisayarında görünür (bkz. lib/tour-import).
  const importTours = async () => {
    if (!user || !window.confirm('Emülatördeki Bursa gezileri ve pratik bilgileri yayındaki uygulamaya aktarılsın mı?')) return;
    setBusy(true);
    try {
      const { importEmulatorTours } = await import('../lib/tour-import');
      setMessage({ kind: 'ok', text: await importEmulatorTours(user.uid, '16', (text) => setMessage({ kind: 'ok', text })) });
      await load();
    } catch (e) {
      setMessage({ kind: 'error', text: `Aktarma durdu: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn: () => Promise<string>, after?: () => void) => {
    setBusy(true);
    setMessage(undefined);
    try {
      setMessage({ kind: 'ok', text: await fn() });
      after?.();
      await load();
    } catch {
      setMessage({ kind: 'error', text: t('travel.error') });
    } finally {
      setBusy(false);
    }
  };
  /** Excel'den toplu yükleme: önce denetlenir, özet onaylanınca taslak olarak eklenir / güncellenir. */
  const importExcel = async (file: File) => {
    setMessage(undefined);
    let parsed: ReturnType<typeof parseTravelWorkbook>;
    try {
      const sheets = (await readXlsxFile(file)) as { sheet: string; data: unknown[][] }[];
      const provinces = locationRepository.getProvinces();
      parsed = parseTravelWorkbook(sheets, { provinces, districts: provinces.flatMap((p) => locationRepository.getDistricts(p.code)) });
    } catch {
      return setMessage({ kind: 'error', text: t('travel.excel.readError') });
    }
    const { regions, cities, places, errors } = parsed;
    const errText = errors.slice(0, 8).map((e) => `${e.sheet} ${e.row}: ${e.message}`).join('\n');
    if (!regions.length && !cities.length && !places.length) return setMessage({ kind: 'error', text: t('travel.excel.empty') + (errText ? '\n' + errText : '') });
    const summary = t('travel.excel.confirm', { regions: regions.length, cities: cities.length, places: places.length, errors: errors.length });
    if (!window.confirm(summary + (errText ? '\n\n' + errText : ''))) return;
    await act(async () => {
      const r = await admin!.importContent({ regions, cities, places });
      return t('travel.excel.done', { added: r.added, updated: r.updated, errors: errors.length });
    });
  };
  const statusPill = (s?: TravelReviewStatus) => <StatusPill status={s} />;
  const toggle = (kind: TravelAdminKind, id: string, s: TravelReviewStatus, label: string) =>
    canEdit ? (
      <button className="link" disabled={busy} onClick={() => act(async () => (await admin!.setStatus(kind, id, s === 'yayinda' ? 'taslak' : 'yayinda', label), t(s === 'yayinda' ? 'travel.unpublished' : 'travel.published')))}>
        {s === 'yayinda' ? t('travel.unpublish') : t('travel.publish')}
      </button>
    ) : null;

  const saveRegion = (e: FormEvent) => {
    e.preventDefault();
    const d = regionDraft!;
    const errs = validateTravelText({ tagline: d.tagline, description: d.description, videoUrl: d.videoUrl || undefined });
    if (errs.length) return setMessage({ kind: 'error', text: t(`travel.errors.${errs[0]}`) });
    act(async () => {
      await admin!.saveRegion({ id: d.id, tagline: d.tagline, description: d.description, ...(d.videoUrl.trim() ? { videoUrl: d.videoUrl } : {}), ...(d.cover ? { cover: d.cover } : {}), status: d.status }, d.isNew);
      return t('travel.saved');
    }, () => setRegionDraft(null));
  };

  const saveCity = (e: FormEvent) => {
    e.preventDefault();
    const d = cityDraft!;
    const errs = validateTravelText({ tagline: d.tagline, description: d.description, videoUrl: d.videoUrl || undefined });
    if (errs.length) return setMessage({ kind: 'error', text: t(`travel.errors.${errs[0]}`) });
    const facts: TravelFact[] = lines(d.facts)
      .slice(0, 8)
      .map((l) => {
        const [label, value, source, asOf] = l.split('|').map((x) => x.trim());
        return { label, value, ...(source ? { source } : {}), ...(asOf ? { asOf } : {}) };
      })
      .filter((f) => f.label && f.value);
    act(async () => {
      await admin!.saveCity(
        {
          id: d.id,
          regionId: d.regionId,
          tagline: d.tagline,
          description: d.description,
          categories: d.categories,
          highlights: d.highlights.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 6),
          facts,
          ...(d.videoUrl.trim() ? { videoUrl: d.videoUrl } : {}),
          ...(d.cover ? { cover: d.cover } : {}),
          status: d.status,
        },
        d.isNew,
      );
      return t('travel.saved');
    }, () => setCityDraft(null));
  };

  const savePlace = (e: FormEvent) => {
    e.preventDefault();
    const { id, howToGet, nearby, tips, bring, rules, ...rest } = placeDraft!;
    const input: TravelPlaceInput = {
      ...rest,
      howToGet: pairs<TravelMode>(howToGet, TRAVEL_MODES).map((x) => ({ mode: x.k, text: x.text })),
      nearby: pairs<NearbyKind>(nearby, NEARBY_KINDS).map((x) => ({ kind: x.k, text: x.text })),
      tips: lines(tips),
      bring: lines(bring),
      rules: lines(rules),
    };
    const errs = validateTravelPlace(input);
    if (errs.length) return setMessage({ kind: 'error', text: t(`travel.errors.${errs[0]}`) });
    act(async () => {
      await admin!.savePlace(id, input);
      return t('travel.saved');
    }, () => setPlaceDraft(null));
  };

  const editPlace = (p?: TravelPlace) =>
    setPlaceDraft(
      p
        ? {
            ...p,
            id: p.id,
            howToGet: p.howToGet.map((s) => `${s.mode}: ${s.text}`).join('\n'),
            nearby: p.nearby.map((s) => `${s.kind}: ${s.text}`).join('\n'),
            tips: p.tips.join('\n'),
            bring: (p.bring ?? []).join('\n'),
            rules: (p.rules ?? []).join('\n'),
          }
        : {
            id: null,
            cityId,
            name: '',
            kind: '',
            category: 'tarih',
            summary: '',
            about: '',
            howToGet: '',
            nearby: '',
            tips: '',
            bring: '',
            rules: '',
            mustSee: false,
            order: (data?.places.filter((x) => x.cityId === cityId).length ?? 0) + 1,
            status: 'taslak',
          },
    );

  const field = (id: string, label: string, value: string, onChange: (v: string) => void, opts: { multiline?: boolean; max?: number; hint?: string; rows?: number } = {}) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {opts.multiline ? (
        <textarea id={id} rows={opts.rows ?? 4} maxLength={opts.max} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} maxLength={opts.max} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {opts.hint ? <p className="meta">{opts.hint}</p> : null}
    </div>
  );
  const P = placeDraft;
  const setP = (patch: Partial<PlaceDraft>) => setPlaceDraft((d) => (d ? { ...d, ...patch } : d));

  const regionCities = TR_REGIONS.find((r) => r.id === regionId)?.provinceCodes ?? [];
  const allProvinces = TR_REGIONS.flatMap((r) => r.provinceCodes).sort((a, b) => provinceName(a).localeCompare(provinceName(b), 'tr'));
  const cityPlaces = (data?.places ?? []).filter((p) => p.cityId === cityId);
  const placeSort = useSortableList(cityPlaces);
  const onError = (text: string) => setMessage({ kind: 'error', text });
  const citySelect = (
    <div className="field">
      <label htmlFor="t-city2">{t('travel.city')}</label>
      <select id="t-city2" value={cityId} onChange={(e) => setCityId(e.target.value)}>
        {allProvinces.map((p) => (
          <option key={p} value={p}>{provinceName(p)}</option>
        ))}
      </select>
    </div>
  );

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('travel.title')}</h1>
          <Intro text={t('travel.intro')} />
        </div>
        {canEdit || isAdminUser(user) ? (
          <div className="actions">
            {isAdminUser(user) ? <Link className="btn secondary" to="/yolculuk-fiyatlari">{t('prices.title')}</Link> : null}
            {canEdit ? <a className="btn secondary" href="./seyahat-sablon.xlsx" download>{t('travel.excel.template')}</a> : null}
            {canEdit ? (
              <label className="btn secondary">
                {t('travel.excel.upload')}
                <input type="file" accept=".xlsx" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importExcel(f); }} />
              </label>
            ) : null}
            {/* Ara > Yerler (Türkiye geneli, 13 Kasım 2026): eski yerlere arama anahtarı; yeni kayıtlarda kendiliğinden. */}
            {canEdit ? <button className="btn secondary" disabled={busy} onClick={() => act(async () => t('travel.searchIndexed', { count: await admin!.reindexPlaceSearch() }))}>
              {t('travel.searchIndex')}
            </button> : null}
            {import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATOR !== '1' && isAdminUser(user) && !user!.isDemo ? (
              <button className="btn" disabled={busy} onClick={importTours}>Gezileri ve pratik bilgileri yayına aktar (Bursa)</button>
            ) : null}
          </div>
        ) : null}
      </header>
      {!canEdit ? <p className="note">{t('travel.readOnly')}</p> : null}
      <p className="note">{t('travel.verifyNote')}</p>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      <div className="tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x} role="tab" aria-selected={tab === x} className={tab === x ? 'btn' : 'btn ghost'} onClick={() => setTab(x)}>
            {t(`travel.tabs.${x}`)}
          </button>
        ))}
      </div>

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('travel.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('travel.retry')}</button>
        </div>
      ) : data === null ? (
        <div className="state" aria-live="polite">{t('travel.loading')}</div>
      ) : tab === 'bolge' ? (
        <>
          {regionDraft ? (
            <form className="form panel-form" onSubmit={saveRegion}>
              <h2 className="form-section">{t(`travel.regions.${regionDraft.id}`)}</h2>
              {field('r-tag', t('travel.tagline'), regionDraft.tagline, (v) => setRegionDraft({ ...regionDraft, tagline: v }), { max: 60 })}
              {field('r-desc', t('travel.description'), regionDraft.description, (v) => setRegionDraft({ ...regionDraft, description: v }), { multiline: true, max: 600 })}
              {field('r-video', t('travel.videoUrl'), regionDraft.videoUrl, (v) => setRegionDraft({ ...regionDraft, videoUrl: v }), { hint: t('travel.videoHint') })}
              {user ? <ImageField label={t('travel.cover')} hint={t('travel.coverHint')} kind="seyahat" uid={user.uid} value={regionDraft.cover} onChange={(cover) => setRegionDraft({ ...regionDraft, cover })} disabled={busy} /> : null}
              <div className="actions">
                <button className="btn" type="submit" disabled={busy}>{t('travel.save')}</button>
                <button className="btn ghost" type="button" onClick={() => setRegionDraft(null)}>{t('travel.cancel')}</button>
              </div>
            </form>
          ) : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('travel.region')}</th>
                  <th scope="col">{t('travel.statusLabel')}</th>
                  <th scope="col"><span className="sr-only">{t('travel.edit')}</span></th>
                </tr>
              </thead>
              <tbody>
                {TR_REGIONS.map((r) => {
                  const c = data.regions.find((x) => x.id === r.id);
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{t(`travel.regions.${r.id}`)}</strong>
                        <div className="meta">{c?.tagline || t('travel.provinces', { count: r.provinceCodes.length })}</div>
                      </td>
                      <td>{statusPill(c?.status)}</td>
                      <td className="row-actions">
                        {canEdit ? (
                          <button className="link" onClick={() => setRegionDraft({ id: r.id, tagline: c?.tagline ?? '', description: c?.description ?? '', videoUrl: c?.videoUrl ?? '', cover: c?.cover, isNew: !c, status: c?.status ?? 'taslak' })}>
                            {c ? t('travel.edit') : t('travel.write')}
                          </button>
                        ) : null}
                        {c ? toggle('bolge', r.id, c.status, t(`travel.regions.${r.id}`)) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : tab === 'sehir' ? (
        <>
          <div className="field">
            <label htmlFor="t-region">{t('travel.region')}</label>
            <select id="t-region" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
              {TR_REGIONS.map((r) => (
                <option key={r.id} value={r.id}>{t(`travel.regions.${r.id}`)}</option>
              ))}
            </select>
          </div>
          {cityDraft ? (
            <form className="form panel-form" onSubmit={saveCity}>
              <h2 className="form-section">{provinceName(cityDraft.id)}</h2>
              {field('c-tag', t('travel.tagline'), cityDraft.tagline, (v) => setCityDraft({ ...cityDraft, tagline: v }), { max: 60 })}
              {field('c-desc', t('travel.description'), cityDraft.description, (v) => setCityDraft({ ...cityDraft, description: v }), { multiline: true, max: 600 })}
              <fieldset className="field">
                <legend>{t('travel.categories')}</legend>
                {TRAVEL_CATEGORIES.map((k) => (
                  <label key={k} className="check">
                    <input
                      type="checkbox"
                      checked={cityDraft.categories.includes(k)}
                      onChange={(e) => setCityDraft({ ...cityDraft, categories: e.target.checked ? [...cityDraft.categories, k] : cityDraft.categories.filter((x) => x !== k) })}
                    />{' '}
                    {t(`travel.cats.${k}`)}
                  </label>
                ))}
              </fieldset>
              {field('c-hl', t('travel.highlights'), cityDraft.highlights, (v) => setCityDraft({ ...cityDraft, highlights: v }), { hint: t('travel.highlightsHint') })}
              {field('c-facts', t('travel.facts'), cityDraft.facts, (v) => setCityDraft({ ...cityDraft, facts: v }), { multiline: true, hint: t('travel.factsHint') })}
              {field('c-video', t('travel.videoUrl'), cityDraft.videoUrl, (v) => setCityDraft({ ...cityDraft, videoUrl: v }), { hint: t('travel.videoHint') })}
              {user ? <ImageField label={t('travel.cover')} hint={t('travel.coverHint')} kind="seyahat" uid={user.uid} value={cityDraft.cover} onChange={(cover) => setCityDraft({ ...cityDraft, cover })} disabled={busy} /> : null}
              <div className="actions">
                <button className="btn" type="submit" disabled={busy}>{t('travel.save')}</button>
                <button className="btn ghost" type="button" onClick={() => setCityDraft(null)}>{t('travel.cancel')}</button>
              </div>
            </form>
          ) : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('travel.city')}</th>
                  <th scope="col">{t('travel.statusLabel')}</th>
                  <th scope="col"><span className="sr-only">{t('travel.edit')}</span></th>
                </tr>
              </thead>
              <tbody>
                {regionCities.map((code) => {
                  const c = data.cities.find((x) => x.id === code);
                  const count = data.places.filter((p) => p.cityId === code).length;
                  return (
                    <tr key={code}>
                      <td>
                        <strong>{provinceName(code)}</strong>
                        <div className="meta">{[c?.tagline, t('travel.placeCount', { count })].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td>{statusPill(c?.status)}</td>
                      <td className="row-actions">
                        {canEdit ? (
                          <button
                            className="link"
                            onClick={() =>
                              setCityDraft({
                                id: code,
                                regionId,
                                tagline: c?.tagline ?? '',
                                description: c?.description ?? '',
                                videoUrl: c?.videoUrl ?? '',
                                cover: c?.cover,
                                categories: c?.categories ?? [],
                                highlights: (c?.highlights ?? []).join(', '),
                                facts: (c?.facts ?? []).map((f) => [f.label, f.value, f.source ?? '', f.asOf ?? ''].join(' | ')).join('\n'),
                                isNew: !c,
                                status: c?.status ?? 'taslak',
                              })
                            }>
                            {c ? t('travel.edit') : t('travel.write')}
                          </button>
                        ) : null}
                        {c ? toggle('sehir', code, c.status, provinceName(code)) : null}
                        <button className="link" onClick={() => { setCityId(code); setTab('yer'); }}>{t('travel.openPlaces')}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : tab !== 'yer' ? (
        <>
          {citySelect}
          {tab === 'rota' ? (
            <RoutesTab cityId={cityId} routes={data.routes} places={data.places} canEdit={canEdit} admin={admin} busy={busy} act={act} toggle={(id, s, label) => toggle('rota', id, s, label)} onError={onError} />
          ) : tab === 'yoresel' ? (
            <LocalTab cityId={cityId} items={data.local} canEdit={canEdit} admin={admin} busy={busy} act={act} toggle={(id, s, label) => toggle('yoresel', id, s, label)} onError={onError} />
          ) : tab === 'kareler' ? (
            <FramesTab cityId={cityId} canEdit={canEdit} busy={busy} act={act} />
          ) : (
            <MunicipalTab cityId={cityId} items={data.municipal} canEdit={canEdit} admin={admin} busy={busy} act={act} toggle={(id, s, label) => toggle('belediye', id, s, label)} onError={onError} />
          )}
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="t-city">{t('travel.city')}</label>
            <select id="t-city" value={cityId} onChange={(e) => setCityId(e.target.value)}>
              {allProvinces.map((p) => (
                <option key={p} value={p}>{provinceName(p)}</option>
              ))}
            </select>
          </div>
          {/* Şehir taslaktayken yerleri uygulamada açılamaz: yayına alan bunu atlamasın. */}
          {data && data.cities.find((x) => x.id === cityId)?.status !== 'yayinda' && cityPlaces.some((p) => p.status === 'yayinda') ? (
            <p className="pill warn" role="status">{t('travel.cityNotPublished', { city: provinceName(cityId) })}</p>
          ) : null}
          {canEdit && !P ? <button className="btn" onClick={() => editPlace()}>{t('travel.addPlace')}</button> : null}
          {P ? (
            <form className="form panel-form" onSubmit={savePlace}>
              <h2 className="form-section">{P.id ? P.name : t('travel.addPlace')}</h2>
              {field('p-name', t('travel.placeName'), P.name, (v) => setP({ name: v }), { max: 80 })}
              {field('p-kind', t('travel.kind'), P.kind, (v) => setP({ kind: v }), { max: 40, hint: t('travel.kindHint') })}
              <div className="field">
                <label htmlFor="p-cat">{t('travel.category')}</label>
                <select id="p-cat" value={P.category} onChange={(e) => setP({ category: e.target.value as TravelCategory })}>
                  {TRAVEL_CATEGORIES.map((k) => (
                    <option key={k} value={k}>{t(`travel.cats.${k}`)}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="p-district">{t('travel.district')}</label>
                <select id="p-district" value={P.districtId ?? ''} onChange={(e) => setP({ districtId: e.target.value || undefined })}>
                  <option value="">-</option>
                  {locationRepository.getDistricts(P.cityId).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              {field('p-sum', t('travel.summary'), P.summary, (v) => setP({ summary: v }), { multiline: true, max: 200, rows: 2 })}
              {field('p-about', t('travel.about'), P.about, (v) => setP({ about: v }), { multiline: true, max: 2000 })}
              {field('p-hours', t('travel.visitingHours'), P.visitingHours ?? '', (v) => setP({ visitingHours: v }), { max: 200 })}
              {field('p-fee', t('travel.entranceFee'), P.entranceFee ?? '', (v) => setP({ entranceFee: v }), { max: 200 })}
              {field('p-dur', t('travel.duration'), P.suggestedDuration ?? '', (v) => setP({ suggestedDuration: v }), { max: 200 })}
              {field('p-addr', t('travel.address'), P.address ?? '', (v) => setP({ address: v }), { max: 200 })}
              <PlacePlanFields key={P.id ?? 'yeni'} value={{ location: P.location, hours: P.hours, durationMinutes: P.durationMinutes }} onChange={setP} disabled={busy} />
              {field('p-how', t('travel.howToGet'), P.howToGet, (v) => setP({ howToGet: v }), { multiline: true, hint: t('travel.howHint', { modes: TRAVEL_MODES.join(', ') }) })}
              {field('p-near', t('travel.nearby'), P.nearby, (v) => setP({ nearby: v }), { multiline: true, hint: t('travel.nearbyHint', { kinds: NEARBY_KINDS.join(', ') }) })}
              {field('p-tips', t('travel.tips'), P.tips, (v) => setP({ tips: v }), { multiline: true, hint: t('travel.tipsHint') })}
              {field('p-bring', t('travel.bring'), P.bring, (v) => setP({ bring: v }), { multiline: true, hint: t('travel.bringHint') })}
              {field('p-rules', t('travel.rules'), P.rules, (v) => setP({ rules: v }), { multiline: true, hint: t('travel.rulesHint') })}
              {field('p-age', t('travel.ageInfo'), P.ageInfo ?? '', (v) => setP({ ageInfo: v }), { max: 200, hint: t('travel.ageInfoHint') })}
              {field('p-hist', t('travel.history'), P.history ?? '', (v) => setP({ history: v }), { multiline: true, max: 2000 })}
              {field('p-arch', t('travel.architecture'), P.architecture ?? '', (v) => setP({ architecture: v }), { multiline: true, max: 2000 })}
              {field('p-acc', t('travel.accessibility'), P.accessibility ?? '', (v) => setP({ accessibility: v }), { max: 200 })}
              {field('p-phone', t('travel.phone'), P.phone ?? '', (v) => setP({ phone: v }), { max: 40 })}
              {field('p-web', t('travel.website'), P.website ?? '', (v) => setP({ website: v }), { hint: t('travel.httpsHint') })}
              {field('p-video', t('travel.videoUrl'), P.videoUrl ?? '', (v) => setP({ videoUrl: v }), { hint: t('travel.videoHint') })}
              {user ? <ImageField label={t('travel.cover')} hint={t('travel.coverHint')} kind="seyahat" uid={user.uid} value={P.cover} onChange={(cover) => setP({ cover })} disabled={busy} /> : null}
              {user ? <TourEditor uid={user.uid} value={P.tour ?? []} onChange={(tour) => setP({ tour })} disabled={busy} /> : null}
              {field('p-source', t('travel.source'), P.source ?? '', (v) => setP({ source: v }), { max: 200 })}
              <div className="field">
                <label htmlFor="p-order">{t('travel.order')}</label>
                <input id="p-order" type="number" min={1} value={P.order} onChange={(e) => setP({ order: Number(e.target.value) || 1 })} />
              </div>
              <label className="check">
                <input type="checkbox" checked={P.mustSee} onChange={(e) => setP({ mustSee: e.target.checked })} /> {t('travel.mustSee')}
              </label>
              <div className="actions">
                <button className="btn" type="submit" disabled={busy}>{t('travel.save')}</button>
                <button className="btn ghost" type="button" onClick={() => setPlaceDraft(null)}>{t('travel.cancel')}</button>
              </div>
            </form>
          ) : null}
          {canEdit && cityPlaces.length > 1 ? (
            <SortBar
              dirty={placeSort.dirty}
              busy={busy}
              onCancel={placeSort.reset}
              onSave={() => act(async () => t('sort.saved', { count: await admin!.reorder('yer', placeSort.list, `${provinceName(cityId)} gezilecek yerler`) }))}
            />
          ) : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {canEdit ? <th scope="col"><span className="sr-only">{t('sort.column')}</span></th> : null}
                  <th scope="col">{t('travel.order')}</th>
                  <th scope="col">{t('travel.placeName')}</th>
                  <th scope="col">{t('travel.statusLabel')}</th>
                  <th scope="col"><span className="sr-only">{t('travel.edit')}</span></th>
                </tr>
              </thead>
              <tbody ref={placeSort.containerRef}>
                {placeSort.list.map((p, i) => (
                  <tr key={p.id} {...placeSort.itemProps(p.id)}>
                    {canEdit ? (
                      <td className="handle-cell">
                        <button {...placeSort.handleProps(p.id, p.name)}>
                          <GripIcon />
                        </button>
                      </td>
                    ) : null}
                    <td className="num">{i + 1}</td>
                    <td>
                      <strong>{p.name}</strong>
                      <div className="meta">{p.kind} · {t(`travel.cats.${p.category}`)}{p.mustSee ? ` · ${t('travel.mustSee')}` : ''}</div>
                    </td>
                    <td>{statusPill(p.status)}</td>
                    <td className="row-actions">
                      {canEdit ? <button className="link" onClick={() => editPlace(p)}>{t('travel.edit')}</button> : null}
                      {toggle('yer', p.id, p.status, p.name)}
                      {canEdit ? (
                        <button className="link" disabled={busy} onClick={() => window.confirm(t('travel.deleteConfirm', { name: p.name })) && act(async () => (await admin!.deletePlace(p), t('travel.deleted')))}>
                          {t('travel.delete')}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!cityPlaces.length ? <p className="count">{t('travel.noPlaces')}</p> : null}
          </div>
        </>
      )}
    </section>
  );
}
