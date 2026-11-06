import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import {
  ADOPTION_LIMITS,
  ADOPTION_SPECIES,
  isMemberActive,
  isOrganizationActive,
  validateAdoption,
  type Adoption,
  type AdoptionError,
  type AdoptionInput,
  type AdoptionStatus,
  type Organization,
} from '@cityjoy/shared';
import { createAdoptionPanel } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { locationRepository as repo } from '../lib/locations';
import { isAdminUser, useSession, type PanelUser } from '../lib/session';
import { t } from '../lib/t';

/** Bu bölümü kullanabilen kurumlar: modülü açık, kişi kurum yöneticisi ya da görevli. */
function adoptionOrgs(user: PanelUser): { org: Organization; canWrite: boolean }[] {
  const now = new Date();
  return user.memberships
    .filter(({ org, member }) => isOrganizationActive(org, now) && isMemberActive(member, now) && org.modules.includes('sahiplendirme')
      && (member.isOrgAdmin || (member.assignments.sahiplendirme ?? []).length > 0))
    .map(({ org, member }) => ({ org, canWrite: member.isOrgAdmin || !!member.assignments.sahiplendirme?.includes('ekle') }));
}

/**
 * Hayvan sahiplendirme (Karar Eren 5 Kasım 2026): belediye barınağı ve dernek ilan verir; uygulamada Benim Şehrim >
 * Gönüllülük'te görünür. Sahiplendirilince "Sahiplendirildi" işaretlenir; ilan silinmez, kaldırılır. İşlem kaydına girer.
 */
export function AdoptionPage() {
  const { user } = useSession();
  if (!user) return null;
  const orgs = adoptionOrgs(user);
  if (!orgs.length && !isAdminUser(user)) return <Navigate to="/" replace />;
  return <Adoptions user={user} orgs={orgs} />;
}

const emptyInput = (org: Organization): AdoptionInput => ({
  name: '', species: 'kedi', age: '', sex: 'bilinmiyor', vaccinated: false, neutered: false, about: '', urgent: false,
  region: { provinceCode: org.scope.level === 'ulke' ? '16' : org.scope.provinceCode, ...(org.scope.level === 'ilce' ? { districtId: org.scope.districtId } : {}) },
});

