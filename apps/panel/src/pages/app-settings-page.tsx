import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import {
  APP_IMAGE_GROUPS,
  APP_IMAGE_SPECS,
  APP_IMAGES,
  APP_SECTIONS,
  BANNER_TEMPLATES,
  bannerPhase,
  CONTACT_LINKS,
  emptyBanner,
  LANGUAGES,
  riskyChanges,
  type AppBanner,
  type AppConfig,
  type AppImage,
  type Platform,
} from '@cityjoy/shared';
import { createAppConfigAdmin, PhotoTooLargeError, uploadMedia, type AppConfigHistoryEntry } from '@cityjoy/shared/firebase';

import { firestore, storage } from '../lib/firebase';
import { defaultImageUrl } from '../lib/app-images';
import { prepareImage } from '../lib/image';
import { locationRepository } from '../lib/locations';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';
import { Intro } from '../components/intro';

const TABS = ['banner', 'update', 'closed', 'images', 'contact', 'legal', 'history'] as const;
type Tab = (typeof TABS)[number];
const PLATFORMS: Platform[] = ['ios', 'android'];

/** ISO tarih ↔ tarih-saat kutusu (yerel saat). */
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

/**
 * Uygulama ayarları (Eren onayladı, 14 Kasım 2026): uygulamanın tamamını etkileyen ayarlar tek yerde. Yalnızca admin
 * görür ve değiştirir. Her kayıt işlem kaydına ve ayar geçmişine yazılır, geçmişten geri alınabilir. Herkesi
 * etkileyen değişikliklerde (bakım modu, zorunlu güncelleme, bölüm kapatma, yeniden onay) ikinci onay istenir.
 */
