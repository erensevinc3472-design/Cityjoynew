import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { activeBanner, LANGUAGES, type AppConfig } from '@cityjoy/shared';
import { APP_CONTENT_KINDS, countAppContent, createAppConfigAdmin, type AppContentKind } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { recordIdOf, screenFor, sectionFor } from '../lib/app-screens';
import { useCity } from '../lib/city';
import { locationRepository } from '../lib/locations';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';
import { Intro } from '../components/intro';

const THEMES = ['system', 'light', 'dark'] as const;
type Theme = (typeof THEMES)[number];
const DEFAULT_PROVINCE = '16';
const NOT_READY_MS = 20_000;

/** Panelin "Uygulamada gör" bağlantısı: uygulamadaki ekranın adresiyle bu sayfayı açar. */
export function appViewHref(appPath: string): string {
  return `/uygulama-gorunumu?yol=${encodeURIComponent(appPath)}`;
}

/**
 * Uygulama görünümü (Eren onayladı, 14 Kasım 2026): uygulamanın web derlemesi telefon çerçevesinde, ana sayfadan başlar.
 * "Şu il gibi göster" seçimi kimsenin konumunu değiştirmez. Açık ekrana göre yanda ilgili panel sayfaları, içerik
 * durumu ve hızlı ayarlar çıkar. Önizlemedeki uygulama yalnızca okur, kayıt yapmaz (apps/mobile/src/lib/preview.ts).
 */
