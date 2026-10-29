import { useCallback, useEffect, useMemo, useState } from 'react';
import { ROADSIDE_FEATURE_IDS, ROADSIDE_KINDS, ROADSIDE_PACK_MAX, packByCell, TURKEY_BOUNDS, type PackedPlace } from '@cityjoy/shared';
import { createRoadsidePackAdmin, type RoadsidePackSummary } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';

type Msg = { kind: 'ok' | 'error'; text: string } | undefined;
type Loaded = { name: string; createdAt?: string; places: PackedPlace[]; skipped: number };

const KIND_IDS = ROADSIDE_KINDS.map((k) => k.id) as string[];

/** Dosyadaki yerleri denetler: biçimi bozuk ya da Türkiye dışındaki kayıt atılır (sayısı gösterilir). */
function parseFile(text: string): { places: PackedPlace[]; skipped: number; createdAt?: string } {
  const data = JSON.parse(text) as { places?: unknown[]; createdAt?: string };
  if (!Array.isArray(data.places)) throw new Error('format');
  const ok = (p: Record<string, unknown>) =>
    typeof p.i === 'string' && p.i.length <= 20 &&
    typeof p.n === 'string' && p.n.length <= 80 &&
    typeof p.k === 'string' && KIND_IDS.includes(p.k) &&
    typeof p.a === 'number' && p.a >= TURKEY_BOUNDS.lat[0] && p.a <= TURKEY_BOUNDS.lat[1] &&
    typeof p.o === 'number' && p.o >= TURKEY_BOUNDS.lng[0] && p.o <= TURKEY_BOUNDS.lng[1] &&
    Array.isArray(p.f) && p.f.every((x) => (ROADSIDE_FEATURE_IDS as string[]).includes(x as string)) &&
    (p.b === undefined || (typeof p.b === 'string' && p.b.length <= 40));
  const places: PackedPlace[] = [];
  for (const raw of data.places) {
    const p = raw as Record<string, unknown>;
    if (p && typeof p === 'object' && ok(p)) places.push({ i: p.i as string, n: p.n as string, k: p.k as PackedPlace['k'], a: p.a as number, o: p.o as number, f: p.f as PackedPlace['f'], ...(p.b ? { b: p.b as string } : {}) });
  }
  return { places, skipped: data.places.length - places.length, createdAt: data.createdAt };
}

/**
 * Panel > Şehir rehberi > Yol üstü verisi (yalnızca admin; Yol Arkadaşı / Yoldayım). OpenStreetMap'ten hazırlanan
 * Türkiye dosyası (scripts/osm-roadside.ts) yüklenir: akaryakıt istasyonları, şarj noktaları, dinlenme tesisleri.
 * Uygulamada "OSM kaydı, doğrulanmadı" diye görünür; aynı yerde kayıtlı işletme varsa o gösterilir. İşlem kayda geçer.
 */
export function RoadsidePage() {
  const { user } = useSession();
  const admin = isAdminUser(user);
  const service = useMemo(() => (user && admin && !user.isDemo ? createRoadsidePackAdmin(firestore, user.uid) : null), [user, admin]);
  const [summary, setSummary] = useState<RoadsidePackSummary[] | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [message, setMessage] = useState<Msg>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!service) return setSummary([]);
    try {
      setSummary(await service.summary());
    } catch {
      setSummary([]);
      setMessage({ kind: 'error', text: t('roadside.loadError') });
    }
  }, [service]);

  useEffect(() => {
    load();
  }, [load]);

  const pick = async (file: File | undefined) => {
    setMessage(undefined);
    setLoaded(null);
    if (!file) return;
    try {
      const r = parseFile(await file.text());
      if (!r.places.length) return setMessage({ kind: 'error', text: t('roadside.emptyFile') });
      setLoaded({ name: file.name, ...r });
    } catch {
      setMessage({ kind: 'error', text: t('roadside.badFile') });
    }
  };

  const cells = loaded ? packByCell(loaded.places) : null;
  const biggest = cells ? Math.max(...[...cells.values()].map((c) => c.length)) : 0;
  const kindCounts = loaded ? ROADSIDE_KINDS.map((k) => [k.id, loaded.places.filter((p) => p.k === k.id).length] as const) : [];
  const total = summary?.reduce((n, s) => n + s.count, 0) ?? 0;
  const last = summary?.map((s) => s.updatedAt ?? '').sort().pop();

  const upload = async () => {
    if (!service || !loaded) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const r = await service.replaceAll(loaded.places);
      setMessage({ kind: 'ok', text: t('roadside.uploaded', { places: r.places, cells: r.cells }) });
      setLoaded(null);
      await load();
    } catch {
      setMessage({ kind: 'error', text: t('roadside.uploadError') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('roadside.title')}</h1>
          <p className="meta">{t('roadside.intro')}</p>
        </div>
      </header>
      {!admin ? <p className="note">{t('roadside.adminOnly')}</p> : user?.isDemo ? <p className="note">{t('roadside.demo')}</p> : null}
      <p className="note">{t('roadside.howTo')}</p>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      <div className="form-section">
        <h2>{t('roadside.current')}</h2>
        {summary === null ? (
          <p aria-live="polite">{t('roadside.loading')}</p>
        ) : summary.length === 0 ? (
          <p className="meta">{t('roadside.none')}</p>
        ) : (
          <p>{t('roadside.currentText', { places: total, cells: summary.length, date: last ? new Date(last).toLocaleDateString('tr') : '–' })}</p>
        )}
      </div>

      {service ? (
        <div className="form-section">
          <h2>{t('roadside.uploadTitle')}</h2>
          <label className="btn secondary">
            {t('roadside.pick')}
            <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {loaded && cells ? (
            <>
              <p>
                <strong>{loaded.name}</strong>
                {loaded.createdAt ? ` · ${loaded.createdAt}` : ''}
              </p>
              <ul>
                {kindCounts.map(([k, n]) => (n ? <li key={k}>{t(`businesses.kinds.${k}`)}: {n}</li> : null))}
              </ul>
              <p className="meta">{t('roadside.preview', { places: loaded.places.length, cells: cells.size, biggest })}</p>
              {loaded.skipped ? <p className="meta">{t('roadside.skipped', { count: loaded.skipped })}</p> : null}
              {biggest > ROADSIDE_PACK_MAX ? (
                <p className="error" role="alert">{t('roadside.tooBig', { max: ROADSIDE_PACK_MAX })}</p>
              ) : (
                <>
                  <p className="note">{t('roadside.replaceNote')}</p>
                  <button className="btn" onClick={upload} disabled={busy}>{busy ? t('roadside.uploading') : t('roadside.upload')}</button>
                </>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
