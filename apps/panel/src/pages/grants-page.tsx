import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ALL_ACTIONS,
  ALL_MODULES,
  can,
  defaultModulesFor,
  DELEGABLE_ROLES,
  grantDocId,
  grantState,
  intersectCaps,
  isGrantActive,
  isValidEmail,
  normalizeModules,
  ROLE_CAPS,
  ROLE_SCOPE_LEVELS,
  ROLE_TEMPLATES,
  type Action,
  type GrantRecord,
  type Module,
  type Neighbourhood,
  type PermissionGrant,
  type PersonRole,
  type RegionScope,
} from '@cityjoy/shared';
import { createGrantAdmin } from '@cityjoy/shared/firebase';

import { ScopeLabel } from '../components/scope-label';
import { firestore } from '../lib/firebase';
import { locationRepository as repo } from '../lib/locations';
import { isAdminUser, useSession, type PanelUser } from '../lib/session';
import { t } from '../lib/t';

type Caps = Partial<Record<Module, Action[]>>;
type Level = RegionScope['level'];

interface Draft {
  isNew: boolean;
  email: string;
  displayName: string;
  note: string;
  role: PersonRole;
  level: Level;
  provinceCode: string;
  districtId: string;
  neighbourhoodId: string;
  modules: Caps;
  /** yyyy-mm-dd, boşsa süresiz. */
  expiresOn: string;
}

/** Yetki verenin kapsamı: admin her yerde; il yöneticisi yalnızca kendi illerinde ve kendi yetkisi kadar. */
interface Granter {
  isAdmin: boolean;
  roles: PersonRole[];
  /** İl yöneticisinin illeri ve o ildeki kendi yetkisi. Admin için boş. */
  provinces: Map<string, Caps>;
}

function granterOf(user: PanelUser): Granter | null {
  if (isAdminUser(user)) return { isAdmin: true, roles: DELEGABLE_ROLES.admin, provinces: new Map() };
  const now = new Date();
  const own = user.grants.filter(
    (g): g is PermissionGrant & { scope: { level: 'il'; provinceCode: string } } =>
      g.role === 'il-yoneticisi' && g.scope.level === 'il' && isGrantActive(g, now) && !!g.modules.yetkiler?.includes('ekle'),
  );
  if (!own.length) return null;
  return { isAdmin: false, roles: DELEGABLE_ROLES['il-yoneticisi'], provinces: new Map(own.map((g) => [g.scope.provinceCode, g.modules])) };
}

/** Bu rol, bu ilde verilirken işaretlenebilecek en geniş yetki. */
function capsFor(granter: Granter, role: PersonRole, provinceCode: string): Caps {
  if (granter.isAdmin) return ROLE_CAPS[role];
  return intersectCaps(ROLE_CAPS[role], granter.provinces.get(provinceCode) ?? {});
}

function newDraft(granter: Granter): Draft {
  const role = granter.roles[0]!;
  const provinceCode = granter.isAdmin ? '' : ([...granter.provinces.keys()][0] ?? '');
  return {
    isNew: true,
    email: '',
    displayName: '',
    note: '',
    role,
    level: ROLE_SCOPE_LEVELS[role][0]!,
    provinceCode,
    districtId: '',
    neighbourhoodId: '',
    modules: normalizeModules(defaultModulesFor(role, ROLE_TEMPLATES), capsFor(granter, role, provinceCode)),
    expiresOn: '',
  };
}

