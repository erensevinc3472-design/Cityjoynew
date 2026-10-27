import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  isGrantActive,
  isMemberActive,
  isOrganizationActive,
  isValidEmail,
  listMunicipalities,
  ORG_MODULES,
  type Module,
  type Organization,
  type OrganizationKind,
  type OrganizationMember,
  type RegionScope,
  type StaffAssignment,
  type StaffRole,
} from '@cityjoy/shared';
import { createAccountWithSetupLink, createOrganizationAdmin, occupationIdFromName, resendSetupLink } from '@cityjoy/shared/firebase';

import { ScopeLabel } from '../components/scope-label';
import { accountAuth, firebaseAuth, firestore } from '../lib/firebase';
import { locationRepository as repo } from '../lib/locations';
import { isAdminUser, useSession, type PanelUser } from '../lib/session';
import { t } from '../lib/t';

type Msg = { kind: 'ok' | 'error'; text: string } | undefined;
const STAFF_ROLES: StaffRole[] = ['izleyen', 'hazirlayan', 'onaylayan'];
const KINDS: ('belediye' | Exclude<OrganizationKind, 'buyuksehir-belediyesi' | 'il-belediyesi' | 'ilce-belediyesi'>)[] = ['belediye', 'kurum', 'kulup', 'yayinci'];

const dateOnly = (iso?: string) => (iso ? iso.slice(0, 10) : '');
const endOfDay = (d: string) => (d ? new Date(`${d}T23:59:59`) : undefined);

/**
 * Kurumlar (PROJE.md 6.6-6.7). Admin kurumu açar: belediye adları kilitli listeden seçilir, hesap kurumun resmî
 * e-postasıyla açılır ve "şifrenizi belirleyin" bağlantısı gönderilir. Kurum yöneticisi kendi personelini e-postayla
 * ekler, görev verir, çıkarır. İl yöneticisi kendi ilindeki kurumları görür.
 */
export function OrganizationsPage() {
  const { user } = useSession();
  if (!user) return null;
  const admin = isAdminUser(user);
  const ownAdminOrgs = user.memberships.filter((m) => m.member.isOrgAdmin).map((m) => m.org);
  const provinceViews = user.grants
    .filter((g) => g.role === 'il-yoneticisi' && g.scope.level === 'il' && isGrantActive(g, new Date()) && g.modules.kurumlar?.includes('goruntule'))
    .map((g) => (g.scope.level === 'il' ? g.scope.provinceCode : ''));
  return <OrgList user={user} isAdmin={admin} ownAdminOrgs={ownAdminOrgs} provinceViews={provinceViews} />;
}

