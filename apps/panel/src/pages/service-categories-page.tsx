import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  can,
  DEFAULT_SERVICE_CATEGORIES,
  isGrantActive,
  LANGUAGES,
  SERVICE_ICONS,
  type LanguageCode,
  type ServiceCategory,
  type ServiceSuggestion,
} from '@cityjoy/shared';
import { createServiceCategoryAdmin, occupationIdFromName } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { locationRepository } from '../lib/locations';
import { useSession } from '../lib/session';
import { t } from '../lib/t';
import { GripIcon, SortBar, useSortableList } from '../components/sortable';

type Draft = {
  id?: string;
  parentId: string | null;
  names: Partial<Record<LanguageCode, string>>;
  icon: string;
  order: number;
  active: boolean;
  urgent: boolean;
};

/**
 * Hizmet kategorileri (admin, ülke geneli) ve kullanıcıların "Eksik hizmet mi var?" önerileri.
 * Uygulamadaki Acil İhtiyaçlar > Hizmetler ekranının panel karşılığı.
 */
export function ServiceCategoriesPage() {
  const { user } = useSession();
  const canEdit = !!user && !user.isDemo && can(user.grants, { module: 'hizmet-kategorileri', action: 'duzenle' });
  const admin = user ? createServiceCategoryAdmin(firestore, user.uid) : null;
  const suggestionScopes = (user?.grants ?? [])
    .filter((g) => isGrantActive(g, new Date()) && g.modules['hizmet-kategorileri']?.includes('goruntule'))
    .map((g) => g.scope);
  const national = suggestionScopes.some((s) => s.level === 'ulke');
  const suggestionProvinces = [...new Set(suggestionScopes.flatMap((s) => (s.level === 'il' ? [s.provinceCode] : [])))].sort();
  const canReview = (provinceCode?: string) =>
    !!user && !user.isDemo && can(user.grants, { module: 'hizmet-kategorileri', action: 'onayla', region: provinceCode ? { provinceCode } : undefined });

  const [list, setList] = useState<ServiceCategory[] | null>(null);
  const [suggestions, setSuggestions] = useState<ServiceSuggestion[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    if (user?.isDemo) {
      setList([]);
      setSuggestions([]);
      return;
    }
    const reader = createServiceCategoryAdmin(firestore, 'okuma');
    try {
      setList(await reader.listAll());
    } catch {
      setLoadError(true);
    }
    // Admin tüm önerileri, il yöneticisi yalnızca kendi ilinin önerilerini görür; okunamazsa bölüm boş görünür.
    if (national) setSuggestions(await reader.listSuggestions().catch(() => null));
    else if (suggestionProvinces.length) {
      const lists = await Promise.all(suggestionProvinces.map((provinceCode) => reader.listSuggestions({ provinceCode }).catch(() => null)));
      setSuggestions(
        lists.some((l) => l === null) ? null : lists.flatMap((l) => l ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    } else setSuggestions(null);
  }, [user, national, suggestionProvinces.join()]);

  useEffect(() => {
    load();
  }, [load]);

  const usingDefaults = list !== null && list.length === 0;
  const all = usingDefaults ? DEFAULT_SERVICE_CATEGORIES : (list ?? []);
  const byOrder = (a: ServiceCategory, b: ServiceCategory) => a.order - b.order;
  const mains = all.filter((c) => c.parentId === null).sort(byOrder);
  const childrenOf = (id: string) => all.filter((c) => c.parentId === id).sort(byOrder);
  const showActions = canEdit && !usingDefaults;
  const anyReview = canReview() || suggestionProvinces.some((p) => canReview(p));

  const act = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      setMessage({ kind: 'ok', text: await fn() });
      await load();
    } catch {
      setMessage({ kind: 'error', text: t('services.error') });
    } finally {
      setBusy(false);
    }
  };

  const nextOrder = (parentId: string | null) =>
    all.filter((c) => c.parentId === parentId).reduce((m, c) => Math.max(m, c.order), 0) + 1;

  const newDraft = (parentId: string | null): Draft => ({ parentId, names: {}, icon: 'category', order: nextOrder(parentId), active: true, urgent: false });

  const submitDraft = (e: FormEvent) => {
    e.preventDefault();
    if (!draft || !admin) return;
    const tr = draft.names.tr?.trim();
    if (!tr) return setMessage({ kind: 'error', text: t('services.nameRequired') });
    const isNew = !draft.id;
    const id = draft.id ?? occupationIdFromName(tr);
    if (isNew && all.some((c) => c.id === id)) return setMessage({ kind: 'error', text: t('services.duplicate') });
    act(async () => {
      await admin.save(
        {
          id,
          parentId: draft.parentId,
          names: { ...draft.names, tr },
          icon: draft.icon,
          order: draft.order,
          active: draft.active,
          ...(draft.parentId && draft.urgent ? { urgent: true } : {}),
        },
        isNew,
      );
      setDraft(null);
      return t('services.saved');
    });
  };

  const edit = (c: ServiceCategory) =>
    setDraft({ id: c.id, parentId: c.parentId, names: { ...c.names }, icon: c.icon, order: c.order, active: c.active, urgent: !!c.urgent });

  const row = (c: ServiceCategory, isChild: boolean) => {
    const missing = LANGUAGES.filter((l) => !c.names[l.code]).length;
    return (
      <tr key={c.id} className={isChild ? 'child-row' : 'parent-row'}>
        <td className="num">{c.order}</td>
        <td>
          {isChild ? <span className="tree-indent" aria-hidden="true">└</span> : null}
          {isChild ? c.names.tr : <strong>{c.names.tr}</strong>}
          {c.urgent ? <> <span className="pill warn">{t('services.urgent')}</span></> : null}
          <div className="meta">
            {c.icon} · {missing ? t('services.missingTranslations', { count: missing }) : t('services.allTranslations')}
          </div>
        </td>
        <td><span className={c.active ? 'pill ok' : 'pill'}>{c.active ? t('services.active') : t('services.inactive')}</span></td>
        {showActions ? (
          <td>
            <div className="row-actions">
              {!isChild ? <button className="link" onClick={() => setDraft(newDraft(c.id))}>{t('services.addChild')}</button> : null}
              <button className="link" onClick={() => edit(c)}>{t('services.edit')}</button>
              <button className="link" disabled={busy} onClick={() => act(async () => {
                await admin!.setActive(c, !c.active);
                return t('services.saved');
              })}>
                {c.active ? t('services.deactivate') : t('services.activate')}
              </button>
            </div>
          </td>
        ) : null}
      </tr>
    );
  };

  const provinceName = (code?: string) => (code ? (locationRepository.getProvince(code)?.name ?? code) : '-');

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('services.title')}</h1>
          <p className="meta">{t('services.intro')}</p>
        </div>
        {showActions ? (
          <div className="actions">
            <button className="btn" onClick={() => setDraft(newDraft(null))}>{t('services.addMain')}</button>
          </div>
        ) : null}
      </header>

      {user?.isDemo ? <p className="note">{t('services.demoReadOnly')}</p> : !canEdit ? <p className="note">{t('services.readOnly')}</p> : null}
      {usingDefaults ? (
        <div className="note">
          <p>{t('services.usingDefaults')}</p>
          {canEdit ? (
            <button className="btn" disabled={busy} onClick={() => act(async () => t('services.seeded', { count: await admin!.seedDefaults(new Set()) }))}>
              {t('services.seed')}
            </button>
          ) : null}
        </div>
      ) : null}
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      <h2>{t('services.suggestionsTitle')}</h2>
      <p className="meta">{t('services.suggestionsIntro')}</p>
      {suggestions === null ? (
        <p className="note">{t('services.suggestionsUnavailable')}</p>
      ) : suggestions.length === 0 ? (
        <div className="state">{t('services.suggestionsEmpty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('services.date')}</th>
                <th scope="col">{t('services.province')}</th>
                <th scope="col">{t('services.suggestion')}</th>
                <th scope="col">{t('services.status')}</th>
                {anyReview ? <th scope="col"><span className="sr-only">{t('services.markReviewed')}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => (
                <tr key={s.id}>
                  <td className="num">{s.createdAt ? new Date(s.createdAt).toLocaleDateString('tr-TR') : '-'}</td>
                  <td>{provinceName(s.provinceCode)}</td>
                  <td dir="auto">{s.text}</td>
                  <td><span className={s.status === 'yeni' ? 'pill warn' : 'pill'}>{t(`services.suggestionStatus.${s.status}`)}</span></td>
                  {anyReview ? (
                    <td>
                      {s.status === 'yeni' && canReview(s.provinceCode) ? (
                        <button className="link" disabled={busy} onClick={() => act(async () => {
                          await admin!.markReviewed(s);
                          return t('services.saved');
                        })}>{t('services.markReviewed')}</button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>{t('services.categoriesTitle')}</h2>
      {draft ? (
        <form className="form panel-form" onSubmit={submitDraft}>
          <h2 className="form-section">
            {draft.parentId
              ? t('services.childOf', { name: all.find((c) => c.id === draft.parentId)?.names.tr ?? '' })
              : t('services.mainCategory')}
          </h2>
          {draft.parentId ? (
            // Alt kategori başka bir ana kategoriye taşınabilir; ana kategori alt kategori yapılamaz (iki seviye).
            <div className="field">
              <label htmlFor="sc-parent">{t('services.parent')}</label>
              <select id="sc-parent" value={draft.parentId} onChange={(e) => setDraft({ ...draft, parentId: e.target.value })}>
                {mains.map((m) => (
                  <option key={m.id} value={m.id}>{m.names.tr}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="sc-icon">{t('services.icon')}</label>
            <select id="sc-icon" value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })}>
              {(SERVICE_ICONS.includes(draft.icon) ? SERVICE_ICONS : [draft.icon, ...SERVICE_ICONS]).map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sc-order">{t('services.order')}</label>
            <input id="sc-order" type="number" min={1} value={draft.order} onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) || 1 })} />
          </div>
          {draft.parentId ? (
            <div className="field checkbox">
              <label>
                <input type="checkbox" checked={draft.urgent} onChange={(e) => setDraft({ ...draft, urgent: e.target.checked })} />{' '}
                {t('services.urgentLabel')}
              </label>
              <span className="meta">{t('services.urgentHint')}</span>
            </div>
          ) : null}
          <h2 className="form-section">{t('services.names')}</h2>
          {LANGUAGES.map((l) => (
            <div key={l.code} className="field">
              <label htmlFor={`sc-${l.code}`}>{t(`emergency.lang.${l.code}`)}</label>
              <input
                id={`sc-${l.code}`}
                dir={l.rtl ? 'rtl' : 'ltr'}
                maxLength={80}
                value={draft.names[l.code] ?? ''}
                onChange={(e) => setDraft({ ...draft, names: { ...draft.names, [l.code]: e.target.value } })}
                required={l.code === 'tr'}
              />
            </div>
          ))}
          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>{t('services.save')}</button>
            <button className="btn ghost" type="button" onClick={() => {
              setDraft(null);
              setMessage(undefined);
            }}>{t('services.cancel')}</button>
          </div>
        </form>
      ) : null}

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('services.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('services.retry')}</button>
        </div>
      ) : list === null ? (
        <div className="state" aria-live="polite">{t('services.loading')}</div>
      ) : (
        <div className="table-wrap">
          {showActions ? (
            <CategorySorter
              groups={[
                { id: '', label: t('services.sortMains'), items: mains },
                ...mains.map((m) => ({ id: m.id, label: t('services.sortChildrenOf', { name: m.names.tr }), items: childrenOf(m.id) })),
              ].filter((g) => g.items.length > 1)}
              busy={busy}
              onSave={(list) => act(async () => t('sort.saved', { count: await admin!.reorder(list) }))}
            />
          ) : null}
          <table>
            <thead>
              <tr>
                <th scope="col">{t('services.order')}</th>
                <th scope="col">{t('services.name')}</th>
                <th scope="col">{t('services.status')}</th>
                {showActions ? <th scope="col"><span className="sr-only">{t('services.edit')}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {mains.flatMap((m) => [row(m, false), ...childrenOf(m.id).map((c) => row(c, true))])}
            </tbody>
          </table>
          <p className="count">{t('services.count', { main: mains.length, sub: all.length - mains.length })} {t('services.noDelete')}</p>
        </div>
      )}

    </section>
  );
}

/**
 * Hizmet kategorilerini sürükleyerek sıralama: ana kategoriler ya da bir ana kategorinin alt kategorileri seçilir
 * (sıra yalnızca aynı üst kategori içinde anlamlıdır).
 */
function CategorySorter({ groups, busy, onSave }: { groups: { id: string; label: string; items: ServiceCategory[] }[]; busy: boolean; onSave(list: ServiceCategory[]): void }) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
  const group = groups.find((g) => g.id === groupId) ?? groups[0];
  const sort = useSortableList(group?.items ?? []);
  if (!group) return null;
  return (
    <details className="sorter">
      <summary>{t('services.sortTitle')}</summary>
      <div className="field">
        <label htmlFor="sc-sort-group">{t('services.sortGroup')}</label>
        <select id="sc-sort-group" value={group.id} onChange={(e) => setGroupId(e.target.value)}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </select>
      </div>
      <SortBar dirty={sort.dirty} busy={busy} onCancel={sort.reset} onSave={() => onSave(sort.list)} />
      <table>
        <tbody ref={sort.containerRef}>
          {sort.list.map((c, i) => (
            <tr key={c.id} {...sort.itemProps(c.id)}>
              <td className="handle-cell">
                <button {...sort.handleProps(c.id, c.names.tr)}>
                  <GripIcon />
                </button>
              </td>
              <td className="num">{i + 1}</td>
              <td>{c.names.tr}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
