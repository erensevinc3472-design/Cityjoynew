import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ALL_ACTIONS,
  ALL_MODULES,
  ASSIGNABLE_ROLES,
  defaultModulesFor,
  GRANTABLE_ACTIONS,
  grantDocId,
  grantState,
  normalizeModules,
  ROLE_SCOPE_LEVELS,
  ROLE_TEMPLATES,
  type AccessRequest,
  type Action,
  type GrantRecord,
  type Module,
  type Neighbourhood,
  type RegionScope,
  type Role,
} from '@cityjoy/shared';
import { createGrantAdmin } from '@cityjoy/shared/firebase';

import { ScopeLabel } from '../components/scope-label';
import { firestore } from '../lib/firebase';
import { locationRepository as repo } from '../lib/locations';
import { useSession } from '../lib/session';
import { t } from '../lib/t';

type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
type Level = RegionScope['level'];

interface Draft {
  isNew: boolean;
  /** Kişi talepten ya da var olan yetkiden geldi; hesap kimliği değiştirilemez. */
  personLocked: boolean;
  uid: string;
  displayName: string;
  email: string;
  note: string;
  role: AssignableRole;
  level: Level;
  provinceCode: string;
  districtId: string;
  neighbourhoodId: string;
  modules: Partial<Record<Module, Action[]>>;
  /** yyyy-mm-dd, boşsa süresiz. */
  expiresOn: string;
}

const GRANTABLE_MODULES = ALL_MODULES.filter((m) => GRANTABLE_ACTIONS[m]?.length);

function newDraft(person?: { uid: string; displayName: string; email?: string; note?: string }): Draft {
  return {
    isNew: true,
    personLocked: !!person,
    uid: person?.uid ?? '',
    displayName: person?.displayName ?? '',
    email: person?.email ?? '',
    note: person?.note ?? '',
    role: 'il-yoneticisi',
    level: 'il',
    provinceCode: '',
    districtId: '',
    neighbourhoodId: '',
    modules: defaultModulesFor('il-yoneticisi', ROLE_TEMPLATES),
    expiresOn: '',
  };
}

function draftFrom(g: GrantRecord): Draft {
  const s = g.scope;
  return {
    isNew: false,
    personLocked: true,
    uid: g.uid,
    displayName: g.displayName,
    email: g.email ?? '',
    note: g.note ?? '',
    role: g.role as AssignableRole,
    level: s.level,
    provinceCode: s.level === 'ulke' ? '' : s.provinceCode,
    districtId: s.level === 'ilce' || s.level === 'mahalle' ? s.districtId : '',
    neighbourhoodId: s.level === 'mahalle' ? s.neighbourhoodId : '',
    modules: normalizeModules(g.modules),
    // Geri alınmış ya da süresi dolmuş yetki yeniden verilirken eski bitiş tarihi taşınmaz.
    expiresOn: grantState(g) === 'aktif' && g.expiresAt ? g.expiresAt.slice(0, 10) : '',
  };
}

function scopeOf(d: Draft): RegionScope | null {
  if (d.level === 'ulke') return { level: 'ulke' };
  if (!d.provinceCode) return null;
  if (d.level === 'il') return { level: 'il', provinceCode: d.provinceCode };
  if (!d.districtId) return null;
  if (d.level === 'ilce') return { level: 'ilce', provinceCode: d.provinceCode, districtId: d.districtId };
  if (!d.neighbourhoodId) return null;
  return { level: 'mahalle', provinceCode: d.provinceCode, districtId: d.districtId, neighbourhoodId: d.neighbourhoodId };
}

const provinceOf = (s: RegionScope) => (s.level === 'ulke' ? '' : s.provinceCode);

/**
 * Yetkiler (PROJE.md 6, 6.4 madde 2): admin rol × bölge × bölüm × eylem yetkisi verir, değiştirir, geri alır,
 * süreli verir ve panelden gelen yetki taleplerini karşılar. Diğer yöneticiler yalnızca kendi yetkilerini görür.
 */
