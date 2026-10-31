import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import readXlsxFile from 'read-excel-file/browser';
import { Link } from 'react-router';
import {
  can,
  CITY_GUIDE_SECTIONS,
  cityChoiceLabel,
  cityItemToRow,
  citySection,
  isGrantActive,
  NATIONAL,
  parseCitySheet,
  type CityGuideItem,
  type CityGuideMeta,
  type CityGuideSectionId,
  type ImportError,
} from '@cityjoy/shared';
import { createCityGuideAdmin } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { locationRepository as repo } from '../lib/locations';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';

type Msg = { kind: 'ok' | 'error'; text: string } | undefined;

interface Preview {
  groups: { provinceCode: string; section: CityGuideSectionId; items: CityGuideItem[] }[];
  errors: ImportError[];
  skipped: number;
  unknownSheets: string[];
}

const provinceName = (code: string) => (code === NATIONAL ? t('guide.national') : (repo.getProvince(code)?.name ?? code));
const districtName = (id?: string) => (id ? (repo.getDistrict(id)?.name ?? id) : '-');

/**
 * Şehir rehberi (Benim Şehrim sabit bilgileri, PROJE.md 5.1, 9.1). Excel şablonundan yükleme: satırlar yüklemeden
 * önce denetlenir, hatalılar listelenir; aynı yer yeniden yüklenince güncellenir. Yerler tek tek düzeltilir,
 * doğrulanır ya da kaldırılır. Admin her ili ve ülke geneli içeriği, il yöneticisi kendi ilini yönetir.
 */
