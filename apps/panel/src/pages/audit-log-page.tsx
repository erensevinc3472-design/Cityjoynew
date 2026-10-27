import { useCallback, useEffect, useState } from 'react';
import type { AuditLogEntry } from '@cityjoy/shared';
import { createGrantAdmin, listAuditLog } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { useSession } from '../lib/session';
import { t } from '../lib/t';

/**
 * İşlem kayıtları (PROJE.md 6.1, 6.4 madde 9): kim, hangi bölümde, ne yaptı. Kayıtlar silinemez ve
 * değiştirilemez. Admin hepsini, diğer yöneticiler yalnızca kendi işlemlerini görür.
 */
export function AuditLogPage() {
  const { user } = useSession();
  const isAdmin = !!user?.grants.some((g) => g.role === 'admin');
  const [list, setList] = useState<AuditLogEntry[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [module, setModule] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoadError(false);
    if (!user || user.isDemo) return setList([]);
    try {
      setList(await listAuditLog(firestore, isAdmin ? {} : { actorUid: user.uid }));
      // Admin için yapanın adı yetki kayıtlarından okunur (kayda kişisel veri yazılmadığı için).
      if (isAdmin) {
        const grants = await createGrantAdmin(firestore, user.uid).listAll().catch(() => []);
        setNames(Object.fromEntries(grants.map((g) => [g.uid, g.displayName])));
      }
    } catch {
      setLoadError(true);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const modules = [...new Set((list ?? []).map((e) => e.module))];
  const visible = (list ?? []).filter((e) => !module || e.module === module);
  const actor = (uid: string) => (uid === user?.uid ? t('audit.you') : (names[uid] ?? uid));

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('audit.title')}</h1>
          <p className="meta">{isAdmin ? t('audit.introAdmin') : t('audit.introOwn')}</p>
        </div>
      </header>
      {user?.isDemo ? <p className="note">{t('audit.demoReadOnly')}</p> : null}

      {modules.length > 1 ? (
        <div className="toolbar">
          <label htmlFor="audit-module" className="sr-only">{t('audit.module')}</label>
          <select id="audit-module" value={module} onChange={(e) => setModule(e.target.value)}>
            <option value="">{t('audit.allModules')}</option>
            {modules.map((m) => (
              <option key={m} value={m}>{t(`nav.${m}`)}</option>
            ))}
          </select>
        </div>
      ) : null}

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('audit.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('audit.retry')}</button>
        </div>
      ) : list === null ? (
        <div className="state" aria-live="polite">{t('audit.loading')}</div>
      ) : visible.length === 0 ? (
        <div className="state">{t('audit.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('audit.date')}</th>
                <th scope="col">{t('audit.actor')}</th>
                <th scope="col">{t('audit.module')}</th>
                <th scope="col">{t('audit.action')}</th>
                <th scope="col">{t('audit.summary')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.id}>
                  <td className="num">{e.at ? new Date(e.at).toLocaleString('tr-TR') : '-'}</td>
                  <td><span dir="ltr">{actor(e.actorUid)}</span></td>
                  <td>{t(`nav.${e.module}`)}</td>
                  <td>{t(`actions.${e.action}`)}</td>
                  <td>{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="count">{t('audit.count', { count: visible.length })}</p>
        </div>
      )}
    </section>
  );
}