export function GrantsPage() {
  const { user } = useSession();
  const isAdmin = !!user?.grants.some((g) => g.role === 'admin');
  const canEdit = isAdmin && !user?.isDemo;

  if (!user) return null;
  if (!isAdmin) return <OwnGrants />;

  return <AdminGrants canEdit={canEdit} actorUid={user.uid} isDemo={!!user.isDemo} />;
}

function OwnGrants() {
  const { user } = useSession();
  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('grants.ownTitle')}</h1>
          <p className="meta">{t('grants.ownIntro')}</p>
        </div>
      </header>
      <GrantTable list={(user?.grants ?? []) as GrantRecord[]} showPerson={false} />
    </section>
  );
}

function AdminGrants({ canEdit, actorUid, isDemo }: { canEdit: boolean; actorUid: string; isDemo: boolean }) {
  const admin = useMemo(() => createGrantAdmin(firestore, actorUid), [actorUid]);
  const provinces = useMemo(() => repo.getProvinces(), []);

  const [grants, setGrants] = useState<GrantRecord[] | null>(null);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState({ state: 'aktif', provinceCode: '', query: '' });

  const load = useCallback(async () => {
    setLoadError(false);
    if (isDemo) {
      setGrants([]);
      setRequests([]);
      return;
    }
    try {
      const [g, r] = await Promise.all([admin.listAll(), admin.listRequests()]);
      setGrants(g);
      setRequests(r);
    } catch {
      setLoadError(true);
    }
  }, [admin, isDemo]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
      setMessage({ kind: 'ok', text: ok });
      await load();
      return true;
    } catch {
      setMessage({ kind: 'error', text: t('grants.error') });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async (d: Draft) => {
    const scope = scopeOf(d);
    if (!d.uid.trim()) return setMessage({ kind: 'error', text: t('grants.uidRequired') });
    if (d.displayName.trim().length < 2) return setMessage({ kind: 'error', text: t('grants.nameRequired') });
    if (!scope) return setMessage({ kind: 'error', text: t('grants.scopeRequired') });
    const modules = normalizeModules(d.modules);
    if (!Object.keys(modules).length) return setMessage({ kind: 'error', text: t('grants.modulesRequired') });
    if (d.uid.trim() === actorUid) return setMessage({ kind: 'error', text: t('grants.notSelf') });
    const expiresAt = d.expiresOn ? new Date(`${d.expiresOn}T23:59:59`) : undefined;
    if (expiresAt && expiresAt <= new Date()) return setMessage({ kind: 'error', text: t('grants.expiryPast') });
    // Aynı kişiye aynı bölgede ikinci yetki açılmaz: varsa güncellenir.
    const exists = grants?.some((g) => g.id === grantDocId(d.uid.trim(), scope));
    const ok = await act(
      () =>
        admin.save(
          { uid: d.uid.trim(), displayName: d.displayName, email: d.email || undefined, note: d.note, role: d.role, scope, modules, expiresAt },
          !exists,
        ),
      exists ? t('grants.updated') : t('grants.granted'),
    );
    if (ok) setDraft(null);
  };

  const revoke = (g: GrantRecord) => {
    if (!window.confirm(t('grants.revokeConfirm', { name: g.displayName, role: t(`roles.${g.role}`) }))) return;
    act(() => admin.revoke(g), t('grants.revoked'));
  };

  const reject = (r: AccessRequest) => {
    if (!window.confirm(t('grants.rejectConfirm', { name: r.displayName }))) return;
    act(() => admin.rejectRequest(r), t('grants.rejected'));
  };

  const q = filter.query.trim().toLocaleLowerCase('tr');
  const visible = (grants ?? []).filter(
    (g) =>
      (filter.state === 'tumu' || grantState(g) === filter.state) &&
      (!filter.provinceCode || provinceOf(g.scope) === filter.provinceCode) &&
      (!q || `${g.displayName} ${g.email ?? ''}`.toLocaleLowerCase('tr').includes(q)),
  );

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('grants.title')}</h1>
          <p className="meta">{t('grants.intro')}</p>
        </div>
        {canEdit && !draft ? (
          <div className="actions">
            <button className="btn" onClick={() => setDraft(newDraft())}>{t('grants.new')}</button>
          </div>
        ) : null}
      </header>
      {isDemo ? <p className="note">{t('grants.demoReadOnly')}</p> : null}
      <p className="note">{t('grants.adminNote')}</p>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {draft ? <GrantForm draft={draft} setDraft={setDraft} busy={busy} onSubmit={save} /> : null}

      <h2>{t('grants.requestsTitle')}</h2>
      {requests.length === 0 ? (
        <div className="state">{t('grants.requestsEmpty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('grants.person')}</th>
                <th scope="col">{t('grants.requestNote')}</th>
                <th scope="col">{t('grants.date')}</th>
                {canEdit ? <th scope="col"><span className="sr-only">{t('grants.actions')}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.uid}>
                  <td>
                    <strong>{r.displayName}</strong>
                    <div className="meta">{r.email}</div>
                  </td>
                  <td>{r.note || <span className="meta">-</span>}</td>
                  <td className="num">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('tr-TR') : '-'}</td>
                  {canEdit ? (
                    <td>
                      <div className="row-actions">
                        <button className="link" disabled={busy} onClick={() => setDraft(newDraft({ uid: r.uid, displayName: r.displayName, email: r.email, note: r.note }))}>
                          {t('grants.grantFromRequest')}
                        </button>
                        <button className="link" disabled={busy} onClick={() => reject(r)}>{t('grants.reject')}</button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>{t('grants.listTitle')}</h2>
      <div className="toolbar">
        <label htmlFor="grant-state" className="sr-only">{t('grants.filterState')}</label>
        <select id="grant-state" value={filter.state} onChange={(e) => setFilter({ ...filter, state: e.target.value })}>
          {['aktif', 'suresi-doldu', 'geri-alindi', 'tumu'].map((s) => (
            <option key={s} value={s}>{t(`grants.states.${s}`)}</option>
          ))}
        </select>
        <label htmlFor="grant-province" className="sr-only">{t('grants.filterProvince')}</label>
        <select id="grant-province" value={filter.provinceCode} onChange={(e) => setFilter({ ...filter, provinceCode: e.target.value })}>
          <option value="">{t('grants.allProvinces')}</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </select>
        <label htmlFor="grant-search" className="sr-only">{t('grants.search')}</label>
        <input id="grant-search" type="search" placeholder={t('grants.search')} value={filter.query} onChange={(e) => setFilter({ ...filter, query: e.target.value })} />
      </div>

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('grants.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('grants.retry')}</button>
        </div>
      ) : grants === null ? (
        <div className="state" aria-live="polite">{t('grants.loading')}</div>
      ) : (
        <GrantTable
          list={visible}
          showPerson
          actions={
            canEdit
              ? (g) => (
                  <div className="row-actions">
                    <button className="link" disabled={busy} onClick={() => setDraft(draftFrom(g))}>
                      {grantState(g) === 'aktif' ? t('grants.edit') : t('grants.regrant')}
                    </button>
                    {grantState(g) === 'aktif' ? (
                      <button className="link" disabled={busy} onClick={() => revoke(g)}>{t('grants.revoke')}</button>
                    ) : null}
                  </div>
                )
              : undefined
          }
        />
      )}
    </section>
  );
}

function GrantTable({ list, showPerson, actions }: { list: GrantRecord[]; showPerson: boolean; actions?: (g: GrantRecord) => React.ReactNode }) {
  if (!list.length) return <div className="state">{t('grants.empty')}</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {showPerson ? <th scope="col">{t('grants.person')}</th> : null}
            <th scope="col">{t('grants.role')}</th>
            <th scope="col">{t('grants.scope')}</th>
            <th scope="col">{t('grants.modules')}</th>
            <th scope="col">{t('grants.status')}</th>
            {actions ? <th scope="col"><span className="sr-only">{t('grants.actions')}</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {list.map((g) => {
            const state = grantState(g);
            const modules = Object.keys(g.modules) as Module[];
            return (
              <tr key={g.id}>
                {showPerson ? (
                  <td>
                    <strong>{g.displayName}</strong>
                    {g.email ? <div className="meta">{g.email}</div> : null}
                    {g.note ? <div className="meta">{g.note}</div> : null}
                  </td>
                ) : null}
                <td>{t(`roles.${g.role}`)}</td>
                <td><ScopeLabel scope={g.scope} /></td>
                <td>
                  <details>
                    <summary>{t('grants.moduleCount', { count: modules.length })}</summary>
                    <ul className="plain-list">
                      {modules.map((m) => (
                        <li key={m}>
                          <strong>{t(`nav.${m}`)}</strong>: {(g.modules[m] ?? []).map((a) => t(`actions.${a}`)).join(', ')}
                        </li>
                      ))}
                    </ul>
                  </details>
                </td>
                <td>
                  <span className={state === 'aktif' ? 'pill ok' : 'pill'}>{t(`grants.states.${state}`)}</span>
                  {g.expiresAt && state === 'aktif' ? <div className="meta">{t('grants.until', { date: new Date(g.expiresAt).toLocaleDateString('tr-TR') })}</div> : null}
                  {g.grantedAt ? <div className="meta">{t('grants.since', { date: new Date(g.grantedAt).toLocaleDateString('tr-TR') })}</div> : null}
                </td>
                {actions ? <td>{actions(g)}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="count">{t('grants.count', { count: list.length })}</p>
    </div>
  );
}

function GrantForm({
  draft,
  setDraft,
  busy,
  onSubmit,
}: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  busy: boolean;
  onSubmit: (d: Draft) => void;
}) {
  const provinces = useMemo(() => repo.getProvinces(), []);
  const districts = draft.provinceCode ? repo.getDistricts(draft.provinceCode) : [];
  const [neighbourhoods, setNeighbourhoods] = useState<Neighbourhood[] | null>(null);
  const levels = ROLE_SCOPE_LEVELS[draft.role as Role];
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  useEffect(() => {
    setNeighbourhoods(null);
    if (draft.level !== 'mahalle' || !draft.districtId) return;
    repo.getNeighbourhoods(draft.districtId).then(setNeighbourhoods, () => setNeighbourhoods([]));
  }, [draft.level, draft.districtId]);

  const changeRole = (role: AssignableRole) => {
    const allowed = ROLE_SCOPE_LEVELS[role];
    set({ role, level: allowed.includes(draft.level) ? draft.level : allowed[0]!, modules: defaultModulesFor(role, ROLE_TEMPLATES) });
  };

  const toggle = (m: Module, a: Action, on: boolean) => {
    const current = new Set(draft.modules[m] ?? []);
    if (on) current.add(a);
    else current.delete(a);
    // Görüntüleme kaldırılınca bölümün tüm yetkileri kalkar.
    if (a === 'goruntule' && !on) current.clear();
    set({ modules: { ...draft.modules, [m]: [...current] } });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(draft);
  };

  const fixedScope = !draft.isNew;

  return (
    <form className="form panel-form" onSubmit={submit} aria-labelledby="grant-form-title">
      <h2 id="grant-form-title" className="form-section">{draft.isNew ? t('grants.new') : t('grants.editTitle')}</h2>

      <p className="form-section meta">{t('grants.personHint')}</p>
      <div className="field">
        <label htmlFor="g-name">{t('grants.name')}</label>
        <input id="g-name" value={draft.displayName} maxLength={80} onChange={(e) => set({ displayName: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="g-email">{t('grants.email')}</label>
        <input id="g-email" type="email" value={draft.email} maxLength={120} onChange={(e) => set({ email: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="g-uid">{t('grants.uid')}</label>
        <input id="g-uid" value={draft.uid} readOnly={draft.personLocked} dir="ltr" onChange={(e) => set({ uid: e.target.value })} />
      </div>

      <h3 className="form-section">{t('grants.roleAndScope')}</h3>
      <div className="field">
        <label htmlFor="g-role">{t('grants.role')}</label>
        <select id="g-role" value={draft.role} disabled={fixedScope} onChange={(e) => changeRole(e.target.value as AssignableRole)}>
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>{t(`roles.${r}`)}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="g-level">{t('grants.level')}</label>
        <select id="g-level" value={draft.level} disabled={fixedScope || levels.length === 1} onChange={(e) => set({ level: e.target.value as Level })}>
          {levels.map((l) => (
            <option key={l} value={l}>{t(`grants.levels.${l}`)}</option>
          ))}
        </select>
      </div>
      {draft.level !== 'ulke' ? (
        <div className="field">
          <label htmlFor="g-province">{t('grants.province')}</label>
          <select id="g-province" value={draft.provinceCode} disabled={fixedScope} onChange={(e) => set({ provinceCode: e.target.value, districtId: '', neighbourhoodId: '' })}>
            <option value="">{t('grants.choose')}</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
        </div>
      ) : null}
      {(draft.level === 'ilce' || draft.level === 'mahalle') && draft.provinceCode ? (
        <div className="field">
          <label htmlFor="g-district">{t('grants.district')}</label>
          <select id="g-district" value={draft.districtId} disabled={fixedScope} onChange={(e) => set({ districtId: e.target.value, neighbourhoodId: '' })}>
            <option value="">{t('grants.choose')}</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      ) : null}
      {draft.level === 'mahalle' && draft.districtId ? (
        <div className="field">
          <label htmlFor="g-neighbourhood">{t('grants.neighbourhood')}</label>
          <select id="g-neighbourhood" value={draft.neighbourhoodId} disabled={fixedScope || !neighbourhoods} onChange={(e) => set({ neighbourhoodId: e.target.value })}>
            <option value="">{neighbourhoods ? t('grants.choose') : t('grants.loading')}</option>
            {(neighbourhoods ?? []).map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="g-expires">{t('grants.expires')}</label>
        <input id="g-expires" type="date" value={draft.expiresOn} min={new Date().toISOString().slice(0, 10)} onChange={(e) => set({ expiresOn: e.target.value })} />
        <span className="meta">{t('grants.expiresHint')}</span>
      </div>
      {fixedScope ? <p className="form-section meta">{t('grants.scopeFixed')}</p> : null}

      <h3 className="form-section">{t('grants.modules')}</h3>
      <p className="form-section meta">{t('grants.modulesHint')}</p>
      <div className="form-section table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('grants.module')}</th>
              {ALL_ACTIONS.map((a) => (
                <th key={a} scope="col">{t(`actions.${a}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRANTABLE_MODULES.map((m) => (
              <tr key={m}>
                <th scope="row">{t(`nav.${m}`)}</th>
                {ALL_ACTIONS.map((a) => {
                  const allowed = GRANTABLE_ACTIONS[m]!.includes(a);
                  const checked = !!draft.modules[m]?.includes(a);
                  const viewOff = a !== 'goruntule' && !draft.modules[m]?.includes('goruntule');
                  return (
                    <td key={a}>
                      {allowed ? (
                        <input
                          type="checkbox"
                          aria-label={`${t(`nav.${m}`)}: ${t(`actions.${a}`)}`}
                          checked={checked}
                          disabled={viewOff && !checked}
                          onChange={(e) => toggle(m, a, e.target.checked)}
                        />
                      ) : (
                        <span className="meta" aria-hidden>-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="field form-section">
        <label htmlFor="g-note">{t('grants.note')}</label>
        <textarea id="g-note" rows={2} maxLength={300} value={draft.note} onChange={(e) => set({ note: e.target.value })} placeholder={t('grants.notePlaceholder')} />
      </div>

      <div className="actions">
        <button className="btn" type="submit" disabled={busy}>{draft.isNew ? t('grants.grant') : t('grants.save')}</button>
        <button className="btn secondary" type="button" onClick={() => setDraft(null)}>{t('grants.cancel')}</button>
      </div>
    </form>
  );
}