export function AppSettingsPage() {
  const { user } = useSession();
  const admin = !!user && isAdminUser(user);
  const canEdit = admin && !user.isDemo;
  const api = useMemo(() => createAppConfigAdmin(firestore), []);
  const [saved, setSaved] = useState<AppConfig | null>(null);
  const [draft, setDraft] = useState<AppConfig | null>(null);
  const [history, setHistory] = useState<AppConfigHistoryEntry[]>([]);
  const [loadError, setLoadError] = useState(false);
  // Uygulama görünümünden gelen bağlantı doğrudan ilgili sekmeyi açar (?sekme=banner).
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (TABS as readonly string[]).includes(params.get('sekme') ?? '') ? (params.get('sekme') as Tab) : 'banner');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [confirming, setConfirming] = useState<ReturnType<typeof riskyChanges> | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      // Geçmiş okunamazsa sayfa yine açılır (geçmiş sekmesi boş görünür).
      const [c, h] = await Promise.all([api.get(), api.history().catch(() => [])]);
      setSaved(c);
      setDraft(c);
      setHistory(h);
    } catch {
      setLoadError(true);
    }
  }, [api]);

  useEffect(() => {
    if (admin) load();
  }, [admin, load]);

  if (!admin) return <section className="page"><p className="note">{t('appSettings.adminOnly')}</p></section>;

  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<AppConfig>) => draft && setDraft({ ...draft, ...patch });

  const commit = async (next: AppConfig, ok = t('appSettings.saved')) => {
    if (!user) return;
    setBusy(true);
    setMessage(undefined);
    setConfirming(null);
    try {
      const c = await api.save(user.uid, next);
      setSaved(c);
      setDraft(c);
      setHistory(await api.history());
      setMessage({ kind: 'ok', text: ok });
    } catch {
      setMessage({ kind: 'error', text: t('appSettings.error') });
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!draft || !saved) return;
    const risks = riskyChanges(saved, draft);
    if (risks.length) setConfirming(risks);
    else commit(draft);
  };

  const rollback = async (h: AppConfigHistoryEntry) => {
    if (!user || !window.confirm(t('appSettings.history.confirm'))) return;
    setBusy(true);
    try {
      const c = await api.rollback(user.uid, h);
      setSaved(c);
      setDraft(c);
      setHistory(await api.history());
      setMessage({ kind: 'ok', text: t('appSettings.history.done') });
    } catch {
      setMessage({ kind: 'error', text: t('appSettings.error') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('appSettings.title')}</h1>
          <Intro text={t('appSettings.intro')} />
        </div>
      </header>
      {user?.isDemo ? <p className="note">{t('appSettings.demoReadOnly')}</p> : null}
      {loadError ? (
        <div className="state" role="alert">
          <p>{t('appSettings.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('appSettings.retry')}</button>
        </div>
      ) : !draft || !saved ? (
        <div className="state" aria-live="polite">{t('appSettings.loading')}</div>
      ) : (
        <>
          <StatusCards cfg={saved} />
          <div className="page-tabs" role="tablist" aria-label={t('appSettings.title')}>
            {TABS.map((k) => (
              <button key={k} role="tab" id={`as-tab-${k}`} aria-controls={`as-panel-${k}`} aria-selected={tab === k} onClick={() => setTab(k)}>
                {t(`appSettings.tabs.${k}`)}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`as-panel-${tab}`} aria-labelledby={`as-tab-${tab}`}>
            <Intro text={t(`appSettings.help.${tab}`)} />
            {tab === 'history' ? (
              <HistoryList items={history} me={user!.uid} canEdit={canEdit} busy={busy} onRollback={rollback} />
            ) : (
              <div className="as-layout">
                <div className="as-form">
                  {tab === 'banner' ? (
                    <BannerForm banner={draft.banner} disabled={!canEdit} onChange={(banner) => set({ banner })} />
                  ) : tab === 'update' ? (
                    <UpdateForm cfg={draft} disabled={!canEdit} onChange={set} />
                  ) : tab === 'closed' ? (
                    <ClosedForm closed={draft.closed} disabled={!canEdit} onChange={(closed) => set({ closed })} />
                  ) : tab === 'images' ? (
                    <ImagesForm images={draft.images} uid={user!.uid} disabled={!canEdit} onChange={(images) => set({ images })} />
                  ) : tab === 'contact' ? (
                    <ContactForm cfg={draft} disabled={!canEdit} onChange={set} />
                  ) : (
                    <LegalForm cfg={draft} disabled={!canEdit} onChange={set} />
                  )}
                </div>
                {tab === 'banner' || tab === 'closed' ? <PhonePreview cfg={draft} /> : null}
              </div>
            )}
          </div>

          {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

          {confirming ? (
            <div className="as-confirm" role="alertdialog" aria-labelledby="as-confirm-title">
              <strong id="as-confirm-title">{t('appSettings.confirm.title')}</strong>
              <ul>
                {confirming.map((r) => (
                  <li key={r}>{t(`appSettings.confirm.${r}`)}</li>
                ))}
              </ul>
              <div className="actions">
                <button className="btn danger" disabled={busy} onClick={() => commit(draft)}>{t('appSettings.confirm.yes')}</button>
                <button className="btn secondary" disabled={busy} onClick={() => setConfirming(null)}>{t('appSettings.cancel')}</button>
              </div>
            </div>
          ) : null}

          {canEdit && tab !== 'history' ? (
            <div className={`sort-bar${dirty ? ' dirty' : ''}`}>
              <span>{dirty ? t('appSettings.unsaved') : t('appSettings.allSaved')}</span>
              <div className="actions">
                {tab === 'banner' && draft.banner ? (
                  <button className="btn secondary" disabled={busy} onClick={() => commit({ ...draft, banner: { ...draft.banner!, onlyUid: user!.uid } }, t('appSettings.banner.onlyMeDone'))}>
                    {t('appSettings.banner.onlyMe')}
                  </button>
                ) : null}
                {dirty ? <button className="btn secondary" disabled={busy} onClick={() => setDraft(saved)}>{t('appSettings.discard')}</button> : null}
                <button className="btn" disabled={busy || !dirty} onClick={save}>{t('appSettings.save')}</button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function StatusCards({ cfg }: { cfg: AppConfig }) {
  const phase = bannerPhase(cfg.banner, new Date());
  const b = cfg.banner;
  const bannerValue =
    phase === 'yok' || phase === 'bitti'
      ? t('appSettings.status.none')
      : `${t(`appSettings.banner.kinds.${b!.kind}`)} · ${phase === 'bekliyor' ? t('appSettings.status.starts', { at: fmt(b!.startAt) }) : t('appSettings.status.live')}${b!.onlyUid ? ` · ${t('appSettings.status.onlyMe')}` : ''}`;
  const maintenance = phase === 'yayinda' && b?.kind === 'bakim' && !b.onlyUid;
  const cards: { label: string; value: string; warn: boolean }[] = [
    { label: t('appSettings.status.app'), value: maintenance ? t('appSettings.status.maintenance') : t('appSettings.status.open'), warn: maintenance },
    { label: t('appSettings.status.banner'), value: bannerValue, warn: phase === 'yayinda' || phase === 'bekliyor' },
    { label: t('appSettings.status.minVersion'), value: `iPhone ${cfg.minVersion.ios} · Android ${cfg.minVersion.android}`, warn: false },
    {
      label: t('appSettings.status.closed'),
      value: cfg.closed.length ? cfg.closed.map((s) => t(`appSettings.sections.${s}`)).join(', ') : t('appSettings.status.noneClosed'),
      warn: cfg.closed.length > 0,
    },
  ];
  return (
    <div className="stat-grid as-status">
      {cards.map((c) => (
        <div key={c.label} className="card stat">
          <span className="stat-label">
            <span className={`as-dot${c.warn ? ' warn' : ''}`} aria-hidden="true" />
            {c.label}
          </span>
          <strong>{c.value}</strong>
        </div>
      ))}
    </div>
  );
}

function Field({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <span className="meta">{hint}</span> : null}
    </div>
  );
}

function BannerForm({ banner, disabled, onChange }: { banner: AppBanner | null; disabled: boolean; onChange(b: AppBanner | null): void }) {
  const [province, setProvince] = useState('');
  const provinces = locationRepository.getProvinces();
  if (!banner) {
    return (
      <div className="card">
        <p className="meta">{t('appSettings.banner.empty')}</p>
        <div className="actions">
          <button className="btn" disabled={disabled} onClick={() => onChange(emptyBanner())}>{t('appSettings.banner.create')}</button>
        </div>
      </div>
    );
  }
  const b = banner;
  const up = (patch: Partial<AppBanner>) => onChange({ ...b, ...patch });
  const audience = b.onlyUid ? 'me' : b.provinces.length ? 'il' : 'tum';
  return (
    <div className="card form">
      <div className="field">
        <span className="stat-label">{t('appSettings.banner.kind')}</span>
        <div className="seg" role="group" aria-label={t('appSettings.banner.kind')}>
          {(['duyuru', 'bakim'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={b.kind === k} disabled={disabled} onClick={() => up({ kind: k })}>
              {t(`appSettings.banner.kinds.${k}`)}
            </button>
          ))}
        </div>
        {b.kind === 'bakim' ? <span className="meta">{t('appSettings.banner.bakimHint')}</span> : null}
      </div>
      <div className="field">
        <span className="stat-label">{t('appSettings.banner.templates')}</span>
        <div className="as-chips">
          {BANNER_TEMPLATES.map((tp) => (
            <button key={tp.id} type="button" className="as-chip" disabled={disabled} onClick={() => up({ kind: tp.kind, text: { ...tp.text } })}>
              {t(`appSettings.banner.template.${tp.id}`)}
            </button>
          ))}
        </div>
      </div>
      {LANGUAGES.map((l) => (
        <Field key={l.code} id={`as-text-${l.code}`} label={`${t('appSettings.banner.text')} (${l.nativeName})`} hint={l.code === 'tr' ? t('appSettings.banner.textHint') : undefined}>
          <textarea
            id={`as-text-${l.code}`}
            dir={l.code === 'ar' ? 'rtl' : 'ltr'}
            rows={2}
            maxLength={300}
            required={l.code === 'tr'}
            disabled={disabled}
            value={b.text[l.code]}
            onChange={(e) => up({ text: { ...b.text, [l.code]: e.target.value } })}
          />
        </Field>
      ))}
      <div className="as-row">
        <Field id="as-start" label={t('appSettings.banner.start')} hint={t('appSettings.banner.startHint')}>
          <input id="as-start" type="datetime-local" disabled={disabled} value={toLocalInput(b.startAt)} onChange={(e) => up({ startAt: fromLocalInput(e.target.value) })} />
        </Field>
        <Field id="as-end" label={t('appSettings.banner.end')} hint={t('appSettings.banner.endHint')}>
          <input id="as-end" type="datetime-local" disabled={disabled} value={toLocalInput(b.endAt)} onChange={(e) => up({ endAt: fromLocalInput(e.target.value) })} />
        </Field>
      </div>
      <div className="field">
        <span className="stat-label">{t('appSettings.banner.audience')}</span>
        <div className="seg" role="group" aria-label={t('appSettings.banner.audience')}>
          <button type="button" aria-pressed={audience === 'tum'} disabled={disabled} onClick={() => up({ provinces: [], onlyUid: null })}>{t('appSettings.banner.all')}</button>
          <button type="button" aria-pressed={audience === 'il'} disabled={disabled} onClick={() => up({ onlyUid: null })}>{t('appSettings.banner.provinces')}</button>
        </div>
        {b.onlyUid ? <span className="meta">{t('appSettings.banner.onlyMeOn')}</span> : null}
        <div className="as-chips">
          {b.provinces.map((code) => (
            <button key={code} type="button" className="as-chip" disabled={disabled} aria-label={t('appSettings.banner.removeProvince', { name: locationRepository.getProvince(code)?.name ?? code })} onClick={() => up({ provinces: b.provinces.filter((p) => p !== code) })}>
              {locationRepository.getProvince(code)?.name ?? code} ✕
            </button>
          ))}
          <select
            aria-label={t('appSettings.banner.addProvince')}
            disabled={disabled}
            value={province}
            onChange={(e) => {
              const code = e.target.value;
              setProvince('');
              if (code && !b.provinces.includes(code)) up({ provinces: [...b.provinces, code], onlyUid: null });
            }}>
            <option value="">{t('appSettings.banner.addProvince')}</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="actions">
        <button className="btn secondary" type="button" disabled={disabled} onClick={() => onChange(null)}>{t('appSettings.banner.remove')}</button>
      </div>
    </div>
  );
}

function UpdateForm({ cfg, disabled, onChange }: { cfg: AppConfig; disabled: boolean; onChange(p: Partial<AppConfig>): void }) {
  return (
    <div className="card form">
      {PLATFORMS.map((p) => (
        <fieldset key={p} className="form-section">
          <legend>{t(`appSettings.update.${p}`)}</legend>
          <div className="as-row">
            <Field id={`as-min-${p}`} label={t('appSettings.update.min')} hint={t('appSettings.update.minHint')}>
              <input id={`as-min-${p}`} inputMode="decimal" placeholder="1.0.0" disabled={disabled} value={cfg.minVersion[p]} onChange={(e) => onChange({ minVersion: { ...cfg.minVersion, [p]: e.target.value } })} />
            </Field>
            <Field id={`as-sug-${p}`} label={t('appSettings.update.suggest')} hint={t('appSettings.update.suggestHint')}>
              <input id={`as-sug-${p}`} inputMode="decimal" placeholder="1.0.0" disabled={disabled} value={cfg.suggestVersion[p]} onChange={(e) => onChange({ suggestVersion: { ...cfg.suggestVersion, [p]: e.target.value } })} />
            </Field>
          </div>
          <Field id={`as-store-${p}`} label={t('appSettings.update.store')}>
            <input id={`as-store-${p}`} type="url" placeholder="https://" disabled={disabled} value={cfg.storeUrl[p]} onChange={(e) => onChange({ storeUrl: { ...cfg.storeUrl, [p]: e.target.value } })} />
          </Field>
        </fieldset>
      ))}
      <span className="meta">{t('appSettings.update.format')}</span>
    </div>
  );
}

function ClosedForm({ closed, disabled, onChange }: { closed: AppConfig['closed']; disabled: boolean; onChange(c: AppConfig['closed']): void }) {
  return (
    <div className="card">
      {APP_SECTIONS.map((s) => {
        const on = !closed.includes(s);
        return (
          <label key={s} className="as-toggle-row">
            <span>
              <strong>{t(`appSettings.sections.${s}`)}</strong>
              <span className="meta">{on ? t('appSettings.closed.on') : t('appSettings.closed.off')}</span>
            </span>
            <input type="checkbox" role="switch" checked={on} disabled={disabled} onChange={() => onChange(on ? [...closed, s] : closed.filter((x) => x !== s))} />
          </label>
        );
      })}
      <p className="meta">{t('appSettings.closed.never')}</p>
    </div>
  );
}

/**
 * Görseller (Eren, 14 Kasım 2026: uygulamadaki bütün resimler panelden değişir). Resim depoya yüklenir, adresi bu ayara
 * yazılır; uygulama açılışta okur, resmi bir kez indirip saklar. Boş bırakılan yerde uygulamadaki hazır resim kalır.
 */
function ImagesForm({ images, uid, disabled, onChange }: { images: AppConfig['images']; uid: string; disabled: boolean; onChange(i: AppConfig['images']): void }) {
  const [busy, setBusy] = useState<AppImage | null>(null);
  const [error, setError] = useState<{ key: AppImage; text: string }>();
  const [warn, setWarn] = useState<{ key: AppImage; text: string }>();
  const changed = APP_IMAGES.filter((k) => images[k]).length;

  const pick = async (key: AppImage, file: File | undefined) => {
    if (!file) return;
    const spec = APP_IMAGE_SPECS[key];
    setError(undefined);
    setWarn(undefined);
    setBusy(key);
    try {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      bitmap.close();
      if (width < spec.minW || height < spec.minH) {
        setError({ key, text: t('appSettings.images.tooSmall', { w: width, h: height, minW: spec.minW, minH: spec.minH }) });
        return;
      }
      const photo = await uploadMedia(storage, uid, 'uygulama', await prepareImage(file));
      onChange({ ...images, [key]: photo.url });
      // En-boy oranı çok farklıysa resim kırpılır: engellemez, uyarır.
      const ratio = width / height / (spec.w / spec.h);
      if (ratio > 1.2 || ratio < 1 / 1.2) setWarn({ key, text: t('appSettings.images.ratio', { w: spec.w, h: spec.h }) });
    } catch (e) {
      setError({ key, text: e instanceof PhotoTooLargeError ? t('image.tooLarge') : t('image.error') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="as-images-wrap">
      <p className="meta">{t('appSettings.images.hint')}</p>
      <p className="meta">{t('appSettings.images.count', { n: changed, total: APP_IMAGES.length })}</p>
      {APP_IMAGE_GROUPS.map((g) => (
        <section key={g} className="as-image-group" aria-labelledby={`as-img-${g}`}>
          <h3 id={`as-img-${g}`}>{t(`appSettings.images.groups.${g}`)}</h3>
          <div className="as-images">
            {APP_IMAGES.filter((k) => APP_IMAGE_SPECS[k].group === g).map((k) => {
              const spec = APP_IMAGE_SPECS[k];
              const name = t(`appSettings.images.names.${k}`);
              const fallback = defaultImageUrl(k);
              const shown = images[k] || fallback;
              return (
                <div key={k} className="card as-image">
                  <strong>{name}</strong>
                  <div className="as-image-frame" style={{ aspectRatio: `${spec.w} / ${spec.h}` }}>
                    {shown ? <img src={shown} alt={name} loading="lazy" /> : <span className="meta">{t('appSettings.images.drawing')}</span>}
                  </div>
                  <span className={images[k] ? 'badge-pill as-pill' : 'meta'}>{t(images[k] ? 'appSettings.images.custom' : fallback ? 'appSettings.images.default' : 'appSettings.images.noDefault')}</span>
                  <span className="meta">{t('appSettings.images.size', { w: spec.w, h: spec.h, minW: spec.minW, minH: spec.minH })}</span>
                  <label className="btn secondary as-file">
                    {busy === k ? t('image.uploading') : t('appSettings.images.choose')}
                    <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`${name}: ${t('appSettings.images.choose')}`} disabled={disabled || !!busy} onChange={(e) => (pick(k, e.target.files?.[0]), (e.target.value = ''))} />
                  </label>
                  {images[k] ? (
                    <button className="btn ghost" type="button" disabled={disabled} onClick={() => onChange({ ...images, [k]: '' })}>{t(fallback ? 'appSettings.images.reset' : 'appSettings.images.resetDrawing')}</button>
                  ) : null}
                  {error?.key === k ? <span className="error" role="alert">{error.text}</span> : null}
                  {warn?.key === k ? <span className="note" role="status">{warn.text}</span> : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <p className="meta">{t('appSettings.images.notHere')}</p>
    </div>
  );
}

function ContactForm({ cfg, disabled, onChange }: { cfg: AppConfig; disabled: boolean; onChange(p: Partial<AppConfig>): void }) {
  const c = cfg.contact;
  const up = (k: keyof AppConfig['contact'], v: string) => onChange({ contact: { ...c, [k]: v } });
  return (
    <div className="card form">
      <Field id="as-mail" label={t('appSettings.contact.supportEmail')} hint={t('appSettings.contact.supportEmailHint')}>
        <input id="as-mail" type="email" disabled={disabled} value={c.supportEmail} onChange={(e) => up('supportEmail', e.target.value)} />
      </Field>
      <Field id="as-kvkk" label={t('appSettings.contact.kvkkAddress')} hint={t('appSettings.contact.kvkkHint')}>
        <textarea id="as-kvkk" rows={2} maxLength={300} disabled={disabled} value={c.kvkkAddress} onChange={(e) => up('kvkkAddress', e.target.value)} />
      </Field>
      {CONTACT_LINKS.map((k) => (
        <Field key={k} id={`as-${k}`} label={t(`appSettings.contact.${k}`)}>
          <input id={`as-${k}`} type="url" placeholder="https://" disabled={disabled} value={c[k]} onChange={(e) => up(k, e.target.value)} />
        </Field>
      ))}
      <span className="meta">{t('appSettings.contact.hint')}</span>
    </div>
  );
}

function LegalForm({ cfg, disabled, onChange }: { cfg: AppConfig; disabled: boolean; onChange(p: Partial<AppConfig>): void }) {
  return (
    <div className="card form">
      <p className="note">{t('appSettings.legal.lawyer')}</p>
      <Field id="as-legal" label={t('appSettings.legal.version')} hint={t('appSettings.legal.versionHint')}>
        <input id="as-legal" maxLength={40} pattern="[a-z0-9-]+" disabled={disabled} value={cfg.legal.version} onChange={(e) => onChange({ legal: { ...cfg.legal, version: e.target.value.toLowerCase() } })} />
      </Field>
      <label className="check">
        <input type="checkbox" disabled={disabled} checked={cfg.legal.reaccept} onChange={(e) => onChange({ legal: { ...cfg.legal, reaccept: e.target.checked } })} />
        {t('appSettings.legal.reaccept')}
      </label>
      <span className="meta">{t('appSettings.legal.reacceptHint')}</span>
    </div>
  );
}

function HistoryList({ items, me, canEdit, busy, onRollback }: { items: AppConfigHistoryEntry[]; me: string; canEdit: boolean; busy: boolean; onRollback(h: AppConfigHistoryEntry): void }) {
  if (!items.length) return <div className="state">{t('appSettings.history.empty')}</div>;
  return (
    <ul className="badge-list">
      {items.map((h) => (
        <li key={h.id} className="card badge-row">
          <div style={{ flex: 1 }}>
            <strong>{h.rollback ? t('appSettings.history.rolledBack') : h.parts.map((p) => t(`appSettings.parts.${p}`)).join(', ')}</strong>
            <p className="meta">{fmt(h.at)} · {h.actorUid === me ? t('appSettings.history.you') : h.actorUid.slice(0, 8)}</p>
          </div>
          {canEdit ? (
            <button className="btn secondary" disabled={busy} onClick={() => onRollback(h)}>{t('appSettings.history.undo')}</button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Telefonda nasıl görüneceği: duyuru bandı, bakım ekranı ve kapalı bölümler (yaklaşık; uygulamanın renkleriyle). */
function PhonePreview({ cfg }: { cfg: AppConfig }) {
  const b = cfg.banner;
  const tiles = (['myCity', 'travel', 'social', 'urgent'] as const).map((k) => ({ k, closed: k !== 'urgent' && cfg.closed.includes(k) }));
  return (
    <figure className="as-phone-wrap">
      <div className="as-phone" aria-hidden="true">
        <div className="as-phone-status"><span>10:50</span></div>
        {b?.kind === 'bakim' ? (
          <div className="as-phone-maint">
            <span className="as-phone-icon">🛠</span>
            <strong>{t('appSettings.preview.maintTitle')}</strong>
            <p>{b.text.tr || t('appSettings.preview.placeholder')}</p>
          </div>
        ) : (
          <>
            {b ? <div className="as-phone-band">📣 {b.text.tr || t('appSettings.preview.placeholder')}</div> : null}
            <div className="as-phone-hero">
              <small>{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</small>
              <strong>{t('appSettings.preview.hello')}</strong>
            </div>
            <div className="as-phone-tiles">
              {tiles.map(({ k, closed }) => (
                <div key={k} className={`as-phone-tile${closed ? ' closed' : ''}`}>
                  <span>{t(`appSettings.sections.${k}`)}</span>
                  {closed ? <small>{t('appSettings.preview.closed')}</small> : null}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="as-phone-nav">
          <span>{t('appSettings.preview.home')}</span>
          <span className={cfg.closed.includes('explore') ? 'off' : undefined}>{t('appSettings.sections.explore')}</span>
          <span>{t('appSettings.preview.search')}</span>
          <span>{t('appSettings.preview.profile')}</span>
        </div>
      </div>
      <figcaption className="meta">{t('appSettings.preview.caption')}</figcaption>
    </figure>
  );
}
