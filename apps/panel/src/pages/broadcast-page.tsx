import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BROADCAST_DAILY_LIMIT,
  BROADCAST_KINDS,
  BROADCAST_LIMITS,
  BROADCAST_MIN_SHOWN,
  CITYJOY_PUBLISHER,
  broadcastersFor,
  validateBroadcast,
  type AnnouncementRegion,
  type Broadcast,
  type BroadcastKind,
  type Publisher,
} from '@cityjoy/shared';
import { createBroadcastPanel } from '@cityjoy/shared/firebase';

import { authorLabel, cleanRegion, dateTime, regionComplete, regionLabel, RegionFields, scopeRegion, useNeighbourhoodNames } from '../components/content-common';
import { firestore, functions } from '../lib/firebase';
import { locationRepository as repo } from '../lib/locations';
import { isAdminUser, useSession, type PanelUser } from '../lib/session';
import { t } from '../lib/t';
import { EmptyState } from '../components/empty-state';
import { Intro } from '../components/intro';

type Msg = { kind: 'ok' | 'error'; text: string } | undefined;
type Draft = { kind: BroadcastKind; title: string; body: string; region: AnnouncementRegion };
type Preview = { reach: number | null; needsApproval: boolean };

/**
 * Bölgeye toplu bildirim (PROJE.md 7): hesap, tür, bölge, başlık ve metin; "Önizle" telefonda nasıl görüneceğini ve
 * yaklaşık kaç kişiye ulaşacağını gösterir (kişiler görünmez), sonra gönderilir. İl geneli, admin dışında önce admin
 * onayına gider. Yetki, sınır ve gönderim sunucuda; her gönderim işlem kaydına yazılır.
 */
export function BroadcastPage() {
  const { user } = useSession();
  if (!user) return null;
  return <Broadcasts user={user} />;
}

/** Menüde göstermek için: gönderebileceği bir hesap var mı? */
export const canBroadcast = (u: PanelUser) => broadcastersFor(u.grants, u.memberships, isAdminUser(u)).length > 0;

