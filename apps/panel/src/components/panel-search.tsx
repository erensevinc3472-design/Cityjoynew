import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { canSeeModule } from '@cityjoy/shared';

import { MENU_GROUPS, visibleItems } from './shell';
import { isAdminUser, type PanelUser } from '../lib/session';
import { t } from '../lib/t';

interface Hit {
  key: string;
  label: string;
  hint?: string;
  to: string;
}

const norm = (s: string) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Genel arama (panel yenileme, Eren 12 Kasım 2026): menünün üstünde tek kutu. Yazdıkça kişinin görebildiği sayfalar
 * listelenir; altında "profillerde ara" ve "kurumlarda ara" kısayolları çıkar. Sayfa araması veritabanı okumaz.
 */
export function PanelSearch({ user }: { user: PanelUser }) {
  const navigate = useNavigate();
  const listId = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const pages = useMemo(
    () => MENU_GROUPS.flatMap((g) => visibleItems(user, g.items).filter((m) => m.path).map((m) => ({ key: m.key, label: t(`menu.items.${m.key}`), to: m.path! }))),
    [user],
  );

  const text = q.trim();
  const hits: Hit[] = useMemo(() => {
    if (!text) return [];
    const n = norm(text);
    const list: Hit[] = pages.filter((p) => norm(p.label).includes(n)).slice(0, 6).map((p) => ({ ...p, hint: t('menu.searchPage') }));
    const enc = encodeURIComponent(text);
    if (isAdminUser(user) && text.length >= 2) list.push({ key: 'q-profiles', label: t('menu.searchProfiles', { q: text }), to: `/profiller?q=${enc}` });
    if (canSeeModule(user.grants, 'kurumlar')) list.push({ key: 'q-orgs', label: t('menu.searchOrgs', { q: text }), to: `/kurumlar?q=${enc}` });
    return list;
  }, [text, pages, user]);

  const go = (hit: Hit | undefined) => {
    if (!hit) return;
    navigate(hit.to);
    setQ('');
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(hits[active]);
    }
  };

  const show = open && text.length > 0;

  return (
    <div className="panel-search">
      <label className="sr-only" htmlFor={listId + '-in'}>{t('menu.search')}</label>
      <input
        id={listId + '-in'}
        type="search"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show && hits[active] ? `${listId}-${active}` : undefined}
        placeholder={t('menu.searchPlaceholder')}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
      />
      {show ? (
        <ul id={listId} role="listbox" aria-label={t('menu.search')}>
          {hits.length ? (
            hits.map((h, i) => (
              <li
                key={h.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(h);
                }}
              >
                {h.label}
                {h.hint ? <small>{h.hint}</small> : null}
              </li>
            ))
          ) : (
            <li className="none" role="option" aria-selected={false} aria-disabled="true">{t('menu.searchNone')}</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
