import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  APPROVAL_KINDS,
  APPROVAL_MODULES,
  bulkApprovable,
  can,
  filterApprovals,
  isGrantActive,
  isHighRisk,
  isSafeApproval,
  REJECT_REASON_LIMITS,
  validRejectReason,
  type Approval,
  type ApprovalStatus,
  type Module,
  type TrustedApprover,
} from '@cityjoy/shared';
import { createApprovalAdmin } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { locationRepository } from '../lib/locations';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';

type View = 'bekleyen' | ApprovalStatus | 'sonuclanan';

const LIVE_MODULES = APPROVAL_MODULES.filter((m) => Object.values(APPROVAL_KINDS).some((k) => k.live && k.module === m));
const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '');

/**
 * Bekleyen onaylar (PROJE.md 6.5, 6.7). İl yöneticisi kendi ilindeki işlerin 1. aşamasını onaylar ya da reddeder;
 * admin bütün bekleyenleri tek ekranda görür, tek tek ya da toplu son kararı verir ve güvenilir yönetici listesini
 * yönetir. Asıl denetim veritabanı kurallarında.
 */
export function ApprovalsPage() {
  const { user } = useSession();
  const isAdmin = isAdminUser(user);
  const live = !!user && !user.isDemo;
  const admin = useMemo(
    () => (user ? createApprovalAdmin(firestore, { uid: user.uid, email: user.email ?? '', name: user.displayName }) : null),
    [user],
  );

  // Admin değilse yalnızca onay yetkisi olan iller (kurallar başka ili okutmaz).
  const provinceCodes = useMemo(() => {
    const now = new Date();
    return [...new Set((user?.grants ?? []).filter((g) => isGrantActive(g, now) && g.modules.onaylar?.includes('goruntule')).flatMap((g) => (g.scope.level === 'ulke' ? [] : [g.scope.provinceCode])))];
  }, [user]);
  const provinces = useMemo(
    () => locationRepository.getProvinces().filter((p) => isAdmin || provinceCodes.includes(p.code)),
    [isAdmin, provinceCodes],
  );

  const [provinceCode, setProvinceCode] = useState(() => (isAdmin ? '' : (provinceCodes[0] ?? '')));
  const [districtId, setDistrictId] = useState('');
  const [module, setModule] = useState<Module | ''>('');
  const [view, setView] = useState<View>(isAdmin ? 'admin-onayi-bekliyor' : 'il-onayi-bekliyor');
  const [list, setList] = useState<Approval[] | null>(null);
  const [trusted, setTrusted] = useState<TrustedApprover[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);

  const decided = view === 'sonuclanan';
  const load = useCallback(async () => {
    setLoadError(false);
    if (!live || !admin) return setList([]);
    try {
      const codes = isAdmin ? [provinceCode || undefined] : provinceCode ? [provinceCode] : provinceCodes;
      const lists = await Promise.all(codes.map((p) => (decided ? admin.listDecided(p) : admin.listPending(p))));
      setList(lists.flat());
      if (isAdmin) setTrusted(await admin.listTrusted());
    } catch {
      setLoadError(true);
    }
  }, [live, admin, isAdmin, provinceCode, provinceCodes, decided]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, okText = t('approvals.saved')) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
      setMessage({ kind: 'ok', text: okText });
      setRejecting(null);
      await load();
    } catch {
      setMessage({ kind: 'error', text: t('approvals.error') });
    } finally {
      setBusy(false);
    }
  };

  const shown = useMemo(() => {
    if (!list) return [];
    return filterApprovals(list, {
      provinceCode: provinceCode || undefined,
      districtId: districtId || undefined,
      module: module || undefined,
      status: view === 'bekleyen' ? undefined : view,
    });
  }, [list, provinceCode, districtId, module, view]);

  const allBulk = isAdmin ? bulkApprovable(shown, 'tumu') : [];
  const safeBulk = isAdmin ? bulkApprovable(shown, 'guvenli', trusted) : [];
  const bulk = (items: Approval[], key: 'confirmAll' | 'confirmSafe') => {
    if (!items.length || !window.confirm(t(`approvals.${key}`, { count: items.length }))) return;
    act(() => admin!.approveFinal(items, { bulk: true }), t('approvals.bulkDone', { count: items.length }));
  };

  const canDecide = (a: Approval) =>
    live && (isAdmin || (a.status === 'il-onayi-bekliyor' && a.requestedBy !== user!.uid && can(user!.grants, { module: a.module, action: 'onayla', region: a.region })));
  const approve = (a: Approval) => act(() => (isAdmin ? admin!.approveFinal([a], { bulk: false }) : admin!.approveFirst(a)));
  const reject = (e: FormEvent, a: Approval) => {
    e.preventDefault();
    if (!rejecting || !validRejectReason(rejecting.reason)) return setMessage({ kind: 'error', text: t('approvals.reasonRequired', { min: REJECT_REASON_LIMITS[0] }) });
    act(() => admin!.reject(a, rejecting.reason, isAdmin));
  };

  const place = (a: Approval) =>
    [a.region.districtId ? locationRepository.getDistrict(a.region.districtId)?.name : null, locationRepository.getProvince(a.region.provinceCode)?.name].filter(Boolean).join(', ');
  const districts = provinceCode ? locationRepository.getDistricts(provinceCode) : [];

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('approvals.title')}</h1>
          <p className="meta">{isAdmin ? t('approvals.introAdmin') : t('approvals.introProvince')}</p>
        </div>
      </header>
      {user?.isDemo ? <p className="note">{t('approvals.demoReadOnly')}</p> : null}

      <div className="toolbar" role="group" aria-label={t('approvals.filters')}>
        <label htmlFor="ap-view" className="sr-only">{t('approvals.stage')}</label>
        <select id="ap-view" value={view} onChange={(e) => setView(e.target.value as View)}>
          {(['admin-onayi-bekliyor', 'il-onayi-bekliyor', 'bekleyen', 'sonuclanan'] as View[]).map((v) => (
            <option key={v} value={v}>{t(`approvals.views.${v}`)}</option>
          ))}
        </select>
        <label htmlFor="ap-province" className="sr-only">{t('approvals.province')}</label>
        <select id="ap-province" value={provinceCode} disabled={!isAdmin && provinces.length < 2} onChange={(e) => (setProvinceCode(e.target.value), setDistrictId(''))}>
          {isAdmin || provinces.length > 1 ? <option value="">{t('approvals.allProvinces')}</option> : null}
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </select>
        {provinceCode ? (
          <>
            <label htmlFor="ap-district" className="sr-only">{t('approvals.district')}</label>
            <select id="ap-district" value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
              <option value="">{t('approvals.allDistricts')}</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </>
        ) : null}
        <label htmlFor="ap-module" className="sr-only">{t('approvals.category')}</label>
        <select id="ap-module" value={module} onChange={(e) => setModule(e.target.value as Module | '')}>
          <option value="">{t('approvals.allCategories')}</option>
          {LIVE_MODULES.map((m) => (
            <option key={m} value={m}>{t(`nav.${m}`)}</option>
          ))}
        </select>
      </div>

      {isAdmin && live && !decided ? (
        <div className="toolbar">
          <button className="btn" disabled={busy || !allBulk.length} onClick={() => bulk(allBulk, 'confirmAll')}>
            {t('approvals.approveAll', { count: allBulk.length })}
          </button>
          <button className="btn secondary" disabled={busy || !safeBulk.length} onClick={() => bulk(safeBulk, 'confirmSafe')}>
            {t('approvals.approveSafe', { count: safeBulk.length })}
          </button>
          <span className="meta">{t('approvals.bulkNote')}</span>
        </div>
      ) : null}
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('approvals.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('approvals.retry')}</button>
        </div>
      ) : list === null ? (
        <div className="state" aria-live="polite">{t('approvals.loading')}</div>
      ) : shown.length === 0 ? (
        <div className="state">{decided ? t('approvals.emptyDecided') : t('approvals.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('approvals.request')}</th>
                <th scope="col">{t('approvals.region')}</th>
                <th scope="col">{t('approvals.firstStage')}</th>
                <th scope="col">{t('approvals.status')}</th>
                {!decided ? <th scope="col"><span className="sr-only">{t('approvals.actions')}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.title}</strong>
                    <div className="meta">{t(`approvals.kinds.${a.kind}`)} · {date(a.requestedAt)}</div>
                    <div className="meta">{a.firstApproval?.uid === a.requestedBy ? t('approvals.byManager') : t(`approvals.requester.${a.kind}`)}</div>
                    {a.note ? <div className="meta" dir="auto">“{a.note}”</div> : null}
                  </td>
                  <td>{place(a)}</td>
                  <td>
                    {a.firstApproval ? (
                      <>
                        <div>{a.firstApproval.name}</div>
                        <div className="meta">{date(a.firstApproval.at)}</div>
                        {isAdmin && isSafeApproval(a, trusted) ? <span className="pill ok">{t('approvals.safe')}</span> : null}
                      </>
                    ) : (
                      <span className="meta">{t('approvals.noFirstStage')}</span>
                    )}
                  </td>
                  <td>
                    <span className={a.status === 'onaylandi' ? 'pill ok' : a.status === 'reddedildi' ? 'pill warn' : 'pill'}>{t(`approvals.statuses.${a.status}`)}</span>
                    {isHighRisk(a) ? <div><span className="pill warn">{t('approvals.highRisk')}</span></div> : null}
                    {a.decision ? <div className="meta">{date(a.decision.at)} · {t('approvals.stageN', { n: a.decision.stage })}</div> : null}
                    {a.decision?.reason ? <div className="meta" dir="auto">{t('approvals.reasonShown', { reason: a.decision.reason })}</div> : null}
                  </td>
                  {!decided ? (
                    <td>
                      {canDecide(a) ? (
                        rejecting?.id === a.id ? (
                          <form className="form" onSubmit={(e) => reject(e, a)}>
                            <label htmlFor={`reason-${a.id}`}>{t('approvals.reason')}</label>
                            <textarea
                              id={`reason-${a.id}`}
                              rows={2}
                              maxLength={REJECT_REASON_LIMITS[1]}
                              value={rejecting.reason}
                              onChange={(e) => setRejecting({ id: a.id, reason: e.target.value })}
                              placeholder={t('approvals.reasonPlaceholder')}
                            />
                            <div className="row-actions">
                              <button className="btn" type="submit" disabled={busy}>{t('approvals.reject')}</button>
                              <button className="btn secondary" type="button" onClick={() => setRejecting(null)}>{t('approvals.cancel')}</button>
                            </div>
                          </form>
                        ) : (
                          <div className="row-actions">
                            <button className="link" disabled={busy} onClick={() => approve(a)}>
                              {isAdmin ? t('approvals.approveFinal') : t('approvals.approveFirst')}
                            </button>
                            <button className="link" disabled={busy} onClick={() => setRejecting({ id: a.id, reason: '' })}>{t('approvals.rejectOpen')}</button>
                          </div>
                        )
                      ) : (
                        <span className="meta">{a.status === 'admin-onayi-bekliyor' ? t('approvals.waitingAdmin') : ''}</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="count">{t('approvals.count', { count: shown.length })}</p>
        </div>
      )}

      {isAdmin ? <TrustedApprovers list={trusted} busy={busy} live={live} onSave={(input) => act(() => admin!.saveTrusted(input))} onRemove={(x) => act(() => admin!.removeTrusted(x))} /> : null}
    </section>
  );
}

interface TrustedDraft {
  email: string;
  displayName: string;
  provinceCode: string;
  districtId: string;
  modules: Module[];
}

/** Güvenilir yöneticiler (PROJE.md 6.5): örn. "Ahmet Bey, Bursa, yalnızca bildirimler". Yalnızca admin. */
function TrustedApprovers(props: {
  list: TrustedApprover[];
  busy: boolean;
  live: boolean;
  onSave(input: Omit<TrustedDraft, 'districtId'> & { districtId?: string }): void;
  onRemove(t: TrustedApprover): void;
}) {
  const empty: TrustedDraft = { email: '', displayName: '', provinceCode: '', districtId: '', modules: [] };
  const [draft, setDraft] = useState<TrustedDraft | null>(null);
  const [error, setError] = useState('');
  const active = props.list.filter((x) => !x.removedAt);
  const provinces = locationRepository.getProvinces();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim()) || !draft.displayName.trim() || !draft.provinceCode) return setError(t('approvals.trusted.invalid'));
    setError('');
    props.onSave({ ...draft, email: draft.email.trim(), districtId: draft.districtId || undefined });
    setDraft(null);
  };
  const scopeText = (x: TrustedApprover) =>
    [x.districtId ? locationRepository.getDistrict(x.districtId)?.name : null, locationRepository.getProvince(x.provinceCode)?.name].filter(Boolean).join(', ');

  return (
    <section aria-labelledby="trusted-title" className="page">
      <header className="page-head">
        <div>
          <h2 id="trusted-title">{t('approvals.trusted.title')}</h2>
          <p className="meta">{t('approvals.trusted.intro')}</p>
        </div>
        {props.live && !draft ? <button className="btn" onClick={() => setDraft(empty)}>{t('approvals.trusted.add')}</button> : null}
      </header>

      {draft ? (
        <form className="form panel-form" onSubmit={submit} aria-labelledby="trusted-form-title">
          <h3 id="trusted-form-title" className="form-section">{t('approvals.trusted.add')}</h3>
          <div className="field">
            <label htmlFor="tr-email">{t('approvals.trusted.email')}</label>
            <input id="tr-email" type="email" dir="ltr" autoComplete="off" maxLength={120} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="tr-name">{t('approvals.trusted.name')}</label>
            <input id="tr-name" maxLength={80} value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="tr-province">{t('approvals.province')}</label>
            <select id="tr-province" value={draft.provinceCode} onChange={(e) => setDraft({ ...draft, provinceCode: e.target.value, districtId: '' })}>
              <option value="">{t('approvals.trusted.choose')}</option>
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
          </div>
          {draft.provinceCode ? (
            <div className="field">
              <label htmlFor="tr-district">{t('approvals.district')}</label>
              <select id="tr-district" value={draft.districtId} onChange={(e) => setDraft({ ...draft, districtId: e.target.value })}>
                <option value="">{t('approvals.trusted.wholeProvince')}</option>
                {locationRepository.getDistricts(draft.provinceCode).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          <fieldset className="checkbox-group form-section">
            <legend>{t('approvals.trusted.categories')}</legend>
            {APPROVAL_MODULES.map((m) => (
              <label key={m}>
                <input
                  type="checkbox"
                  checked={draft.modules.includes(m)}
                  onChange={(e) => setDraft({ ...draft, modules: e.target.checked ? [...draft.modules, m] : draft.modules.filter((x) => x !== m) })}
                />
                {t(`nav.${m}`)}
              </label>
            ))}
          </fieldset>
          <p className="form-section meta">{t('approvals.trusted.categoriesHint')}</p>
          {error ? <p className="form-section error" role="alert">{error}</p> : null}
          <div className="actions">
            <button className="btn" type="submit" disabled={props.busy}>{t('approvals.trusted.save')}</button>
            <button className="btn secondary" type="button" onClick={() => setDraft(null)}>{t('approvals.cancel')}</button>
          </div>
        </form>
      ) : null}

      {active.length === 0 ? (
        <div className="state">{t('approvals.trusted.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('approvals.trusted.name')}</th>
                <th scope="col">{t('approvals.region')}</th>
                <th scope="col">{t('approvals.trusted.categories')}</th>
                {props.live ? <th scope="col"><span className="sr-only">{t('approvals.actions')}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {active.map((x) => (
                <tr key={x.id}>
                  <td>
                    <strong>{x.displayName}</strong>
                    <div className="meta" dir="ltr">{x.email}</div>
                  </td>
                  <td>{scopeText(x)}</td>
                  <td>{x.modules.length ? x.modules.map((m) => t(`nav.${m}`)).join(', ') : t('approvals.trusted.allCategories')}</td>
                  {props.live ? (
                    <td>
                      <div className="row-actions">
                        <button
                          className="link"
                          disabled={props.busy}
                          onClick={() => window.confirm(t('approvals.trusted.removeConfirm', { name: x.displayName })) && props.onRemove(x)}>
                          {t('approvals.trusted.remove')}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