function Broadcasts({ user }: { user: PanelUser }) {
  const isAdmin = isAdminUser(user);
  const live = !user.isDemo;
  const accounts = useMemo(() => broadcastersFor(user.grants, user.memberships, isAdmin), [user, isAdmin]);
  const service = useMemo(() => createBroadcastPanel(firestore, functions), []);
  const [accountKey, setAccountKey] = useState(accounts[0]?.key ?? '');
  const account = accounts.find((a) => a.key === accountKey);
  const fresh = useCallback((p: Publisher | undefined): Draft => ({ kind: 'duyuru', title: '', body: '', region: p ? startRegion(p) : { provinceCode: '' } }), []);
  const [draft, setDraft] = useState<Draft>(() => fresh(account));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [history, setHistory] = useState<Broadcast[] | null>(null);
  const [pending, setPending] = useState<Broadcast[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<Msg>();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    if (!live) return setHistory([]);
    try {
      const [mine, sent, queue] = await Promise.all([
        service.listMine(user.uid),
        isAdmin ? service.listRecent() : account && account.key !== CITYJOY_PUBLISHER ? service.listSent(account.key) : Promise.resolve([]),
        isAdmin ? service.listPending() : Promise.resolve([]),
      ]);
      const seen = new Set<string>();
      setHistory([...mine, ...sent].filter((b) => !seen.has(b.id) && seen.add(b.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setPending(queue);
    } catch {
      setLoadError(true);
    }
  }, [live, service, user.uid, isAdmin, account]);

  useEffect(() => {
    load();
  }, [load]);

  const nameOf = useNeighbourhoodNames([...(history ?? []), ...pending, { region: draft.region }, ...accounts.map((p) => ({ region: scopeRegion(p) }))]);
  const accountName = (p: Publisher) => (p.key === CITYJOY_PUBLISHER ? t('broadcast.cityjoy') : authorLabel({ author: p.author, region: scopeRegion(p) }, nameOf({ region: scopeRegion(p) })));
  const change = (d: Partial<Draft>) => {
    setDraft({ ...draft, ...d });
    setPreview(null);
  };
  const region = cleanRegion(draft.region);
  const input = { publisherKey: accountKey, ...draft, title: draft.title.trim(), body: draft.body.trim(), region };
  const errors = validateBroadcast(input);
  const ready = !!account && regionComplete(draft.region) && !!draft.region.provinceCode && !errors.length;

  const errorText = (e: unknown) => {
    const code = (e as { code?: string })?.code ?? '';
    if (code.endsWith('resource-exhausted')) return t('broadcast.limitReached', { count: BROADCAST_DAILY_LIMIT });
    if (code.endsWith('permission-denied')) return t('broadcast.noPermission');
    return t('broadcast.error');
  };

  const showPreview = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return setMessage({ kind: 'error', text: t('broadcast.fillAll', { title: BROADCAST_LIMITS.title[0], body: BROADCAST_LIMITS.body[0] }) });
    setBusy(true);
    setMessage(undefined);
    try {
      setPreview(await service.estimate(accountKey, region));
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!ready || !preview) return;
    if (!window.confirm(preview.needsApproval ? t('broadcast.confirmApproval') : t('broadcast.confirmSend', { place: regionLabel(region, nameOf({ region })) }))) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const res = await service.send(input);
      setMessage({ kind: 'ok', text: res.status === 'onay-bekliyor' ? t('broadcast.sentForApproval') : t('broadcast.sent') });
      setDraft(fresh(account));
      setPreview(null);
      await load();
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const review = async (b: Broadcast, approve: boolean, note?: string) => {
    if (approve && !window.confirm(t('broadcast.confirmApprove'))) return;
    setBusy(true);
    setMessage(undefined);
    try {
      await service.review(b.id, approve, note);
      setMessage({ kind: 'ok', text: approve ? t('broadcast.approved') : t('broadcast.rejected') });
      setRejecting(null);
      await load();
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const row = (b: Broadcast, actions?: React.ReactNode) => (
    <tr key={b.id}>
      <td>
        <strong dir="auto">{b.title}</strong>
        {b.kind === 'acil' ? <> <span className="pill warn">{t('broadcast.kinds.acil')}</span></> : null}
        <p className="meta" dir="auto" style={{ whiteSpace: 'pre-wrap', margin: '0.25rem 0 0' }}>{b.body}</p>
      </td>
      <td>
        <div>{b.sourceName}</div>
        <div className="meta">{regionLabel(b.region, nameOf(b))}</div>
      </td>
      <td>
        <span className={b.status === 'gonderildi' ? 'pill ok' : b.status === 'reddedildi' ? 'pill warn' : 'pill'}>{t(`broadcast.statuses.${b.status}`)}</span>
        <div className="meta">{dateTime(b.sentAt ?? b.createdAt)}</div>
        {b.sentCount !== undefined ? <div className="meta">{t('broadcast.sentCount', { count: b.sentCount })}</div> : null}
        {b.reviewNote ? <div className="meta" dir="auto">{t('broadcast.noteShown', { note: b.reviewNote })}</div> : null}
      </td>
      {actions !== undefined ? <td>{actions}</td> : null}
    </tr>
  );

  const table = (rows: React.ReactNode[], withActions = false) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">{t('broadcast.message')}</th>
            <th scope="col">{t('broadcast.target')}</th>
            <th scope="col">{t('broadcast.status')}</th>
            {withActions ? <th scope="col"><span className="sr-only">{t('broadcast.actions')}</span></th> : null}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('broadcast.title')}</h1>
          <Intro text={t('broadcast.intro', { min: BROADCAST_MIN_SHOWN, count: BROADCAST_DAILY_LIMIT })} />
        </div>
      </header>
      {user.isDemo ? <p className="note">{t('broadcast.demoReadOnly')}</p> : null}
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {!account ? (
        <p className="note">{t('broadcast.noAccount')}</p>
      ) : (
        <div className="card-grid two">
          <form className="form panel-form card" onSubmit={showPreview} noValidate>
            {accounts.length > 1 ? (
              <div className="field">
                <label htmlFor="bc-account">{t('broadcast.account')}</label>
                <select id="bc-account" value={accountKey} onChange={(e) => {
                  const next = accounts.find((a) => a.key === e.target.value);
                  setAccountKey(e.target.value);
                  setDraft(fresh(next));
                  setPreview(null);
                }}>
                  {accounts.map((p) => (
                    <option key={p.key} value={p.key}>{accountName(p)}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="meta">{t('broadcast.sendingAs', { name: accountName(account) })}</p>
            )}
            <fieldset className="checkbox-group form-section">
              <legend>{t('broadcast.kind')}</legend>
              {BROADCAST_KINDS.map((k) => (
                <label key={k}>
                  <input type="radio" name="bc-kind" checked={draft.kind === k} onChange={() => change({ kind: k })} />
                  <span>{t(`broadcast.kinds.${k}`)} <small className="meta">· {t(`broadcast.kindHints.${k}`)}</small></span>
                </label>
              ))}
            </fieldset>
            {account.scope.level === 'ulke' ? (
              <div className="field">
                <label htmlFor="bc-province">{t('broadcast.province')}</label>
                <select id="bc-province" value={draft.region.provinceCode} onChange={(e) => change({ region: { provinceCode: e.target.value } })}>
                  <option value="">{t('announcements.choose')}</option>
                  {repo.getProvinces().map((p) => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {draft.region.provinceCode ? (
              <RegionFields idPrefix="bc" publisher={account} region={draft.region} onChange={(r) => change({ region: r })} />
            ) : null}
            <div className="field">
              <label htmlFor="bc-title">{t('broadcast.titleField')}</label>
              <input id="bc-title" dir="auto" value={draft.title} maxLength={BROADCAST_LIMITS.title[1]} onChange={(e) => change({ title: e.target.value })} />
              <span className="meta">{draft.title.trim().length}/{BROADCAST_LIMITS.title[1]}</span>
            </div>
            <div className="field">
              <label htmlFor="bc-body">{t('broadcast.body')}</label>
              <textarea id="bc-body" dir="auto" rows={4} value={draft.body} maxLength={BROADCAST_LIMITS.body[1]} onChange={(e) => change({ body: e.target.value })} />
              <span className="meta">{draft.body.trim().length}/{BROADCAST_LIMITS.body[1]} · {t('broadcast.bodyHint')}</span>
            </div>
            {!draft.region.districtId && !isAdmin ? <p className="note">{t('broadcast.provinceApproval')}</p> : null}
            <div className="actions">
              <button className="btn secondary" type="submit" disabled={busy || !live}>{t('broadcast.preview')}</button>
              {preview ? (
                <button className="btn" type="button" disabled={busy || !live} onClick={send}>
                  {preview.needsApproval ? t('broadcast.sendForApproval') : t('broadcast.send')}
                </button>
              ) : null}
            </div>
          </form>

          <div className="card" aria-live="polite">
            <h2 className="card-title">{t('broadcast.previewTitle')}</h2>
            <div className="phone-notice">
              <div className="phone-notice-head">
                <i aria-hidden="true" />
                <span>CityJoy</span>
                <span className="meta">{t('broadcast.now')}</span>
              </div>
              <strong dir="auto">{t(`broadcast.pushTitle.${draft.kind}`, { name: account.key === CITYJOY_PUBLISHER ? t('broadcast.cityjoy') : account.author.type === 'kurum' ? account.author.name : account.author.role === 'muhtar' ? t('broadcast.muhtar') : t('broadcast.cityjoy') })}</strong>
              <p dir="auto">{draft.title.trim() || t('broadcast.titleField')}: {draft.body.trim() || t('broadcast.body')}</p>
            </div>
            <p className="meta">{t('broadcast.previewHint')}</p>
            {preview ? (
              <p className="note">
                {preview.reach === null ? t('broadcast.reachFew', { min: BROADCAST_MIN_SHOWN }) : t('broadcast.reach', { count: preview.reach.toLocaleString('tr') })}
                <br />
                <small className="meta">{t('broadcast.reachHint')}</small>
              </p>
            ) : (
              <p className="meta">{t('broadcast.reachUnknown')}</p>
            )}
          </div>
        </div>
      )}

      {isAdmin && pending.length ? (
        <>
          <h2>{t('broadcast.pendingTitle', { count: pending.length })}</h2>
          {table(
            pending.map((b) =>
              row(
                b,
                rejecting?.id === b.id ? (
                  <form onSubmit={(e) => (e.preventDefault(), review(b, false, rejecting.note.trim()))}>
                    <label className="sr-only" htmlFor={`rej-${b.id}`}>{t('broadcast.rejectNote')}</label>
                    <textarea id={`rej-${b.id}`} rows={2} placeholder={t('broadcast.rejectNote')} value={rejecting.note} minLength={BROADCAST_LIMITS.reviewNote[0]} maxLength={BROADCAST_LIMITS.reviewNote[1]} onChange={(e) => setRejecting({ id: b.id, note: e.target.value })} />
                    <div className="actions">
                      <button className="btn danger" type="submit" disabled={busy || rejecting.note.trim().length < BROADCAST_LIMITS.reviewNote[0]}>{t('broadcast.reject')}</button>
                      <button className="btn secondary" type="button" onClick={() => setRejecting(null)}>{t('broadcast.cancel')}</button>
                    </div>
                  </form>
                ) : (
                  <div className="actions">
                    <button className="btn" disabled={busy} onClick={() => review(b, true)}>{t('broadcast.approve')}</button>
                    <button className="btn secondary" disabled={busy} onClick={() => setRejecting({ id: b.id, note: '' })}>{t('broadcast.reject')}</button>
                  </div>
                ),
              ),
            ),
            true,
          )}
        </>
      ) : null}

      <h2>{t('broadcast.historyTitle')}</h2>
      {loadError ? (
        <div className="state" role="alert">
          <p>{t('broadcast.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('broadcast.retry')}</button>
        </div>
      ) : history === null ? (
        <div className="state" aria-live="polite">{t('broadcast.loading')}</div>
      ) : !history.length ? (
        <EmptyState text={t('broadcast.empty')} />
      ) : (
        table(history.map((b) => row(b)))
      )}
    </section>
  );
}

/** Formun başlangıç bölgesi: hesabın bölgesi; il yöneticisinde onaysız gitsin diye ilçe düzeyi. */
function startRegion(p: Publisher): AnnouncementRegion {
  const r = scopeRegion(p);
  return p.scope.level === 'il' && p.key !== CITYJOY_PUBLISHER ? { ...r, districtId: '' } : r;
}
