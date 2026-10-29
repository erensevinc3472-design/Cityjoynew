import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  can,
  isGrantActive,
  SHOWCASE_THEMES,
  validateShowcase,
  type Business,
  type CityShowcase,
  type CityShowcaseInput,
  type ShowcaseItem,
  type ShowcaseTheme,
  type TravelPlace,
} from '@cityjoy/shared';
import { createFirestoreBusinessRepository, createFirestoreTravelRepository, createShowcaseAdmin } from '@cityjoy/shared/firebase';

import { GripIcon, moveId, useDragSort } from '../components/sortable';
import { firestore } from '../lib/firebase';
import { locationRepository as repo } from '../lib/locations';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';

type Msg = { kind: 'ok' | 'error'; text: string } | undefined;
type ItemDraft = ShowcaseItem & { key: string };
type StoryDraft = { key: string; title: string; subtitle: string; body: string; theme: ShowcaseTheme; items: ItemDraft[] };
type Draft = { id: string | null; issue: number; title: string; intro: string; weekOf: string; stories: StoryDraft[] };

let seq = 0;
const key = () => `k${++seq}`;
const monday = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const emptyStory = (): StoryDraft => ({ key: key(), title: '', subtitle: '', body: '', theme: 'lezzet', items: [] });

/**
 * Panel > Şehir Vitrini (Benim Şehrim; tasarım: bursa-vitrini.html): ilin haftalık seçkisi. Sayı, konular ve her
 * konuda seçilen işletmeler / gezilecek yerler. Editör seçkisidir, para karşılığı girilmez. Taslak hazırlanır, yayına
 * alınır; uygulama en son yayındaki sayıyı açar. Admin her ili, il yöneticisi kendi ilini yönetir; işlemler kayda geçer.
 */