export function CityGuidePage() {
  const { user } = useSession();
  const admin = isAdminUser(user);
  const service = useMemo(() => (user ? createCityGuideAdmin(firestore, user.uid) : null), [user]);
  const editable = useMemo(() => {
    if (!user) return [] as string[];
    if (admin) return [NATIONAL, ...repo.getProvinces().map((p) => p.code)];
    return user.grants
      .filter((g) => isGrantActive(g, new Date()) && g.scope.level === 'il' && g.modules['sehir-rehberi']?.includes('goruntule'))
      .map((g) => (g.scope.level === 'il' ? g.scope.provinceCode : ''));
  }, [user, admin]);
  const canEdit = (p: string) =>
    !!user && !user.isDemo && (admin || (p !== NATIONAL && can(user.grants, { module: 'sehir-rehberi', action: 'duzenle', region: { provinceCode: p } })));

  const [provinceCode, setProvinceCode] = useState(() => (admin ? '16' : (editable[0] ?? '')));
  const [meta, setMeta] = useState<CityGuideMeta | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState<CityGuideSectionId | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<Msg>();
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const loadMeta = useCallback(async () => {
    setLoadError(false);
    setMeta(undefined);
    if (!service || !provinceCode) return;
    if (user?.isDemo) return setMeta(null);
    try {
      setMeta(await service.meta(provinceCode));
    } catch {
      setLoadError(true);
    }
  }, [service, provinceCode, user?.isDemo]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const readFile = async (file: File) => {
    setMessage(undefined);
    setPreview(null);
    setBusy(true);
    try {
      const sheets = await readXlsxFile(file);
      const ctx = { provinces: repo.getProvinces(), districts: repo.getProvinces().flatMap((p) => repo.getDistricts(p.code)) };
      const result: Preview = { groups: [], errors: [], skipped: 0, unknownSheets: [] };
      for (const { sheet, data } of sheets) {
        const section = CITY_GUIDE_SECTIONS.find((s) => s.sheet === sheet);
        if (!section) {
          if (!['Okuyun', 'İlçeler'].includes(sheet)) result.unknownSheets.push(sheet);
          continue;
        }
        const { items, errors, skipped } = parseCitySheet(section.id, data as unknown[][], ctx);
        result.errors.push(...errors);
        result.skipped += skipped;
        const byProvince = new Map<string, CityGuideItem[]>();
        for (const item of items) {
          if (!canEdit(item.provinceCode)) {
            result.errors.push({ sheet, row: 0, message: t('guide.noPermissionFor', { name: item.name, province: provinceName(item.provinceCode) }) });
            continue;
          }
          byProvince.set(item.provinceCode, [...(byProvince.get(item.provinceCode) ?? []), item]);
        }
        for (const [p, list] of byProvince) result.groups.push({ provinceCode: p, section: section.id, items: list });
      }
      setPreview(result);
    } catch {
      setMessage({ kind: 'error', text: t('guide.readError') });
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!preview || !service) return;
    setBusy(true);
    setMessage(undefined);
    let added = 0;
    let updated = 0;
    let unchanged = 0;
    try {
      for (const g of preview.groups) {
        const r = await service.importItems(g.provinceCode, g.section, g.items);
        added += r.added;
        updated += r.updated;
        unchanged += r.unchanged;
      }
      setMessage({ kind: 'ok', text: t('guide.imported', { added, updated, unchanged }) });
      setPreview(null);
      await loadMeta();
    } catch {
      setMessage({ kind: 'error', text: t('guide.importError') });
    } finally {
      setBusy(false);
    }
  };

  if (open && service) {
    return <SectionView provinceCode={provinceCode} section={open} canEdit={canEdit(provinceCode)} onBack={() => { setOpen(null); loadMeta(); }} />;
  }
  if (showAll && service) {
    return <ProvinceReadiness load={service.meta} onBack={() => setShowAll(false)} onPick={(p) => { setProvinceCode(p); setShowAll(false); }} />;
  }

  const validCount = preview?.groups.reduce((n, g) => n + g.items.length, 0) ?? 0;

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('guide.title')}</h1>
          <p className="meta">{t('guide.intro')}</p>
        </div>
        <div className="actions">
          {admin && !user?.isDemo ? <button className="btn secondary" onClick={() => setShowAll(true)}>{t('guide.readiness')}</button> : null}
          <Link className="btn secondary" to="/sehir-vitrini">{t('guide.showcase')}</Link>
          {admin ? <Link className="btn secondary" to="/yol-ustu-verisi">{t('guide.roadside')}</Link> : null}
          <a className="btn secondary" href="./benim-sehrim-sablon.xlsx" download>{t('guide.downloadTemplate')}</a>
          {!user?.isDemo && editable.length ? (
            <label className="btn">
              {t('guide.uploadExcel')}
              <input
                type="file"
                accept=".xlsx"
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) readFile(f);
                }}
              />
            </label>
          ) : null}
        </div>
      </header>
      {user?.isDemo ? <p className="note">{t('guide.demoReadOnly')}</p> : null}
      <p className="note">{t('guide.rules')}</p>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {preview ? (
        <div className="panel-form">
          <h2 className="form-section">{t('guide.previewTitle')}</h2>
          <p className="form-section">{t('guide.previewSummary', { valid: validCount, errors: preview.errors.length, skipped: preview.skipped })}</p>
          {preview.unknownSheets.length ? <p className="form-section error">{t('guide.unknownSheets', { names: preview.unknownSheets.join(', ') })}</p> : null}
          {preview.groups.length ? (
            <div className="form-section table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('guide.section')}</th>
                    <th scope="col">{t('guide.province')}</th>
                    <th scope="col">{t('guide.validRows')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.groups.map((g) => (
                    <tr key={`${g.provinceCode}-${g.section}`}>
                      <td>{citySection(g.section)?.names.tr}</td>
                      <td>{provinceName(g.provinceCode)}</td>
                      <td className="num">{g.items.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {preview.errors.length ? (
            <details className="form-section" open={preview.errors.length <= 20}>
              <summary>{t('guide.errorList', { count: preview.errors.length })}</summary>
              <ul className="plain-list">
                {preview.errors.slice(0, 300).map((e, i) => (
                  <li key={i}>
                    <strong>{e.sheet}{e.row ? `, ${t('guide.row', { row: e.row })}` : ''}:</strong> {e.message}
                  </li>
                ))}
              </ul>
              {preview.errors.length > 300 ? <p className="meta">{t('guide.moreErrors', { count: preview.errors.length - 300 })}</p> : null}
            </details>
          ) : null}
          <p className="form-section meta">{t('guide.importHint')}</p>
          <div className="actions">
            <button className="btn" disabled={busy || !validCount} onClick={runImport}>{t('guide.importValid', { count: validCount })}</button>
            <button className="btn secondary" disabled={busy} onClick={() => setPreview(null)}>{t('guide.cancel')}</button>
          </div>
        </div>
      ) : null}

      <div className="toolbar">
        <label htmlFor="guide-province" className="sr-only">{t('guide.province')}</label>
        <select id="guide-province" value={provinceCode} onChange={(e) => setProvinceCode(e.target.value)} disabled={editable.length < 2}>
          {editable.map((p) => (
            <option key={p} value={p}>{provinceName(p)}</option>
          ))}
        </select>
      </div>

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('guide.loadError')}</p>
          <button className="btn secondary" onClick={loadMeta}>{t('guide.retry')}</button>
        </div>
      ) : meta === undefined ? (
        <div className="state" aria-live="polite">{t('guide.loading')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('guide.section')}</th>
                <th scope="col">{t('guide.count')}</th>
                <th scope="col">{t('guide.updated')}</th>
              </tr>
            </thead>
            <tbody>
              {CITY_GUIDE_SECTIONS.filter((s) => provinceCode !== NATIONAL || s.id === 'nasil-yapilir').map((s) => {
                const info = meta?.sections[s.id];
                return (
                  <tr key={s.id}>
                    <td>
                      <button className="link" onClick={() => setOpen(s.id)}><strong>{s.names.tr}</strong></button>
                      <div className="meta">{s.description}</div>
                    </td>
                    <td className="num">{info?.count ?? 0}</td>
                    <td className="num">{info ? new Date(Number(info.version)).toLocaleDateString('tr-TR') : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const PROVINCE_SECTIONS = CITY_GUIDE_SECTIONS.filter((s) => s.id !== 'nasil-yapilir');

/**
 * 81 il durumu (yalnızca admin): her ilde hangi bölümün kaç kaydı var. Yeni il açmadan önce eksikleri görmek için;
 * il başına tek özet belgesi okunur (81 okuma). İl adına basınca o il seçilir.
 */
function ProvinceReadiness({ load, onBack, onPick }: { load: (p: string) => Promise<CityGuideMeta | null>; onBack: () => void; onPick: (p: string) => void }) {
  const [rows, setRows] = useState<{ code: string; meta: CityGuideMeta | null }[] | undefined>(undefined);
  const [error, setError] = useState(false);

  const fetchAll = useCallback(async () => {
    setError(false);
    setRows(undefined);
    try {
      const provinces = repo.getProvinces();
      const metas = await Promise.all(provinces.map((p) => load(p.code)));
      setRows(provinces.map((p, i) => ({ code: p.code, meta: metas[i] })));
    } catch {
      setError(true);
    }
  }, [load]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const count = (m: CityGuideMeta | null, id: CityGuideSectionId) => m?.sections[id]?.count ?? 0;
  const filled = (m: CityGuideMeta | null) => PROVINCE_SECTIONS.filter((s) => count(m, s.id) > 0).length;
  const started = rows?.filter((r) => filled(r.meta) > 0).length ?? 0;

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <button className="link" onClick={onBack}>‹ {t('guide.title')}</button>
          <h1>{t('guide.readinessTitle')}</h1>
          <p className="meta">{t('guide.readinessIntro')}</p>
        </div>
      </header>
      {error ? (
        <div className="state" role="alert">
          <p>{t('guide.loadError')}</p>
          <button className="btn secondary" onClick={fetchAll}>{t('guide.retry')}</button>
        </div>
      ) : !rows ? (
        <div className="state" aria-live="polite">{t('guide.loading')}</div>
      ) : (
        <>
          <p className="note" role="status">{t('guide.readinessSummary', { started, all: rows.length })}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('guide.province')}</th>
                  <th scope="col">{t('guide.readinessFilled')}</th>
                  {PROVINCE_SECTIONS.map((s) => <th scope="col" key={s.id}>{s.names.tr}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ code, meta }) => {
                  const f = filled(meta);
                  return (
                    <tr key={code}>
                      <td><button className="link" onClick={() => onPick(code)}><strong>{provinceName(code)}</strong></button></td>
                      <td><span className={f === PROVINCE_SECTIONS.length ? 'pill ok' : 'pill'}>{f} / {PROVINCE_SECTIONS.length}</span></td>
                      {PROVINCE_SECTIONS.map((s) => <td className="num" key={s.id}>{count(meta, s.id) || '-'}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function SectionView({ provinceCode, section, canEdit, onBack }: { provinceCode: string; section: CityGuideSectionId; canEdit: boolean; onBack: () => void }) {
  const { user } = useSession();
  const service = useMemo(() => createCityGuideAdmin(firestore, user!.uid), [user]);
  const def = citySection(section)!;
  const [items, setItems] = useState<CityGuideItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'tumu' | 'dogrulanmadi' | 'dogrulandi'>('tumu');
  const [editing, setEditing] = useState<CityGuideItem | null>(null);
  const [message, setMessage] = useState<Msg>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    if (user?.isDemo) return setItems([]);
    try {
      setItems(await service.list(provinceCode, section));
    } catch {
      setLoadError(true);
    }
  }, [service, provinceCode, section, user?.isDemo]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
      setMessage({ kind: 'ok', text: ok });
      await load();
      return true;
    } catch {
      setMessage({ kind: 'error', text: t('guide.saveError') });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const q = query.trim().toLocaleLowerCase('tr');
  const visible = (items ?? []).filter(
    (i) =>
      (filter === 'tumu' || (filter === 'dogrulandi') === i.verified) &&
      (!q || `${i.name} ${districtName(i.districtId)}`.toLocaleLowerCase('tr').includes(q)),
  );

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <button className="link" onClick={onBack}>‹ {t('guide.title')}</button>
          <h1>{def.names.tr}</h1>
          <p className="meta">{provinceName(provinceCode)} · {def.description}</p>
        </div>
      </header>
      {!canEdit ? <p className="note">{t('guide.readOnly')}</p> : null}
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {editing ? (
        <EditForm
          item={editing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={async (next) => {
            const ok = await act(async () => {
              if (next.id === editing.id) await service.update(next);
              else {
                await service.importItems(next.provinceCode, next.section, [next]);
                await service.remove(editing);
              }
            }, t('guide.saved'));
            if (ok) setEditing(null);
          }}
        />
      ) : null}

      <div className="toolbar">
        <label htmlFor="guide-filter" className="sr-only">{t('guide.filter')}</label>
        <select id="guide-filter" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          {(['tumu', 'dogrulanmadi', 'dogrulandi'] as const).map((f) => (
            <option key={f} value={f}>{t(`guide.filters.${f}`)}</option>
          ))}
        </select>
        <label htmlFor="guide-search" className="sr-only">{t('guide.search')}</label>
        <input id="guide-search" type="search" placeholder={t('guide.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('guide.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('guide.retry')}</button>
        </div>
      ) : items === null ? (
        <div className="state" aria-live="polite">{t('guide.loading')}</div>
      ) : visible.length === 0 ? (
        <div className="state">{items.length ? t('guide.noMatch') : t('guide.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('guide.name')}</th>
                <th scope="col">{t('guide.district')}</th>
                <th scope="col">{t('guide.source')}</th>
                <th scope="col">{t('guide.status')}</th>
                {canEdit ? <th scope="col"><span className="sr-only">{t('guide.actions')}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {visible.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.name}</strong>
                    {i.category ? <div className="meta">{cityChoiceLabel(i.category, 'tr')}</div> : null}
                    {typeof i.values.not === 'string' ? <div className="meta">{t('guide.note')}: {i.values.not}</div> : null}
                  </td>
                  <td>{districtName(i.districtId)}</td>
                  <td>
                    <a href={i.source} target="_blank" rel="noreferrer noopener">{new URL(i.source).hostname}</a>
                    <div className="meta">{new Date(i.sourceDate).toLocaleDateString('tr-TR')}</div>
                  </td>
                  <td>
                    <span className={i.verified ? 'pill ok' : 'pill warn'}>{i.verified ? t('guide.verified') : t('guide.unverified')}</span>
                    {i.verifiedAt ? <div className="meta">{new Date(i.verifiedAt).toLocaleDateString('tr-TR')}</div> : null}
                  </td>
                  {canEdit ? (
                    <td>
                      <div className="row-actions">
                        <button className="link" disabled={busy} onClick={() => act(() => service.setVerified(i, !i.verified), i.verified ? t('guide.unverifiedDone') : t('guide.verifiedDone'))}>
                          {i.verified ? t('guide.unverify') : t('guide.verify')}
                        </button>
                        <button className="link" disabled={busy} onClick={() => setEditing(i)}>{t('guide.edit')}</button>
                        <button
                          className="link"
                          disabled={busy}
                          onClick={() => window.confirm(t('guide.removeConfirm', { name: i.name })) && act(() => service.remove(i), t('guide.removed'))}>
                          {t('guide.remove')}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="count">{t('guide.itemCount', { count: visible.length })}</p>
        </div>
      )}
    </section>
  );
}

/** Tek yeri düzeltme: alanlar Excel sütunlarıyla aynı, kaydederken aynı denetimden geçer. */
function EditForm({ item, busy, onCancel, onSave }: { item: CityGuideItem; busy: boolean; onCancel: () => void; onSave: (next: CityGuideItem) => void }) {
  const def = citySection(item.section)!;
  const ctx = useMemo(() => ({ provinces: repo.getProvinces(), districts: repo.getProvinces().flatMap((p) => repo.getDistricts(p.code)) }), []);
  const [row, setRow] = useState<Record<string, string>>(() => cityItemToRow(item, ctx));
  const [error, setError] = useState<string>();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const keys = def.columns.map((c) => c.key);
    const { items, errors } = parseCitySheet(item.section, [keys, keys.map((k) => row[k] ?? '')], ctx);
    if (errors.length || !items[0]) return setError(errors.map((x) => x.message).join('; ') || t('guide.saveError'));
    if (items[0].provinceCode !== item.provinceCode) return setError(t('guide.provinceFixed'));
    onSave(items[0]);
  };

  return (
    <form className="form panel-form" onSubmit={submit} aria-labelledby="guide-edit-title">
      <h2 id="guide-edit-title" className="form-section">{t('guide.editTitle', { name: item.name })}</h2>
      <p className="form-section meta">{t('guide.editHint')}</p>
      {def.columns.map((c) => (
        <div className="field" key={c.key}>
          <label htmlFor={`ge-${c.key}`}>{c.key}{c.required ? ' *' : ''}</label>
          {c.type === 'choice' || c.type === 'bool' ? (
            <select id={`ge-${c.key}`} value={row[c.key] ?? ''} onChange={(e) => setRow({ ...row, [c.key]: e.target.value })}>
              <option value="">-</option>
              {(c.type === 'bool' ? ['Evet', 'Hayır'] : c.choices!).map((o) => (
                <option key={o} value={o}>{c.type === 'bool' ? o : cityChoiceLabel(o, 'tr')}</option>
              ))}
            </select>
          ) : (
            <input id={`ge-${c.key}`} value={row[c.key] ?? ''} dir={c.type === 'url' || c.type === 'phone' ? 'ltr' : undefined} onChange={(e) => setRow({ ...row, [c.key]: e.target.value })} />
          )}
          <span className="meta">{c.hint}</span>
        </div>
      ))}
      {error ? <p className="error form-section" role="alert">{error}</p> : null}
      <div className="actions">
        <button className="btn" type="submit" disabled={busy}>{t('guide.save')}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>{t('guide.cancel')}</button>
      </div>
    </form>
  );
}
