import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import {
  ADMIN_PUSH_KINDS,
  ADMIN_PUSH_LIMITS,
  cleanPushTarget,
  isCommercial,
  validateAdminPush,
  type AdminPush,
  type AdminPushError,
  type AdminPushKind,
  type AdminPushLink,
  type AdminPushRegion,
  type AudienceFilter,
  type Business,
  type Neighbourhood,
  type Post,
} from '@cityjoy/shared';
import {
  createAdminPushPanel,
  createBusinessAdmin,
  createFirestoreAnnouncementRepository,
  createFirestoreEventRepository,
  createFirestorePostRepository,
  type AdminPushBilling,
} from '@cityjoy/shared/firebase';

import { AudienceFields } from '../components/audience-fields';
import { firestore } from '../lib/firebase';
import { locationRepository as repo } from '../lib/locations';
import { isAdminUser, useSession, type PanelUser } from '../lib/session';
import { t } from '../lib/t';

const toLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const dateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/**
 * Bildirim gönder (yalnızca admin; PROJE.md 7, Karar Eren 5 Kasım 2026): duyuru, etkinlik, kampanya / tanıtım ve
 * ücretli işletme reklamı. Bölge (ülke / il / ilçe / mahalle), yaş / cinsiyet / meslek, dokununca açılacak yer, hemen ya
 * da planlı. Reklamda ücret ve fatura elle (yalnızca admin görür). Gönderim ve kişi sayısı sunucuda (Blaze).
 */
export function AdminPushPage() {
  const { user } = useSession();
  if (!user) return null;
  if (!isAdminUser(user)) return <Navigate to="/" replace />;
  return <AdminPushes user={user} />;
}

interface Draft {
  kind: AdminPushKind;
  title: string;
  body: string;
  region: AdminPushRegion;
  target?: AudienceFilter;
  linkType: AdminPushLink['type'];
  linkId: string;
  business?: { id: string; name: string };
  /** Seçilen paylaşımın resmi (yalnızca panelde, doğru paylaşım seçilsin diye). */
  image?: string;
  now: boolean;
  sendAt: string;
  billing: { amount: string; invoiceNo: string; note: string };
}

const emptyDraft = (): Draft => ({
  kind: 'duyuru', title: '', body: '', region: {}, linkType: 'yok', linkId: '', now: true, sendAt: toLocal(new Date(Date.now() + 3600000)),
  billing: { amount: '', invoiceNo: '', note: '' },
});

