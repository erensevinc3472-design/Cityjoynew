import { createLocationRepository, fakePharmacyProvider, normalizePharmacy, turkeyDate, type DutyPharmacy, type PharmacyProvider } from '@cityjoy/shared';
import type { Firestore } from 'firebase-admin/firestore';

/** İl ve ilçe listesi (gömülü; mahalle gerekmez). */
const locations = createLocationRepository({ neighbourhoodsBaseUrl: '', dataVersion: 'x', cache: { get: async () => null, set: async () => {} } });

/** NosyAPI'nin il adresi için Türkçe harfsiz küçük ad ("Şanlıurfa" > "sanliurfa"). */
export const citySlug = (name: string) =>
  name.toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]/g, '');

/**
 * NosyAPI bağdaştırıcısı. Adres ve yanıt biçimi anahtar gelince doğrulanacak; adres `PHARMACY_API_URL` ile değiştirilebilir
 * ({city} il adıyla değişir). Yanıtta `data` dizisi beklenir; alan adları `normalizePharmacy` ile çevrilir.
 */
export function nosyProvider(apiKey: string, fetchImpl: typeof fetch = fetch): PharmacyProvider {
  const template = process.env.PHARMACY_API_URL || 'https://www.nosyapi.com/apiv2/service/pharmacies-on-duty?city={city}';
  return {
    id: 'nosyapi',
    async fetchProvince({ name }) {
      const res = await fetchImpl(template.replace('{city}', encodeURIComponent(citySlug(name))), { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`servis ${res.status}`);
      const body = (await res.json()) as { data?: unknown };
      if (!Array.isArray(body.data)) throw new Error('beklenmeyen yanıt');
      return body.data.map((r) => normalizePharmacy(r as Record<string, unknown>)).filter((p): p is DutyPharmacy => !!p);
    },
  };
}

/** Ortam ayarına göre servis: PHARMACY_PROVIDER=nosy (+ PHARMACY_API_KEY) ya da sahte (emülatör); yoksa çekim yapılmaz. */
export function providerFromEnv(): PharmacyProvider | null {
  if (process.env.PHARMACY_PROVIDER === 'nosy' && process.env.PHARMACY_API_KEY) return nosyProvider(process.env.PHARMACY_API_KEY);
  if (process.env.PHARMACY_PROVIDER === 'sahte') return fakePharmacyProvider((code) => locations.getDistricts(code));
  return null;
}

export interface SyncResult {
  ok: string[];
  failed: { code: string; error: string }[];
}

/**
 * İllerin nöbetçi eczanelerini çeker ve `dutyPharmacies/{il}` belgesine yazar; aynı gün yeniden çekilirse o günün
 * gizlemeleri korunur. `onlyStale`: yalnızca bugünün listesi olmayan iller (10.00'daki ikinci deneme). Her ilin
 * sonucu panel için `dataSourceStatus/pharmacy` belgesine, çalışma özeti `dataSourceRuns`'a yazılır.
 */
export async function syncPharmacies(
  db: Firestore,
  provider: PharmacyProvider,
  opts: { now: Date; provinces?: string[]; onlyStale?: boolean; by?: string },
): Promise<SyncResult> {
  const today = turkeyDate(opts.now);
  const all = locations.getProvinces().filter((p) => !opts.provinces || opts.provinces.includes(p.code));
  const result: SyncResult = { ok: [], failed: [] };
  const status: Record<string, unknown> = {};
  for (const p of all) {
    const ref = db.doc(`dutyPharmacies/${p.code}`);
    const prev = (await ref.get()).data();
    if (opts.onlyStale && prev?.date === today) continue;
    try {
      const items = await provider.fetchProvince({ code: p.code, name: p.name });
      await ref.set({ date: today, fetchedAt: opts.now, source: provider.id, items, hidden: prev?.date === today ? (prev.hidden ?? []) : [], ...(prev?.hours ? { hours: prev.hours } : {}) });
      result.ok.push(p.code);
      status[p.code] = { date: today, count: items.length, at: opts.now };
    } catch (e) {
      const error = String((e as Error).message ?? e).slice(0, 200);
      result.failed.push({ code: p.code, error });
      status[p.code] = { date: prev?.date ?? null, count: prev?.items?.length ?? 0, at: opts.now, error };
    }
  }
  await db.doc('dataSourceStatus/pharmacy').set({ provinces: status, source: provider.id, updatedAt: opts.now }, { merge: true });
  await db.collection('dataSourceRuns').add({
    kind: 'eczane', at: opts.now, source: provider.id, ok: result.ok.length, failed: result.failed.length,
    errors: result.failed.slice(0, 20), ...(opts.by ? { by: opts.by } : { by: 'zamanlayici' }),
  });
  return result;
}
