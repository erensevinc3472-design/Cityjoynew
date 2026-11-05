import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import {
  ANNOUNCEMENT_KINDS,
  ANNOUNCEMENT_LIMITS,
  NEWS_CATEGORIES,
  type NewsCategory,
  canPublishDirectly,
  isFromPublisher,
  isGrantActive,
  publishersFor,
  URGENT_MAX_DAYS,
  validateAnnouncement,
  placeholdersIn,
  prePublishChecks,
  cleanPushTarget,
  validatePushTarget,
  type AudienceFilter,
  type Occupation,
  DEFAULT_IMPORTANT_DAYS,
  type PressTemplate,
  isScheduled,
  SCHEDULE_MAX_DAYS,
  type Announcement,
  type AnnouncementError,
  type AnnouncementInput,
  type AnnouncementKind,
  type Publisher,
} from '@cityjoy/shared';
import { createAnnouncementPanel, createFirestoreAnnouncementRepository, createPressTemplatesService, type SaveMode } from '@cityjoy/shared/firebase';
import { canEditTemplates, pressAuditAs } from '../lib/press';
import { httpsCallable } from 'firebase/functions';
import { createFirestoreOccupationRepository } from '@cityjoy/shared/firebase';

import { authorLabel, cleanRegion, dateTime, regionComplete, regionLabel, RegionFields, scopeRegion, toLocalInput, useNeighbourhoodNames } from '../components/content-common';
import { firestore, functions } from '../lib/firebase';
import { locationRepository as repo } from '../lib/locations';
import { isAdminUser, useSession, type PanelUser } from '../lib/session';
import { t } from '../lib/t';
import { limitText } from '../lib/limits';

// `retry`: sınır dolunca "Onaya gönder" düğmesi.
type Msg = { kind: 'ok' | 'error'; text: string; retry?: () => void } | undefined;
const DAY = 86400000;
/** Planlı yayında başlangıç önerisi: bir sonraki tam saat. */
const nextHour = () => {
  const d = new Date(Date.now() + 3600000);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
};

/**
 * Duyurular (PROJE.md 6.2 madde 1, 4, 6; 6.6): kurum personeli, muhtar ve il yöneticisi duyuru hazırlar. "Onaysız
 * yayınla" ya da "Onayla" yetkisi olan doğrudan yayınlar, diğerleri onaya gönderir. Onay bekleyenleri kurumda "Onayla"
 * yetkisi olan, muhtar duyurularında il yöneticisi görür. Admin bütün onay bekleyenleri ve yayındakileri görür.
 */
export function AnnouncementsPage() {
  const { user } = useSession();
  if (!user) return null;
  return <Announcements user={user} />;
}