function AdminPushes({ user }: { user: PanelUser }) {
  const svc = useMemo(() => createAdminPushPanel(firestore, user.uid), [user.uid]);
  const [list, setList] = useState<AdminPush[] | null>(null);
  const [extra, setExtra] = useState<Record<string, { opens: number | null; billing: AdminPushBilling | null }>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (user.isDemo) return setList([]);
    try {
      const l = await svc.list();
      setList(l);
      const pairs = await Promise.all(l.slice(0, 20).map(async (p) => [p.id, { opens: p.status === 'gonderildi' ? await svc.opens(p.id) : null, billing: p.kind === 'reklam' ? await svc.billing(p.id).catch(() => null) : null }] as const));
      setExtra(Object.fromEntries(pairs));
    } catch {
      setList([]);
      setMsg({ ok: false, text: t('adminPush.loadError') });
    }
  }, [svc, user.isDemo]);
  useEffect(() => {
    load();
  }, [load]);

  const submit = async (d: Draft) => {
    setBusy(true);
    setMsg(undefined);
    try {
      const link: AdminPushLink = d.linkType === 'yok' ? { type: 'yok' } : ({ type: d.linkType, id: d.linkId } as AdminPushLink);
      const amount = d.billing.amount.trim() ? Number(d.billing.amount.replace(',', '.')) : undefined;
      await svc.create(
        { kind: d.kind, title: d.title, body: d.body, region: d.region, target: cleanPushTarget(d.target) ?? undefined, link, business: d.business, sendAt: d.now ? new Date().toISOString() : new Date(d.sendAt).toISOString() },
        d.kind === 'reklam' ? { ...(amount !== undefined && Number.isFinite(amount) ? { amount } : {}), invoiceNo: d.billing.invoiceNo.trim(), note: d.billing.note.trim() } : undefined,
      );
      setDraft(null);
      setMsg({ ok: true, text: d.now ? t('adminPush.sent') : t('adminPush.scheduled', { date: dateTime(new Date(d.sendAt).toISOString()) }) });
      await load();
    } catch {
      setMsg({ ok: false, text: t('adminPush.saveError') });
    } finally {
      setBusy(false);
    }
  };

  const regionText = (r: AdminPushRegion) =>
    !r.provinceCode ? t('adminPush.national') : [r.neighbourhoodId ? t('adminPush.oneHood') : null, r.districtId ? repo.getDistrict(r.districtId)?.name : null, repo.getProvince(r.provinceCode)?.name].filter(Boolean).join(', ');
  const statusText = (p: AdminPush) =>
    p.status === 'planli' ? t('adminPush.st.planli', { date: dateTime(p.sendAt) })
      : p.status === 'iptal' ? t('adminPush.st.iptal')
        : p.skipped ? t('adminPush.st.small')
          : t('adminPush.st.gonderildi', { count: (p.recipients ?? 0).toLocaleString('tr-TR') });

  return (
    <section className="page wide">
      <header className="page-head">
        <div>
          <h1>{t('adminPush.title')}</h1>
          <p className="meta">{t('adminPush.intro')}</p>
        </div>
        {!draft && !user.isDemo ? <button className="btn" onClick={() => setDraft(emptyDraft())}>{t('adminPush.new')}</button> : null}
      </header>
      {user.isDemo ? <p className="note">{t('adminPush.demo')}</p> : null}
      {msg ? <p className={msg.ok ? 'note' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p> : null}
      {draft ? <PushForm draft={draft} setDraft={setDraft} busy={busy} onSubmit={submit} /> : null}

      <h2>{t('adminPush.history')}</h2>
      {list === null ? <div className="state">{t('profile.loading')}</div> : list.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('adminPush.colPush')}</th>
                <th scope="col">{t('adminPush.colTarget')}</th>
                <th scope="col">{t('adminPush.colStatus')}</th>
                <th scope="col" className="num">{t('adminPush.colOpens')}</th>
                <th scope="col"><span className="sr-only">{t('adminPush.colActions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const x = extra[p.id];
                return (
                  <tr key={p.id}>
                    <td>
                      <span className={isCommercial(p.kind) ? 'pill warn' : 'pill'}>{t(`adminPush.kinds.${p.kind}`)}</span>{' '}
                      <strong>{p.business ? `${p.business.name}: ` : ''}{p.title}</strong>
                      <div className="meta">{p.body}</div>
                      {x?.billing ? <div className="meta">{t('adminPush.billingLine', { amount: x.billing.amount !== undefined ? `${x.billing.amount.toLocaleString('tr-TR')} TL` : '—', invoice: x.billing.invoiceNo || '—' })}</div> : null}
                    </td>
                    <td>
                      <div>{regionText(p.region)}</div>
                      {p.target ? <div className="meta">{t('adminPush.targeted')}</div> : null}
                    </td>
                    <td>{statusText(p)}</td>
                    <td className="num">{p.status === 'gonderildi' ? (x?.opens ?? '—') : '—'}</td>
                    <td>
                      {p.status === 'planli' ? (
                        <button className="link" disabled={busy} onClick={async () => {
                          if (!window.confirm(t('adminPush.cancelConfirm', { title: p.title }))) return;
                          await svc.cancel(p).then(load, () => setMsg({ ok: false, text: t('adminPush.saveError') }));
                        }}>{t('adminPush.cancel')}</button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="state">{t('adminPush.empty')}</div>}
    </section>
  );
}

function PushForm({ draft: d, setDraft, busy, onSubmit }: { draft: Draft; setDraft: (d: Draft | null) => void; busy: boolean; onSubmit: (d: Draft) => void }) {
  const set = (p: Partial<Draft>) => setDraft({ ...d, ...p });
  const [errors, setErrors] = useState<AdminPushError[]>([]);
  const [hoods, setHoods] = useState<Neighbourhood[]>([]);
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [bizQuery, setBizQuery] = useState('');
  const [linkOptions, setLinkOptions] = useState<{ id: string; label: string }[]>([]);
  const { user } = useSession();
  const commercial = isCommercial(d.kind);
  const pc = d.region.provinceCode ?? '';

  useEffect(() => {
    setHoods([]);
    if (d.region.districtId) repo.getNeighbourhoods(d.region.districtId).then(setHoods, () => setHoods([]));
  }, [d.region.districtId]);
  // İşletme seçimi (reklam ya da "işletme sayfası açılsın"): seçili ildeki işletmeler.
  const needBiz = d.kind === 'reklam' || d.linkType === 'isletme' || d.linkType === 'gonderi';
  // İşletmenin herkese açık (Genel) paylaşımları: reklam bildirimi bunlardan birini açar (Karar Eren 5 Kasım 2026).
  const [posts, setPosts] = useState<Post[] | null>(null);
  const bizId = d.business?.id;
  useEffect(() => {
    setPosts(null);
    if (d.linkType !== 'gonderi' || !bizId) return;
    createFirestorePostRepository(firestore).byBusiness(bizId, { following: false }).then(setPosts, () => setPosts([]));
  }, [d.linkType, bizId]);
  useEffect(() => {
    setBusinesses(null);
    if (!needBiz || !pc || !user) return;
    createBusinessAdmin(firestore, user.uid).list({ provinceCode: pc }).then(setBusinesses, () => setBusinesses([]));
  }, [needBiz, pc, user]);
  // Etkinlik / duyuru bağlantısı: seçili ildeki yayındakiler.
  useEffect(() => {
    setLinkOptions([]);
    if (!pc || (d.linkType !== 'etkinlik' && d.linkType !== 'duyuru')) return;
    const load = d.linkType === 'etkinlik'
      ? createFirestoreEventRepository(firestore).listUpcoming(pc).then((l) => l.map((e) => ({ id: e.id, label: e.title })))
      : createFirestoreAnnouncementRepository(firestore).listLive(pc).then((l) => l.map((a) => ({ id: a.id, label: a.title })));
    load.then(setLinkOptions, () => setLinkOptions([]));
  }, [pc, d.linkType]);

  const chooseBusiness = (b: Business) =>
    set({ business: { id: b.id, name: b.name }, image: undefined, ...(d.linkType === 'gonderi' ? { linkId: '' } : d.linkType === 'isletme' || d.kind === 'reklam' ? { linkType: 'isletme', linkId: b.id } : {}) });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const link: AdminPushLink = d.linkType === 'yok' ? { type: 'yok' } : ({ type: d.linkType, id: d.linkId } as AdminPushLink);
    const errs = validateAdminPush({ kind: d.kind, title: d.title, body: d.body, business: d.business, link, sendAt: d.now ? new Date().toISOString() : new Date(d.sendAt).toISOString() });
    setErrors(errs);
    if (errs.length) return;
    const where = !pc ? t('adminPush.national') : [repo.getProvince(pc)?.name, d.region.districtId ? repo.getDistrict(d.region.districtId)?.name : null].filter(Boolean).join(' / ');
    if (window.confirm(t(d.now ? 'adminPush.confirmNow' : 'adminPush.confirmLater', { kind: t(`adminPush.kinds.${d.kind}`), where }))) onSubmit(d);
  };
  const err = (k: AdminPushError) => (errors.includes(k) ? <span className="error" role="alert">{t(`adminPush.errors.${k}`)}</span> : null);
  const preview = `${commercial ? `${t(d.kind === 'reklam' ? 'adminPush.adTag' : 'adminPush.campaignTag')} · ` : ''}${d.kind === 'reklam' && d.business ? `${d.business.name}: ` : ''}${d.title || t('adminPush.fTitle')}`;
  const shownBiz = (businesses ?? []).filter((b) => !bizQuery.trim() || b.name.toLocaleLowerCase('tr').includes(bizQuery.trim().toLocaleLowerCase('tr'))).slice(0, 30);

  return (
    <form className="form panel-form" onSubmit={submit} noValidate aria-labelledby="ap-title">
      <h2 id="ap-title" className="form-section">{t('adminPush.new')}</h2>
      <fieldset className="checkbox-group form-section">
        <legend>{t('adminPush.kind')}</legend>
        {ADMIN_PUSH_KINDS.map((k) => (
          <label key={k}>
            <input type="radio" name="ap-kind" checked={d.kind === k} onChange={() => set({ kind: k, ...(k !== 'reklam' ? { business: undefined } : {}) })} />
            {t(`adminPush.kinds.${k}`)}
          </label>
        ))}
      </fieldset>
      <p className="form-section meta">{t(`adminPush.kindHint.${d.kind}`)}</p>

      <h3 className="form-section">{t('adminPush.where')}</h3>
      <div className="field">
        <label htmlFor="ap-prov">{t('adminPush.province')}</label>
        <select id="ap-prov" value={pc} onChange={(e) => set({ region: e.target.value ? { provinceCode: e.target.value } : {}, business: undefined, linkId: '' })}>
          <option value="">{t('adminPush.national')}</option>
          {repo.getProvinces().map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
      </div>
      {pc ? (
        <div className="field">
          <label htmlFor="ap-dist">{t('adminPush.district')}</label>
          <select id="ap-dist" value={d.region.districtId ?? ''} onChange={(e) => set({ region: { provinceCode: pc, ...(e.target.value ? { districtId: e.target.value } : {}) } })}>
            <option value="">{t('adminPush.wholeProvince')}</option>
            {repo.getDistricts(pc).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
      ) : null}
      {d.region.districtId ? (
        <div className="field">
          <label htmlFor="ap-hood">{t('adminPush.hood')}</label>
          <select id="ap-hood" value={d.region.neighbourhoodId ?? ''} onChange={(e) => set({ region: { ...d.region, neighbourhoodId: e.target.value || undefined } })}>
            <option value="">{t('adminPush.wholeDistrict')}</option>
            {hoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </div>
      ) : null}
      <AudienceFields publisherKey="admin" region={d.region} value={d.target} onChange={(target) => set({ target })} commercial={commercial} />

      {needBiz ? (
        <div className="field form-section">
          <label htmlFor="ap-biz">{t('adminPush.business')}</label>
          {!pc ? <span className="meta">{t('adminPush.businessNeedsProvince')}</span> : (
            <>
              <input id="ap-biz" value={bizQuery} placeholder={t('adminPush.businessSearch')} onChange={(e) => setBizQuery(e.target.value)} />
              {d.business ? <span className="meta">{t('adminPush.businessChosen', { name: d.business.name })}</span> : null}
              <div className="biz-list" role="listbox" aria-label={t('adminPush.business')}>
                {businesses === null ? <span className="meta">{t('profile.loading')}</span> : shownBiz.map((b) => (
                  <button key={b.id} type="button" role="option" aria-selected={d.business?.id === b.id} className={d.business?.id === b.id ? 'chip on' : 'chip'} onClick={() => chooseBusiness(b)}>{b.name}</button>
                ))}
              </div>
            </>
          )}
          {err('business')}
        </div>
      ) : null}

      <div className="field form-section">
        <label htmlFor="ap-t">{t('adminPush.fTitle')}</label>
        <input id="ap-t" value={d.title} maxLength={ADMIN_PUSH_LIMITS.title[1]} onChange={(e) => set({ title: e.target.value })} />
        <span className="meta">{d.title.length} / {ADMIN_PUSH_LIMITS.title[1]}</span>
        {err('title')}
      </div>
      <div className="field form-section">
        <label htmlFor="ap-b">{t('adminPush.fBody')}</label>
        <textarea id="ap-b" rows={3} value={d.body} maxLength={ADMIN_PUSH_LIMITS.body[1]} onChange={(e) => set({ body: e.target.value })} />
        <span className="meta">{d.body.length} / {ADMIN_PUSH_LIMITS.body[1]}</span>
        {err('body')}
      </div>
      <div className="form-section push-preview" aria-label={t('adminPush.preview')}>
        <span className="meta">{t('adminPush.preview')}</span>
        {d.linkType === 'gonderi' && d.image ? <img src={d.image} alt="" className="push-preview-img" /> : null}
        <strong>{preview}</strong>
        <span>{d.body || t('adminPush.fBody')}</span>
      </div>

      <div className="field">
        <label htmlFor="ap-link">{t('adminPush.link')}</label>
        <select id="ap-link" value={d.linkType} onChange={(e) => set({ linkType: e.target.value as AdminPushLink['type'], linkId: e.target.value === 'isletme' && d.business ? d.business.id : '', image: undefined })}>
          {(['yok', 'gonderi', 'isletme', 'etkinlik', 'duyuru'] as const).map((k) => <option key={k} value={k}>{t(`adminPush.links.${k}`)}</option>)}
        </select>
      </div>
      {d.linkType === 'gonderi' ? (
        <fieldset className="form-section">
          <legend>{t('adminPush.chooseShare')}</legend>
          {!d.business ? <span className="meta">{t('adminPush.shareNeedsBusiness')}</span> : posts === null ? <span className="meta">{t('profile.loading')}</span> : posts.length ? (
            <div className="share-grid" role="listbox" aria-label={t('adminPush.chooseShare')}>
              {posts.map((p) => (
                <button key={p.id} type="button" role="option" aria-selected={d.linkId === p.id} className={d.linkId === p.id ? 'share on' : 'share'}
                  onClick={() => set({ linkId: p.id, image: p.photos?.[0]?.url })}>
                  {p.photos?.[0] ? <img src={p.photos[0].url} alt="" /> : <span className="share-ph" aria-hidden="true">{p.video ? '▶' : '¶'}</span>}
                  <span className="share-text">{p.video ? `${t('adminPush.video')} · ` : ''}{p.text || t('adminPush.noText')}</span>
                </button>
              ))}
            </div>
          ) : <span className="meta">{t('adminPush.noShares')}</span>}
          <p className="meta">{t('adminPush.shareHint')}</p>
        </fieldset>
      ) : null}
      {d.linkType === 'etkinlik' || d.linkType === 'duyuru' ? (
        <div className="field">
          <label htmlFor="ap-link-id">{t(`adminPush.links.${d.linkType}`)}</label>
          {!pc ? <span className="meta">{t('adminPush.businessNeedsProvince')}</span> : (
            <select id="ap-link-id" value={d.linkId} onChange={(e) => set({ linkId: e.target.value })}>
              <option value="">{t('adminPush.choose')}</option>
              {linkOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          )}
        </div>
      ) : null}
      {err('link')}

      <fieldset className="checkbox-group form-section">
        <legend>{t('adminPush.when')}</legend>
        <label><input type="radio" name="ap-when" checked={d.now} onChange={() => set({ now: true })} />{t('adminPush.now')}</label>
        <label><input type="radio" name="ap-when" checked={!d.now} onChange={() => set({ now: false })} />{t('adminPush.later')}</label>
        {!d.now ? <input aria-label={t('adminPush.later')} type="datetime-local" value={d.sendAt} min={toLocal(new Date())} onChange={(e) => set({ sendAt: e.target.value })} /> : null}
      </fieldset>
      {err('sendAt')}

      {d.kind === 'reklam' ? (
        <fieldset className="form-section billing">
          <legend>{t('adminPush.billing')}</legend>
          <div className="field">
            <label htmlFor="ap-amount">{t('adminPush.amount')}</label>
            <input id="ap-amount" inputMode="decimal" value={d.billing.amount} onChange={(e) => set({ billing: { ...d.billing, amount: e.target.value } })} />
          </div>
          <div className="field">
            <label htmlFor="ap-inv">{t('adminPush.invoice')}</label>
            <input id="ap-inv" value={d.billing.invoiceNo} maxLength={40} onChange={(e) => set({ billing: { ...d.billing, invoiceNo: e.target.value } })} />
          </div>
          <div className="field">
            <label htmlFor="ap-note">{t('adminPush.note')}</label>
            <input id="ap-note" value={d.billing.note} maxLength={200} onChange={(e) => set({ billing: { ...d.billing, note: e.target.value } })} />
          </div>
          <p className="meta">{t('adminPush.billingHint')}</p>
        </fieldset>
      ) : null}

      <div className="actions">
        <button className="btn" type="submit" disabled={busy}>{d.now ? t('adminPush.sendNow') : t('adminPush.schedule')}</button>
        <button className="btn secondary" type="button" onClick={() => setDraft(null)}>{t('adminPush.cancelForm')}</button>
      </div>
    </form>
  );
}
