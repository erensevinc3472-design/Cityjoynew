import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  DISTRICT_ZONES,
  listMunicipalities,
  LOCAL_KINDS,
  ROUTE_LENGTHS,
  ROUTE_THEMES,
  TRAVEL_MODES,
  validateTravelLocal,
  validateTravelMunicipal,
  validateTravelRoute,
  type DistrictZone,
  type LocalKind,
  type Organization,
  type RouteLength,
  type RouteTheme,
  type TravelFact,
  type TravelLocalInput,
  type TravelLocalItem,
  type TravelMode,
  type TravelMunicipal,
  type TravelPlace,
  type TravelReviewStatus,
  type TravelRoute,
  type TravelRouteInput,
  type TravelRouteStop,
} from '@cityjoy/shared';
import { createFirestoreTravelRepository, createMunicipalTravel, type createTravelAdmin } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { locationRepository } from '../lib/locations';
import type { PanelUser } from '../lib/session';
import { t } from '../lib/t';
import { GripIcon, moveId, SortBar, useDragSort, useSortableList } from '../components/sortable';

type Admin = ReturnType<typeof createTravelAdmin>;
type Act = (fn: () => Promise<string>, after?: () => void) => void;

export const provinceName = (code: string) => locationRepository.getProvince(code)?.name ?? code;
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const municipalitiesOf = (code: string) => {
  const p = locationRepository.getProvince(code);
  return p ? listMunicipalities([p], locationRepository.getDistricts(code)) : [];
};

export function StatusPill({ status }: { status?: TravelReviewStatus }) {
  const cls = status === 'yayinda' ? 'pill ok' : status === 'onay-bekliyor' ? 'pill warn' : 'pill';
  return <span className={cls}>{status ? t(`travel.status.${status}`) : t('travel.status.yok')}</span>;
}

function Field(props: { id: string; label: string; value: string; onChange(v: string): void; multiline?: boolean; max?: number; hint?: string; rows?: number; type?: string }) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      {props.multiline ? (
        <textarea id={props.id} rows={props.rows ?? 4} maxLength={props.max} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      ) : (
        <input id={props.id} type={props.type} maxLength={props.max} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      )}
      {props.hint ? <p className="meta">{props.hint}</p> : null}
    </div>
  );
}

// ---- Rota düzenleyici (admin ve belediye ortak) ----

type StopDraft = { key: string; placeId: string; name: string; note: string; stay: string; mode: TravelMode | ''; next: string };
let stopSeq = 0;
const stopKey = () => `durak-${++stopSeq}`;
export type RouteDraft = {
  id: string | null;
  title: string;
  theme: RouteTheme;
  length: RouteLength;
  hours: string;
  summary: string;
  stops: StopDraft[];
  tips: string;
  order: number;
};

const emptyStop = (): StopDraft => ({ key: stopKey(), placeId: '', name: '', note: '', stay: '', mode: '', next: '' });

export function routeDraftOf(r?: TravelRoute, order = 1): RouteDraft {
  return r
    ? {
        id: r.id,
        title: r.title,
        theme: r.theme,
        length: r.length,
        hours: String(Math.round((r.durationMinutes / 60) * 10) / 10),
        summary: r.summary,
        stops: r.stops.map((s) => ({ key: stopKey(), placeId: s.placeId ?? '', name: s.name, note: s.note, stay: s.stayMinutes ? String(s.stayMinutes) : '', mode: s.next?.mode ?? '', next: s.next?.text ?? '' })),
        tips: r.tips.join('\n'),
        order: r.order,
      }
    : { id: null, title: '', theme: 'tarih', length: 'yarim', hours: '', summary: '', stops: [emptyStop(), emptyStop()], tips: '', order };
}

