import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  OFFICIAL_PROFILE_LIMITS,
  orgProfileTarget,
  profileTargetsFor,
  validateOfficialProfile,
  type OfficialProfileError,
  type OfficialProfileInput,
  type ProfileTarget,
} from '@cityjoy/shared';
import { createOfficialProfileAdmin, createOrganizationAdmin } from '@cityjoy/shared/firebase';

import { regionLabel, useNeighbourhoodNames } from '../components/content-common';
import { firestore } from '../lib/firebase';
import { isAdminUser, useSession, type PanelUser } from '../lib/session';
import { t } from '../lib/t';

type Form = OfficialProfileInput & { name: string };
const EMPTY: Form = { name: '', about: '', phone: '', email: '', website: '', address: '', hours: '' };

/** Menüde "Resmî profil" görünsün mü: admin, kurum yöneticisi ya da muhtar. */
export const hasProfileAccess = (user: PanelUser) => isAdminUser(user) || profileTargetsFor(user.grants, user.memberships).length > 0;

/**
 * Resmî profil (PROJE.md 6.2 madde 2): kurumun ya da muhtarlığın uygulamada görünen künyesi. Kurum yöneticisi kendi
 * kurumunu, muhtar kendi mahallesini, admin her kurumu düzenler. Kurumun adı ve bölgesi kurum kaydından gelir.
 */
export function ProfilePage() {
  const { user } = useSession();
  if (!user) return null;
  return <Profiles user={user} />;
}

function Profiles({ user }: { user: PanelUser }) {
  const isAdmin = isAdminUser(user);
  const live = !user.isDemo;
  const own = useMemo(() => profileTargetsFor(user.grants, user.memberships), [user]);
  const [orgTargets, setOrgTargets] = useState<ProfileTarget[]>([]);
  const targets = useMemo(() => [...own, ...orgTargets.filter((o) => !own.some((x) => x.id === o.id))], [own, orgTargets]);
  const [targetId, setTargetId] = useState(own[0]?.id ?? '');
  const target = targets.find((x) => x.id === targetId);
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<OfficialProfileError[]>([]);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);
  const service = useMemo(() => createOfficialProfileAdmin(firestore, user.uid), [user]);
  const nameOf = useNeighbourhoodNames(targets.flatMap((x) => (x.region ? [{ region: x.region }] : [])));

  // Admin her kurumun profilini düzenler.
  useEffect(() => {
    if (!isAdmin || !live) return;
    createOrganizationAdmin(firestore, user.uid)
      .listAll()
      .then((list) => setOrgTargets(list.map(orgProfileTarget)))
      .catch(() => setMessage({ kind: 'error', text: t('profile.loadError') }));
  }, [isAdmin, live, user.uid]);

  useEffect(() => {
    if (!targetId && targets[0]) setTargetId(targets[0].id);
  }, [targetId, targets]);

  useEffect(() => {
    setForm(null);
    setErrors([]);
    if (!target) return;
    if (!live) return setForm({ ...EMPTY });
    service
      .get(target.id)
      .then((p) => setForm({ ...EMPTY, ...(p ?? {}), name: p?.name ?? '' }))
      .catch(() => setMessage({ kind: 'error', text: t('profile.loadError') }));
  }, [target, live, service]);

  const label = (x: ProfileTarget) =>
    x.type === 'kurum' ? x.name : t('announcements.muhtarOf', { place: (x.region && nameOf({ region: x.region })) ?? x.region?.neighbourhoodId ?? '' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || !target) return;
    const input = { ...form, email: form.email?.trim().toLowerCase() };
    const errs = validateOfficialProfile(input, target.type);
    setErrors(errs);
    if (errs.length) return setMessage({ kind: 'error', text: t('profile.fixErrors') });
    setBusy(true);
    setMessage(undefined);
    try {
      await service.save(target, input);
      setMessage({ kind: 'ok', text: t('profile.saved') });
    } catch {
      setMessage({ kind: 'error', text: t('profile.error') });
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof Form, opts: { multiline?: boolean; type?: string; max: number; hint?: string }) => (
    <div className="field">
      <label htmlFor={`pr-${key}`}>{t(`profile.fields.${key}`)}</label>
      {opts.multiline ? (
        <textarea id={`pr-${key}`} rows={4} dir="auto" maxLength={opts.max} disabled={!live} value={form![key] ?? ''} onChange={(e) => setForm({ ...form!, [key]: e.target.value })} aria-invalid={errors.includes(key as OfficialProfileError)} />
      ) : (
        <input id={`pr-${key}`} type={opts.type ?? 'text'} dir="auto" maxLength={opts.max} disabled={!live} value={form![key] ?? ''} onChange={(e) => setForm({ ...form!, [key]: e.target.value })} aria-invalid={errors.includes(key as OfficialProfileError)} />
      )}
      {errors.includes(key as OfficialProfileError) ? <span className="error">{t(`profile.errors.${key}`)}</span> : opts.hint ? <span className="meta">{opts.hint}</span> : null}
    </div>
  );

  const L = OFFICIAL_PROFILE_LIMITS;
  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('profile.title')}</h1>
          <p className="meta">{t('profile.intro')}</p>
        </div>
      </header>
      {user.isDemo ? <p className="note">{t('profile.demoReadOnly')}</p> : null}
      {targets.length > 1 ? (
        <div className="toolbar">
          <label htmlFor="pr-target">{t('profile.which')}</label>
          <select id="pr-target" value={targetId} onChange={(e) => (setTargetId(e.target.value), setMessage(undefined))}>
            {targets.map((x) => (
              <option key={x.id} value={x.id}>{label(x)}</option>
            ))}
          </select>
        </div>
      ) : null}
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {!target ? (
        <div className="state">{isAdmin ? t('profile.loading') : t('profile.none')}</div>
      ) : !form ? (
        <div className="state" aria-live="polite">{t('profile.loading')}</div>
      ) : (
        <form className="form panel-form" onSubmit={submit}>
          <div className="field">
            <span className="label">{target.type === 'kurum' ? t('profile.orgName') : t('profile.muhtarlik')}</span>
            <strong>{label(target)}</strong>
            <span className="meta">{target.region ? regionLabel(target.region, nameOf({ region: target.region })) : t('profile.national')}</span>
            {target.type === 'kurum' ? <span className="meta">{t('profile.nameLocked')}</span> : null}
          </div>
          {target.type === 'muhtar' ? field('name', { max: L.name, hint: t('profile.muhtarNameHint') }) : null}
          {field('about', { multiline: true, max: L.about })}
          {field('phone', { type: 'tel', max: L.phone[1], hint: t('profile.phoneHint') })}
          {field('email', { type: 'email', max: L.email })}
          {field('website', { type: 'url', max: L.website, hint: t('profile.websiteHint') })}
          {field('address', { max: L.address })}
          {field('hours', { max: L.hours, hint: t('profile.hoursHint') })}
          <p className="meta">{t('profile.publicNote')}</p>
          {live ? (
            <div className="actions">
              <button className="btn" type="submit" disabled={busy}>{t('profile.save')}</button>
            </div>
          ) : null}
        </form>
      )}
    </section>
  );
}
