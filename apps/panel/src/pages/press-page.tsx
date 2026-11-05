import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import {
  DEFAULT_IMPORTANT_DAYS,
  IMPORTANT_DAY_KINDS,
  isMemberActive,
  isOrganizationActive,
  isScheduled,
  occurrencesBetween,
  publishersFor,
  upcomingDays,
  validateImportantDay,
  type Announcement,
  type CityEvent,
  type ImportantDay,
  type ImportantDayKind,
  type Publisher,
  type PressTemplate,
  STARTER_TEMPLATES,
} from '@cityjoy/shared';
import { createAnnouncementPanel, createEventPanel, createImportantDaysService, createPressTemplatesService } from '@cityjoy/shared/firebase';
import { canEditTemplates, pressAuditAs } from '../lib/press';

import { sampleContent } from '../lib/content-stats';
import { firestore } from '../lib/firebase';
import { isAdminUser, useSession, type PanelUser } from '../lib/session';
import { t } from '../lib/t';

/**
 * Basın Masası'nı görebilen hesaplar: duyuru ya da etkinlik bölümü açık kurumda yönetici ya da o bölümlerde görevi olan
 * personel (yalnızca görüntüleyen dahil) ve duyuru yazabilen muhtar / il yöneticisi. ann / ev: o hesabın duyuru ve
 * etkinlik listesi okunur mu.
 */
export function pressPublishers(user: PanelUser): { ann: Publisher[]; ev: Publisher[]; all: Publisher[] } {
  const now = new Date();
  const ann: Publisher[] = [];
  const ev: Publisher[] = [];
  for (const { org, member } of user.memberships) {
    if (!isOrganizationActive(org, now) || !isMemberActive(member, now)) continue;
    const p = (module: 'gonderiler' | 'etkinlikler'): Publisher | null =>
      org.modules.includes(module) && (member.isOrgAdmin || (member.assignments[module] ?? []).length > 0)
        ? { key: org.id, author: { type: 'kurum', orgId: org.id, name: org.name }, scope: org.scope, actions: member.assignments[module] ?? [] }
        : null;
    const a = p('gonderiler');
    const e = p('etkinlikler');
    if (a) ann.push(a);
    if (e) ev.push(e);
  }
  const people = (module: 'gonderiler' | 'etkinlikler') => publishersFor(user.grants, [], now, module);
  ann.push(...people('gonderiler'));
  ev.push(...people('etkinlikler'));
  const all = [...ann, ...ev.filter((e) => !ann.some((a) => a.key === e.key))];
  return { ann, ev, all };
}
export const canSeePress = (user: PanelUser) => isAdminUser(user) || pressPublishers(user).all.length > 0;