export function AppViewPage() {
  const { user } = useSession();
  const admin = !!user && isAdminUser(user);
  const canEdit = admin && !user.isDemo;
  const { provinceCode: panelProvince } = useCity();
  const [params] = useSearchParams();
  const start = (() => {
    const y = params.get('yol');
    return y && y.startsWith('/') && !y.startsWith('//') ? y : '/home';
  })();
  const provinces = useMemo(() => locationRepository.getProvinces(), []);
  const [il, setIl] = useState(() => panelProvince || DEFAULT_PROVINCE);
  const [ilce, setIlce] = useState('');
  const districts = useMemo(() => locationRepository.getDistricts(il), [il]);
  const [theme, setTheme] = useState<Theme>('system');
  const [language, setLanguage] = useState('tr');
  const [src, setSrc] = useState(() => `/uygulama${start}?il=${encodeURIComponent(il)}`);
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [pathname, setPathname] = useState(start);

  const api = useMemo(() => createAppConfigAdmin(firestore), []);
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [counts, setCounts] = useState<Record<AppContentKind, number | null> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();

  const post = (m: object) => frame.current?.contentWindow?.postMessage(m, window.location.origin);

  // Önizlemedeki uygulamadan gelen mesajlar (yalnızca bu sayfadaki çerçeveden ve aynı adresten).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const m = e.data as { type?: string; pathname?: string };
      if (m?.type === 'cj-ready') setReady(true);
      if (m?.type === 'cj-route' && typeof m.pathname === 'string') setPathname(m.pathname);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Çerçeve uzun süre açılmazsa (önizleme derlemesi yoksa) uyarı.
  useEffect(() => {
    setReady(false);
    setNotReady(false);
  }, [src]);
  useEffect(() => {
    if (ready) return;
    const id = setTimeout(() => setNotReady(true), NOT_READY_MS);
    return () => clearTimeout(id);
  }, [ready, src]);

  useEffect(() => {
    if (ready) post({ type: 'cj-view-as', provinceCode: il, districtId: ilce || undefined });
  }, [ready, il, ilce]);
  useEffect(() => {
    if (ready) post({ type: 'cj-settings', theme, language });
  }, [ready, theme, language]);

  useEffect(() => {
    if (!admin) return;
    api.get().then(setCfg).catch(() => setCfg(null));
  }, [admin, api]);
  useEffect(() => {
    if (!admin) return;
    setCounts(null);
    countAppContent(firestore, il).then(setCounts);
  }, [admin, il]);

  if (!admin) return <section className="page"><p className="note">{t('appView.adminOnly')}</p></section>;

  const screen = screenFor(pathname);
  const section = sectionFor(pathname);
  const recordId = screen.record ? recordIdOf(pathname) : null;
  const closed = !!section && !!cfg?.closed.includes(section);
  const banner = cfg ? activeBanner(cfg, { now: new Date(), provinceCode: il }) : null;
  const provinceName = locationRepository.getProvince(il)?.name ?? il;
  const label = (key: string) => (key.startsWith('appView.') ? t(key) : t(`menu.items.${key}`));

  const reloadApp = (path = pathname) => setSrc(`/uygulama${path}?il=${encodeURIComponent(il)}${ilce ? `&ilce=${encodeURIComponent(ilce)}` : ''}&r=${Date.now()}`);

  const toggleSection = async () => {
    if (!user || !cfg || !section || !canEdit) return;
    if (!closed && !window.confirm(t('appView.confirmClose', { section: t(`appSettings.sections.${section}`) }))) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const next = { ...cfg, closed: closed ? cfg.closed.filter((s) => s !== section) : [...cfg.closed, section] };
      setCfg(await api.save(user.uid, next));
      setMessage({ kind: 'ok', text: t('appView.saved') });
      // Uygulama ayarı açılışta okur: yeni hâli görmek için önizleme yeniden açılır.
      reloadApp();
    } catch {
      setMessage({ kind: 'error', text: t('appView.saveError') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('appView.title')}</h1>
          <Intro text={t('appView.intro')} />
        </div>
      </header>

      <div className="toolbar av-toolbar">
        <label>
          <span>{t('appView.viewAs')}</span>
          <select value={il} onChange={(e) => (setIl(e.target.value), setIlce(''))}>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('appView.district')}</span>
          <select value={ilce} onChange={(e) => setIlce(e.target.value)}>
            <option value="">{t('appView.allDistricts')}</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('appView.theme')}</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
            {THEMES.map((k) => (
              <option key={k} value={k}>{t(`appView.themes.${k}`)}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('appView.language')}</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.nativeName}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn secondary" onClick={() => (ready ? post({ type: 'cj-nav', href: '/home' }) : reloadApp('/home'))}>
          {t('appView.home')}
        </button>
        <button type="button" className="btn ghost" onClick={() => reloadApp()}>{t('appView.reload')}</button>
      </div>

      <div className="av-layout">
        <figure className="av-phone-wrap">
          <div className="av-phone">
            <span className="av-tag">{t('appView.tag')}</span>
            <iframe ref={frame} key={src} src={src} title={t('appView.frameTitle')} className="av-frame" />
          </div>
          <figcaption className="meta">{t('appView.readOnly')}</figcaption>
          {notReady && !ready ? <p className="note" role="status">{t('appView.notReady')}</p> : null}
        </figure>

        <aside className="av-side" aria-live="polite">
          <div className="card">
            <p className="meta av-path">{pathname}</p>
            <h2>{t(`appView.screens.${screen.screen}`)}</h2>
            {section ? (
              <p className={closed ? 'error' : 'meta'}>
                {t(closed ? 'appView.sectionClosed' : 'appView.sectionOpen', { section: t(`appSettings.sections.${section}`) })}
              </p>
            ) : null}
          </div>

          {screen.counts.length ? (
            <div className="card">
              <h3>{t('appView.countsTitle', { province: provinceName })}</h3>
              <ul className="av-counts">
                {APP_CONTENT_KINDS.filter((k) => screen.counts.includes(k)).map((k) => {
                  const n = counts?.[k];
                  return (
                    <li key={k} className={n === 0 ? 'warn' : undefined}>
                      <span>{t(`appView.kinds.${k}`)}</span>
                      <strong>{counts === null ? '…' : n === null ? '—' : n}</strong>
                      {n === 0 ? <small>{t('appView.empty')}</small> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {screen.record ? (
            <div className="card">
              <h3>{t('appView.recordTitle')}</h3>
              {recordId ? <p className="meta">{t('appView.recordId')}: <code>{recordId}</code></p> : null}
              <Link className="btn secondary" to={screen.record.path}>{t('appView.recordOpen', { page: label(screen.record.label) })}</Link>
            </div>
          ) : null}

          <div className="card">
            <h3>{t('appView.related')}</h3>
            <ul className="av-links">
              {screen.links.map((l) => (
                <li key={l.path}>
                  <Link to={l.path}>{label(l.label)}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3>{t('appView.quick')}</h3>
            {section ? (
              <button type="button" className={closed ? 'btn' : 'btn secondary'} disabled={!canEdit || busy || !cfg} onClick={toggleSection}>
                {t(closed ? 'appView.openSection' : 'appView.closeSection', { section: t(`appSettings.sections.${section}`) })}
              </button>
            ) : null}
            <p className="meta">{banner ? t('appView.bannerActive', { kind: t(`appView.bannerKinds.${banner.kind}`) }) : t('appView.bannerNone')}</p>
            <Link className="btn ghost" to="/uygulama-ayarlari?sekme=banner">{t(banner ? 'appView.bannerEdit' : 'appView.bannerAdd')}</Link>
            {user.isDemo ? <p className="note">{t('appView.demoReadOnly')}</p> : null}
            {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
          </div>

          <details className="card av-limits">
            <summary>{t('appView.limitsTitle')}</summary>
            <ul>
              {(['notifications', 'sos', 'camera', 'location', 'save'] as const).map((k) => (
                <li key={k}>{t(`appView.limits.${k}`)}</li>
              ))}
            </ul>
          </details>
        </aside>
      </div>
    </section>
  );
}