export function ShowcasePage() {
  const { user } = useSession();
  const admin = isAdminUser(user);
  const provinces = useMemo(() => {
    if (!user) return [] as string[];
    if (admin) return repo.getProvinces().map((p) => p.code);
    return user.grants
      .filter((g) => isGrantActive(g, new Date()) && g.scope.level === 'il' && g.modules['sehir-rehberi']?.includes('goruntule'))
      .map((g) => (g.scope.level === 'il' ? g.scope.provinceCode : ''));
  }, [user, admin]);
  const [provinceCode, setProvinceCode] = useState(() => (admin ? '16' : (provinces[0] ?? '')));
  const canEdit = !!user && !user.isDemo && (admin || can(user.grants, { module: 'sehir-rehberi', action: 'duzenle', region: { provinceCode } }));
  const service = useMemo(() => (user ? createShowcaseAdmin(firestore, user.uid) : null), [user]);
  const [issues, setIssues] = useState<CityShowcase[] | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [places, setPlaces] = useState<TravelPlace[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<Msg>();
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    if (!service || !provinceCode) return;
    if (user?.isDemo) return setIssues([]);
    try {
      setIssues(await service.list(provinceCode));
    } catch {
      setLoadError(true);
    }
    // Seçim listeleri: ildeki yayındaki işletmeler ve gezilecek yerler.
    createFirestoreBusinessRepository(firestore).listInProvince(provinceCode).then(setBusinesses).catch(() => setBusinesses([]));
    createFirestoreTravelRepository(firestore).listPlaces(provinceCode).then(setPlaces).catch(() => setPlaces([]));
  }, [service, provinceCode, user?.isDemo]);
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
      setMessage({ kind: 'error', text: t('showcase.error') });
    } finally {
      setBusy(false);
    }
  };

  const edit = (s?: CityShowcase) =>
    setDraft(
      s
        ? {
            id: s.id,
            issue: s.issue,
            title: s.title,
            intro: s.intro,
            weekOf: s.weekOf,
            stories: s.stories.map((x) => ({ key: key(), title: x.title, subtitle: x.subtitle ?? '', body: x.body ?? '', theme: x.theme, items: x.items.map((i) => ({ ...i, key: key() })) })),
          }
        : {
            id: null,
            issue: (issues?.reduce((m, x) => Math.max(m, x.issue), 0) ?? 0) + 1,
            title: t('showcase.defaultTitle', { city: repo.getProvince(provinceCode)?.name ?? '' }),
            intro: '',
            weekOf: monday(),
            stories: [emptyStory()],
          },
    );

  const save = (e: FormEvent) => {
    e.preventDefault();
    const d = draft!;
    const input: CityShowcaseInput = {
      provinceCode,
      issue: d.issue,
      title: d.title,
      intro: d.intro,
      weekOf: d.weekOf,
      stories: d.stories.map(({ key: _k, items, ...s }) => ({ ...s, items: items.map(({ key: _i, ...i }) => i) })),
      status: issues?.find((x) => x.id === d.id)?.status ?? 'taslak',
    };
    const errs = validateShowcase(input);
    if (errs.length) return setMessage({ kind: 'error', text: t(`showcase.errors.${errs[0]}`) });
    act(async () => (await service!.save(d.id, input), t('showcase.saved')), () => setDraft(null));
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('showcase.title')}</h1>
          <p className="meta">{t('showcase.intro')}</p>
        </div>
        {canEdit && !draft ? (
          <div className="actions">
            <button className="btn" onClick={() => edit()}>{t('showcase.add')}</button>
          </div>
        ) : null}
      </header>
      <p className="note">{t('showcase.rules')}</p>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {provinces.length > 1 ? (
        <div className="field">
          <label htmlFor="sc-province">{t('showcase.province')}</label>
          <select id="sc-province" value={provinceCode} onChange={(e) => (setProvinceCode(e.target.value), setDraft(null))}>
            {provinces.map((p) => (
              <option key={p} value={p}>{repo.getProvince(p)?.name ?? p}</option>
            ))}
          </select>
        </div>
      ) : null}

      {draft ? (
        <IssueEditor draft={draft} setDraft={setDraft} businesses={businesses} places={places} busy={busy} onSave={save} onCancel={() => setDraft(null)} />
      ) : null}

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('showcase.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('showcase.retry')}</button>
        </div>
      ) : issues === null ? (
        <div className="state" aria-live="polite">{t('showcase.loading')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('showcase.issueCol')}</th>
                <th scope="col">{t('showcase.titleCol')}</th>
                <th scope="col">{t('showcase.statusCol')}</th>
                <th scope="col"><span className="sr-only">{t('showcase.edit')}</span></th>
              </tr>
            </thead>
            <tbody>
              {issues.map((s) => (
                <tr key={s.id}>
                  <td className="num">{s.issue}</td>
                  <td>
                    <strong>{s.title}</strong>
                    <div className="meta">{[new Date(`${s.weekOf}T12:00:00`).toLocaleDateString('tr-TR'), t('showcase.storyCount', { count: s.stories.length })].join(' · ')}</div>
                  </td>
                  <td><span className={s.status === 'yayinda' ? 'pill ok' : 'pill'}>{t(`showcase.status.${s.status}`)}</span></td>
                  <td className="row-actions">
                    {canEdit ? (
                      <>
                        <button className="link" onClick={() => edit(s)}>{t('showcase.edit')}</button>
                        <button className="link" disabled={busy} onClick={() => act(async () => (await service!.setStatus(s, s.status === 'yayinda' ? 'taslak' : 'yayinda'), t('showcase.saved')))}>
                          {s.status === 'yayinda' ? t('showcase.unpublish') : t('showcase.publish')}
                        </button>
                        <button className="link" disabled={busy} onClick={() => window.confirm(t('showcase.deleteConfirm', { n: s.issue })) && act(async () => (await service!.remove(s), t('showcase.deleted')))}>
                          {t('showcase.delete')}
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!issues.length ? <p className="count">{t('showcase.none')}</p> : null}
        </div>
      )}
    </section>
  );
}

function IssueEditor({
  draft,
  setDraft,
  businesses,
  places,
  busy,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft(d: Draft): void;
  businesses: Business[];
  places: TravelPlace[];
  busy: boolean;
  onSave(e: FormEvent): void;
  onCancel(): void;
}) {
  const D = draft;
  const set = (patch: Partial<Draft>) => setDraft({ ...D, ...patch });
  const setStory = (k: string, patch: Partial<StoryDraft>) => set({ stories: D.stories.map((s) => (s.key === k ? { ...s, ...patch } : s)) });
  const keys = D.stories.map((s) => s.key);
  const sort = useDragSort(keys, (k, to) => set({ stories: moveId(keys, k, to).map((x) => D.stories.find((s) => s.key === x)!) }));

  return (
    <form className="form panel-form" onSubmit={onSave}>
      <h2 className="form-section">{D.id ? t('showcase.editIssue', { n: D.issue }) : t('showcase.add')}</h2>
      <div className="field">
        <label htmlFor="sc-issue">{t('showcase.issueCol')}</label>
        <input id="sc-issue" type="number" min={1} value={D.issue} onChange={(e) => set({ issue: Math.max(1, Number(e.target.value) || 1) })} />
      </div>
      <div className="field">
        <label htmlFor="sc-week">{t('showcase.weekOf')}</label>
        <input id="sc-week" type="date" value={D.weekOf} onChange={(e) => set({ weekOf: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="sc-title">{t('showcase.titleCol')}</label>
        <input id="sc-title" maxLength={80} value={D.title} onChange={(e) => set({ title: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="sc-intro">{t('showcase.introLabel')}</label>
        <textarea id="sc-intro" rows={2} maxLength={400} value={D.intro} onChange={(e) => set({ intro: e.target.value })} />
      </div>

      <fieldset className="form-section">
        <legend>{t('showcase.stories')}</legend>
        <p className="meta">{t('showcase.storiesHint')} {t('sort.hint')}</p>
        <div ref={sort.containerRef}>
          {D.stories.map((s, i) => (
            <div key={s.key} {...sort.itemProps(s.key)} className={`stop-row${sort.dragging === s.key ? ' dragging' : ''}`}>
              <div className="stop-head">
                <button {...sort.handleProps(s.key, s.title || t('showcase.storyN', { n: i + 1 }))}>
                  <GripIcon />
                </button>
                <strong>{t('showcase.storyN', { n: i + 1 })}</strong>
              </div>
              <div className="field">
                <label htmlFor={`st-title-${s.key}`}>{t('showcase.storyTitle')}</label>
                <input id={`st-title-${s.key}`} maxLength={80} value={s.title} onChange={(e) => setStory(s.key, { title: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`st-theme-${s.key}`}>{t('showcase.theme')}</label>
                <select id={`st-theme-${s.key}`} value={s.theme} onChange={(e) => setStory(s.key, { theme: e.target.value as ShowcaseTheme })}>
                  {SHOWCASE_THEMES.map((th) => (
                    <option key={th} value={th}>{t(`showcase.themes.${th}`)}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`st-sub-${s.key}`}>{t('showcase.subtitle')}</label>
                <input id={`st-sub-${s.key}`} maxLength={120} value={s.subtitle} onChange={(e) => setStory(s.key, { subtitle: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`st-body-${s.key}`}>{t('showcase.body')}</label>
                <textarea id={`st-body-${s.key}`} rows={3} maxLength={800} value={s.body} onChange={(e) => setStory(s.key, { body: e.target.value })} />
              </div>
              <StoryItems items={s.items} onChange={(items) => setStory(s.key, { items })} businesses={businesses} places={places} />
              <div className="actions">
                <button type="button" className="link" disabled={D.stories.length <= 1} onClick={() => set({ stories: D.stories.filter((x) => x.key !== s.key) })}>
                  {t('showcase.removeStory')}
                </button>
              </div>
            </div>
          ))}
        </div>
        {D.stories.length < 8 ? (
          <button type="button" className="btn secondary" onClick={() => set({ stories: [...D.stories, emptyStory()] })}>{t('showcase.addStory')}</button>
        ) : null}
      </fieldset>
      <div className="actions">
        <button className="btn" type="submit" disabled={busy}>{t('showcase.save')}</button>
        <button className="btn ghost" type="button" onClick={onCancel}>{t('showcase.cancel')}</button>
      </div>
    </form>
  );
}

/** Konunun seçilen işletme / yerleri: listeden eklenir, not yazılır, sürükleyerek sıralanır. */
function StoryItems({ items, onChange, businesses, places }: { items: ItemDraft[]; onChange(items: ItemDraft[]): void; businesses: Business[]; places: TravelPlace[] }) {
  const keys = items.map((i) => i.key);
  const sort = useDragSort(keys, (k, to) => onChange(moveId(keys, k, to).map((x) => items.find((i) => i.key === x)!)));
  const taken = new Set(items.map((i) => `${i.kind}:${i.id}`));
  const add = (value: string) => {
    const [kind, id] = value.split(':') as ['isletme' | 'yer', string];
    const name = kind === 'isletme' ? businesses.find((b) => b.id === id)?.name : places.find((p) => p.id === id)?.name;
    if (name && items.length < 8) onChange([...items, { key: key(), kind, id, name }]);
  };
  return (
    <div className="field" style={{ gridColumn: '1 / -1' }}>
      <label htmlFor={`add-${keys.join('-')}`}>{t('showcase.items')}</label>
      <div ref={sort.containerRef}>
        {items.map((i, n) => (
          <div key={i.key} {...sort.itemProps(i.key)} className="pick-row">
            <button {...sort.handleProps(i.key, i.name)}>
              <GripIcon />
            </button>
            <span className="num">{n + 1}.</span>
            <span className="pick-name">
              {i.name} <span className="meta">({t(`showcase.kind.${i.kind}`)})</span>
            </span>
            <input
              aria-label={t('showcase.note', { name: i.name })}
              placeholder={t('showcase.notePlaceholder')}
              maxLength={160}
              value={i.note ?? ''}
              onChange={(e) => onChange(items.map((x) => (x.key === i.key ? { ...x, note: e.target.value } : x)))}
            />
            <button type="button" className="link" onClick={() => onChange(items.filter((x) => x.key !== i.key))}>{t('showcase.removeItem')}</button>
          </div>
        ))}
      </div>
      {items.length < 8 ? (
        <select id={`add-${keys.join('-')}`} value="" onChange={(e) => e.target.value && add(e.target.value)}>
          <option value="">{t('showcase.addItem')}</option>
          {businesses.length ? (
            <optgroup label={t('showcase.businesses')}>
              {businesses.filter((b) => !taken.has(`isletme:${b.id}`)).map((b) => (
                <option key={b.id} value={`isletme:${b.id}`}>{b.name}{b.verification.status === 'dogrulandi' ? ' ✓' : ''}</option>
              ))}
            </optgroup>
          ) : null}
          {places.length ? (
            <optgroup label={t('showcase.places')}>
              {places.filter((p) => !taken.has(`yer:${p.id}`)).map((p) => (
                <option key={p.id} value={`yer:${p.id}`}>{p.name}</option>
              ))}
            </optgroup>
          ) : null}
        </select>
      ) : null}
      {!businesses.length && !places.length ? <p className="meta">{t('showcase.noPicks')}</p> : null}
    </div>
  );
}
