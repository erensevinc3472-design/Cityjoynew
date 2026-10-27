import { useCallback, useEffect, useState } from 'react';
import { can } from '@cityjoy/shared';
import { createReviewModeration, type ReviewReport } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { useSession } from '../lib/session';
import { t } from '../lib/t';

/**
 * Moderasyon (PROJE.md 6.4, 15.1): şikâyet edilen işletme değerlendirmeleri. Gizlenen yorum işletme
 * puanından da düşer. Uygulamadaki "Şikâyet et" düğmesinin panel karşılığı.
 */
export function ModerationPage() {
  const { user } = useSession();
  const canEdit = !!user && !user.isDemo && can(user.grants, { module: 'moderasyon', action: 'duzenle' }) && user.grants.some((g) => g.role === 'admin');
  const mod = user ? createReviewModeration(firestore, user.uid) : null;

  const [list, setList] = useState<ReviewReport[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    if (user?.isDemo) return setList([]);
    try {
      setList(await createReviewModeration(firestore, 'okuma').listReports());
    } catch {
      setLoadError(true);
    }
  }, [user]);

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
      {user?.isDemo ? <p className="note">{t('moderation.demoReadOnly')}</p> : !canEdit ? <p className="note">{t('moderation.readOnly')}</p> : null}
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
    </section>
  );
}
