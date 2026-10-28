import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { BANNED_WORD_LIMITS, can, isGrantActive } from '@cityjoy/shared';
import {
  createActivityModeration,
  createBannedWords,
  createPostModeration,
  createProfileModeration,
  createReviewModeration,
  type ActivityReport,
  type CommentReport,
  type PostReport,
  type ProfileReport,
  type ReviewReport,
} from '@cityjoy/shared/firebase';

import { regionLabel } from '../components/content-common';
import { firestore } from '../lib/firebase';
import { isAdminUser, useSession, type PanelUser } from '../lib/session';
import { t } from '../lib/t';

/**
 * Moderasyon (PROJE.md 6.4, 15.1): şikâyet edilen işletme değerlendirmeleri. Gizlenen yorum işletme
 * puanından da düşer. Uygulamadaki "Şikâyet et" düğmesinin panel karşılığı.
 */
export function ModerationPage() {
  const { user } = useSession();
  const isAdmin = !!user?.grants.some((g) => g.role === 'admin');
  const canEdit = !!user && !user.isDemo && can(user.grants, { module: 'moderasyon', action: 'duzenle' }) && isAdmin;
  const mod = user ? createReviewModeration(firestore, user.uid) : null;

  const [list, setList] = useState<ReviewReport[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    if (user?.isDemo) return setList([]);
    // Şikâyetler şimdilik yalnızca admin'e açık; il bazlı kuyruk sonraki adımda (kurallar da okutmaz).
    if (!isAdmin) return setList([]);
    try {
      setList(await createReviewModeration(firestore, 'okuma').listReports());
    } catch {
      setLoadError(true);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
      setMessage({ kind: 'ok', text: t('moderation.saved') });
      await load();
    } catch {
      setMessage({ kind: 'error', text: t('moderation.error') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('moderation.title')}</h1>
          <p className="meta">{t('moderation.intro')}</p>
        </div>
      </header>
      {user?.isDemo ? <p className="note">{t('moderation.demoReadOnly')}</p> : !isAdmin ? <p className="note">{t('moderation.adminOnly')}</p> : !canEdit ? <p className="note">{t('moderation.readOnly')}</p> : null}
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('moderation.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('moderation.retry')}</button>
        </div>
      ) : list === null ? (
        <div className="state" aria-live="polite">{t('moderation.loading')}</div>
      ) : list.length === 0 ? (
        <div className="state">{t('moderation.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('moderation.date')}</th>
                <th scope="col">{t('moderation.business')}</th>
                <th scope="col">{t('moderation.review')}</th>
                <th scope="col">{t('moderation.reason')}</th>
                <th scope="col">{t('moderation.status')}</th>
                {canEdit ? <th scope="col"><span className="sr-only">{t('moderation.actions')}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="num">{new Date(r.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td>{r.businessName ?? t('moderation.deletedBusiness')}</td>
                  <td>
                    {r.review ? (
                      <>
                        <div>{'★'.repeat(r.review.stars)}{'☆'.repeat(5 - r.review.stars)} · {r.review.authorName}</div>
                        <div dir="auto">{r.review.text}</div>
                        {r.review.status === 'gizlendi' ? <span className="pill warn">{t('moderation.hidden')}</span> : null}
                      </>
                    ) : (
                      <span className="meta">{t('moderation.deletedReview')}</span>
                    )}
                  </td>
                  <td>{t(`moderation.reasons.${r.reason}`)}</td>
                  <td><span className={r.status === 'yeni' ? 'pill warn' : 'pill'}>{t(`moderation.statuses.${r.status}`)}</span></td>
                  {canEdit ? (
                    <td>
                      <div className="row-actions">
                        {r.review ? (
                          <button className="link" disabled={busy} onClick={() => act(() => mod!.setHidden(r, r.review!.status === 'yayinda'))}>
                            {r.review.status === 'yayinda' ? t('moderation.hide') : t('moderation.unhide')}
                          </button>
                        ) : null}
                        {r.status === 'yeni' ? (
                          <button className="link" disabled={busy} onClick={() => act(() => mod!.dismiss(r))}>{t('moderation.dismiss')}</button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="count">{t('moderation.note')}</p>
        </div>
      )}
      {user ? <ActivityReports user={user} /> : null}
      {user ? <PostReports user={user} /> : null}
      {user ? <CommentReports user={user} /> : null}
      {user ? <ProfileReports user={user} /> : null}
      {user && isAdminUser(user) ? <BannedWords user={user} /> : null}
    </section>
  );
}

/**
 * Aktivite şikâyetleri (PROJE.md 5.3): admin hepsini, il yöneticisi ve il düzeyindeki gönüllü moderatör kendi ilini görür.
 * Üç şikâyet alan aktivite uygulamada listeden düşer; "Kaldır" tamamen kaldırır, "Yerinde kalsın" geri getirir.
 */
function ActivityReports({ user }: { user: PanelUser }) {
  const isAdmin = isAdminUser(user);
  const provinces = useMemo(
    () => [...new Set(user.grants.filter((g) => g.scope.level === 'il' && isGrantActive(g, new Date()) && g.modules.moderasyon?.includes('goruntule')).map((g) => (g.scope.level === 'il' ? g.scope.provinceCode : '')))],
    [user],
  );
  const canDecide = !user.isDemo && (isAdmin || user.grants.some((g) => g.scope.level === 'il' && g.modules.moderasyon?.includes('duzenle')));
  const [list, setList] = useState<ActivityReport[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);
  const mod = useMemo(() => createActivityModeration(firestore, user.uid), [user]);

  const load = useCallback(async () => {
    setLoadError(false);
    if (user.isDemo || (!isAdmin && !provinces.length)) return setList([]);
    try {
      const all = await Promise.all(isAdmin ? [mod.listReports('admin')] : provinces.map((p) => mod.listReports({ provinceCode: p })));
      setList(all.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch {
      setLoadError(true);
    }
  }, [user, isAdmin, provinces, mod]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
      setMessage({ kind: 'ok', text: t('moderation.saved') });
      await load();
    } catch {
      setMessage({ kind: 'error', text: t('moderation.error') });
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin && !provinces.length) return null;
  return (
    <>
      <header className="page-head">
        <div>
          <h2>{t('moderation.activities.title')}</h2>
          <p className="meta">{t('moderation.activities.intro')}</p>
        </div>
      </header>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {loadError ? (
        <div className="state" role="alert">
          <p>{t('moderation.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('moderation.retry')}</button>
        </div>
      ) : list === null ? (
        <div className="state" aria-live="polite">{t('moderation.loading')}</div>
      ) : list.length === 0 ? (
        <div className="state">{t('moderation.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('moderation.date')}</th>
                <th scope="col">{t('moderation.activities.activity')}</th>
                <th scope="col">{t('moderation.reason')}</th>
                <th scope="col">{t('moderation.status')}</th>
                {canDecide ? <th scope="col"><span className="sr-only">{t('moderation.actions')}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="num">{new Date(r.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td>
                    {r.activity ? (
                      <>
                        <strong>{r.activity.title}</strong>
                        <div className="meta">{regionLabel(r.activity.region)} · {new Date(r.activity.startsAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                        <div className="meta">{t('moderation.activities.counts', { reports: r.activity.reportCount, attendees: r.activity.attendeeCount })}</div>
                        <details>
                          <summary>{t('announcements.showBody')}</summary>
                          <p dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{r.activity.description}</p>
                        </details>
                        {r.activity.status === 'kaldirildi' ? <span className="pill warn">{t('moderation.activities.removed')}</span> : r.activity.cleared ? <span className="pill ok">{t('moderation.activities.kept')}</span> : null}
                      </>
                    ) : (
                      <span className="meta">{t('moderation.activities.missing')}</span>
                    )}
                  </td>
                  <td>{t(`moderation.activities.reasons.${r.reason}`)}</td>
                  <td><span className={r.status === 'yeni' ? 'pill warn' : 'pill'}>{t(`moderation.statuses.${r.status}`)}</span></td>
                  {canDecide ? (
                    <td>
                      <div className="row-actions">
                        {r.activity && r.activity.status !== 'kaldirildi' ? (
                          <button className="link" disabled={busy} onClick={() => act(() => mod.remove(r))}>{t('moderation.activities.remove')}</button>
                        ) : null}
                        {r.activity && r.activity.status !== 'kaldirildi' && !r.activity.cleared ? (
                          <button className="link" disabled={busy} onClick={() => act(() => mod.keep(r))}>{t('moderation.activities.keep')}</button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="count">{t('moderation.activities.note')}</p>
        </div>
      )}
    </>
  );
}

/**
 * Keşfet şikâyetleri (PROJE.md 5.5 madde 8): admin hepsini, il yöneticisi ve il düzeyindeki gönüllü moderatör kendi
 * ilini görür. Üç şikâyet alan gönderi uygulamada akıştan düşer; "Kaldır" tamamen kaldırır, "Yerinde kalsın" geri getirir.
 */
function PostReports({ user }: { user: PanelUser }) {
  const isAdmin = isAdminUser(user);
  const provinces = useMemo(
    () => [...new Set(user.grants.filter((g) => g.scope.level === 'il' && isGrantActive(g, new Date()) && g.modules.moderasyon?.includes('goruntule')).map((g) => (g.scope.level === 'il' ? g.scope.provinceCode : '')))],
    [user],
  );
  const canDecide = !user.isDemo && (isAdmin || user.grants.some((g) => g.scope.level === 'il' && g.modules.moderasyon?.includes('duzenle')));
  const [list, setList] = useState<PostReport[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);
  const mod = useMemo(() => createPostModeration(firestore, user.uid), [user]);

  const load = useCallback(async () => {
    setLoadError(false);
    if (user.isDemo || (!isAdmin && !provinces.length)) return setList([]);
    try {
      const all = await Promise.all(isAdmin ? [mod.listReports('admin')] : provinces.map((p) => mod.listReports({ provinceCode: p })));
      setList(all.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch {
      setLoadError(true);
    }
  }, [user, isAdmin, provinces, mod]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
      setMessage({ kind: 'ok', text: t('moderation.saved') });
      await load();
    } catch {
      setMessage({ kind: 'error', text: t('moderation.error') });
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin && !provinces.length) return null;
  return (
    <>
      <header className="page-head">
        <div>
          <h2>{t('moderation.posts.title')}</h2>
          <p className="meta">{t('moderation.posts.intro')}</p>
        </div>
      </header>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {loadError ? (
        <div className="state" role="alert">
          <p>{t('moderation.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('moderation.retry')}</button>
        </div>
      ) : list === null ? (
        <div className="state" aria-live="polite">{t('moderation.loading')}</div>
      ) : list.length === 0 ? (
        <div className="state">{t('moderation.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('moderation.date')}</th>
                <th scope="col">{t('moderation.posts.post')}</th>
                <th scope="col">{t('moderation.reason')}</th>
                <th scope="col">{t('moderation.status')}</th>
                {canDecide ? <th scope="col"><span className="sr-only">{t('moderation.actions')}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="num">{new Date(r.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td>
                    {r.post && r.post.text ? (
                      <>
                        <strong>{r.post.authorName}</strong> <span className="meta">· {t(`moderation.posts.categories.${r.post.category}`)}</span>
                        <div className="meta">{regionLabel(r.post.region)} · {r.post.targets.map((x) => t(`moderation.posts.targets.${x}`)).join(', ')}</div>
                        <div className="meta">{t('moderation.posts.counts', { reports: r.post.reportCount, likes: r.post.likeCount })}</div>
                        <details>
                          <summary>{t('announcements.showBody')}</summary>
                          <p dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{r.post.text}</p>
                        </details>
                        {r.post.status === 'kaldirildi' ? <span className="pill warn">{t('moderation.posts.removed')}</span> : r.post.cleared ? <span className="pill ok">{t('moderation.posts.kept')}</span> : null}
                      </>
                    ) : (
                      <span className="meta">{t('moderation.posts.missing')}</span>
                    )}
                  </td>
                  <td>{t(`moderation.posts.reasons.${r.reason}`)}</td>
                  <td><span className={r.status === 'yeni' ? 'pill warn' : 'pill'}>{t(`moderation.statuses.${r.status}`)}</span></td>
                  {canDecide ? (
                    <td>
                      <div className="row-actions">
                        {r.post && r.post.status !== 'kaldirildi' ? (
                          <button className="link" disabled={busy} onClick={() => act(() => mod.remove(r))}>{t('moderation.posts.remove')}</button>
                        ) : null}
                        {r.post && r.post.status !== 'kaldirildi' && !r.post.cleared ? (
                          <button className="link" disabled={busy} onClick={() => act(() => mod.keep(r))}>{t('moderation.posts.keep')}</button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="count">{t('moderation.posts.note')}</p>
        </div>
      )}
    </>
  );
}

/**
 * Keşfet yorum şikâyetleri: admin hepsini, il yöneticisi ve il düzeyindeki gönüllü moderatör kendi ilini görür. Üç
 * şikâyet alan yorum uygulamada gizlenir; "Yorumu sil" tamamen siler, "Yerinde kalsın" geri getirir. Yorum yazısının
 * şikâyet anındaki kopyası gösterilir (yorum sonradan silinmiş olsa da). Her işlem kayda geçer.
 */
function CommentReports({ user }: { user: PanelUser }) {
  const isAdmin = isAdminUser(user);
  const provinces = useMemo(
    () => [...new Set(user.grants.filter((g) => g.scope.level === 'il' && isGrantActive(g, new Date()) && g.modules.moderasyon?.includes('goruntule')).map((g) => (g.scope.level === 'il' ? g.scope.provinceCode : '')))],
    [user],
  );
  const canDecide = !user.isDemo && (isAdmin || user.grants.some((g) => g.scope.level === 'il' && g.modules.moderasyon?.includes('sil')));
  const [list, setList] = useState<CommentReport[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);
  const mod = useMemo(() => createPostModeration(firestore, user.uid), [user]);

  const load = useCallback(async () => {
    setLoadError(false);
    if (user.isDemo || (!isAdmin && !provinces.length)) return setList([]);
    try {
      const all = await Promise.all(isAdmin ? [mod.listCommentReports('admin')] : provinces.map((p) => mod.listCommentReports({ provinceCode: p })));
      setList(all.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch {
      setLoadError(true);
    }
  }, [user, isAdmin, provinces, mod]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
      setMessage({ kind: 'ok', text: t('moderation.saved') });
      await load();
    } catch {
      setMessage({ kind: 'error', text: t('moderation.error') });
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin && !provinces.length) return null;
  return (
    <>
      <header className="page-head">
        <div>
          <h2>{t('moderation.comments.title')}</h2>
          <p className="meta">{t('moderation.comments.intro')}</p>
        </div>
      </header>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {loadError ? (
        <div className="state" role="alert">
          <p>{t('moderation.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('moderation.retry')}</button>
        </div>
      ) : list === null ? (
        <div className="state" aria-live="polite">{t('moderation.loading')}</div>
      ) : list.length === 0 ? (
        <div className="state">{t('moderation.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('moderation.date')}</th>
                <th scope="col">{t('moderation.comments.comment')}</th>
                <th scope="col">{t('moderation.reason')}</th>
                <th scope="col">{t('moderation.status')}</th>
                {canDecide ? <th scope="col"><span className="sr-only">{t('moderation.actions')}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="num">{new Date(r.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td>
                    {r.comment ? <strong>{r.comment.authorName}</strong> : null}
                    <p dir="auto" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{r.text}</p>
                    {r.comment ? (
                      <div className="meta">{t('moderation.comments.counts', { reports: r.comment.reportCount })}</div>
                    ) : (
                      <span className="pill warn">{t('moderation.comments.deleted')}</span>
                    )}
                    {r.comment?.cleared ? <span className="pill ok">{t('moderation.posts.kept')}</span> : null}
                  </td>
                  <td>{t(`moderation.posts.reasons.${r.reason}`)}</td>
                  <td><span className={r.status === 'yeni' ? 'pill warn' : 'pill'}>{t(`moderation.statuses.${r.status}`)}</span></td>
                  {canDecide ? (
                    <td>
                      <div className="row-actions">
                        {r.comment ? <button className="link" disabled={busy} onClick={() => act(() => mod.removeComment(r))}>{t('moderation.comments.remove')}</button> : null}
                        {r.comment && !r.comment.cleared ? <button className="link" disabled={busy} onClick={() => act(() => mod.keepComment(r))}>{t('moderation.posts.keep')}</button> : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="count">{t('moderation.comments.note')}</p>
        </div>
      )}
    </>
  );
}

/**
 * Keşfet profil şikâyetleri (yalnızca admin; profilde bölge bilgisi tutulmaz). Şikâyet anındaki ad ve tanıtım
 * gösterilir. "Tanıtımı kaldır" tanıtımı boşaltır ve kişinin yeniden yazmasını kapatır. Her işlem kayda geçer.
 */
function ProfileReports({ user }: { user: PanelUser }) {
  const isAdmin = isAdminUser(user);
  const [list, setList] = useState<ProfileReport[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);
  const mod = useMemo(() => createProfileModeration(firestore, user.uid), [user]);

  const load = useCallback(async () => {
    setLoadError(false);
    if (user.isDemo || !isAdmin) return setList([]);
    try {
      setList(await mod.listReports());
    } catch {
      setLoadError(true);
    }
  }, [user, isAdmin, mod]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
      setMessage({ kind: 'ok', text: t('moderation.saved') });
      await load();
    } catch {
      setMessage({ kind: 'error', text: t('moderation.error') });
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) return null;
  return (
    <>
      <header className="page-head">
        <div>
          <h2>{t('moderation.profiles.title')}</h2>
          <p className="meta">{t('moderation.profiles.intro')}</p>
        </div>
      </header>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {loadError ? (
        <div className="state" role="alert">
          <p>{t('moderation.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('moderation.retry')}</button>
        </div>
      ) : list === null ? (
        <div className="state" aria-live="polite">{t('moderation.loading')}</div>
      ) : list.length === 0 ? (
        <div className="state">{t('moderation.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('moderation.date')}</th>
                <th scope="col">{t('moderation.profiles.profile')}</th>
                <th scope="col">{t('moderation.reason')}</th>
                <th scope="col">{t('moderation.status')}</th>
                {user.isDemo ? null : <th scope="col"><span className="sr-only">{t('moderation.actions')}</span></th>}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="num">{new Date(r.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <strong>{r.displayName}</strong>
                    {r.bio ? <p dir="auto" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{r.bio}</p> : null}
                    {!r.current ? <span className="pill warn">{t('moderation.profiles.deleted')}</span> : r.current.bioRemoved ? <span className="pill warn">{t('moderation.profiles.bioRemoved')}</span> : null}
                  </td>
                  <td>{t(`moderation.profiles.reasons.${r.reason}`)}</td>
                  <td><span className={r.status === 'yeni' ? 'pill warn' : 'pill'}>{t(`moderation.statuses.${r.status}`)}</span></td>
                  {user.isDemo ? null : (
                    <td>
                      <div className="row-actions">
                        {r.current && !r.current.bioRemoved && r.current.bio ? <button className="link" disabled={busy} onClick={() => act(() => mod.removeBio(r))}>{t('moderation.profiles.removeBio')}</button> : null}
                        {r.status === 'yeni' ? <button className="link" disabled={busy} onClick={() => act(() => mod.dismiss(r))}>{t('moderation.profiles.dismiss')}</button> : null}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="count">{t('moderation.profiles.note')}</p>
        </div>
      )}
    </>
  );
}

/**
 * Yasaklı kelimeler (Keşfet kuralları madde 8): admin her satıra bir kelime ya da ifade yazar. Uygulama gönderi, yorum
 * ve profil tanıtımında listeyi denetler, eşleşen paylaşımı durdurur. Kaydetme işlem kaydına yazılır.
 */
function BannedWords({ user }: { user: PanelUser }) {
  const [text, setText] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);
  const store = useMemo(() => createBannedWords(firestore), []);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setText((await store.get()).join('\n'));
    } catch {
      setLoadError(true);
    }
  }, [store]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (text === null) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const saved = await store.save(user.uid, text.split('\n'));
      setText(saved.join('\n'));
      setMessage({ kind: 'ok', text: t('moderation.words.saved', { count: saved.length }) });
    } catch {
      setMessage({ kind: 'error', text: t('moderation.error') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h2>{t('moderation.words.title')}</h2>
          <p className="meta">{t('moderation.words.intro', { max: BANNED_WORD_LIMITS.count })}</p>
        </div>
      </header>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {loadError ? (
        <div className="state" role="alert">
          <p>{t('moderation.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('moderation.retry')}</button>
        </div>
      ) : text === null ? (
        <div className="state" aria-live="polite">{t('moderation.loading')}</div>
      ) : (
        <form className="form panel-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="banned-words">{t('moderation.words.label')}</label>
            <textarea id="banned-words" rows={8} value={text} disabled={user.isDemo} onChange={(e) => setText(e.target.value)} />
            <span className="meta">{t('moderation.words.hint')}</span>
          </div>
          {user.isDemo ? null : (
            <div className="actions">
              <button className="btn" type="submit" disabled={busy}>{t('moderation.words.save')}</button>
            </div>
          )}
        </form>
      )}
    </>
  );
}