function Adoptions({ user, orgs }: { user: PanelUser; orgs: { org: Organization; canWrite: boolean }[] }) {
  const [orgId, setOrgId] = useState(orgs[0]?.org.id ?? '');
  const current = orgs.find((o) => o.org.id === orgId);
  const svc = useMemo(() => createAdoptionPanel(firestore, user.uid), [user.uid]);
  const [list, setList] = useState<Adoption[] | null>(null);
  const [draft, setDraft] = useState<{ input: AdoptionInput; existing?: Adoption } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!current || user.isDemo) return setList([]);
    svc.listFor(current.org.id).then(setList, () => {
      setList([]);
      setMsg({ ok: false, text: t('adoption.loadError') });
    });
  }, [current, svc, user.isDemo]);
  useEffect(() => {
    setList(null);
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg(undefined);
    try {
      await fn();
      setMsg({ ok: true, text: t('adoption.saved') });
      setDraft(null);
      await load();
    } catch {
      setMsg({ ok: false, text: t('adoption.saveError') });
    } finally {
      setBusy(false);
    }
  };
  const setStatus = (a: Adoption, s: AdoptionStatus) => current && act(() => svc.setStatus(current.org, a, s));
  const place = (a: Adoption) => [a.region.districtId ? repo.getDistrict(a.region.districtId)?.name : null, repo.getProvince(a.region.provinceCode)?.name].filter(Boolean).join(', ');

  return (
    <section className="page wide">
      <header className="page-head">
        <div>
          <h1>{t('adoption.title')}</h1>
          <p className="meta">{t('adoption.intro')}</p>
        </div>
        {current?.canWrite && !draft && !user.isDemo ? <button className="btn" onClick={() => setDraft({ input: emptyInput(current.org) })}>{t('adoption.new')}</button> : null}
      </header>
      {orgs.length > 1 ? (
        <div className="toolbar">
          <label htmlFor="ad-org">{t('adoption.which')}</label>
          <select id="ad-org" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            {orgs.map(({ org }) => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
        </div>
      ) : null}
      {msg ? <p className={msg.ok ? 'note' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p> : null}
      {draft && current ? (
        <AdoptionForm org={current.org} draft={draft} busy={busy} onCancel={() => setDraft(null)} onSave={(input) => act(() => svc.save(current.org, input, draft.existing))} />
      ) : null}

      {!current ? <div className="state">{t('adoption.empty')}</div> : list === null ? <div className="state">{t('profile.loading')}</div> : list.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('adoption.colAnimal')}</th>
                <th scope="col">{t('adoption.colPlace')}</th>
                <th scope="col">{t('adoption.colStatus')}</th>
                <th scope="col"><span className="sr-only">{t('adoption.colActions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.name}</strong>{a.urgent ? <> <span className="pill warn">{t('adoption.urgentTag')}</span></> : null}
                    <div className="meta">{t(`adoption.species.${a.species}`)} · {a.age} · {t(`adoption.sex.${a.sex}`)}{a.breed ? ` · ${a.breed}` : ''}</div>
                  </td>
                  <td>{place(a)}</td>
                  <td><span className={a.status === 'yayinda' ? 'pill ok' : 'pill'}>{t(`adoption.status.${a.status}`)}</span></td>
                  <td className="actions">
                    {current.canWrite && !user.isDemo ? (
                      <>
                        <button className="link" disabled={busy} onClick={() => setDraft({ input: { ...a }, existing: a })}>{t('adoption.edit')}</button>
                        {a.status === 'yayinda' ? (
                          <>
                            <button className="link" disabled={busy} onClick={() => setStatus(a, 'sahiplendirildi')}>{t('adoption.markAdopted')}</button>
                            <button className="link" disabled={busy} onClick={() => setStatus(a, 'kaldirildi')}>{t('adoption.remove')}</button>
                          </>
                        ) : <button className="link" disabled={busy} onClick={() => setStatus(a, 'yayinda')}>{t('adoption.republish')}</button>}
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="state">{t('adoption.empty')}</div>}
    </section>
  );
}

function AdoptionForm({ org, draft, busy, onCancel, onSave }: {
  org: Organization; draft: { input: AdoptionInput; existing?: Adoption }; busy: boolean; onCancel(): void; onSave(i: AdoptionInput): void;
}) {
  const [input, setInput] = useState(draft.input);
  const [errors, setErrors] = useState<AdoptionError[]>([]);
  const set = (p: Partial<AdoptionInput>) => setInput((x) => ({ ...x, ...p }));
  const districts = org.scope.level === 'ilce' ? [] : repo.getDistricts(input.region.provinceCode);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateAdoption(input);
    setErrors(errs);
    if (!errs.length) onSave(input);
  };
  const err = (k: AdoptionError) => (errors.includes(k) ? <span className="error" role="alert">{t(`adoption.errors.${k}`)}</span> : null);
  const check = (key: 'vaccinated' | 'neutered' | 'urgent') => (
    <label>
      <input type="checkbox" checked={input[key]} onChange={(e) => set({ [key]: e.target.checked })} />
      {t(`adoption.f${key[0].toUpperCase()}${key.slice(1)}`)}
    </label>
  );

  return (
    <form className="form panel-form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="ad-name">{t('adoption.fName')}</label>
        <input id="ad-name" value={input.name} maxLength={ADOPTION_LIMITS.name[1]} onChange={(e) => set({ name: e.target.value })} />
        {err('name')}
      </div>
      <fieldset className="checkbox-group form-section">
        <legend>{t('adoption.fSpecies')}</legend>
        {ADOPTION_SPECIES.map((s) => (
          <label key={s}><input type="radio" name="ad-sp" checked={input.species === s} onChange={() => set({ species: s })} />{t(`adoption.species.${s}`)}</label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="ad-age">{t('adoption.fAge')}</label>
        <input id="ad-age" value={input.age} placeholder={t('adoption.fAgePh')} maxLength={ADOPTION_LIMITS.age[1]} onChange={(e) => set({ age: e.target.value })} />
        {err('age')}
      </div>
      <fieldset className="checkbox-group form-section">
        <legend>{t('adoption.fSex')}</legend>
        {(['disi', 'erkek', 'bilinmiyor'] as const).map((s) => (
          <label key={s}><input type="radio" name="ad-sex" checked={input.sex === s} onChange={() => set({ sex: s })} />{t(`adoption.sex.${s}`)}</label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="ad-breed">{t('adoption.fBreed')}</label>
        <input id="ad-breed" value={input.breed ?? ''} maxLength={ADOPTION_LIMITS.breed} onChange={(e) => set({ breed: e.target.value })} />
        {err('breed')}
      </div>
      <fieldset className="checkbox-group form-section">{check('vaccinated')}{check('neutered')}{check('urgent')}</fieldset>
      <div className="field form-section">
        <label htmlFor="ad-about">{t('adoption.fAbout')}</label>
        <textarea id="ad-about" rows={3} value={input.about} maxLength={ADOPTION_LIMITS.about[1]} onChange={(e) => set({ about: e.target.value })} />
        {err('about')}
      </div>
      {districts.length ? (
        <div className="field">
          <label htmlFor="ad-dist">{t('adoption.fDistrict')}</label>
          <select id="ad-dist" value={input.region.districtId ?? ''} onChange={(e) => set({ region: { provinceCode: input.region.provinceCode, ...(e.target.value ? { districtId: e.target.value } : {}) } })}>
            <option value="">—</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="ad-phone">{t('adoption.fPhone')}</label>
        <input id="ad-phone" type="tel" value={input.phone ?? ''} maxLength={ADOPTION_LIMITS.phone} onChange={(e) => set({ phone: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="ad-email">{t('adoption.fEmail')}</label>
        <input id="ad-email" type="email" value={input.email ?? ''} maxLength={ADOPTION_LIMITS.email} onChange={(e) => set({ email: e.target.value })} />
      </div>
      <p className="form-section meta">{t('adoption.contactHint')}</p>
      {err('contact')}
      <p className="form-section meta">{t('adoption.photoNote')}</p>
      <div className="actions">
        <button className="btn" type="submit" disabled={busy}>{t('adoption.save')}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>{t('adoption.cancel')}</button>
      </div>
    </form>
  );
}