/** Taslaktan rota girdisi (şehir, belediye ve durum çağıran tarafından eklenir). */
export function routeInputOf(d: RouteDraft): Omit<TravelRouteInput, 'cityId' | 'status' | 'municipalityId'> {
  const stops: TravelRouteStop[] = d.stops
    .filter((s) => s.name.trim())
    .map((s) => ({
      ...(s.placeId ? { placeId: s.placeId } : {}),
      name: s.name.trim(),
      note: s.note.trim(),
      ...(Number(s.stay) > 0 ? { stayMinutes: Math.round(Number(s.stay)) } : {}),
      ...(s.mode && s.next.trim() ? { next: { mode: s.mode, text: s.next.trim() } } : {}),
    }));
  return {
    title: d.title.trim(),
    theme: d.theme,
    length: d.length,
    durationMinutes: Math.round(Number(d.hours.replace(',', '.')) * 60) || 0,
    summary: d.summary.trim(),
    stops,
    tips: lines(d.tips),
    order: d.order,
  };
}

export function RouteEditor({
  draft,
  setDraft,
  places,
  busy,
  onSave,
  onCancel,
  submitLabel,
  extraAction,
}: {
  draft: RouteDraft;
  setDraft(d: RouteDraft): void;
  places: TravelPlace[];
  busy: boolean;
  onSave(e: FormEvent): void;
  onCancel(): void;
  submitLabel: string;
  extraAction?: ReactNode;
}) {
  const D = draft;
  const set = (patch: Partial<RouteDraft>) => setDraft({ ...D, ...patch });
  const setStop = (i: number, patch: Partial<StopDraft>) => set({ stops: D.stops.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const keys = D.stops.map((s) => s.key);
  const stopSort = useDragSort(keys, (key, to) => set({ stops: moveId(keys, key, to).map((k) => D.stops.find((s) => s.key === k)!) }));
  return (
    <form className="form panel-form" onSubmit={onSave}>
      <h2 className="form-section">{D.id ? D.title : t('travel.addRoute')}</h2>
      <Field id="r-title" label={t('travel.routeTitle')} value={D.title} onChange={(v) => set({ title: v })} max={60} />
      <div className="field">
        <label htmlFor="r-theme">{t('travel.routeTheme')}</label>
        <select id="r-theme" value={D.theme} onChange={(e) => set({ theme: e.target.value as RouteTheme })}>
          {ROUTE_THEMES.map((k) => (
            <option key={k} value={k}>{t(`travel.routeThemes.${k}`)}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="r-length">{t('travel.routeLength')}</label>
        <select id="r-length" value={D.length} onChange={(e) => set({ length: e.target.value as RouteLength })}>
          {ROUTE_LENGTHS.map((k) => (
            <option key={k} value={k}>{t(`travel.lengths.${k}`)}</option>
          ))}
        </select>
      </div>
      <Field id="r-hours" label={t('travel.routeHours')} value={D.hours} onChange={(v) => set({ hours: v })} max={5} hint={t('travel.routeHoursHint')} />
      <Field id="r-summary" label={t('travel.summary')} value={D.summary} onChange={(v) => set({ summary: v })} multiline rows={3} max={300} />

      <fieldset className="form-section">
        <legend>{t('travel.stopsLegend')}</legend>
        <p className="meta">{t('travel.stopsHint')} {t('sort.hint')}</p>
        <div ref={stopSort.containerRef}>
        {D.stops.map((s, i) => (
          <div key={s.key} {...stopSort.itemProps(s.key)} className={`stop-row${stopSort.dragging === s.key ? ' dragging' : ''}`}>
            <div className="stop-head">
              <button {...stopSort.handleProps(s.key, s.name || t('travel.stopN', { n: i + 1 }))}>
                <GripIcon />
              </button>
              <strong>{t('travel.stopN', { n: i + 1 })}</strong>
            </div>
            <div className="field">
              <label htmlFor={`s-place-${i}`}>{t('travel.stopPlace')}</label>
              <select
                id={`s-place-${i}`}
                value={s.placeId}
                onChange={(e) => {
                  const p = places.find((x) => x.id === e.target.value);
                  setStop(i, { placeId: e.target.value, ...(p && !s.name.trim() ? { name: p.name } : {}) });
                }}>
                <option value="">{t('travel.stopFree')}</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <Field id={`s-name-${i}`} label={t('travel.stopName')} value={s.name} onChange={(v) => setStop(i, { name: v })} max={80} />
            <Field id={`s-note-${i}`} label={t('travel.stopNote')} value={s.note} onChange={(v) => setStop(i, { note: v })} max={300} />
            <Field id={`s-stay-${i}`} label={t('travel.stopStay')} type="number" value={s.stay} onChange={(v) => setStop(i, { stay: v })} />
            {i < D.stops.length - 1 ? (
              <div className="field">
                <label htmlFor={`s-mode-${i}`}>{t('travel.stopNext')}</label>
                <select id={`s-mode-${i}`} value={s.mode} onChange={(e) => setStop(i, { mode: e.target.value as TravelMode | '' })}>
                  <option value="">-</option>
                  {TRAVEL_MODES.map((m) => (
                    <option key={m} value={m}>{t(`travel.modes.${m}`)}</option>
                  ))}
                </select>
                <input aria-label={t('travel.stopNextText')} placeholder={t('travel.stopNextText')} maxLength={200} value={s.next} onChange={(e) => setStop(i, { next: e.target.value })} />
              </div>
            ) : null}
            <div className="actions">
              <button type="button" className="link" disabled={D.stops.length <= 2} onClick={() => set({ stops: D.stops.filter((_, j) => j !== i) })}>{t('travel.removeStop')}</button>
            </div>
          </div>
        ))}
        </div>
        {D.stops.length < 12 ? (
          <button type="button" className="btn secondary" onClick={() => set({ stops: [...D.stops, emptyStop()] })}>{t('travel.addStop')}</button>
        ) : null}
      </fieldset>

      <Field id="r-tips" label={t('travel.tips')} value={D.tips} onChange={(v) => set({ tips: v })} multiline rows={3} hint={t('travel.tipsHint')} />
      <div className="field">
        <label htmlFor="r-order">{t('travel.order')}</label>
        <input id="r-order" type="number" min={1} value={D.order} onChange={(e) => set({ order: Number(e.target.value) || 1 })} />
      </div>
      <div className="actions">
        <button className="btn" type="submit" disabled={busy}>{submitLabel}</button>
        {extraAction}
        <button className="btn ghost" type="button" onClick={onCancel}>{t('travel.cancel')}</button>
      </div>
    </form>
  );
}

function RouteTable({ routes, actions, onReorder, busy }: { routes: TravelRoute[]; actions(r: TravelRoute): ReactNode; onReorder?(list: TravelRoute[]): void; busy?: boolean }) {
  const sort = useSortableList(routes);
  return (
    <>
    {onReorder && routes.length > 1 ? <SortBar dirty={sort.dirty} busy={busy} onCancel={sort.reset} onSave={() => onReorder(sort.list)} /> : null}
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {onReorder ? <th scope="col"><span className="sr-only">{t('sort.column')}</span></th> : null}
            <th scope="col">{t('travel.order')}</th>
            <th scope="col">{t('travel.routeTitle')}</th>
            <th scope="col">{t('travel.statusLabel')}</th>
            <th scope="col"><span className="sr-only">{t('travel.edit')}</span></th>
          </tr>
        </thead>
        <tbody ref={sort.containerRef}>
          {sort.list.map((r, i) => (
            <tr key={r.id} {...sort.itemProps(r.id)}>
              {onReorder ? (
                <td className="handle-cell">
                  <button {...sort.handleProps(r.id, r.title)}>
                    <GripIcon />
                  </button>
                </td>
              ) : null}
              <td className="num">{i + 1}</td>
              <td>
                <strong>{r.title}</strong>
                <div className="meta">
                  {[t(`travel.routeThemes.${r.theme}`), t(`travel.lengths.${r.length}`), t('travel.stopCount', { count: r.stops.length })].join(' · ')}
                </div>
                <div className="meta">{r.stops.map((s) => s.name).join(' → ')}</div>
              </td>
              <td><StatusPill status={r.status} /></td>
              <td className="row-actions">{actions(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!routes.length ? <p className="count">{t('travel.noRoutes')}</p> : null}
    </div>
    </>
  );
}

const validationError = (errs: string[]) => (errs.length ? t(`travel.errors.${errs[0]}`) : null);

// ---- Admin: Hazır Rotalar ----

export function RoutesTab({
  cityId,
  routes,
  places,
  canEdit,
  admin,
  busy,
  act,
  toggle,
  onError,
}: {
  cityId: string;
  routes: TravelRoute[];
  places: TravelPlace[];
  canEdit: boolean;
  admin: Admin | null;
  busy: boolean;
  act: Act;
  toggle(id: string, s: TravelReviewStatus, label: string): ReactNode;
  onError(text: string): void;
}) {
  const [draft, setDraft] = useState<RouteDraft | null>(null);
  const [municipalityId, setMunicipalityId] = useState<string | undefined>();
  const own = routes.filter((r) => r.cityId === cityId);
  const names = Object.fromEntries(municipalitiesOf(cityId).map((m) => [m.id, m.name]));

  const save = (e: FormEvent) => {
    e.preventDefault();
    const input: TravelRouteInput = { ...routeInputOf(draft!), cityId, ...(municipalityId ? { municipalityId } : {}), status: own.find((r) => r.id === draft!.id)?.status ?? 'taslak' };
    const err = validationError(validateTravelRoute(input));
    if (err) return onError(err);
    act(async () => (await admin!.saveRoute(draft!.id, input), t('travel.saved')), () => setDraft(null));
  };

  return (
    <>
      <p className="meta">{t('travel.routesTabIntro')}</p>
      {canEdit && !draft ? (
        <button className="btn" onClick={() => (setMunicipalityId(undefined), setDraft(routeDraftOf(undefined, own.length + 1)))}>{t('travel.addRoute')}</button>
      ) : null}
      {draft ? (
        <RouteEditor draft={draft} setDraft={setDraft} places={places.filter((p) => p.cityId === cityId)} busy={busy} onSave={save} onCancel={() => setDraft(null)} submitLabel={t('travel.save')} />
      ) : null}
      <RouteTable
        routes={own}
        busy={busy}
        onReorder={canEdit ? (list) => act(async () => t('sort.saved', { count: await admin!.reorder('rota', list, `${provinceName(cityId)} rotaları`) })) : undefined}
        actions={(r) => (
          <>
            {r.municipalityId ? <span className="meta">{names[r.municipalityId] ?? r.municipalityId}</span> : null}
            {canEdit ? <button className="link" onClick={() => (setMunicipalityId(r.municipalityId), setDraft(routeDraftOf(r)))}>{t('travel.edit')}</button> : null}
            {toggle(r.id, r.status, r.title)}
            {canEdit ? (
              <button className="link" disabled={busy} onClick={() => window.confirm(t('travel.deleteConfirm', { name: r.title })) && act(async () => (await admin!.remove('rota', r.id, r.title), t('travel.deleted')))}>
                {t('travel.delete')}
              </button>
            ) : null}
          </>
        )}
      />
    </>
  );
}

// ---- Admin: Yöresel ----

type LocalDraft = Omit<TravelLocalInput, 'badges' | 'facts'> & { id: string | null; badges: string; facts: string };

const factsOf = (s: string): TravelFact[] =>
  lines(s)
    .slice(0, 8)
    .map((l) => {
      const [label, value, source, asOf] = l.split('|').map((x) => x.trim());
      return { label: label ?? '', value: value ?? '', ...(source ? { source } : {}), ...(asOf ? { asOf } : {}) };
    })
    .filter((f) => f.label && f.value);

export function LocalTab({
  cityId,
  items,
  canEdit,
  admin,
  busy,
  act,
  toggle,
  onError,
}: {
  cityId: string;
  items: TravelLocalItem[];
  canEdit: boolean;
  admin: Admin | null;
  busy: boolean;
  act: Act;
  toggle(id: string, s: TravelReviewStatus, label: string): ReactNode;
  onError(text: string): void;
}) {
  const [draft, setDraft] = useState<LocalDraft | null>(null);
  const own = items.filter((x) => x.cityId === cityId);
  const sort = useSortableList(own);
  const D = draft;
  const set = (patch: Partial<LocalDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const edit = (x?: TravelLocalItem) =>
    setDraft(
      x
        ? { ...x, badges: x.badges.join(', '), facts: x.facts.map((f) => [f.label, f.value, f.source ?? '', f.asOf ?? ''].join(' | ')).join('\n') }
        : { id: null, cityId, kind: 'miras', title: '', subtitle: '', body: '', badges: '', facts: '', order: own.length + 1, status: 'taslak' },
    );

  const save = (e: FormEvent) => {
    e.preventDefault();
    const { id, badges, facts, ...rest } = draft!;
    const input: TravelLocalInput = { ...rest, badges: badges.split(',').map((x) => x.trim()).filter(Boolean), facts: factsOf(facts) };
    const err = validationError(validateTravelLocal(input));
    if (err) return onError(err);
    act(async () => (await admin!.saveLocal(id, input), t('travel.saved')), () => setDraft(null));
  };

  return (
    <>
      <p className="meta">{t('travel.localTabIntro')}</p>
      {canEdit && !D ? <button className="btn" onClick={() => edit()}>{t('travel.addLocal')}</button> : null}
      {D ? (
        <form className="form panel-form" onSubmit={save}>
          <h2 className="form-section">{D.id ? D.title : t('travel.addLocal')}</h2>
          <div className="field">
            <label htmlFor="l-kind">{t('travel.localKind')}</label>
            <select id="l-kind" value={D.kind} onChange={(e) => set({ kind: e.target.value as LocalKind })}>
              {LOCAL_KINDS.map((k) => (
                <option key={k} value={k}>{t(`travel.localKinds.${k}`)}</option>
              ))}
            </select>
          </div>
          <Field id="l-title" label={t('travel.localTitle')} value={D.title} onChange={(v) => set({ title: v })} max={80} />
          <Field id="l-sub" label={t('travel.localSubtitle')} value={D.subtitle} onChange={(v) => set({ subtitle: v })} max={200} />
          <Field id="l-body" label={t('travel.about')} value={D.body} onChange={(v) => set({ body: v })} multiline max={2000} />
          <Field id="l-badges" label={t('travel.badges')} value={D.badges} onChange={(v) => set({ badges: v })} hint={t('travel.badgesHint')} />
          <Field id="l-facts" label={t('travel.facts')} value={D.facts} onChange={(v) => set({ facts: v })} multiline hint={t('travel.factsHint')} />
          <Field id="l-source" label={t('travel.source')} value={D.source ?? ''} onChange={(v) => set({ source: v })} max={200} />
          <div className="field">
            <label htmlFor="l-order">{t('travel.order')}</label>
            <input id="l-order" type="number" min={1} value={D.order} onChange={(e) => set({ order: Number(e.target.value) || 1 })} />
          </div>
          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>{t('travel.save')}</button>
            <button className="btn ghost" type="button" onClick={() => setDraft(null)}>{t('travel.cancel')}</button>
          </div>
        </form>
      ) : null}
      {canEdit && own.length > 1 ? (
        <SortBar
          dirty={sort.dirty}
          busy={busy}
          onCancel={sort.reset}
          onSave={() => act(async () => t('sort.saved', { count: await admin!.reorder('yoresel', sort.list, `Yöresel ${provinceName(cityId)}`) }))}
        />
      ) : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {canEdit ? <th scope="col"><span className="sr-only">{t('sort.column')}</span></th> : null}
              <th scope="col">{t('travel.order')}</th>
              <th scope="col">{t('travel.localTitle')}</th>
              <th scope="col">{t('travel.statusLabel')}</th>
              <th scope="col"><span className="sr-only">{t('travel.edit')}</span></th>
            </tr>
          </thead>
          <tbody ref={sort.containerRef}>
            {sort.list.map((x, i) => (
              <tr key={x.id} {...sort.itemProps(x.id)}>
                {canEdit ? (
                  <td className="handle-cell">
                    <button {...sort.handleProps(x.id, x.title)}>
                      <GripIcon />
                    </button>
                  </td>
                ) : null}
                <td className="num">{i + 1}</td>
                <td>
                  <strong>{x.title}</strong>
                  <div className="meta">{[t(`travel.localKinds.${x.kind}`), ...x.badges].join(' · ')}</div>
                </td>
                <td><StatusPill status={x.status} /></td>
                <td className="row-actions">
                  {canEdit ? <button className="link" onClick={() => edit(x)}>{t('travel.edit')}</button> : null}
                  {toggle(x.id, x.status, x.title)}
                  {canEdit ? (
                    <button className="link" disabled={busy} onClick={() => window.confirm(t('travel.deleteConfirm', { name: x.title })) && act(async () => (await admin!.remove('yoresel', x.id, x.title), t('travel.deleted')))}>
                      {t('travel.delete')}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!own.length ? <p className="count">{t('travel.noLocal')}</p> : null}
      </div>
    </>
  );
}

// ---- Admin: Başkanlarla Keşif (belediye tanıtımları) ----

type MunicipalDraft = Omit<TravelMunicipal, 'updatedAt' | 'population'> & { population: string; label: string };

export function MunicipalTab({
  cityId,
  items,
  canEdit,
  admin,
  busy,
  act,
  toggle,
  onError,
}: {
  cityId: string;
  items: TravelMunicipal[];
  canEdit: boolean;
  admin: Admin | null;
  busy: boolean;
  act: Act;
  toggle(id: string, s: TravelReviewStatus, label: string): ReactNode;
  onError(text: string): void;
}) {
  const [draft, setDraft] = useState<MunicipalDraft | null>(null);
  const list = municipalitiesOf(cityId);
  const D = draft;
  const set = (patch: Partial<MunicipalDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const edit = (id: string, label: string, districtId?: string) => {
    const m = items.find((x) => x.id === id);
    setDraft({
      id,
      cityId,
      ...(districtId ? { districtId } : {}),
      slogan: m?.slogan ?? '',
      description: m?.description ?? '',
      videoUrl: m?.videoUrl ?? '',
      mayorName: m?.mayorName ?? '',
      showMayor: m?.showMayor ?? true,
      zone: m?.zone,
      population: m?.population != null ? String(m.population) : '',
      populationYear: m?.populationYear ?? '',
      status: m?.status ?? 'taslak',
      label,
    });
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    const { label, population, ...rest } = draft!;
    const err = validationError(validateTravelMunicipal(rest));
    if (err) return onError(err);
    const pop = Number(population.replace(/\D/g, ''));
    act(
      async () => (await admin!.saveMunicipal({ ...rest, ...(population.trim() && pop >= 0 ? { population: pop } : {}) }, label), t('travel.saved')),
      () => setDraft(null),
    );
  };

  return (
    <>
      <p className="meta">{t('travel.municipalTabIntro')}</p>
      {D ? (
        <form className="form panel-form" onSubmit={save}>
          <h2 className="form-section">{D.label}</h2>
          <Field id="m-slogan" label={t('travel.slogan')} value={D.slogan} onChange={(v) => set({ slogan: v })} max={60} />
          <Field id="m-desc" label={t('travel.description')} value={D.description} onChange={(v) => set({ description: v })} multiline max={600} />
          <Field id="m-video" label={t('travel.videoUrl')} value={D.videoUrl ?? ''} onChange={(v) => set({ videoUrl: v })} hint={t('travel.videoHint')} />
          <Field id="m-mayor" label={t('travel.mayorName')} value={D.mayorName ?? ''} onChange={(v) => set({ mayorName: v })} max={80} />
          <label className="check">
            <input type="checkbox" checked={D.showMayor} onChange={(e) => set({ showMayor: e.target.checked })} /> {t('travel.showMayor')}
          </label>
          <p className="meta">{t('travel.showMayorHint')}</p>
          <div className="field">
            <label htmlFor="m-zone">{t('travel.zone')}</label>
            <select id="m-zone" value={D.zone ?? ''} onChange={(e) => set({ zone: (e.target.value || undefined) as DistrictZone | undefined })}>
              <option value="">-</option>
              {DISTRICT_ZONES.map((z) => (
                <option key={z} value={z}>{t(`travel.zones.${z}`)}</option>
              ))}
            </select>
          </div>
          <Field id="m-pop" label={t('travel.population')} value={D.population} onChange={(v) => set({ population: v })} hint={t('travel.populationHint')} />
          <Field id="m-year" label={t('travel.populationYear')} value={D.populationYear ?? ''} onChange={(v) => set({ populationYear: v })} max={10} />
          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>{t('travel.save')}</button>
            <button className="btn ghost" type="button" onClick={() => setDraft(null)}>{t('travel.cancel')}</button>
          </div>
        </form>
      ) : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('travel.municipality')}</th>
              <th scope="col">{t('travel.statusLabel')}</th>
              <th scope="col"><span className="sr-only">{t('travel.edit')}</span></th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => {
              const x = items.find((i) => i.id === m.id);
              return (
                <tr key={m.id}>
                  <td>
                    <strong>{m.name}</strong>
                    <div className="meta">
                      {[x?.slogan, x?.population != null ? t('travel.populationShort', { value: x.population.toLocaleString('tr-TR') }) : null, x?.zone ? t(`travel.zones.${x.zone}`) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </td>
                  <td><StatusPill status={x?.status} /></td>
                  <td className="row-actions">
                    {canEdit ? (
                      <button className="link" onClick={() => edit(m.id, m.name, m.scope.level === 'ilce' ? m.scope.districtId : undefined)}>
                        {x ? t('travel.edit') : t('travel.write')}
                      </button>
                    ) : null}
                    {x ? toggle(m.id, x.status, m.name) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---- Belediye paneli: kendi tanıtımı ve rotaları ----

/**
 * Belediye personeli (kurumda Seyahat bölümü işaretli): Başkanlarla Keşif tanıtımı ve keşif rotaları. Hazırlar,
 * "Onaya gönder"ir; CityJoy kontrol edip yayına alır (siyasi mesaj ve parti işareti yasak).
 */
export function MunicipalTravelPage({ user }: { user: PanelUser }) {
  const orgs = user.memberships.filter(({ org }) => org.modules.includes('seyahat') && org.id.startsWith('bld-')).map(({ org }) => org);
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? '');
  const org = orgs.find((o) => o.id === orgId);
  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('travel.municipalTitle')}</h1>
          <p className="meta">{t('travel.municipalIntro')}</p>
        </div>
      </header>
      <p className="note">{t('travel.municipalRules')}</p>
      {orgs.length > 1 ? (
        <div className="field">
          <label htmlFor="m-org">{t('travel.municipality')}</label>
          <select id="m-org" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      ) : null}
      {org ? <MunicipalEditor key={org.id} user={user} org={org} /> : <p className="note">{t('travel.readOnly')}</p>}
    </section>
  );
}

function MunicipalEditor({ user, org }: { user: PanelUser; org: Organization }) {
  const cityId = org.scope.level === 'ulke' ? '' : org.scope.provinceCode;
  const districtId = org.scope.level === 'ilce' || org.scope.level === 'mahalle' ? org.scope.districtId : undefined;
  const actions = user.memberships.find((m) => m.org.id === org.id)?.member.assignments.seyahat ?? [];
  // Örnek hesapta düğmeler görünür ama kapalıdır (yalnızca görünüm).
  const demo = !!user.isDemo;
  const canWrite = actions.some((a) => a === 'ekle' || a === 'duzenle');
  const canDelete = !demo && actions.includes('sil');
  const api = createMunicipalTravel(firestore, user.uid, { id: org.id, name: org.name, cityId, ...(districtId ? { districtId } : {}) });
  const [intro, setIntro] = useState<TravelMunicipal | null>(null);
  const [text, setText] = useState({ slogan: '', description: '', videoUrl: '', mayorName: '' });
  const [routes, setRoutes] = useState<TravelRoute[]>([]);
  const [places, setPlaces] = useState<TravelPlace[]>([]);
  const [draft, setDraft] = useState<RouteDraft | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const places = createFirestoreTravelRepository(firestore).listPlaces(cityId).catch(() => []);
      const [m, r, p] = demo ? [null, [], await places] : await Promise.all([api.get(), api.listRoutes(), places]);
      setIntro(m);
      setText({ slogan: m?.slogan ?? '', description: m?.description ?? '', videoUrl: m?.videoUrl ?? '', mayorName: m?.mayorName ?? '' });
      setRoutes(r);
      setPlaces(p);
    } catch {
      setLoadError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id]);
  useEffect(() => {
    load();
  }, [load]);

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

  const saveIntro = (submit: boolean) => {
    const err = validationError(validateTravelMunicipal(text));
    if (err) return setMessage({ kind: 'error', text: err });
    act(async () => (await api.saveText(text, submit), t(submit ? 'travel.submitted' : 'travel.saved')));
  };
  const saveRoute = (submit: boolean) => {
    const input = routeInputOf(draft!);
    const err = validationError(validateTravelRoute({ ...input, cityId, status: 'taslak' }));
    if (err) return setMessage({ kind: 'error', text: err });
    act(async () => (await api.saveRoute(draft!.id, input, submit), t(submit ? 'travel.submitted' : 'travel.saved')), () => setDraft(null));
  };

  if (loadError) {
    return (
      <div className="state" role="alert">
        <p>{t('travel.loadError')}</p>
        <button className="btn secondary" onClick={load}>{t('travel.retry')}</button>
      </div>
    );
  }

  return (
    <>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {demo ? <p className="note">{t('travel.municipalDemo')}</p> : null}
      <form
        className="form panel-form"
        onSubmit={(e) => {
          e.preventDefault();
          saveIntro(true);
        }}>
        <h2 className="form-section">
          {t('travel.municipalIntroTitle')} <StatusPill status={intro?.status} />
        </h2>
        <Field id="mi-slogan" label={t('travel.slogan')} value={text.slogan} onChange={(v) => setText({ ...text, slogan: v })} max={60} hint={t('travel.sloganHint')} />
        <Field id="mi-desc" label={t('travel.description')} value={text.description} onChange={(v) => setText({ ...text, description: v })} multiline max={600} />
        <Field id="mi-video" label={t('travel.videoUrl')} value={text.videoUrl} onChange={(v) => setText({ ...text, videoUrl: v })} hint={t('travel.videoHint')} />
        <Field id="mi-mayor" label={t('travel.mayorName')} value={text.mayorName} onChange={(v) => setText({ ...text, mayorName: v })} max={80} hint={t('travel.mayorNameHint')} />
        {canWrite ? (
          <div className="actions">
            <button className="btn" type="submit" disabled={busy || demo}>{t('travel.submit')}</button>
            <button className="btn secondary" type="button" disabled={busy || demo} onClick={() => saveIntro(false)}>{t('travel.saveDraft')}</button>
          </div>
        ) : null}
      </form>

      <h2>{t('travel.municipalRoutes')}</h2>
      {canWrite && !draft ? <button className="btn" onClick={() => setDraft(routeDraftOf(undefined, routes.length + 1))}>{t('travel.addRoute')}</button> : null}
      {draft ? (
        <RouteEditor
          draft={draft}
          setDraft={setDraft}
          places={places}
          busy={busy || demo}
          onSave={(e) => {
            e.preventDefault();
            saveRoute(true);
          }}
          onCancel={() => setDraft(null)}
          submitLabel={t('travel.submit')}
          extraAction={
            <button className="btn secondary" type="button" disabled={busy || demo} onClick={() => saveRoute(false)}>{t('travel.saveDraft')}</button>
          }
        />
      ) : null}
      <RouteTable
        routes={routes}
        actions={(r) => (
          <>
            {canWrite ? <button className="link" onClick={() => setDraft(routeDraftOf(r))}>{t('travel.edit')}</button> : null}
            {canDelete ? (
              <button className="link" disabled={busy} onClick={() => window.confirm(t('travel.deleteConfirm', { name: r.title })) && act(async () => (await api.deleteRoute(r), t('travel.deleted')))}>
                {t('travel.delete')}
              </button>
            ) : null}
          </>
        )}
      />
    </>
  );
}