type ItemKind = 'duyuru' | 'haber' | 'acil' | 'etkinlik' | 'gun' | 'yerel';
interface CalItem {
  key: string;
  kind: ItemKind;
  title: string;
  /** Takvim günü "YYYY-AA-GG". */
  date: string;
  time?: string;
  /** Yayında değil (taslak, onay bekliyor) ya da planlı. */
  pending?: boolean;
  /** Planlı yayın: zamanı gelince yayına girecek. */
  scheduled?: boolean;
  idea?: string;
  /** Önemli gün: kaçıncı bayram günü. */
  nthDay?: number;
  to?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

interface Data {
  announcements: Announcement[];
  events: CityEvent[];
  national: ImportantDay[] | null;
  local: ImportantDay[];
}

/** Örnek hesaplar: yayınlanmış örnek içerikler, birkaç taslak ve yaklaşan bir etkinlik (veritabanı okunmaz). */
function sampleData(): Data {
  const now = new Date();
  const rows = sampleContent('basin', 30, []).rows;
  const base = { body: '', region: { provinceCode: '16', districtId: '16-nilufer' }, author: { type: 'kurum', orgId: 'bld-16-nilufer', name: 'Nilüfer Belediyesi' }, preparedBy: 'ornek', preparedByName: 'Basın', createdAt: '', updatedAt: now.toISOString() } as const;
  const announcements: Announcement[] = [
    ...rows.filter((r) => r.kind !== 'etkinlik').map((r) => ({ ...base, id: r.id, kind: r.kind === 'acil' ? 'acil' : r.kind === 'haber' ? 'haber' : 'duyuru', title: r.title, status: 'yayinda', publishedAt: r.publishedAt }) as Announcement),
    { ...base, id: 'taslak-1', kind: 'haber', title: 'Öğretmenler Günü mesajı', status: 'taslak' },
    { ...base, id: 'taslak-2', kind: 'duyuru', title: 'Kış lastiği ve kar küreme hazırlığı', status: 'onay-bekliyor' },
  ];
  const at = (days: number, h: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, h).toISOString();
  const ev = (id: string, title: string, s: string, status: CityEvent['status'] = 'yayinda') => ({ ...base, id, title, startsAt: s, endsAt: s, status, attendeeCount: 0 }) as unknown as CityEvent;
  return {
    announcements,
    events: [ev('e1', 'Kitap fuarı açılışı', at(6, 11)), ev('e2', 'Gençlik konseri', at(12, 20)), ev('e3', 'Yılbaşı çocuk şenliği', at(40, 14), 'taslak')],
    national: null,
    local: [{ id: 'kurtulus', title: 'Bursa’nın Kurtuluşu', kind: 'yerel', md: '09-11', idea: 'Tören programı ve kurtuluş yürüyüşü.' }],
  };
}

/**
 * Basın Masası (PROJE.md 6.2, Karar Eren 5 Kasım 2026): basın biriminin yardımcı araçları. Aylık yayın takvimi
 * (yayınlanan duyuru ve haberler, etkinlikler, önemli günler), seçilen günün ayrıntısı ve "bu gün için duyuru hazırla",
 * yaklaşan önemli günler, hazırlıktaki içerikler; kurumun yerel günleri ve (admin) ülke geneli gün listesi.
 */
export function PressPage() {
  const { user } = useSession();
  if (!user) return null;
  if (!canSeePress(user)) return <Navigate to="/" replace />;
  return <Press user={user} />;
}

function Press({ user }: { user: PanelUser }) {
  const admin = isAdminUser(user);
  const navigate = useNavigate();
  const { ann, ev, all } = useMemo(() => pressPublishers(user), [user]);
  const [pubKey, setPubKey] = useState(all[0]?.key ?? '');
  const publisher = all.find((p) => p.key === pubKey);
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(keyOf(today));
  const days = useMemo(() => createImportantDaysService(firestore, user.uid), [user.uid]);

  const orgId = publisher?.author.type === 'kurum' ? publisher.author.orgId : null;
  const load = useCallback(async () => {
    setFailed(false);
    if (user.isDemo) return setData(sampleData());
    try {
      const actor = { uid: user.uid, name: user.displayName };
      const [announcements, events, national, local] = await Promise.all([
        publisher && ann.some((p) => p.key === publisher.key) ? createAnnouncementPanel(firestore, actor).listFor(publisher) : Promise.resolve([]),
        publisher && ev.some((p) => p.key === publisher.key) ? createEventPanel(firestore, actor).listFor(publisher) : Promise.resolve([]),
        days.loadNational().catch(() => null),
        orgId ? days.loadLocal(orgId).catch(() => []) : Promise.resolve([]),
      ]);
      setData({ announcements, events, national, local });
    } catch {
      setFailed(true);
    }
  }, [user, publisher, ann, ev, days, orgId]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const national = data?.national ?? DEFAULT_IMPORTANT_DAYS;
  const allDays = useMemo(() => [...national, ...(data?.local ?? [])], [national, data?.local]);
  const canWriteAnn = !!publisher && !user.isDemo && !!ann.find((p) => p.key === publisher.key)?.actions.includes('ekle');
  const membership = orgId ? user.memberships.find((m) => m.org.id === orgId) : undefined;
  const canEditLocal = !!orgId && !user.isDemo && (admin || !!membership?.member.isOrgAdmin || !!ann.find((p) => p.key === orgId)?.actions.includes('ekle'));

  // Takvim: ayın görünen haftaları (pazartesi başlar).
  const grid = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - ((first.getDay() + 6) % 7));
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + (7 - ((last.getDay() + 6) % 7)));
    const cells: Date[] = [];
    for (let d = new Date(start); d < end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) cells.push(d);
    return { cells, start, end };
  }, [month]);

  const items = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    const add = (i: CalItem) => map.set(i.date, [...(map.get(i.date) ?? []), i]);
    if (!data) return map;
    for (const a of data.announcements) {
      if (a.status !== 'yayinda' || !a.publishedAt) continue;
      // Planlı (zamanı gelmemiş) duyuru kesik çizgili, "Planlı" etiketiyle.
      add({ key: a.id, kind: a.kind === 'acil' ? 'acil' : a.kind === 'haber' ? 'haber' : 'duyuru', title: a.title, date: keyOf(new Date(a.publishedAt)), time: timeOf(a.publishedAt), pending: isScheduled(a), scheduled: isScheduled(a), to: '/duyurular' });
    }
    for (const e of data.events) {
      if (e.status === 'reddedildi' || e.status === 'kaldirildi') continue;
      add({ key: e.id, kind: 'etkinlik', title: e.title, date: keyOf(new Date(e.startsAt)), time: timeOf(e.startsAt), pending: e.status !== 'yayinda' && e.status !== 'iptal', to: '/etkinlikler' });
    }
    for (const o of occurrencesBetween(allDays, grid.start, grid.end)) {
      add({ key: `${o.day.id}-${o.date}`, kind: o.day.kind === 'yerel' ? 'yerel' : 'gun', title: o.day.title, date: o.date, idea: o.day.idea, nthDay: (o.day.length ?? 1) > 1 ? o.nthDay : undefined });
    }
    // Önemli günler önce, sonra saate göre.
    for (const [k, list] of map) map.set(k, list.sort((a, b) => Number(!!a.time) - Number(!!b.time) || (a.time ?? '').localeCompare(b.time ?? '')));
    return map;
  }, [data, allDays, grid]);

  const pending = (data?.announcements ?? []).filter((a) => a.status === 'taslak' || a.status === 'onay-bekliyor' || a.status === 'reddedildi' || isScheduled(a));
  const upcoming = upcomingDays(allDays, today, 30);
  const monthLabel = month.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  const draftFor = (title: string) => navigate(`/duyurular?yeni=1&baslik=${encodeURIComponent(title)}`);
  const selectedItems = items.get(selected) ?? [];
  const selectedLabel = new Date(`${selected}T12:00:00`).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });

  const chip = (i: CalItem) => (
    <span key={i.key} className={`cal-chip k-${i.kind}${i.pending ? ' pending' : ''}`} title={i.title}>
      {i.time ? <b>{i.time}</b> : null} {i.title}
    </span>
  );

  return (
    <section className="page wide">
      <header className="page-head">
        <div>
          <h1>
            {t('press.title')}
            {user.isDemo ? <span className="sample-tag">{t('audience.sample')}</span> : null}
          </h1>
          <p className="meta">{t('press.intro')}</p>
        </div>
        {canWriteAnn ? <button className="btn" onClick={() => draftFor('')}>{t('press.newAnnouncement')}</button> : null}
      </header>

      {all.length > 1 ? (
        <div className="toolbar">
          <label htmlFor="press-pub">{t('audience.which')}</label>
          <select id="press-pub" value={pubKey} onChange={(e) => setPubKey(e.target.value)}>
            {all.map((p) => (
              <option key={p.key} value={p.key}>{p.author.type === 'kurum' ? p.author.name : t('audience.muhtarOf', { id: p.key })}</option>
            ))}
          </select>
        </div>
      ) : null}

      {failed ? <p className="error" role="alert">{t('press.error')}</p> : !data ? <div className="state" aria-live="polite">{t('profile.loading')}</div> : (
        <>
          <div className="press-top">
            <div className="card">
              <h2 className="card-title">{t('press.upcoming')}</h2>
              {upcoming.length ? (
                <ul className="upcoming">
                  {upcoming.slice(0, 6).map((o) => (
                    <li key={`${o.day.id}-${o.date}`}>
                      <span className={`dot k-${o.day.kind === 'yerel' ? 'yerel' : 'gun'}`} aria-hidden="true" />
                      <span className="grow">
                        <strong>{o.day.title}</strong>
                        <small>{new Date(`${o.date}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}</small>
                      </span>
                      <span className="when">{o.inDays === 0 ? t('press.todayShort') : t('press.inDays', { count: o.inDays })}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="meta">{t('press.noUpcoming')}</p>}
            </div>
            <div className="card">
              <h2 className="card-title">{t('press.pending')}</h2>
              {pending.length ? (
                <ul className="upcoming">
                  {pending.slice(0, 6).map((a) => (
                    <li key={a.id}>
                      <span className={`dot k-${isScheduled(a) ? 'duyuru' : 'taslak'}`} aria-hidden="true" />
                      <span className="grow">
                        <strong>{a.title}</strong>
                        <small>{isScheduled(a) ? t('press.scheduledAt', { date: new Date(a.publishedAt!).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) }) : t(`press.status.${a.status}`)}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="meta">{t('press.noPending')}</p>}
              {publisher && ann.some((p) => p.key === publisher.key) ? <Link className="btn secondary" to="/duyurular">{t('press.toAnnouncements')}</Link> : null}
            </div>
          </div>

          <div className="card">
            <div className="cal-head">
              <button type="button" className="btn secondary" aria-label={t('press.prev')} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
              <h2 aria-live="polite">{monthLabel}</h2>
              <button type="button" className="btn secondary" aria-label={t('press.next')} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
              <button type="button" className="btn ghost" onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(keyOf(today)); }}>{t('press.today')}</button>
            </div>
            <ul className="cal-legend" aria-label={t('press.legend')}>
              {(['duyuru', 'haber', 'etkinlik', 'gun', 'yerel'] as const).map((k) => (
                <li key={k}><span className={`dot k-${k}`} aria-hidden="true" />{t(`press.kinds.${k}`)}</li>
              ))}
              <li><span className="dot k-taslak" aria-hidden="true" />{t('press.kinds.taslak')}</li>
            </ul>
            <div className="cal-grid" role="grid" aria-label={monthLabel}>
              {WEEKDAYS.map((w) => <span key={w} className="cal-wd" role="columnheader">{w}</span>)}
              {grid.cells.map((d) => {
                const k = keyOf(d);
                const list = items.get(k) ?? [];
                const other = d.getMonth() !== month.getMonth();
                return (
                  <button
                    key={k}
                    type="button"
                    role="gridcell"
                    className={`cal-cell${other ? ' other' : ''}${k === keyOf(today) ? ' today' : ''}${k === selected ? ' selected' : ''}`}
                    aria-selected={k === selected}
                    aria-label={`${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}: ${list.length ? list.map((i) => i.title).join(', ') : t('press.empty')}`}
                    onClick={() => setSelected(k)}>
                    <span className="cal-num">{d.getDate()}</span>
                    <span className="cal-items" aria-hidden="true">
                      {list.slice(0, 3).map(chip)}
                      {list.length > 3 ? <span className="cal-more">+{list.length - 3}</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card" aria-live="polite">
            <h2 className="card-title">{selectedLabel}</h2>
            {selectedItems.length ? (
              <ul className="day-list">
                {selectedItems.map((i) => (
                  <li key={i.key} className={`k-${i.pending && !i.scheduled ? 'taslak' : i.kind}`}>
                    <div className="grow">
                      <span className="meta">{t(`press.kinds.${i.kind}`)}{i.time ? ` · ${i.time}` : ''}{i.scheduled ? ` · ${t('press.kinds.planli')}` : i.pending ? ` · ${t('press.kinds.taslak')}` : ''}{i.nthDay ? ` · ${t('press.nthDay', { n: i.nthDay })}` : ''}</span>
                      <strong>{i.title}</strong>
                      {i.idea ? <span className="meta">{t('press.idea')}: {i.idea}</span> : null}
                    </div>
                    {(i.kind === 'gun' || i.kind === 'yerel') && canWriteAnn && (i.nthDay ?? 1) === 1 ? (
                      <button type="button" className="btn secondary" onClick={() => draftFor(i.title)}>{t('press.prepare')}</button>
                    ) : i.to ? <Link className="link" to={i.to}>{t('press.open')}</Link> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="meta">{t('press.emptyDay')}</p>}
          </div>

          {orgId ? (
            <DaysEditor
              title={t('press.localTitle')}
              hint={t('press.localHint')}
              days={data.local}
              kinds={['yerel']}
              readOnly={!canEditLocal}
              max={60}
              onSave={async (list) => {
                await days.saveLocal(orgId, list, membership?.member.isOrgAdmin || admin ? { module: 'kurumlar', action: 'duzenle' } : { module: 'gonderiler', action: 'ekle' });
                await load();
              }}
            />
          ) : null}
          {publisher && ann.some((p) => p.key === publisher.key) ? <TemplatesCard user={user} publisher={publisher} /> : null}
          {admin ? (
            <DaysEditor
              title={t('press.nationalTitle')}
              hint={data.national ? t('press.nationalHint') : t('press.nationalDefault')}
              days={national}
              kinds={IMPORTANT_DAY_KINDS.filter((k) => k !== 'yerel')}
              readOnly={!!user.isDemo}
              max={300}
              onSave={async (list) => {
                await days.saveNational(list);
                await load();
              }}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

const whenText = (d: ImportantDay) =>
  d.md
    ? t('press.everyYear', { date: new Date(`2024-${d.md}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) })
    : d.date
      ? new Date(`${d.date}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
      : d.nth
        ? t('press.nth', { month: new Date(2024, d.nth.month - 1, 1).toLocaleDateString('tr-TR', { month: 'long' }), n: d.nth.n === -1 ? t('press.last') : `${d.nth.n}.`, weekday: new Date(2024, 0, 7 + d.nth.weekday).toLocaleDateString('tr-TR', { weekday: 'long' }) })
        : '';

interface FormState { id?: string; title: string; kind: ImportantDayKind; mode: 'md' | 'date'; md: string; date: string; length: string; idea: string; nth?: ImportantDay['nth'] }

/** Gün listesi düzenleyici: yerel günler (kurum) ya da ülke geneli liste (admin). Liste bir kerede kaydedilir. */
function DaysEditor({ title, hint, days, kinds, readOnly, max, onSave }: {
  title: string; hint: string; days: ImportantDay[]; kinds: ImportantDayKind[]; readOnly: boolean; max: number; onSave: (days: ImportantDay[]) => Promise<void>;
}) {
  const [list, setList] = useState(days);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  useEffect(() => setList(days), [days]);
  const dirty = JSON.stringify(list) !== JSON.stringify(days);
  const sortKey = (d: ImportantDay) => d.md ?? d.date?.slice(5) ?? (d.nth ? `${String(d.nth.month).padStart(2, '0')}-${String(d.nth.n === -1 ? 28 : d.nth.n * 7).padStart(2, '0')}` : '');
  const sorted = [...list].sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || (a.date ?? '').localeCompare(b.date ?? ''));

  const edit = (d?: ImportantDay) =>
    setForm(d
      ? { id: d.id, title: d.title, kind: d.kind, mode: d.date ? 'date' : 'md', md: d.md ?? '', date: d.date ?? '', length: String(d.length ?? 1), idea: d.idea ?? '', nth: d.nth }
      : { title: '', kind: kinds[0], mode: 'md', md: '', date: '', length: '1', idea: '' });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const day: ImportantDay = {
      id: form.id ?? `${Date.now().toString(36)}`,
      title: form.title.trim(),
      kind: form.kind,
      ...(form.nth ? { nth: form.nth } : form.mode === 'md' ? { md: form.md } : { date: form.date }),
      ...(Number(form.length) > 1 ? { length: Number(form.length) } : {}),
      ...(form.idea.trim() ? { idea: form.idea.trim() } : {}),
    };
    const errs = validateImportantDay(day);
    setErrors(errs);
    if (errs.length) return;
    setList((l) => (form.id ? l.map((x) => (x.id === form.id ? day : x)) : [...l, day]));
    setForm(null);
  };

  const save = async () => {
    setBusy(true);
    setMsg(undefined);
    try {
      await onSave(list);
      setMsg({ ok: true, text: t('press.saved') });
    } catch {
      setMsg({ ok: false, text: t('press.saveError') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">{title}</h2>
      <p className="meta">{hint}</p>
      {sorted.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('press.colDay')}</th>
                <th scope="col">{t('press.colWhen')}</th>
                <th scope="col">{t('press.colKind')}</th>
                {readOnly ? null : <th scope="col"><span className="sr-only">{t('press.colActions')}</span></th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.title}</strong>{d.idea ? <><br /><span className="meta">{d.idea}</span></> : null}</td>
                  <td>{whenText(d)}{(d.length ?? 1) > 1 ? ` · ${t('press.lengthDays', { count: d.length! })}` : ''}</td>
                  <td>{t(`press.dayKinds.${d.kind}`)}</td>
                  {readOnly ? null : (
                    <td className="actions">
                      <button type="button" className="link" onClick={() => edit(d)}>{t('press.edit')}</button>
                      <button type="button" className="link" onClick={() => setList((l) => l.filter((x) => x.id !== d.id))}>{t('press.remove')}</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="meta">{t('press.noDays')}</p>}

      {readOnly ? null : form ? (
        <form className="form panel-form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="day-title">{t('press.fTitle')}</label>
            <input id="day-title" value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-invalid={errors.includes('title')} />
            {errors.includes('title') ? <span className="error">{t('press.errTitle')}</span> : null}
          </div>
          {kinds.length > 1 ? (
            <div className="field">
              <label htmlFor="day-kind">{t('press.colKind')}</label>
              <select id="day-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ImportantDayKind })}>
                {kinds.map((k) => <option key={k} value={k}>{t(`press.dayKinds.${k}`)}</option>)}
              </select>
            </div>
          ) : null}
          {form.nth ? <p className="meta">{whenText({ id: '', title: '', kind: form.kind, nth: form.nth })}</p> : (
            <>
              <div className="field">
                <label htmlFor="day-mode">{t('press.fRepeat')}</label>
                <select id="day-mode" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as 'md' | 'date' })}>
                  <option value="md">{t('press.fEveryYear')}</option>
                  <option value="date">{t('press.fOnce')}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="day-date">{t('press.fDate')}</label>
                <input
                  id="day-date"
                  type="date"
                  value={form.mode === 'md' ? (form.md ? `${new Date().getFullYear()}-${form.md}` : '') : form.date}
                  onChange={(e) => setForm(form.mode === 'md' ? { ...form, md: e.target.value.slice(5) } : { ...form, date: e.target.value })}
                  aria-invalid={errors.includes('date')}
                />
                {errors.includes('date') ? <span className="error">{t('press.errDate')}</span> : null}
              </div>
            </>
          )}
          <div className="field">
            <label htmlFor="day-length">{t('press.fLength')}</label>
            <input id="day-length" type="number" min={1} max={10} value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} aria-invalid={errors.includes('length')} />
          </div>
          <div className="field">
            <label htmlFor="day-idea">{t('press.fIdea')}</label>
            <textarea id="day-idea" rows={2} maxLength={200} value={form.idea} onChange={(e) => setForm({ ...form, idea: e.target.value })} />
          </div>
          <div className="actions">
            <button className="btn" type="submit">{form.id ? t('press.update') : t('press.add')}</button>
            <button className="btn secondary" type="button" onClick={() => { setForm(null); setErrors([]); }}>{t('press.cancel')}</button>
          </div>
        </form>
      ) : (
        <div className="actions">
          <button type="button" className="btn secondary" disabled={list.length >= max} onClick={() => edit()}>{t('press.addDay')}</button>
          <button type="button" className="btn" disabled={!dirty || busy} onClick={save}>{t('press.save')}</button>
          {dirty ? <button type="button" className="btn ghost" onClick={() => setList(days)}>{t('press.discard')}</button> : null}
        </div>
      )}
      {msg ? <p className={msg.ok ? 'note' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p> : null}
    </div>
  );
}

/** Hazır şablonlar: liste, kaldırma ve örnek şablonları ekleme. Yeni şablon duyuru formunda "Şablon olarak kaydet" ile. */
function TemplatesCard({ user, publisher }: { user: PanelUser; publisher: Publisher }) {
  const svc = useMemo(() => createPressTemplatesService(firestore, user.uid), [user.uid]);
  const [list, setList] = useState<PressTemplate[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState(false);
  const editable = canEditTemplates(user, publisher);
  useEffect(() => {
    if (user.isDemo) return setList(STARTER_TEMPLATES.slice(0, 4));
    svc.load(publisher.key).then(setList, () => setList([]));
  }, [svc, publisher.key, user.isDemo]);

  const store = async (next: PressTemplate[]) => {
    setBusy(true);
    setMsg(undefined);
    try {
      await svc.save(publisher.key, next, pressAuditAs(user, publisher));
      setList(next);
      setMsg({ ok: true, text: t('press.saved') });
    } catch {
      setMsg({ ok: false, text: t('press.saveError') });
    } finally {
      setBusy(false);
    }
  };
  const missing = STARTER_TEMPLATES.filter((x) => !(list ?? []).some((y) => y.id === x.id));

  return (
    <div className="card">
      <h2 className="card-title">{t('press.templatesTitle')}</h2>
      <p className="meta">{t('press.templatesHint')}</p>
      {list === null ? <p className="meta">{t('profile.loading')}</p> : list.length ? (
        <ul className="day-list">
          {list.map((x) => (
            <li key={x.id} className={`k-${x.kind}`}>
              <div className="grow">
                <span className="meta">{t(`press.kinds.${x.kind}`)}</span>
                <strong>{x.name}</strong>
                <span className="meta">{x.title}</span>
              </div>
              {editable ? <button type="button" className="link" disabled={busy} onClick={() => window.confirm(t('press.templateRemoveConfirm', { name: x.name })) && store(list.filter((y) => y.id !== x.id))}>{t('press.remove')}</button> : null}
            </li>
          ))}
        </ul>
      ) : <p className="meta">{t('press.noTemplates')}</p>}
      <div className="actions">
        {editable && missing.length ? <button type="button" className="btn secondary" disabled={busy} onClick={() => store([...(list ?? []), ...missing])}>{t('press.addStarters', { count: missing.length })}</button> : null}
        <Link className="btn ghost" to="/duyurular?yeni=1">{t('press.useTemplate')}</Link>
      </div>
      {msg ? <p className={msg.ok ? 'note' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p> : null}
    </div>
  );
}
