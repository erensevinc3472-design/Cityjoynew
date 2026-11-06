import type { ContentKind, ContentPerformance } from '@cityjoy/shared';

import type { Loaded } from '../pages/content-stats-page';

function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const TITLES: [ContentKind, string][] = [
  ['duyuru', 'Su kesintisi: Alipaşa ve Yıldırım mahalleleri'],
  ['haber', 'Kent parkında yenileme çalışmaları tamamlandı'],
  ['etkinlik', 'Hafta sonu çocuk tiyatrosu'],
  ['duyuru', 'Pazar yeri bu hafta cumartesi kurulacak'],
  ['haber', 'Yeni kreş başvuruları başladı'],
  ['acil', 'Yoğun kar nedeniyle yol kapanması'],
  ['etkinlik', 'Kitap fuarı açılışı'],
  ['duyuru', 'Asfalt çalışması: Atatürk Caddesi'],
  ['haber', 'Mahalle bisiklet yolu ihalesi sonuçlandı'],
  ['duyuru', 'Vergi ödemelerinde son gün hatırlatması'],
  ['etkinlik', 'Gençlik konseri'],
  ['haber', 'Sosyal market yardımları genişledi'],
];

/**
 * Örnek hesaplarda sayfanın nasıl görüneceğini göstermek için uydurma ama tutarlı sayılar (ekranda "Örnek veri"
 * yazar). Haberler akşam, duyurular sabah yayınlanır; akşam haberleri daha çok okunur (öneriler görünsün).
 */
export function sampleContent(seed: string, days: number, labels: string[], now = new Date()): Loaded {
  const rnd = seeded(`${seed}-${days}`);
  const n = Math.min(TITLES.length, Math.max(3, Math.round(days / 3)));
  const rows: ContentPerformance[] = TITLES.slice(0, n).map(([kind, title], i) => {
    const at = new Date(now.getTime() - (i + 0.3) * (days / n) * 86400000);
    at.setUTCHours(kind === 'haber' ? 16 : kind === 'etkinlik' ? 9 : 5, Math.floor(rnd() * 60));
    const base = kind === 'acil' ? 2400 : kind === 'haber' ? 1700 : kind === 'etkinlik' ? 900 : 600;
    const reads = Math.round(base * (0.6 + rnd() * 0.8));
    return {
      id: `ornek-${i}`, kind, title, publishedAt: at.toISOString(), reads,
      shares: Math.round(reads * (kind === 'etkinlik' ? 0.06 : 0.025) * (0.5 + rnd())),
      ...(kind === 'etkinlik' ? { attendees: Math.round(reads * 0.12 * (0.5 + rnd())) } : {}),
    };
  });
  const total = rows.reduce((a, r) => a + r.reads, 0);
  const chart = labels.map((label) => ({ label, value: Math.round((total / labels.length) * (0.5 + rnd())) }));
  return { rows, reads: total, readsBefore: Math.round(total * (0.75 + rnd() * 0.3)), followers: 5200, chart };
}