function OrgList({ user, isAdmin, ownAdminOrgs, provinceViews }: { user: PanelUser; isAdmin: boolean; ownAdminOrgs: Organization[]; provinceViews: string[] }) {
  const service = useMemo(() => createOrganizationAdmin(firestore, user.uid), [user.uid]);
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(ownAdminOrgs.length === 1 && !isAdmin ? ownAdminOrgs[0]!.id : null);
  const [message, setMessage] = useState<Msg>();
  const [filter, setFilter] = useState({ provinceCode: '', query: '' });

  const load = useCallback(async () => {
    setLoadError(false);
    if (user.isDemo) return setOrgs([]);
    try {
      if (isAdmin) setOrgs(await service.listAll());
      else {
        const fromProvinces = (await Promise.all(provinceViews.map((p) => service.listForProvince(p)))).flat();
        const byId = new Map([...ownAdminOrgs, ...fromProvinces].map((o) => [o.id, o]));
        setOrgs([...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr')));
      }
    } catch {
      setLoadError(true);
    }
  }, [service, isAdmin, user.isDemo, provinceViews.join(), ownAdminOrgs.map((o) => o.id).join()]);

  useEffect(() => {
    load();
  }, [load]);

  const open = orgs?.find((o) => o.id === openId);
  const canManageMembers = (o: Organization) => isAdmin || ownAdminOrgs.some((x) => x.id === o.id);

  if (open) {
    return (
      <OrgDetail
        user={user}
        org={open}
        isAdmin={isAdmin}
        canManageMembers={canManageMembers(open)}
        onBack={ownAdminOrgs.length === 1 && !isAdmin && !provinceViews.length ? undefined : () => setOpenId(null)}
        onChanged={load}
      />
    );
  }

  const q = filter.query.trim().toLocaleLowerCase('tr');
  const visible = (orgs ?? []).filter(
    (o) => (!filter.provinceCode || (o.scope.level !== 'ulke' && o.scope.provinceCode === filter.provinceCode)) && (!q || o.name.toLocaleLowerCase('tr').includes(q)),
  );
  const now = new Date();

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('orgs.title')}</h1>
          <p className="meta">{isAdmin ? t('orgs.introAdmin') : t('orgs.introOther')}</p>
        </div>
        {isAdmin && !creating && !user.isDemo ? (
          <div className="actions">
            <button className="btn" onClick={() => setCreating(true)}>{t('orgs.new')}</button>
          </div>
        ) : null}
      </header>
      {user.isDemo ? <p className="note">{t('orgs.demoReadOnly')}</p> : null}
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {creating ? (
        <CreateOrgForm
          user={user}
          existingIds={new Set((orgs ?? []).map((o) => o.id))}
          onCancel={() => setCreating(false)}
          onDone={async (text, kind) => {
            setMessage({ kind, text });
            if (kind === 'ok') setCreating(false);
            await load();
          }}
        />
      ) : null}

      <div className="toolbar">
        {isAdmin ? (
          <>
            <label htmlFor="org-province" className="sr-only">{t('orgs.filterProvince')}</label>
            <select id="org-province" value={filter.provinceCode} onChange={(e) => setFilter({ ...filter, provinceCode: e.target.value })}>
              <option value="">{t('orgs.allProvinces')}</option>
              {repo.getProvinces().map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
          </>
        ) : null}
        <label htmlFor="org-search" className="sr-only">{t('orgs.search')}</label>
        <input id="org-search" type="search" placeholder={t('orgs.search')} value={filter.query} onChange={(e) => setFilter({ ...filter, query: e.target.value })} />
      </div>

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('orgs.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('orgs.retry')}</button>
        </div>
      ) : orgs === null ? (
        <div className="state" aria-live="polite">{t('orgs.loading')}</div>
      ) : visible.length === 0 ? (
        <div className="state">{t('orgs.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('orgs.name')}</th>
                <th scope="col">{t('orgs.region')}</th>
                <th scope="col">{t('orgs.modules')}</th>
                <th scope="col">{t('orgs.status')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => {
                const active = isOrganizationActive(o, now);
                return (
                  <tr key={o.id}>
                    <td>
                      {isAdmin || canManageMembers(o) ? <button className="link" onClick={() => setOpenId(o.id)}><strong>{o.name}</strong></button> : <strong>{o.name}</strong>}
                      <div className="meta">{t(`orgs.kinds.${o.kind}`)} · <span dir="ltr">{o.officialEmail}</span></div>
                    </td>
                    <td><ScopeLabel scope={o.scope} /></td>
                    <td>{o.modules.map((m) => t(`nav.${m}`)).join(', ') || '-'}</td>
                    <td>
                      <span className={active ? 'pill ok' : 'pill warn'}>{active ? t('orgs.active') : o.status === 'pasif' ? t('orgs.passive') : t('orgs.contractEnded')}</span>
                      {o.contractEndsAt ? <div className="meta">{t('orgs.contractUntil', { date: new Date(o.contractEndsAt).toLocaleDateString('tr-TR') })}</div> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="count">{t('orgs.count', { count: visible.length })}</p>
        </div>
      )}
    </section>
  );
}

function CreateOrgForm({ user, existingIds, onCancel, onDone }: { user: PanelUser; existingIds: Set<string>; onCancel: () => void; onDone: (text: string, kind: 'ok' | 'error') => void }) {
  const service = useMemo(() => createOrganizationAdmin(firestore, user.uid), [user.uid]);
  const provinces = useMemo(() => repo.getProvinces(), []);
  const municipalities = useMemo(() => listMunicipalities(provinces, provinces.flatMap((p) => repo.getDistricts(p.code))), [provinces]);
  const [kind, setKind] = useState<(typeof KINDS)[number]>('belediye');
  const [provinceCode, setProvinceCode] = useState('');
  const [municipalityId, setMunicipalityId] = useState('');
  const [name, setName] = useState('');
  const [level, setLevel] = useState<'ulke' | 'il' | 'ilce'>('il');
  const [districtId, setDistrictId] = useState('');
  const [email, setEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [modules, setModules] = useState<Module[]>([...ORG_MODULES]);
  const [contractEnds, setContractEnds] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const options = municipalities.filter((m) => m.scope.level !== 'ulke' && m.scope.provinceCode === provinceCode);
  const chosen = municipalities.find((m) => m.id === municipalityId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    let id: string;
    let orgName: string;
    let orgKind: OrganizationKind;
    let scope: RegionScope;
    if (kind === 'belediye') {
      if (!chosen) return setError(t('orgs.chooseMunicipality'));
      ({ id, name: orgName, kind: orgKind, scope } = chosen);
    } else {
      orgName = name.trim();
      if (orgName.length < 2) return setError(t('orgs.nameRequired'));
      id = `krm-${occupationIdFromName(orgName)}`;
      orgKind = kind;
      if (level === 'ulke') scope = { level: 'ulke' };
      else if (!provinceCode) return setError(t('orgs.regionRequired'));
      else if (level === 'il') scope = { level: 'il', provinceCode };
      else if (!districtId) return setError(t('orgs.regionRequired'));
      else scope = { level: 'ilce', provinceCode, districtId };
    }
    const address = email.trim().toLowerCase();
    if (!isValidEmail(address)) return setError(t('orgs.emailRequired'));
    if (adminName.trim().length < 2) return setError(t('orgs.adminNameRequired'));
    if (existingIds.has(id)) return setError(t('orgs.exists'));
    const ends = endOfDay(contractEnds);
    if (ends && ends <= new Date()) return setError(t('orgs.contractPast'));

    setBusy(true);
    try {
      await service.create({ id, name: orgName, kind: orgKind, scope, modules, officialEmail: address, contractEndsAt: ends }, { email: address, displayName: adminName });
    } catch {
      setBusy(false);
      return setError(t('orgs.createError'));
    }
    // Kurum açıldı; hesap açma ayrı adımdır (başarısız olursa ayrıntıdan bağlantı yeniden gönderilir).
    try {
      const result = await createAccountWithSetupLink(accountAuth, address);
      onDone(result === 'olusturuldu' ? t('orgs.createdWithLink', { name: orgName, email: address }) : t('orgs.createdExisting', { name: orgName, email: address }), 'ok');
    } catch {
      onDone(t('orgs.createdLinkFailed', { name: orgName }), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form panel-form" onSubmit={submit} aria-labelledby="org-form-title">
      <h2 id="org-form-title" className="form-section">{t('orgs.new')}</h2>
      <p className="form-section meta">{t('orgs.createHint')}</p>
      <div className="field">
        <label htmlFor="o-kind">{t('orgs.kind')}</label>
        <select id="o-kind" value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}>
          {KINDS.map((k) => (
            <option key={k} value={k}>{t(`orgs.kindChoices.${k}`)}</option>
          ))}
        </select>
      </div>
      {kind !== 'belediye' ? (
        <>
          <div className="field">
            <label htmlFor="o-name">{t('orgs.name')}</label>
            <input id="o-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="o-level">{t('orgs.level')}</label>
            <select id="o-level" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
              {(['ulke', 'il', 'ilce'] as const).map((l) => (
                <option key={l} value={l}>{t(`grants.levels.${l}`)}</option>
              ))}
            </select>
          </div>
        </>
      ) : null}
      {kind === 'belediye' || level !== 'ulke' ? (
        <div className="field">
          <label htmlFor="o-province">{t('orgs.province')}</label>
          <select id="o-province" value={provinceCode} onChange={(e) => { setProvinceCode(e.target.value); setMunicipalityId(''); setDistrictId(''); }}>
            <option value="">{t('orgs.choose')}</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
        </div>
      ) : null}
      {kind === 'belediye' && provinceCode ? (
        <div className="field">
          <label htmlFor="o-municipality">{t('orgs.municipality')}</label>
          <select id="o-municipality" value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)}>
            <option value="">{t('orgs.choose')}</option>
            {options.map((m) => (
              <option key={m.id} value={m.id} disabled={existingIds.has(m.id)}>
                {m.name}{existingIds.has(m.id) ? ` (${t('orgs.alreadyOpen')})` : ''}
              </option>
            ))}
          </select>
          <span className="meta">{t('orgs.lockedNames')}</span>
        </div>
      ) : null}
      {kind !== 'belediye' && level === 'ilce' && provinceCode ? (
        <div className="field">
          <label htmlFor="o-district">{t('orgs.district')}</label>
          <select id="o-district" value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
            <option value="">{t('orgs.choose')}</option>
            {repo.getDistricts(provinceCode).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      ) : null}

      <h3 className="form-section">{t('orgs.accountTitle')}</h3>
      <div className="field">
        <label htmlFor="o-email">{t('orgs.officialEmail')}</label>
        <input id="o-email" type="email" dir="ltr" autoComplete="off" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} />
        <span className="meta">{t('orgs.officialEmailHint')}</span>
      </div>
      <div className="field">
        <label htmlFor="o-admin">{t('orgs.adminName')}</label>
        <input id="o-admin" value={adminName} maxLength={80} onChange={(e) => setAdminName(e.target.value)} placeholder={t('orgs.adminNamePlaceholder')} />
      </div>

      <h3 className="form-section">{t('orgs.modulesAndContract')}</h3>
      <fieldset className="form-section checkbox-group">
        <legend className="sr-only">{t('orgs.modules')}</legend>
        {ORG_MODULES.map((m) => (
          <label key={m}>
            <input type="checkbox" checked={modules.includes(m)} onChange={(e) => setModules(e.target.checked ? [...modules, m] : modules.filter((x) => x !== m))} />
            {t(`nav.${m}`)}
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="o-contract">{t('orgs.contractEnds')}</label>
        <input id="o-contract" type="date" value={contractEnds} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setContractEnds(e.target.value)} />
        <span className="meta">{t('orgs.contractHint')}</span>
      </div>

      {error ? <p className="error form-section" role="alert">{error}</p> : null}
      <div className="actions">
        <button className="btn" type="submit" disabled={busy}>{t('orgs.create')}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>{t('orgs.cancel')}</button>
      </div>
    </form>
  );
}

interface MemberDraft {
  isNew: boolean;
  email: string;
  displayName: string;
  isOrgAdmin: boolean;
  assignments: Partial<Record<Module, StaffAssignment>>;
  expiresOn: string;
}

function OrgDetail({
  user,
  org,
  isAdmin,
  canManageMembers,
  onBack,
  onChanged,
}: {
  user: PanelUser;
  org: Organization;
  isAdmin: boolean;
  canManageMembers: boolean;
  onBack?: () => void;
  onChanged: () => Promise<void>;
}) {
  const service = useMemo(() => createOrganizationAdmin(firestore, user.uid), [user.uid]);
  const [members, setMembers] = useState<OrganizationMember[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<MemberDraft | null>(null);
  const [message, setMessage] = useState<Msg>();
  const [busy, setBusy] = useState(false);
  const [modules, setModules] = useState<Module[]>(org.modules);
  const [contractEnds, setContractEnds] = useState(dateOnly(org.contractEndsAt));
  const myEmail = user.email?.toLowerCase();

  const load = useCallback(async () => {
    setLoadError(false);
    if (!canManageMembers || user.isDemo) return setMembers([]);
    try {
      setMembers(await service.listMembers(org.id));
    } catch {
      setLoadError(true);
    }
  }, [service, org.id, canManageMembers, user.isDemo]);

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
      setMessage({ kind: 'error', text: t('orgs.error') });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveMember = async (d: MemberDraft) => {
    const email = d.email.trim().toLowerCase();
    if (!isValidEmail(email)) return setMessage({ kind: 'error', text: t('orgs.emailRequired') });
    if (d.displayName.trim().length < 2) return setMessage({ kind: 'error', text: t('orgs.memberNameRequired') });
    if (!isAdmin && email === myEmail) return setMessage({ kind: 'error', text: t('orgs.notSelf') });
    const expiresAt = endOfDay(d.expiresOn);
    if (expiresAt && expiresAt <= new Date()) return setMessage({ kind: 'error', text: t('orgs.expiryPast') });
    const exists = members?.some((m) => m.email === email);
    const ok = await act(
      () => service.saveMember(org, { email, displayName: d.displayName, isOrgAdmin: isAdmin && d.isOrgAdmin, assignments: d.assignments, expiresAt }, !exists),
      exists ? t('orgs.memberUpdated') : t('orgs.memberAdded', { email }),
    );
    if (ok) setDraft(null);
  };

  const remove = (m: OrganizationMember) => {
    if (!window.confirm(t('orgs.removeConfirm', { name: m.displayName }))) return;
    act(() => service.removeMember(org, m), t('orgs.memberRemoved'));
  };

  const toggleStatus = () => {
    const next = org.status === 'aktif' ? 'pasif' : 'aktif';
    if (next === 'pasif' && !window.confirm(t('orgs.passiveConfirm', { name: org.name }))) return;
    act(async () => {
      await service.update(org, { status: next });
      await onChanged();
    }, next === 'pasif' ? t('orgs.madePassive') : t('orgs.madeActive'));
  };

  const saveSettings = () =>
    act(async () => {
      const ends = endOfDay(contractEnds);
      await service.update(org, { modules, contractEndsAt: ends ?? null });
      await onChanged();
    }, t('orgs.settingsSaved'));

  const canEditMember = (m: OrganizationMember) => !user.isDemo && (isAdmin || (!m.isOrgAdmin && m.email !== myEmail));
  const now = new Date();

  return (
    <section className="page">
      <header className="page-head">
        <div>
          {onBack ? <button className="link" onClick={onBack}>‹ {t('orgs.back')}</button> : null}
          <h1>{org.name}</h1>
          <p className="meta">
            {t(`orgs.kinds.${org.kind}`)} · <ScopeLabel scope={org.scope} /> · <span dir="ltr">{org.officialEmail}</span>
          </p>
        </div>
        {isAdmin && !user.isDemo ? (
          <div className="actions">
            <button className="btn secondary" disabled={busy} onClick={() => act(() => resendSetupLink(firebaseAuth, org.officialEmail), t('orgs.linkSent', { email: org.officialEmail }))}>
              {t('orgs.resendLink')}
            </button>
            <button className="btn secondary" disabled={busy} onClick={toggleStatus}>{org.status === 'aktif' ? t('orgs.makePassive') : t('orgs.makeActive')}</button>
          </div>
        ) : null}
      </header>
      {!isOrganizationActive(org, now) ? <p className="note" role="status">{t('orgs.inactiveNote')}</p> : null}
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {isAdmin && !user.isDemo ? (
        <div className="form panel-form">
          <h2 className="form-section">{t('orgs.settings')}</h2>
          <fieldset className="form-section checkbox-group">
            <legend>{t('orgs.modules')}</legend>
            {ORG_MODULES.map((m) => (
              <label key={m}>
                <input type="checkbox" checked={modules.includes(m)} onChange={(e) => setModules(e.target.checked ? [...modules, m] : modules.filter((x) => x !== m))} />
                {t(`nav.${m}`)}
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="od-contract">{t('orgs.contractEnds')}</label>
            <input id="od-contract" type="date" value={contractEnds} onChange={(e) => setContractEnds(e.target.value)} />
          </div>
          <div className="actions">
            <button className="btn" disabled={busy} onClick={saveSettings}>{t('orgs.saveSettings')}</button>
          </div>
        </div>
      ) : null}

      {canManageMembers ? (
        <>
          <div className="page-head">
            <h2>{t('orgs.staffTitle')}</h2>
            {!draft && !user.isDemo ? (
              <button className="btn" onClick={() => setDraft({ isNew: true, email: '', displayName: '', isOrgAdmin: false, assignments: {}, expiresOn: '' })}>
                {t('orgs.addMember')}
              </button>
            ) : null}
          </div>
          <p className="meta">{t('orgs.staffIntro')}</p>
          {draft ? <MemberForm org={org} draft={draft} setDraft={setDraft} isAdmin={isAdmin} busy={busy} onSubmit={saveMember} /> : null}

          {loadError ? (
            <div className="state" role="alert">
              <p>{t('orgs.loadError')}</p>
              <button className="btn secondary" onClick={load}>{t('orgs.retry')}</button>
            </div>
          ) : members === null ? (
            <div className="state" aria-live="polite">{t('orgs.loading')}</div>
          ) : members.length === 0 ? (
            <div className="state">{t('orgs.noMembers')}</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('orgs.person')}</th>
                    <th scope="col">{t('orgs.duties')}</th>
                    <th scope="col">{t('orgs.status')}</th>
                    <th scope="col"><span className="sr-only">{t('orgs.actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const active = isMemberActive(m, now);
                    const duties = (Object.entries(m.assignments) as [Module, StaffAssignment][]).map(
                      ([mod, a]) => `${t(`nav.${mod}`)}: ${t(`orgs.staffRoles.${a.role}`)}${a.canPublishDirectly ? ` (${t('orgs.publishDirectly')})` : ''}`,
                    );
                    return (
                      <tr key={m.email}>
                        <td>
                          <strong>{m.displayName}</strong>
                          <div className="meta" dir="ltr">{m.email}</div>
                          {m.isOrgAdmin ? <span className="pill ok">{t('orgs.orgAdmin')}</span> : null}
                        </td>
                        <td>{duties.length ? duties.join(' · ') : m.isOrgAdmin ? t('orgs.allModulesView') : '-'}</td>
                        <td>
                          <span className={active ? 'pill ok' : 'pill'}>{active ? t('orgs.active') : m.removedAt ? t('orgs.removed') : t('orgs.expired')}</span>
                          {m.expiresAt && active ? <div className="meta">{t('orgs.until', { date: new Date(m.expiresAt).toLocaleDateString('tr-TR') })}</div> : null}
                        </td>
                        <td>
                          {canEditMember(m) ? (
                            <div className="row-actions">
                              <button
                                className="link"
                                disabled={busy}
                                onClick={() => setDraft({ isNew: false, email: m.email, displayName: m.displayName, isOrgAdmin: m.isOrgAdmin, assignments: m.assignments, expiresOn: active ? dateOnly(m.expiresAt) : '' })}>
                                {active ? t('orgs.edit') : t('orgs.readd')}
                              </button>
                              {active ? <button className="link" disabled={busy} onClick={() => remove(m)}>{t('orgs.remove')}</button> : null}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <p className="note">{t('orgs.staffHidden')}</p>
      )}
    </section>
  );
}

function MemberForm({
  org,
  draft,
  setDraft,
  isAdmin,
  busy,
  onSubmit,
}: {
  org: Organization;
  draft: MemberDraft;
  setDraft: (d: MemberDraft | null) => void;
  isAdmin: boolean;
  busy: boolean;
  onSubmit: (d: MemberDraft) => void;
}) {
  const set = (patch: Partial<MemberDraft>) => setDraft({ ...draft, ...patch });
  const setRole = (m: Module, role: StaffRole | '') => {
    const next = { ...draft.assignments };
    if (!role) delete next[m];
    else next[m] = { role, ...(role === 'hazirlayan' && next[m]?.canPublishDirectly ? { canPublishDirectly: true } : {}) };
    set({ assignments: next });
  };

  return (
    <form
      className="form panel-form"
      aria-labelledby="member-form-title"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}>
      <h3 id="member-form-title" className="form-section">{draft.isNew ? t('orgs.addMember') : t('orgs.editMember')}</h3>
      <p className="form-section meta">{t('orgs.memberHint')}</p>
      <div className="field">
        <label htmlFor="m-email">{t('orgs.email')}</label>
        <input id="m-email" type="email" dir="ltr" autoComplete="off" value={draft.email} readOnly={!draft.isNew} maxLength={120} onChange={(e) => set({ email: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="m-name">{t('orgs.memberName')}</label>
        <input id="m-name" value={draft.displayName} maxLength={80} onChange={(e) => set({ displayName: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="m-expires">{t('orgs.memberExpires')}</label>
        <input id="m-expires" type="date" value={draft.expiresOn} min={new Date().toISOString().slice(0, 10)} onChange={(e) => set({ expiresOn: e.target.value })} />
      </div>
      {isAdmin ? (
        <div className="field checkbox">
          <label>
            <input type="checkbox" checked={draft.isOrgAdmin} onChange={(e) => set({ isOrgAdmin: e.target.checked })} />
            {t('orgs.makeOrgAdmin')}
          </label>
        </div>
      ) : null}

      <div className="form-section table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('orgs.module')}</th>
              <th scope="col">{t('orgs.duty')}</th>
              <th scope="col">{t('orgs.publishDirectly')}</th>
            </tr>
          </thead>
          <tbody>
            {org.modules.map((m) => {
              const a = draft.assignments[m];
              return (
                <tr key={m}>
                  <th scope="row">{t(`nav.${m}`)}</th>
                  <td>
                    <select aria-label={`${t(`nav.${m}`)}: ${t('orgs.duty')}`} value={a?.role ?? ''} onChange={(e) => setRole(m, e.target.value as StaffRole | '')}>
                      <option value="">{t('orgs.noDuty')}</option>
                      {STAFF_ROLES.map((r) => (
                        <option key={r} value={r}>{t(`orgs.staffRoles.${r}`)}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {a?.role === 'hazirlayan' ? (
                      <input
                        type="checkbox"
                        aria-label={`${t(`nav.${m}`)}: ${t('orgs.publishDirectly')}`}
                        checked={!!a.canPublishDirectly}
                        onChange={(e) => set({ assignments: { ...draft.assignments, [m]: { role: 'hazirlayan', ...(e.target.checked ? { canPublishDirectly: true } : {}) } } })}
                      />
                    ) : (
                      <span className="meta" aria-hidden>-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="form-section meta">{t('orgs.dutyHint')}</p>

      <div className="actions">
        <button className="btn" type="submit" disabled={busy}>{draft.isNew ? t('orgs.addMember') : t('orgs.save')}</button>
        <button className="btn secondary" type="button" onClick={() => setDraft(null)}>{t('orgs.cancel')}</button>
      </div>
    </form>
  );
}