function Announcements({ user }: { user: PanelUser }) {
  const isAdmin = isAdminUser(user);
  const live = !user.isDemo;
  const publishers = useMemo(() => publishersFor(user.grants, user.memberships), [user]);
  const service = useMemo(() => createAnnouncementPanel(firestore, { uid: user.uid, name: user.displayName }), [user]);
  // İl yöneticisi: o ildeki muhtar duyurularını onaylar.
  const reviewProvinces = useMemo(
    () => user.grants.filter((g) => !g.orgId && g.scope.level === 'il' && isGrantActive(g, new Date()) && g.modules.gonderiler?.includes('onayla')).map((g) => (g.scope.level === 'il' ? g.scope.provinceCode : '')),
    [user],
  );

  const [publisherKey, setPublisherKey] = useState(publishers[0]?.key ?? '');
  const publisher = publishers.find((p) => p.key === publisherKey);
  const [mine, setMine] = useState<Announcement[] | null>(null);
  const [pending, setPending] = useState<Announcement[]>([]);
  const [adminProvince, setAdminProvince] = useState('');
  const [liveList, setLiveList] = useState<Announcement[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<Msg>();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ input: AnnouncementInput; existing?: Announcement } | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);

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
      setPending(queues.flat().filter((a) => !seen.has(a.id) && seen.add(a.id)));
      if (isAdmin && adminProvince) setLiveList(await createFirestoreAnnouncementRepository(firestore).listLive(adminProvince));
      else setLiveList([]);
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
      setMessage({ kind: 'error', text: limit ?? t('announcements.error'), retry: limit ? onLimit : undefined });
    } finally {
      setBusy(false);
    }
  };

  const nameOf = useNeighbourhoodNames([...(mine ?? []), ...pending, ...liveList, ...publishers.map((p) => ({ region: scopeRegion(p) }))]);
  const isReviewer = (a: Announcement) =>
    isAdmin || (a.author.type === 'kurum' ? a.author.orgId === orgReviewer : reviewProvinces.includes(a.region.provinceCode));
  const canUnpublish = (a: Announcement) =>
    a.status === 'yayinda' && (isReviewer(a) || (a.preparedBy === user.uid && !!publisher && isFromPublisher(a, publisher) && publisher.actions.includes('sil')));

  const newDraft = (): AnnouncementInput => {
    return { kind: 'duyuru', title: '', body: '', region: scopeRegion(publisher!) };
  };

  // Hazır şablonlar (Basın Masası): hesap başına bir belge, form açılınca okunur.
  const templateSvc = useMemo(() => createPressTemplatesService(firestore, user.uid), [user.uid]);
  const [templates, setTemplates] = useState<PressTemplate[]>([]);
  useEffect(() => {
    setTemplates([]);
    if (!publisher || !live || !draft) return;
    templateSvc.load(publisher.key).then(setTemplates, () => setTemplates([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publisher?.key, live, !!draft, templateSvc]);
  const saveTemplate = async (tpl: PressTemplate) => {
    if (!publisher) return;
    const next = [...templates.filter((x) => x.id !== tpl.id), tpl];
    await templateSvc.save(publisher.key, next, pressAuditAs(user, publisher));
    setTemplates(next);
  };

  // Basın Masası'ndan "Bu gün için duyuru hazırla": yeni taslak, başlık önceden dolu.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('yeni') !== '1' || !publisher || !live) return;
    setDraft({ input: { ...newDraft(), title: (params.get('baslik') ?? '').slice(0, 100) } });
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, publisher, live]);

  const rejectSubmit = (e: FormEvent, a: Announcement) => {
    e.preventDefault();
    const note = rejecting?.note.trim() ?? '';
    if (note.length < ANNOUNCEMENT_LIMITS.reviewNote[0]) return setMessage({ kind: 'error', text: t('announcements.noteRequired', { min: ANNOUNCEMENT_LIMITS.reviewNote[0] }) });
    act(() => service.reject(a, note), t('announcements.rejected'));
  };

  const card = (a: Announcement, actions: React.ReactNode) => (
    <tr key={a.id}>
      <td>
        <strong>{a.title}</strong>
        {a.kind === 'acil' ? <> <span className="pill warn">{t('announcements.kinds.acil')}</span></> : null}
        {a.kind === 'haber' ? <> <span className="pill">{t('announcements.kinds.haber')}{a.category ? ` · ${t(`announcements.categories.${a.category}`)}` : ''}</span></> : null}
        {a.pinned ? <> <span className="pill">{t('announcements.pinned')}</span></> : null}
        <details>
          <summary>{t('announcements.showBody')}</summary>
          <p dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{a.body}</p>
        </details>
      </td>
      <td>
        <div>{authorLabel(a, nameOf(a))}</div>
        <div className="meta">{regionLabel(a.region, nameOf(a))}</div>
        <div className="meta">{t('announcements.preparedBy', { name: a.preparedByName })}</div>
      </td>
      <td>
        {isScheduled(a) ? (
          <span className="pill">{t('announcements.scheduledPill')}</span>
        ) : (
          <span className={a.status === 'yayinda' ? 'pill ok' : a.status === 'reddedildi' || a.status === 'kaldirildi' ? 'pill warn' : 'pill'}>{t(`announcements.statuses.${a.status}`)}</span>
        )}
        <div className="meta">{dateTime(a.publishedAt ?? a.updatedAt)}</div>
        {a.scheduledAt && a.status !== 'yayinda' ? <div className="meta">{t('announcements.scheduledFor', { date: dateTime(a.scheduledAt) })}</div> : null}
        {a.pushTarget ? <div className="meta">{t('announcements.target2.tableLabel', { what: targetSummary(a.pushTarget) })}</div> : null}
        {a.endsAt ? <div className="meta">{t('announcements.until', { date: dateTime(a.endsAt) })}</div> : null}
        {a.reviewNote ? <div className="meta" dir="auto">{t('announcements.noteShown', { note: a.reviewNote })}</div> : null}
      </td>
      <td>{actions}</td>
    </tr>
  );

  const table = (rows: React.ReactNode[]) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">{t('announcements.announcement')}</th>
            <th scope="col">{t('announcements.publisher')}</th>
            <th scope="col">{t('announcements.status')}</th>
            <th scope="col"><span className="sr-only">{t('announcements.actions')}</span></th>
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
          <h1>{t('announcements.title')}</h1>
          <p className="meta">{t('announcements.intro')}</p>
        </div>
        {publisher && live && !draft ? <button className="btn" onClick={() => setDraft({ input: newDraft() })}>{t('announcements.new')}</button> : null}
      </header>
      {user.isDemo ? <p className="note">{t('announcements.demoReadOnly')}</p> : null}

      {publishers.length > 1 ? (
        <div className="toolbar">
          <label htmlFor="an-publisher">{t('announcements.publishAs')}</label>
          <select id="an-publisher" value={publisherKey} onChange={(e) => (setPublisherKey(e.target.value), setDraft(null))}>
            {publishers.map((p) => (
              <option key={p.key} value={p.key}>{authorLabel({ author: p.author, region: scopeRegion(p) }, nameOf({ region: scopeRegion(p) }))}</option>
            ))}
          </select>
        </div>
      ) : null}
      {publisher ? (
        <p className="note">{canPublishDirectly(publisher) ? t('announcements.directNote') : publisher.author.type === 'kurum' ? t('announcements.approvalNoteOrg') : t('announcements.approvalNoteProvince')}</p>
      ) : !isAdmin && !reviewProvinces.length ? (
        <p className="note">{t('announcements.noPublisher')}</p>
      ) : null}
      {message ? (
        <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
          {message.retry ? <> <button className="btn secondary" disabled={busy} onClick={message.retry}>{t('limitReached.sendForApproval')}</button></> : null}
        </p>
      ) : null}

      {draft && publisher ? (
        <AnnouncementForm
          publisher={publisher}
          draft={draft}
          busy={busy}
          templates={templates}
          onSaveTemplate={canEditTemplates(user, publisher) ? saveTemplate : undefined}
          onCancel={() => setDraft(null)}
          onSave={(input, mode) =>
            act(
              () => service.save(publisher, input, mode, draft.existing),
              mode === 'yayinla' && input.scheduledAt
                ? t('announcements.scheduledOk', { date: dateTime(input.scheduledAt) })
                : t(mode === 'taslak' ? 'announcements.savedDraft' : mode === 'onaya' ? 'announcements.sent' : 'announcements.published'),
              () => act(() => service.save(publisher, input, 'onaya', draft.existing), t('announcements.sent')),
            )
          }
        />
      ) : null}

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('announcements.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('announcements.retry')}</button>
        </div>
      ) : mine === null ? (
        <div className="state" aria-live="polite">{t('announcements.loading')}</div>
      ) : (
        <>
          {isAdmin || orgReviewer || reviewProvinces.length ? (
            <>
              <h2>{t('announcements.pendingTitle')}</h2>
              {pending.length === 0 ? (
                <div className="state">{t('announcements.pendingEmpty')}</div>
              ) : (
                table(
                  pending.map((a) =>
                    card(
                      a,
                      rejecting?.id === a.id ? (
                        <form className="form" onSubmit={(e) => rejectSubmit(e, a)}>
                          <label htmlFor={`note-${a.id}`}>{t('announcements.note')}</label>
                          <textarea id={`note-${a.id}`} rows={2} maxLength={ANNOUNCEMENT_LIMITS.reviewNote[1]} value={rejecting.note} onChange={(e) => setRejecting({ id: a.id, note: e.target.value })} />
                          <div className="row-actions">
                            <button className="btn" type="submit" disabled={busy}>{t('announcements.reject')}</button>
                            <button className="btn secondary" type="button" onClick={() => setRejecting(null)}>{t('announcements.cancel')}</button>
                          </div>
                        </form>
                      ) : live ? (
                        <div className="row-actions">
                          <button className="link" disabled={busy} onClick={() => act(() => service.approve(a), t('announcements.approved'))}>{t('announcements.approve')}</button>
                          {isAdmin && a.kind !== 'acil' ? (
                            <button className="link" disabled={busy} title={t('announcements.approveRingHint')} onClick={() => act(() => service.approve(a, { ringAlways: true }), t('announcements.approved'))}>
                              {t('announcements.approveRing')}
                            </button>
                          ) : null}
                          <button className="link" disabled={busy} onClick={() => setRejecting({ id: a.id, note: '' })}>{t('announcements.reject')}</button>
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
              <h2>{publisher.author.type === 'kurum' ? t('announcements.orgTitle') : t('announcements.mineTitle')}</h2>
              {mine.length === 0 ? (
                <div className="state">{t('announcements.empty')}</div>
              ) : (
                table(
                  mine.map((a) =>
                    card(
                      a,
                      live ? (
                        <div className="row-actions">
                          {a.preparedBy === user.uid && ['taslak', 'onay-bekliyor', 'reddedildi'].includes(a.status) ? (
                            <button className="link" disabled={busy} onClick={() => setDraft({ input: { kind: a.kind, title: a.title, body: a.body, region: a.region, ...(a.endsAt ? { endsAt: a.endsAt } : {}), ...(a.pinned ? { pinned: true } : {}), ...(a.category ? { category: a.category } : {}), ...(a.scheduledAt && new Date(a.scheduledAt) > new Date() ? { scheduledAt: a.scheduledAt } : {}), ...(a.pushTarget ? { pushTarget: a.pushTarget } : {}) }, existing: a })}>
                              {t('announcements.edit')}
                            </button>
                          ) : null}
                          {canUnpublish(a) ? (
                            <button className="link" disabled={busy} onClick={() => window.confirm(t('announcements.unpublishConfirm', { title: a.title })) && act(() => service.unpublish(a, isReviewer(a)), t('announcements.unpublished'))}>
                              {isScheduled(a) ? t('announcements.cancelSchedule') : t('announcements.unpublish')}
                            </button>
                          ) : null}
                        </div>
                      ) : null,
                    ),
                  ),
                )
              )}
            </>
          ) : null}

          {isAdmin ? (
            <>
              <h2>{t('announcements.liveTitle')}</h2>
              <div className="toolbar">
                <label htmlFor="an-province" className="sr-only">{t('announcements.province')}</label>
                <select id="an-province" value={adminProvince} onChange={(e) => setAdminProvince(e.target.value)}>
                  <option value="">{t('announcements.chooseProvince')}</option>
                  {repo.getProvinces().map((p) => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
              </div>
              {adminProvince
                ? liveList.length === 0
                  ? <div className="state">{t('announcements.liveEmpty')}</div>
                  : table(
                      liveList.map((a) =>
                        card(
                          a,
                          live ? (
                            <div className="row-actions">
                              <button className="link" disabled={busy} onClick={() => window.confirm(t('announcements.unpublishConfirm', { title: a.title })) && act(() => service.unpublish(a, true), t('announcements.unpublished'))}>
                                {t('announcements.unpublish')}
                              </button>
                            </div>
                          ) : null,
                        ),
                      ),
                    )
                : null}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

function AnnouncementForm({
  publisher,
  draft,
  busy,
  templates,
  onSaveTemplate,
  onCancel,
  onSave,
}: {
  publisher: Publisher;
  draft: { input: AnnouncementInput; existing?: Announcement };
  busy: boolean;
  templates: PressTemplate[];
  onSaveTemplate?: (tpl: PressTemplate) => Promise<void>;
  onCancel(): void;
  onSave(input: AnnouncementInput, mode: SaveMode): void;
}) {
  const sc = publisher.scope;
  const [input, setInput] = useState<AnnouncementInput>(draft.input);
  const [errors, setErrors] = useState<AnnouncementError[]>([]);
  // Şablondan gelen doldurulmamış boşluklar ([tarih], [saat]): yayına ve onaya gönderilmez, taslak olur.
  const [blanks, setBlanks] = useState<string[]>([]);
  const [tplName, setTplName] = useState<string | null>(null);
  const [tplMsg, setTplMsg] = useState<{ ok: boolean; text: string }>();
  const applyTemplate = (id: string) => {
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    set({ kind: tpl.kind, title: tpl.title, body: tpl.body, category: tpl.kind === 'haber' ? tpl.category : undefined, ...(tpl.kind === 'acil' && !input.endsAt ? { endsAt: new Date(Date.now() + DAY).toISOString() } : {}) });
    setBlanks([]);
  };
  const storeTemplate = async () => {
    const name = (tplName ?? '').trim();
    if (name.length < 2 || !onSaveTemplate) return;
    setTplMsg(undefined);
    try {
      await onSaveTemplate({ id: Date.now().toString(36), name: name.slice(0, 60), kind: input.kind, title: input.title.trim(), body: input.body.trim(), ...(input.kind === 'haber' && input.category ? { category: input.category } : {}) });
      setTplName(null);
      setTplMsg({ ok: true, text: t('announcements.templateSaved') });
    } catch {
      setTplMsg({ ok: false, text: t('announcements.templateError') });
    }
  };
  const set = (patch: Partial<AnnouncementInput>) => setInput((x) => ({ ...x, ...patch }));
  const changeKind = (kind: AnnouncementKind) =>
    set({ kind, ...(kind === 'acil' && !input.endsAt ? { endsAt: new Date(Date.now() + DAY).toISOString() } : {}) });

  const submit = (mode: SaveMode) => (e?: FormEvent) => {
    e?.preventDefault();
    const region = cleanRegion(input.region);
    // Mahalle düzeyinden çıkılınca ya da acil seçilince sabitleme düşer.
    const pinned = input.pinned && input.kind === 'duyuru' && !!region.neighbourhoodId;
    const clean: AnnouncementInput = {
      ...input,
      region,
      ...(pinned ? { pinned: true } : { pinned: undefined }),
      // Kategori yalnızca haberde; acil duyuru planlanmaz.
      ...(input.kind === 'haber' ? {} : { category: undefined }),
      ...(input.kind === 'acil' ? { scheduledAt: undefined, pushTarget: undefined } : { pushTarget: cleanPushTarget(input.pushTarget) ?? undefined }),
    };
    const problems = validateAnnouncement(clean, sc);
    // Seçilmemiş ilçe / mahalle de bölge hatasıdır.
    if (!regionComplete(input.region)) problems.push('region');
    setErrors(problems);
    const open = mode === 'taslak' ? [] : placeholdersIn(`${clean.title}\n${clean.body}`);
    setBlanks(open);
    if (!problems.length && !open.length) onSave(clean, mode);
  };
  const err = (k: AnnouncementError) => (errors.includes(k) ? <span className="error" role="alert">{t(`announcements.errors.${k}`)}</span> : null);
  const direct = canPublishDirectly(publisher);

  return (
    <form className="form panel-form" onSubmit={submit(direct ? 'yayinla' : 'onaya')} aria-labelledby="an-form-title">
      <h2 id="an-form-title" className="form-section">{draft.existing ? t('announcements.editTitle') : t('announcements.new')}</h2>
      {templates.length ? (
        <div className="field form-section">
          <label htmlFor="an-template">{t('announcements.fromTemplate')}</label>
          <select id="an-template" value="" onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">{t('announcements.chooseTemplate')}</option>
            {templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <span className="meta">{t('announcements.templateHint')}</span>
        </div>
      ) : null}
      <fieldset className="checkbox-group form-section">
        <legend>{t('announcements.kind')}</legend>
        {ANNOUNCEMENT_KINDS.map((k) => (
          <label key={k}>
            <input type="radio" name="an-kind" checked={input.kind === k} onChange={() => changeKind(k)} />
            {t(`announcements.kinds.${k}`)}
          </label>
        ))}
      </fieldset>
      {input.kind === 'acil' ? <p className="form-section meta">{t('announcements.urgentHint', { days: URGENT_MAX_DAYS })}</p> : null}
      {input.kind === 'haber' ? (
        <div className="field form-section">
          <p className="meta">{t('announcements.newsHint')}</p>
          <label htmlFor="an-category">{t('announcements.category')}</label>
          <select id="an-category" value={input.category ?? ''} onChange={(e) => set({ category: (e.target.value || undefined) as NewsCategory | undefined })}>
            <option value="">{t('announcements.chooseCategory')}</option>
            {NEWS_CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(`announcements.categories.${c}`)}</option>
            ))}
          </select>
          {err('category')}
        </div>
      ) : null}
      <div className="field form-section">
        <label htmlFor="an-title">{t('announcements.titleLabel')}</label>
        <input id="an-title" value={input.title} maxLength={ANNOUNCEMENT_LIMITS.title[1]} onChange={(e) => set({ title: e.target.value })} />
        {err('title')}
      </div>
      <div className="field form-section">
        <label htmlFor="an-body">{t('announcements.bodyLabel')}</label>
        <textarea id="an-body" rows={6} dir="auto" value={input.body} maxLength={ANNOUNCEMENT_LIMITS.body[1]} onChange={(e) => set({ body: e.target.value })} />
        <span className="meta">{input.body.length} / {ANNOUNCEMENT_LIMITS.body[1]}</span>
        {err('body')}
      </div>

      <h3 className="form-section">{t('announcements.target')}</h3>
      <RegionFields idPrefix="an" publisher={publisher} region={input.region} onChange={(region) => set({ region })} />
      <div className="field">
        <label htmlFor="an-ends">{input.kind === 'acil' ? t('announcements.endsRequired') : t('announcements.endsOptional')}</label>
        <input
          id="an-ends"
          type="datetime-local"
          value={input.endsAt ? toLocalInput(new Date(input.endsAt)) : ''}
          min={toLocalInput(new Date())}
          onChange={(e) => set({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
        />
        {err('endsAt')}
      </div>
      {input.kind !== 'acil' ? (
        // Planlı yayın (Basın Masası): seçilen anda kendiliğinden yayına girer; onaya gidende onaylanınca bu an kullanılır.
        <fieldset className="checkbox-group form-section">
          <legend>{t('announcements.when')}</legend>
          <label>
            <input type="radio" name="an-when" checked={!input.scheduledAt} onChange={() => set({ scheduledAt: undefined })} />
            {t('announcements.whenNow')}
          </label>
          <label>
            <input type="radio" name="an-when" checked={!!input.scheduledAt} onChange={() => set({ scheduledAt: nextHour() })} />
            {t('announcements.whenLater')}
          </label>
          {input.scheduledAt ? (
            <div className="field">
              <label htmlFor="an-scheduled">{t('announcements.scheduledLabel')}</label>
              <input
                id="an-scheduled"
                type="datetime-local"
                value={toLocalInput(new Date(input.scheduledAt))}
                min={toLocalInput(new Date())}
                onChange={(e) => set({ scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : nextHour() })}
              />
              <span className="meta">{t('announcements.scheduledHint', { days: SCHEDULE_MAX_DAYS })}</span>
              {err('scheduledAt')}
            </div>
          ) : null}
        </fieldset>
      ) : null}
      {input.kind !== 'acil' ? (
        <AudienceFields publisherKey={publisher.key} region={input.region} value={input.pushTarget} onChange={(pushTarget) => set({ pushTarget })} />
      ) : <p className="form-section meta">{t('announcements.target2.urgent')}</p>}
      {err('pushTarget')}
      {input.kind === 'duyuru' && input.region.neighbourhoodId !== undefined ? (
        <div className="field checkbox form-section">
          <label>
            <input type="checkbox" checked={!!input.pinned} onChange={(e) => set({ pinned: e.target.checked || undefined })} />
            {t('announcements.pinLabel')}
          </label>
          <span className="meta">{t('announcements.pinHint')}</span>
          {err('pinned')}
        </div>
      ) : null}
      {errors.includes('region') ? <p className="form-section error" role="alert">{t('announcements.errors.region')}</p> : null}
      <p className="form-section meta">{t('announcements.languageNote')}</p>
      {blanks.length ? <p className="form-section error" role="alert">{t('announcements.blanks', { list: blanks.join(', ') })}</p> : null}
      <PrePublish input={input} />

      <div className="actions">
        {direct ? (
          <button className="btn" type="submit" disabled={busy}>{input.scheduledAt && input.kind !== 'acil' ? t('announcements.schedule') : t('announcements.publish')}</button>
        ) : (
          <button className="btn" type="submit" disabled={busy}>{t('announcements.send')}</button>
        )}
        <button className="btn secondary" type="button" disabled={busy} onClick={() => submit('taslak')()}>{t('announcements.saveDraft')}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>{t('announcements.cancel')}</button>
        {onSaveTemplate && tplName === null ? (
          <button className="btn ghost" type="button" disabled={input.title.trim().length < 3 || input.body.trim().length < 10} onClick={() => setTplName(input.title.slice(0, 60))}>
            {t('announcements.saveAsTemplate')}
          </button>
        ) : null}
      </div>
      {onSaveTemplate && tplName !== null ? (
        <div className="field form-section">
          <label htmlFor="an-tpl-name">{t('announcements.templateName')}</label>
          <input id="an-tpl-name" value={tplName} maxLength={60} onChange={(e) => setTplName(e.target.value)} />
          <span className="meta">{t('announcements.templateNameHint')}</span>
          <div className="actions">
            <button className="btn secondary" type="button" disabled={tplName.trim().length < 2} onClick={storeTemplate}>{t('announcements.templateStore')}</button>
            <button className="btn ghost" type="button" onClick={() => setTplName(null)}>{t('announcements.cancel')}</button>
          </div>
        </div>
      ) : null}
      {tplMsg ? <p className={`form-section ${tplMsg.ok ? 'note' : 'error'}`} role={tplMsg.ok ? 'status' : 'alert'}>{tplMsg.text}</p> : null}
    </form>
  );
}

/** Yayın öncesi kontrol listesi (Basın Masası): yazarken güncellenir; yalnızca doldurulmamış boşluk yayını durdurur. */
function PrePublish({ input }: { input: AnnouncementInput }) {
  const region = cleanRegion(input.region);
  const label = region.provinceCode ? `${regionLabel(region)}${region.neighbourhoodId ? ` · ${t('announcements.check.oneHood')}` : ''}` : '—';
  const checks = prePublishChecks(input, { regionLabel: label, days: DEFAULT_IMPORTANT_DAYS });
  const icon = { tamam: '✓', uyari: '!', hata: '✕' } as const;
  return (
    <div className="form-section prepublish" aria-live="polite">
      <h3>{t('announcements.check.title')}</h3>
      <ul>
        {checks.map((c) => (
          <li key={c.key} className={`lvl-${c.level}`}>
            <span className="ic" aria-hidden="true">{icon[c.level]}</span>
            <span>
              <span className="sr-only">{t(`announcements.check.level.${c.level}`)}: </span>
              {t(`announcements.check.${c.key}.${c.level === 'tamam' ? 'ok' : 'warn'}`, c.vars ?? {})}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Hedefin kısa özeti: "65+ yaş, kadın, 2 meslek". */
function targetSummary(f: AudienceFilter): string {
  const parts: string[] = [];
  if (f.ageMin !== undefined || f.ageMax !== undefined) {
    parts.push(f.ageMax === undefined ? t('announcements.target2.ageFrom', { min: f.ageMin! }) : f.ageMin === undefined ? t('announcements.target2.ageTo', { max: f.ageMax }) : t('announcements.target2.ageRange', { min: f.ageMin, max: f.ageMax }));
  }
  if (f.genders?.length) parts.push(f.genders.map((g) => t(`announcements.target2.g.${g}`)).join(' / '));
  if (f.occupations?.length) parts.push(t('announcements.target2.occCount', { count: f.occupations.length }));
  return parts.join(', ');
}

let occupationCache: Occupation[] | null = null;

/**
 * Hedefli bildirim (PROJE.md 7; Karar Eren 5 Kasım: yalnızca bildirimi daraltır). Bölge duyurunun bölgesidir; yaş,
 * cinsiyet ve meslek isteğe bağlı. "Kaç kişiye ulaşır?" sunucuda sayılır (Blaze), panele kişi bilgisi gelmez.
 */
function AudienceFields({ publisherKey, region, value, onChange }: {
  publisherKey: string; region: AnnouncementInput['region']; value?: AudienceFilter; onChange: (v: AudienceFilter | undefined) => void;
}) {
  const [group, setGroup] = useState(!!value);
  const [occupations, setOccupations] = useState<Occupation[]>(occupationCache ?? []);
  const [estimate, setEstimate] = useState<{ state: 'idle' | 'busy' | 'ok' | 'small' | 'error'; n?: number }>({ state: 'idle' });
  const f = value ?? {};
  useEffect(() => {
    if (!group || occupationCache) return;
    createFirestoreOccupationRepository(firestore).listActive().then((l) => { occupationCache = l; setOccupations(l); }, () => setOccupations([]));
  }, [group]);
  useEffect(() => setEstimate({ state: 'idle' }), [value, region]);
  const patch = (p: Partial<AudienceFilter>) => onChange({ ...f, ...p });
  const num = (v: string) => (v === '' ? undefined : Math.round(Number(v)));
  const toggle = <T extends string>(list: T[] | undefined, x: T, on: boolean) => (on ? [...(list ?? []), x] : (list ?? []).filter((y) => y !== x));
  const invalid = validatePushTarget(f).length > 0;

  const ask = async () => {
    setEstimate({ state: 'busy' });
    try {
      const r = await httpsCallable<unknown, { tooSmall: boolean; approx: number }>(functions, 'estimateAudience')({ publisherKey, region: cleanRegion(region), target: group ? cleanPushTarget(f) : null });
      setEstimate(r.data.tooSmall ? { state: 'small' } : { state: 'ok', n: r.data.approx });
    } catch {
      setEstimate({ state: 'error' });
    }
  };

  return (
    <fieldset className="checkbox-group form-section audience">
      <legend>{t('announcements.target2.title')}</legend>
      <label>
        <input type="radio" name="an-aud" checked={!group} onChange={() => { setGroup(false); onChange(undefined); }} />
        {t('announcements.target2.everyone')}
      </label>
      <label>
        <input type="radio" name="an-aud" checked={group} onChange={() => setGroup(true)} />
        {t('announcements.target2.group')}
      </label>
      {group ? (
        <div className="audience-box">
          <div className="audience-row">
            <div className="field">
              <label htmlFor="aud-min">{t('announcements.target2.ageMin')}</label>
              <input id="aud-min" type="number" min={13} max={120} inputMode="numeric" value={f.ageMin ?? ''} onChange={(e) => patch({ ageMin: num(e.target.value) })} />
            </div>
            <div className="field">
              <label htmlFor="aud-max">{t('announcements.target2.ageMax')}</label>
              <input id="aud-max" type="number" min={13} max={120} inputMode="numeric" value={f.ageMax ?? ''} onChange={(e) => patch({ ageMax: num(e.target.value) })} />
            </div>
            <fieldset className="checkbox-group">
              <legend>{t('announcements.target2.gender')}</legend>
              {(['kadin', 'erkek'] as const).map((g) => (
                <label key={g}>
                  <input type="checkbox" checked={!!f.genders?.includes(g)} onChange={(e) => patch({ genders: toggle(f.genders, g, e.target.checked) })} />
                  {t(`announcements.target2.g.${g}`)}
                </label>
              ))}
            </fieldset>
          </div>
          {invalid ? <span className="error" role="alert">{t('announcements.target2.invalid')}</span> : null}
          <fieldset className="checkbox-group">
            <legend>{t('announcements.target2.occupations')} <small className="meta">{t('announcements.target2.occHint')}</small></legend>
            <div className="occ-list">
              {occupations.map((o) => (
                <label key={o.id}>
                  <input type="checkbox" checked={!!f.occupations?.includes(o.id)} disabled={!f.occupations?.includes(o.id) && (f.occupations?.length ?? 0) >= 10} onChange={(e) => patch({ occupations: toggle(f.occupations, o.id, e.target.checked) })} />
                  {o.names.tr}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}
      <div className="audience-estimate">
        <button type="button" className="btn secondary" disabled={estimate.state === 'busy' || invalid || !region.provinceCode} onClick={ask}>{t('announcements.target2.ask')}</button>
        <span role="status">
          {estimate.state === 'ok' ? t('announcements.target2.approx', { count: (estimate.n ?? 0).toLocaleString('tr-TR') })
            : estimate.state === 'small' ? t('announcements.target2.small')
            : estimate.state === 'error' ? t('announcements.target2.noServer')
            : estimate.state === 'busy' ? t('profile.loading') : ''}
        </span>
      </div>
      <p className="meta">{t('announcements.target2.note')}</p>
    </fieldset>
  );
}
