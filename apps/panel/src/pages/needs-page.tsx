import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_SERVICE_CATEGORIES, NEED_MAX_SERVICES, NEED_SITUATIONS, resolveNeedMap, type NeedMap, type NeedSituation, type ServiceCategory } from '@cityjoy/shared';
import { createNeedsConfig, createServiceCategoryAdmin } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';
import { Intro } from '../components/intro';

/**
 * Panel > Diğer İhtiyaçlar (13. madde 35, yalnızca admin): uygulamadaki Acil İhtiyaçlar > Diğer ihtiyaçlar durum
 * kartlarının ("Yeni taşındım", "Tatile gidiyorum"…) hangi hizmet listelerini açacağı. Kart başına en çok 12 hizmet;
 * boş bırakılan kart uygulamada gizlenir. Kayıt işlem kaydına geçer.
 */
export function NeedsPage() {
  const { user } = useSession();
  const admin = isAdminUser(user);
  const canEdit = admin && !!user && !user.isDemo;
  const config = useMemo(() => createNeedsConfig(firestore), []);
  const [cats, setCats] = useState<ServiceCategory[]>([]);
  const [map, setMap] = useState<NeedMap | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const listed = user?.isDemo ? [] : await createServiceCategoryAdmin(firestore, 'okuma').listAll();
      const all = listed.length ? listed : DEFAULT_SERVICE_CATEGORIES;
      setCats(all);
      const raw = user?.isDemo ? null : await config.get();
      setMap(resolveNeedMap(raw, new Set(all.filter((c) => c.parentId && c.active).map((c) => c.id))));
    } catch {
      setLoadError(true);
    }
  }, [config, user?.isDemo]);
  useEffect(() => {
    load();
  }, [load]);

  const name = (id: string) => cats.find((c) => c.id === id)?.names.tr ?? id;
  const groups = useMemo(
    () =>
      cats
        .filter((c) => !c.parentId && c.active)
        .map((p) => ({ parent: p, children: cats.filter((c) => c.parentId === p.id && c.active) }))
        .filter((g) => g.children.length),
    [cats],
  );

  const add = (s: NeedSituation, id: string) => setMap((m) => (m && id && !m[s].includes(id) ? { ...m, [s]: [...m[s], id].slice(0, NEED_MAX_SERVICES) } : m));
  const remove = (s: NeedSituation, id: string) => setMap((m) => (m ? { ...m, [s]: m[s].filter((x) => x !== id) } : m));
  const save = async () => {
    if (!user || !map) return;
    setBusy(true);
    setMessage(undefined);
    try {
      await config.save(user.uid, map);
      setMessage({ kind: 'ok', text: t('needs.saved') });
    } catch {
      setMessage({ kind: 'error', text: t('needs.error') });
    } finally {
      setBusy(false);
    }
  };

  if (!admin) return <section className="page"><p className="note">{t('needs.adminOnly')}</p></section>;

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('needs.title')}</h1>
          <Intro text={t('needs.intro')} />
        </div>
        {canEdit && map ? <button className="btn" disabled={busy} onClick={save}>{t('needs.save')}</button> : null}
      </header>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('needs.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('needs.retry')}</button>
        </div>
      ) : !map ? (
        <div className="state" aria-live="polite">{t('needs.loading')}</div>
      ) : (
        NEED_SITUATIONS.map((s) => (
          <div key={s} className="card">
            <h2 className="card-title">{t(`needs.items.${s}`)}</h2>
            <p className="meta">{map[s].length ? t('needs.count', { count: map[s].length, max: NEED_MAX_SERVICES }) : t('needs.hiddenCard')}</p>
            <div className="chips">
              {map[s].map((id) => (
                <span key={id} className="pill">
                  {name(id)}
                  {canEdit ? (
                    <button className="link" aria-label={t('needs.remove', { name: name(id) })} onClick={() => remove(s, id)}>×</button>
                  ) : null}
                </span>
              ))}
            </div>
            {canEdit && map[s].length < NEED_MAX_SERVICES ? (
              <div className="field">
                <label htmlFor={`need-${s}`}>{t('needs.add')}</label>
                <select id={`need-${s}`} value="" onChange={(e) => add(s, e.target.value)}>
                  <option value="">{t('needs.pick')}</option>
                  {groups.map((g) => (
                    <optgroup key={g.parent.id} label={g.parent.names.tr}>
                      {g.children.filter((c) => !map[s].includes(c.id)).map((c) => (
                        <option key={c.id} value={c.id}>{c.names.tr}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ))
      )}
    </section>
  );
}