function draftFrom(g: GrantRecord): Draft {
  const s = g.scope;
  return {
    isNew: false,
    email: g.email,
    displayName: g.displayName,
    note: g.note ?? '',
    role: g.role,
    level: s.level,
    provinceCode: s.level === 'ulke' ? '' : s.provinceCode,
    districtId: s.level === 'ilce' || s.level === 'mahalle' ? s.districtId : '',
    neighbourhoodId: s.level === 'mahalle' ? s.neighbourhoodId : '',
    modules: g.modules,
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
 * Yetkiler (PROJE.md 6.7): admin il yöneticisi, muhtar ve gönüllü moderatör atar; il yöneticisi kendi ilinde muhtar
 * ve moderatör atar, kendinde olmayan yetkiyi veremez. Kişi e-postasıyla eklenir, form doldurmaz. Diğer
 * yöneticiler yalnızca kendi yetkilerini görür. Kurum personeli Kurumlar sayfasından yönetilir.
 */
export function GrantsPage() {
  const { user } = useSession();
  if (!user) return null;
  const granter = granterOf(user);
  if (!granter) return <OwnGrants user={user} />;
  return <ManageGrants user={user} granter={granter} />;
}

function OwnGrants({ user }: { user: PanelUser }) {
  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('grants.ownTitle')}</h1>
          <p className="meta">{t('grants.ownIntro')}</p>
        </div>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('grants.role')}</th>
              <th scope="col">{t('grants.scope')}</th>
              <th scope="col">{t('grants.modules')}</th>
            </tr>
          </thead>
          <tbody>
            {user.grants.map((g) => (
              <tr key={g.id}>
                <td>
                  {t(`roles.${g.role}`)}
                  {g.orgId ? <div className="meta">{user.memberships.find((m) => m.org.id === g.orgId)?.org.name}</div> : null}
                </td>
                <td><ScopeLabel scope={g.scope} /></td>
                <td><ModuleList modules={g.modules} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ModuleList({ modules }: { modules: Caps }) {
  const keys = Object.keys(modules) as Module[];
  return (
    <details>
      <summary>{t('grants.moduleCount', { count: keys.length })}</summary>
      <ul className="plain-list">
        {keys.map((m) => (
          <li key={m}>
            <strong>{t(`nav.${m}`)}</strong>: {(modules[m] ?? []).map((a) => t(`actions.${a}`)).join(', ')}
          </li>
        ))}
      </ul>
    </details>
  );
}

function ManageGrants({ user, granter }: { user: PanelUser; granter: Granter }) {
  const admin = useMemo(() => createGrantAdmin(firestore, user.uid), [user.uid]);
  const myProvinces = [...granter.provinces.keys()].sort();
  const provinces = useMemo(
    () => repo.getProvinces().filter((p) => granter.isAdmin || granter.provinces.has(p.code)),
    [granter.isAdmin, myProvinces.join()],
  );

  const [grants, setGrants] = useState<GrantRecord[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState({ state: 'aktif', provinceCode: '', query: '' });

  const load = useCallback(async () => {
    setLoadError(false);
    if (user.isDemo) return setGrants([]);
    try {
      if (granter.isAdmin) setGrants(await admin.listAll());
      else setGrants((await Promise.all(myProvinces.map((p) => admin.listForProvince(p)))).flat());
    } catch {
      setLoadError(true);
    }
  }, [admin, user.isDemo, granter.isAdmin, myProvinces.join()]);

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
    const email = d.email.trim().toLowerCase();
    if (!isValidEmail(email)) return setMessage({ kind: 'error', text: t('grants.emailRequired') });
    if (email === user.email?.toLowerCase()) return setMessage({ kind: 'error', text: t('grants.notSelf') });
    if (d.displayName.trim().length < 2) return setMessage({ kind: 'error', text: t('grants.nameRequired') });
    const scope = scopeOf(d);
    if (!scope) return setMessage({ kind: 'error', text: t('grants.scopeRequired') });
    const modules = normalizeModules(d.modules, capsFor(granter, d.role, d.provinceCode));
    if (!Object.keys(modules).length) return setMessage({ kind: 'error', text: t('grants.modulesRequired') });
    const expiresAt = d.expiresOn ? new Date(`${d.expiresOn}T23:59:59`) : undefined;
    if (expiresAt && expiresAt <= new Date()) return setMessage({ kind: 'error', text: t('grants.expiryPast') });
    // Aynı kişiye aynı bölgede ikinci yetki açılmaz: varsa güncellenir.
    const existing = grants?.find((g) => g.id === grantDocId(email, scope));
    if (existing && !granter.isAdmin && existing.role === 'il-yoneticisi') return setMessage({ kind: 'error', text: t('grants.cannotOverwrite') });
    const ok = await act(
      () => admin.save({ email, displayName: d.displayName, note: d.note, role: d.role, scope, modules, expiresAt }, !existing),
      existing ? t('grants.updated') : t('grants.granted', { email }),
    );
    if (ok) setDraft(null);
  };

  const canRevoke = (g: GrantRecord) =>
    grantState(g) === 'aktif' &&
    (granter.isAdmin || (g.role !== 'il-yoneticisi' && can(user.grants, { module: 'yetkiler', action: 'sil', region: { provinceCode: provinceOf(g.scope) } })));

  const revoke = (g: GrantRecord) => {
    if (!window.confirm(t('grants.revokeConfirm', { name: g.displayName, role: t(`roles.${g.role}`) }))) return;
    act(() => admin.revoke(g), t('grants.revoked'));
  };

  const q = filter.query.trim().toLocaleLowerCase('tr');
  const visible = (grants ?? []).filter(
    (g) =>
      (filter.state === 'tumu' || grantState(g) === filter.state) &&
      (!filter.provinceCode || provinceOf(g.scope) === filter.provinceCode) &&
      (!q || `${g.displayName} ${g.email}`.toLocaleLowerCase('tr').includes(q)),
  );

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('grants.title')}</h1>
          <p className="meta">{granter.isAdmin ? t('grants.introAdmin') : t('grants.introProvince')}</p>
        </div>
        {!draft && !user.isDemo ? (
          <div className="actions">
            <button className="btn" onClick={() => setDraft(newDraft(granter))}>{t('grants.new')}</button>
          </div>
        ) : null}
      </header>
      {user.isDemo ? <p className="note">{t('grants.demoReadOnly')}</p> : null}
      <p className="note">{granter.isAdmin ? t('grants.adminNote') : t('grants.provinceNote')}</p>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {draft ? <GrantForm draft={draft} setDraft={setDraft} granter={granter} provinces={provinces} busy={busy} onSubmit={save} /> : null}

      <h2>{t('grants.listTitle')}</h2>
      <div className="toolbar">
        <label htmlFor="grant-state" className="sr-only">{t('grants.filterState')}</label>
        <select id="grant-state" value={filter.state} onChange={(e) => setFilter({ ...filter, state: e.target.value })}>
          {['aktif', 'suresi-doldu', 'geri-alindi', 'tumu'].map((s) => (
            <option key={s} value={s}>{t(`grants.states.${s}`)}</option>
          ))}
        </select>
        {provinces.length > 1 ? (
          <>
            <label htmlFor="grant-province" className="sr-only">{t('grants.filterProvince')}</label>
            <select id="grant-province" value={filter.provinceCode} onChange={(e) => setFilter({ ...filter, provinceCode: e.target.value })}>
              <option value="">{t('grants.allProvinces')}</option>
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
          </>
        ) : null}
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
      ) : visible.length === 0 ? (
        <div className="state">{t('grants.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('grants.person')}</th>
                <th scope="col">{t('grants.role')}</th>
                <th scope="col">{t('grants.scope')}</th>
                <th scope="col">{t('grants.modules')}</th>
                <th scope="col">{t('grants.status')}</th>
                <th scope="col"><span className="sr-only">{t('grants.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((g) => {
                const state = grantState(g);
                const editable = !user.isDemo && (granter.isAdmin || g.role !== 'il-yoneticisi');
                return (
                  <tr key={g.id}>
                    <td>
                      <strong>{g.displayName}</strong>
                      <div className="meta">{g.email}</div>
                      {g.note ? <div className="meta">{g.note}</div> : null}
                    </td>
                    <td>{t(`roles.${g.role}`)}</td>
                    <td><ScopeLabel scope={g.scope} /></td>
                    <td><ModuleList modules={g.modules} /></td>
                    <td>
                      <span className={state === 'aktif' ? 'pill ok' : 'pill'}>{t(`grants.states.${state}`)}</span>
                      {g.expiresAt && state === 'aktif' ? <div className="meta">{t('grants.until', { date: new Date(g.expiresAt).toLocaleDateString('tr-TR') })}</div> : null}
                      {g.grantedAt ? <div className="meta">{t('grants.since', { date: new Date(g.grantedAt).toLocaleDateString('tr-TR') })}</div> : null}
                    </td>
                    <td>
                      {editable ? (
                        <div className="row-actions">
                          <button className="link" disabled={busy} onClick={() => setDraft(draftFrom(g))}>
                            {state === 'aktif' ? t('grants.edit') : t('grants.regrant')}
                          </button>
                          {canRevoke(g) ? <button className="link" disabled={busy} onClick={() => revoke(g)}>{t('grants.revoke')}</button> : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="count">{t('grants.count', { count: visible.length })}</p>
        </div>
      )}
    </section>
  );
}

function GrantForm({
  draft,
  setDraft,
  granter,
  provinces,
  busy,
  onSubmit,
}: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  granter: Granter;
  provinces: { code: string; name: string }[];
  busy: boolean;
  onSubmit: (d: Draft) => void;
}) {
  const districts = draft.provinceCode ? repo.getDistricts(draft.provinceCode) : [];
  const [neighbourhoods, setNeighbourhoods] = useState<Neighbourhood[] | null>(null);
  const levels = ROLE_SCOPE_LEVELS[draft.role];
  const caps = capsFor(granter, draft.role, draft.provinceCode);
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const fixed = !draft.isNew;

  useEffect(() => {
    setNeighbourhoods(null);
    if (draft.level !== 'mahalle' || !draft.districtId) return;
    repo.getNeighbourhoods(draft.districtId).then(setNeighbourhoods, () => setNeighbourhoods([]));
  }, [draft.level, draft.districtId]);

  const changeRole = (role: PersonRole) => {
    const allowed = ROLE_SCOPE_LEVELS[role];
    set({
      role,
      level: allowed.includes(draft.level) ? draft.level : allowed[0]!,
      modules: normalizeModules(defaultModulesFor(role, ROLE_TEMPLATES), capsFor(granter, role, draft.provinceCode)),
    });
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

  const shownModules = ALL_MODULES.filter((m) => caps[m]?.length);

  return (
    <form className="form panel-form" onSubmit={submit} aria-labelledby="grant-form-title">
      <h2 id="grant-form-title" className="form-section">{draft.isNew ? t('grants.new') : t('grants.editTitle')}</h2>
      <p className="form-section meta">{t('grants.personHint')}</p>
      <div className="field">
        <label htmlFor="g-email">{t('grants.email')}</label>
        <input id="g-email" type="email" dir="ltr" autoComplete="off" value={draft.email} maxLength={120} readOnly={fixed} onChange={(e) => set({ email: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="g-name">{t('grants.name')}</label>
        <input id="g-name" value={draft.displayName} maxLength={80} onChange={(e) => set({ displayName: e.target.value })} />
      </div>

      <h3 className="form-section">{t('grants.roleAndScope')}</h3>
      <div className="field">
        <label htmlFor="g-role">{t('grants.role')}</label>
        <select id="g-role" value={draft.role} disabled={fixed} onChange={(e) => changeRole(e.target.value as PersonRole)}>
          {(fixed ? [draft.role] : granter.roles).map((r) => (
            <option key={r} value={r}>{t(`roles.${r}`)}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="g-level">{t('grants.level')}</label>
        <select id="g-level" value={draft.level} disabled={fixed || levels.length === 1} onChange={(e) => set({ level: e.target.value as Level })}>
          {levels.map((l) => (
            <option key={l} value={l}>{t(`grants.levels.${l}`)}</option>
          ))}
        </select>
      </div>
      {draft.level !== 'ulke' ? (
        <div className="field">
          <label htmlFor="g-province">{t('grants.province')}</label>
          <select
            id="g-province"
            value={draft.provinceCode}
            disabled={fixed || provinces.length === 1}
            onChange={(e) =>
              set({
                provinceCode: e.target.value,
                districtId: '',
                neighbourhoodId: '',
                modules: normalizeModules(draft.modules, capsFor(granter, draft.role, e.target.value)),
              })
            }>
            {provinces.length > 1 ? <option value="">{t('grants.choose')}</option> : null}
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
        </div>
      ) : null}
      {(draft.level === 'ilce' || draft.level === 'mahalle') && draft.provinceCode ? (
        <div className="field">
          <label htmlFor="g-district">{t('grants.district')}</label>
          <select id="g-district" value={draft.districtId} disabled={fixed} onChange={(e) => set({ districtId: e.target.value, neighbourhoodId: '' })}>
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
          <select id="g-neighbourhood" value={draft.neighbourhoodId} disabled={fixed || !neighbourhoods} onChange={(e) => set({ neighbourhoodId: e.target.value })}>
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
      {fixed ? <p className="form-section meta">{t('grants.scopeFixed')}</p> : null}

      <h3 className="form-section">{t('grants.modules')}</h3>
      <p className="form-section meta">{granter.isAdmin ? t('grants.modulesHint') : t('grants.modulesHintProvince')}</p>
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
            {shownModules.map((m) => (
              <tr key={m}>
                <th scope="row">{t(`nav.${m}`)}</th>
                {ALL_ACTIONS.map((a) => {
                  const allowed = caps[m]!.includes(a);
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
