import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  canPublishDirectly,
  EVENT_CATEGORIES,
  EVENT_LIMITS,
  isFromPublisher,
  isGrantActive,
  publishersFor,
  validateEvent,
  type CityEvent,
  type EventError,
  type EventInput,
  type Publisher,
} from '@cityjoy/shared';
import { createEventPanel, createFirestoreEventRepository, type SaveMode } from '@cityjoy/shared/firebase';

import { authorLabel, cleanRegion, dateTime, regionComplete, regionLabel, RegionFields, scopeRegion, toLocalInput, useNeighbourhoodNames } from '../components/content-common';
import { firestore } from '../lib/firebase';
import { locationRepository as repo } from '../lib/locations';
import { isAdminUser, useSession, type PanelUser } from '../lib/session';
import { t } from '../lib/t';
import { limitText } from '../lib/limits';

// `retry`: sınır dolunca "Onaya gönder" düğmesi.
type Msg = { kind: 'ok' | 'error'; text: string; retry?: () => void } | undefined;

/**
 * Etkinlikler (PROJE.md 5.3, 6.2 madde 3): yetkili kurum ve kişiler etkinlik açar; akış duyurularla aynı (hazırla >
 * onayla > yayınla, "Onaysız yayınla"). Organizatör katılım sayısını ve adını paylaşan katılanları görür, etkinliği
 * iptal eder ya da yayından kaldırır. Bilet satılmaz; siyasi parti etkinliği, miting ve gösteri açılamaz.
 */
export function EventsPage() {
  const { user } = useSession();
  if (!user) return null;
  return <Events user={user} />;
}

function Events({ user }: { user: PanelUser }) {
  const isAdmin = isAdminUser(user);
  const live = !user.isDemo;
  const publishers = useMemo(() => publishersFor(user.grants, user.memberships, new Date(), 'etkinlikler'), [user]);
  const service = useMemo(() => createEventPanel(firestore, { uid: user.uid, name: user.displayName }), [user]);
  const reviewProvinces = useMemo(
    () => user.grants.filter((g) => !g.orgId && g.scope.level === 'il' && isGrantActive(g, new Date()) && g.modules.etkinlikler?.includes('onayla')).map((g) => (g.scope.level === 'il' ? g.scope.provinceCode : '')),
    [user],
  );

  const [publisherKey, setPublisherKey] = useState(publishers[0]?.key ?? '');
  const publisher = publishers.find((p) => p.key === publisherKey);
  const [mine, setMine] = useState<CityEvent[] | null>(null);
  const [pending, setPending] = useState<CityEvent[]>([]);
  const [adminProvince, setAdminProvince] = useState('');
  const [liveList, setLiveList] = useState<CityEvent[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<Msg>();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ input: EventInput; existing?: CityEvent } | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);
  const [names, setNames] = useState<{ id: string; list: string[] | null } | null>(null);

  const orgReviewer = publisher?.author.type === 'kurum' && publisher.actions.includes('onayla') ? publisher.author.orgId : null;

  const load = useCallback(async () => {
    setLoadError(false);
    if (!live) return setMine([]);
    try {
      const [own, ...queues] = await Promise.all([
        publisher ? service.listFor(publisher) : Promise.resolve([]),
        ...(isAdmin
          ? [service.listPending('admin')]
          : [...(orgReviewer ? [service.listPending({ orgId: orgReviewer })] : []), ...reviewProvinces.map((p) => service.listPending({ provinceCode: p }))]),
      ]);
      setMine(own);
      const seen = new Set<string>();
      setPending(queues.flat().filter((e) => !seen.has(e.id) && seen.add(e.id)));
      setLiveList(isAdmin && adminProvince ? await createFirestoreEventRepository(firestore).listUpcoming(adminProvince) : []);
    } catch {
      setLoadError(true);
    }
  }, [live, publisher, service, isAdmin, orgReviewer, reviewProvinces, adminProvince]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, okText: string, onLimit?: () => void) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
      setMessage({ kind: 'ok', text: okText });
      setDraft(null);
      setRejecting(null);
      await load();
    } catch (e) {
      const limit = limitText(e);
      setMessage({ kind: 'error', text: limit ?? t('events.error'), retry: limit ? onLimit : undefined });
    } finally {
      setBusy(false);
    }
  };

  const showNames = async (e: CityEvent) => {
    setNames({ id: e.id, list: null });
    try {
      setNames({ id: e.id, list: await service.listNamedAttendees(e.id) });
    } catch {
      setNames(null);
      setMessage({ kind: 'error', text: t('events.loadError') });
    }
  };

  const nameOf = useNeighbourhoodNames([...(mine ?? []), ...pending, ...liveList, ...publishers.map((p) => ({ region: scopeRegion(p) }))]);
  const isReviewer = (e: CityEvent) => isAdmin || (e.author.type === 'kurum' ? e.author.orgId === orgReviewer : reviewProvinces.includes(e.region.provinceCode));
  const ownsAs = (e: CityEvent) => e.preparedBy === user.uid && !!publisher && isFromPublisher(e, publisher);
  const canCancel = (e: CityEvent) => e.status === 'yayinda' && (isReviewer(e) || ownsAs(e));
  const canUnpublish = (e: CityEvent) => (e.status === 'yayinda' || e.status === 'iptal') && (isReviewer(e) || (ownsAs(e) && publisher!.actions.includes('sil')));

  const newDraft = (): EventInput => {
    const start = new Date(Date.now() + 7 * 86400000);
    start.setHours(19, 0, 0, 0);
    return {
      title: '',
      description: '',
      category: 'kultur-sanat',
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 2 * 3600000).toISOString(),
      venueName: '',
      region: scopeRegion(publisher!),
      free: true,
    };
  };

  const confirm = (key: string, e: CityEvent) => window.confirm(t(key, { title: e.title, count: e.attendeeCount }));

  const row = (e: CityEvent, actions: ReactNode) => (
    <tr key={e.id}>
      <td>
        <strong>{e.title}</strong>
        <div className="meta">{t(`events.categories.${e.category}`)} · {dateTime(e.startsAt)} - {dateTime(e.endsAt)}</div>
        <div className="meta">{e.venueName}{e.address ? `, ${e.address}` : ''}</div>
        <div className="meta">{e.free ? t('events.free') : e.priceNote}</div>
        <details>
          <summary>{t('events.showDescription')}</summary>
          <p dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{e.description}</p>
          {e.ticketUrl ? <p dir="ltr"><a href={e.ticketUrl} target="_blank" rel="noreferrer">{e.ticketUrl}</a></p> : null}
        </details>
      </td>
      <td>
        <div>{authorLabel(e, nameOf(e))}</div>
        <div className="meta">{regionLabel(e.region, nameOf(e))}</div>
        <div className="meta">{t('announcements.preparedBy', { name: e.preparedByName })}</div>
      </td>
      <td>
        <span className={e.status === 'yayinda' ? 'pill ok' : ['reddedildi', 'kaldirildi', 'iptal'].includes(e.status) ? 'pill warn' : 'pill'}>{t(`events.statuses.${e.status}`)}</span>
        {e.status === 'yayinda' || e.status === 'iptal' ? (
          <div className="meta">{e.capacity ? t('events.attendingOf', { count: e.attendeeCount, capacity: e.capacity }) : t('events.attending', { count: e.attendeeCount })}</div>
        ) : null}
        {e.reviewNote ? <div className="meta" dir="auto">{t('announcements.noteShown', { note: e.reviewNote })}</div> : null}
        {names?.id === e.id ? (
          names.list === null ? (
            <div className="meta">{t('events.loading')}</div>
          ) : (
            <div className="meta">{names.list.length ? names.list.join(', ') : t('events.noNames')}</div>
          )
        ) : null}
      </td>
      <td>{actions}</td>
    </tr>
  );

  const table = (rows: ReactNode[]) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">{t('events.event')}</th>
            <th scope="col">{t('announcements.publisher')}</th>
            <th scope="col">{t('announcements.status')}</th>
            <th scope="col"><span className="sr-only">{t('announcements.actions')}</span></th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );

  const manageActions = (e: CityEvent) =>
    live ? (
      <div className="row-actions">
        {e.preparedBy === user.uid && ['taslak', 'onay-bekliyor', 'reddedildi'].includes(e.status) ? (
          <button className="link" disabled={busy} onClick={() => setDraft({ input: toInput(e), existing: e })}>{t('announcements.edit')}</button>
        ) : null}
        {(e.status === 'yayinda' || e.status === 'iptal') && e.attendeeCount > 0 ? (
          <button className="link" disabled={busy} onClick={() => showNames(e)}>{t('events.showNames')}</button>
        ) : null}
        {canCancel(e) ? (
          <button className="link" disabled={busy} onClick={() => confirm('events.cancelConfirm', e) && act(() => service.cancel(e, isReviewer(e)), t('events.cancelled'))}>{t('events.cancelEvent')}</button>
        ) : null}
        {canUnpublish(e) ? (
          <button className="link" disabled={busy} onClick={() => confirm('events.unpublishConfirm', e) && act(() => service.unpublish(e, isReviewer(e)), t('announcements.unpublished'))}>{t('announcements.unpublish')}</button>
        ) : null}
      </div>
    ) : null;

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('events.title')}</h1>
          <p className="meta">{t('events.intro')}</p>
        </div>
        {publisher && live && !draft ? <button className="btn" onClick={() => setDraft({ input: newDraft() })}>{t('events.new')}</button> : null}
      </header>
      {user.isDemo ? <p className="note">{t('announcements.demoReadOnly')}</p> : null}

      {publishers.length > 1 ? (
        <div className="toolbar">
          <label htmlFor="ev-publisher">{t('announcements.publishAs')}</label>
          <select id="ev-publisher" value={publisherKey} onChange={(e) => (setPublisherKey(e.target.value), setDraft(null))}>
            {publishers.map((p) => (
              <option key={p.key} value={p.key}>{authorLabel({ author: p.author, region: scopeRegion(p) }, nameOf({ region: scopeRegion(p) }))}</option>
            ))}
          </select>
        </div>
      ) : null}
      {publisher ? (
        <p className="note">{canPublishDirectly(publisher) ? t('events.directNote') : publisher.author.type === 'kurum' ? t('events.approvalNoteOrg') : t('events.approvalNoteProvince')}</p>
      ) : !isAdmin && !reviewProvinces.length ? (
        <p className="note">{t('events.noPublisher')}</p>
      ) : null}
      {message ? (
        <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
          {message.retry ? <> <button className="btn secondary" disabled={busy} onClick={message.retry}>{t('limitReached.sendForApproval')}</button></> : null}
        </p>
      ) : null}

      {draft && publisher ? (
        <EventForm
          publisher={publisher}
          draft={draft}
          busy={busy}
          onCancel={() => setDraft(null)}
          onSave={(input, mode) =>
            act(
              () => service.save(publisher, input, mode, draft.existing),
              t(mode === 'taslak' ? 'announcements.savedDraft' : mode === 'onaya' ? 'events.sent' : 'events.published'),
              () => act(() => service.save(publisher, input, 'onaya', draft.existing), t('events.sent')),
            )
          }
        />
      ) : null}

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('events.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('announcements.retry')}</button>
        </div>
      ) : mine === null ? (
        <div className="state" aria-live="polite">{t('events.loading')}</div>
      ) : (
        <>
          {isAdmin || orgReviewer || reviewProvinces.length ? (
            <>
              <h2>{t('announcements.pendingTitle')}</h2>
              {pending.length === 0 ? (
                <div className="state">{t('events.pendingEmpty')}</div>
              ) : (
                table(
                  pending.map((e) =>
                    row(
                      e,
                      rejecting?.id === e.id ? (
                        <form
                          className="form"
                          onSubmit={(ev: FormEvent) => {
                            ev.preventDefault();
                            if (rejecting.note.trim().length < 5) return setMessage({ kind: 'error', text: t('announcements.noteRequired', { min: 5 }) });
                            act(() => service.reject(e, rejecting.note), t('announcements.rejected'));
                          }}>
                          <label htmlFor={`ev-note-${e.id}`}>{t('announcements.note')}</label>
                          <textarea id={`ev-note-${e.id}`} rows={2} maxLength={300} value={rejecting.note} onChange={(x) => setRejecting({ id: e.id, note: x.target.value })} />
                          <div className="row-actions">
                            <button className="btn" type="submit" disabled={busy}>{t('announcements.reject')}</button>
                            <button className="btn secondary" type="button" onClick={() => setRejecting(null)}>{t('announcements.cancel')}</button>
                          </div>
                        </form>
                      ) : live ? (
                        <div className="row-actions">
                          <button className="link" disabled={busy} onClick={() => act(() => service.approve(e), t('events.approved'))}>{t('announcements.approve')}</button>
                          <button className="link" disabled={busy} onClick={() => setRejecting({ id: e.id, note: '' })}>{t('announcements.reject')}</button>
                        </div>
                      ) : null,
                    ),
                  ),
                )
              )}
            </>
          ) : null}

          {publisher ? (
            <>
              <h2>{publisher.author.type === 'kurum' ? t('events.orgTitle') : t('events.mineTitle')}</h2>
              {mine.length === 0 ? <div className="state">{t('events.empty')}</div> : table(mine.map((e) => row(e, manageActions(e))))}
            </>
          ) : null}

          {isAdmin ? (
            <>
              <h2>{t('events.liveTitle')}</h2>
              <div className="toolbar">
                <label htmlFor="ev-province" className="sr-only">{t('announcements.province')}</label>
                <select id="ev-province" value={adminProvince} onChange={(e) => setAdminProvince(e.target.value)}>
                  <option value="">{t('announcements.chooseProvince')}</option>
                  {repo.getProvinces().map((p) => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
              </div>
              {adminProvince ? (liveList.length === 0 ? <div className="state">{t('events.liveEmpty')}</div> : table(liveList.map((e) => row(e, manageActions(e))))) : null}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

const toInput = (e: CityEvent): EventInput => ({
  title: e.title,
  description: e.description,
  category: e.category,
  startsAt: e.startsAt,
  endsAt: e.endsAt,
  venueName: e.venueName,
  ...(e.address ? { address: e.address } : {}),
  region: e.region,
  free: e.free,
  ...(e.priceNote ? { priceNote: e.priceNote } : {}),
  ...(e.ticketUrl ? { ticketUrl: e.ticketUrl } : {}),
  ...(e.capacity ? { capacity: e.capacity } : {}),
});

function EventForm({
  publisher,
  draft,
  busy,
  onCancel,
  onSave,
}: {
  publisher: Publisher;
  draft: { input: EventInput; existing?: CityEvent };
  busy: boolean;
  onCancel(): void;
  onSave(input: EventInput, mode: SaveMode): void;
}) {
  const [input, setInput] = useState<EventInput>(draft.input);
  const [notPolitical, setNotPolitical] = useState(!!draft.existing);
  const [errors, setErrors] = useState<(EventError | 'political')[]>([]);
  const set = (patch: Partial<EventInput>) => setInput((x) => ({ ...x, ...patch }));
  const direct = canPublishDirectly(publisher);

  const submit = (mode: SaveMode) => (e?: FormEvent) => {
    e?.preventDefault();
    const clean: EventInput = { ...input, region: cleanRegion(input.region), ...(input.free ? { priceNote: undefined } : {}) };
    const problems: (EventError | 'political')[] = validateEvent(clean, publisher.scope);
    if (!regionComplete(input.region)) problems.push('region');
    if (!notPolitical) problems.push('political');
    setErrors(problems);
    if (!problems.length) onSave(clean, mode);
  };
  const err = (k: EventError | 'political') => (errors.includes(k) ? <span className="error" role="alert">{t(`events.errors.${k}`)}</span> : null);
  const dateInput = (id: string, key: 'startsAt' | 'endsAt') => (
    <div className="field">
      <label htmlFor={id}>{t(`events.${key}`)}</label>
      <input id={id} type="datetime-local" value={toLocalInput(new Date(input[key]))} onChange={(e) => e.target.value && set({ [key]: new Date(e.target.value).toISOString() })} />
    </div>
  );

  return (
    <form className="form panel-form" onSubmit={submit(direct ? 'yayinla' : 'onaya')} aria-labelledby="ev-form-title">
      <h2 id="ev-form-title" className="form-section">{draft.existing ? t('events.editTitle') : t('events.new')}</h2>
      <div className="field form-section">
        <label htmlFor="ev-title">{t('announcements.titleLabel')}</label>
        <input id="ev-title" value={input.title} maxLength={EVENT_LIMITS.title[1]} onChange={(e) => set({ title: e.target.value })} />
        {err('title')}
      </div>
      <div className="field">
        <label htmlFor="ev-category">{t('events.category')}</label>
        <select id="ev-category" value={input.category} onChange={(e) => set({ category: e.target.value as EventInput['category'] })}>
          {EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{t(`events.categories.${c}`)}</option>
          ))}
        </select>
      </div>
      {dateInput('ev-start', 'startsAt')}
      {dateInput('ev-end', 'endsAt')}
      <p className="form-section">{err('dates')}</p>
      <div className="field form-section">
        <label htmlFor="ev-description">{t('events.description')}</label>
        <textarea id="ev-description" rows={5} dir="auto" value={input.description} maxLength={EVENT_LIMITS.description[1]} onChange={(e) => set({ description: e.target.value })} />
        <span className="meta">{input.description.length} / {EVENT_LIMITS.description[1]}</span>
        {err('description')}
      </div>

      <h3 className="form-section">{t('events.place')}</h3>
      <div className="field">
        <label htmlFor="ev-venue">{t('events.venue')}</label>
        <input id="ev-venue" value={input.venueName} maxLength={EVENT_LIMITS.venueName[1]} onChange={(e) => set({ venueName: e.target.value })} />
        {err('venue')}
      </div>
      <div className="field">
        <label htmlFor="ev-address">{t('events.address')}</label>
        <input id="ev-address" value={input.address ?? ''} maxLength={EVENT_LIMITS.address} onChange={(e) => set({ address: e.target.value })} />
        {err('address')}
      </div>
      <h3 className="form-section">{t('announcements.target')}</h3>
      <RegionFields idPrefix="ev" publisher={publisher} region={input.region} onChange={(region) => set({ region })} />
      {errors.includes('region') ? <p className="form-section error" role="alert">{t('announcements.errors.region')}</p> : null}

      <h3 className="form-section">{t('events.priceAndSeats')}</h3>
      <fieldset className="checkbox-group form-section">
        <legend className="sr-only">{t('events.price')}</legend>
        <label>
          <input type="radio" name="ev-free" checked={input.free} onChange={() => set({ free: true })} />
          {t('events.free')}
        </label>
        <label>
          <input type="radio" name="ev-free" checked={!input.free} onChange={() => set({ free: false })} />
          {t('events.paid')}
        </label>
      </fieldset>
      {!input.free ? (
        <div className="field">
          <label htmlFor="ev-price">{t('events.priceNote')}</label>
          <input id="ev-price" value={input.priceNote ?? ''} maxLength={EVENT_LIMITS.priceNote} placeholder={t('events.pricePlaceholder')} onChange={(e) => set({ priceNote: e.target.value })} />
          {err('price')}
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="ev-ticket">{t('events.ticketUrl')}</label>
        <input id="ev-ticket" type="url" dir="ltr" value={input.ticketUrl ?? ''} maxLength={EVENT_LIMITS.ticketUrl} placeholder="https://" onChange={(e) => set({ ticketUrl: e.target.value })} />
        {err('ticketUrl')}
      </div>
      <div className="field">
        <label htmlFor="ev-capacity">{t('events.capacity')}</label>
        <input
          id="ev-capacity"
          type="number"
          min={1}
          max={EVENT_LIMITS.capacity[1]}
          value={input.capacity ?? ''}
          onChange={(e) => set({ capacity: e.target.value ? Number(e.target.value) : undefined })}
        />
        {err('capacity')}
      </div>
      <p className="form-section meta">{t('events.ticketNote')}</p>

      <div className="field checkbox form-section">
        <label>
          <input type="checkbox" checked={notPolitical} onChange={(e) => setNotPolitical(e.target.checked)} />
          {t('events.notPolitical')}
        </label>
        {err('political')}
      </div>

      <div className="actions">
        <button className="btn" type="submit" disabled={busy}>{direct ? t('announcements.publish') : t('announcements.send')}</button>
        <button className="btn secondary" type="button" disabled={busy} onClick={() => submit('taslak')()}>{t('announcements.saveDraft')}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>{t('announcements.cancel')}</button>
      </div>
    </form>
  );
}
