import {
  dayKey,
  isGrantActive,
  isMemberActive,
  isOrganizationActive,
  mayorProfileId,
  scopeKey,
  AGE_BANDS,
  type OfficialStats,
  type Organization,
} from '@cityjoy/shared';

import { locationRepository } from './locations';
import type { PanelUser } from './session';

/** Kitle istatistiği görülebilen resmî profil. */
export interface AudienceTarget {
  /** officialStats belge kimliği: kurum, "baskan-{kurum}" ya da "mahalle-...". */
  id: string;
  kind: 'kurum' | 'baskan' | 'muhtar';
  /** Kurumun adı (başkanda da belediyenin adı); muhtarlıkta mahalle kimliği. */
  name: string;
  /** "İl içi / dışı" ayrımı için ev ili; ülke geneli kurumda yok. */
  provinceCode?: string;
  /** Başkan kartı için belediyenin kimliği. */
  orgId?: string;
}

const homeOf = (org: Organization) => (org.scope.level === 'ulke' ? undefined : org.scope.provinceCode);

/**
 * Kişinin istatistiğini görebildiği profiller (asıl denetim veritabanı kurallarında): kurum yöneticisi ya da
 * "Kitle istatistikleri" görevi olan personel kurumunu, "Belediye başkanı" görevi olan personel başkanı, muhtar
 * mahallesini görür. Admin kurumları ayrıca listeden seçer; başkan istatistiği admin'e açık değildir.
 */
export function audienceTargetsFor(user: PanelUser, now = new Date()): AudienceTarget[] {
  const out: AudienceTarget[] = [];
  for (const { org, member } of user.memberships) {
    if (!isMemberActive(member, now) || !isOrganizationActive(org, now)) continue;
    const base = { name: org.name, provinceCode: homeOf(org), orgId: org.id };
    if (org.modules.includes('istatistik') && (member.isOrgAdmin || member.assignments.istatistik?.includes('goruntule'))) {
      out.push({ id: org.id, kind: 'kurum', ...base });
    }
    if (org.id.startsWith('bld-') && org.modules.includes('baskan') && member.assignments.baskan?.includes('goruntule')) {
      out.push({ id: mayorProfileId(org.id), kind: 'baskan', ...base });
    }
  }
  for (const g of user.grants) {
    if (g.orgId || g.role !== 'muhtar' || g.scope.level !== 'mahalle' || !isGrantActive(g, now)) continue;
    out.push({ id: scopeKey(g.scope), kind: 'muhtar', name: g.scope.neighbourhoodId, provinceCode: g.scope.provinceCode });
  }
  return out;
}

export const canSeeAudience = (user: PanelUser, admin: boolean) => admin || audienceTargetsFor(user).length > 0;

/** Bir başkanın istatistiğini bu kişi görebilir mi (başkan kartındaki düğme için). */
export const canSeeMayor = (user: PanelUser, orgId: string) => audienceTargetsFor(user).some((x) => x.id === mayorProfileId(orgId));

// ---- Örnek hesaplar için örnek veri (veritabanı okunmaz) ----

function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Örnek hesaplarda sayfanın nasıl görüneceğini göstermek için uydurma ama tutarlı sayılar (ekranda "Örnek veri"
 * yazar). Ev ilinin ilçelerine ve ilk birkaç ilçenin mahallelerine dağıtılır.
 */
export async function sampleStats(target: AudienceTarget, now = new Date()): Promise<OfficialStats> {
  const rnd = seeded(target.id);
  const home = target.provinceCode ?? '16';
  const s: OfficialStats = { total: 0, unfollows: 0, p: {}, d: {}, n: {}, a: {}, f: {}, u: {} };
  const add = (m: Record<string, number>, k: string, v: number) => (m[k] = (m[k] ?? 0) + v);
  // Kurumun kendi ilçesi ve merkez ilçeler önde (örnek dağılım gerçeğe benzesin).
  const own = target.orgId?.replace(/^bld-/, '') ?? '';
  const big = new Set([own, `${home}-osmangazi`, `${home}-nilufer`, `${home}-yildirim`, `${home}-merkez`]);
  const districts = locationRepository.getDistricts(home);
  const weights = districts.map((d) => (d.id === own ? 14 : big.has(d.id) ? 5 : 1) * (0.4 + rnd()));
  const order = districts.map((d, i) => [d, weights[i]] as const).sort((a, b) => b[1] - a[1]).map(([d]) => d.id).slice(0, 4);
  const scale = target.kind === 'baskan' ? 9 : 5;
  for (const [i, d] of districts.entries()) {
    const v = Math.round(weights[i] * scale * 40 * (0.6 + rnd()));
    add(s.d, d.id, v);
    add(s.p, home, v);
    if (order.includes(d.id)) {
      const hoods = await locationRepository.getNeighbourhoods(d.id).catch(() => []);
      let left = Math.round(v * 0.85);
      for (const n of hoods.slice(0, 24)) {
        const c = Math.min(left, Math.round(left * (0.08 + rnd() * 0.25)));
        if (c <= 0) break;
        add(s.n, n.id, c);
        left -= c;
      }
    }
  }
  for (const code of ['34', '06', '35', '41', '10', '26', '11', '77', '07', '01'].filter((c) => c !== home)) {
    add(s.p, code, Math.round(rnd() * 120 * (code === '34' ? 4 : 1)));
  }
  const located = Object.values(s.p).reduce((a, b) => a + b, 0);
  s.total = Math.round(located * 1.06);
  const shares = [0.17, 0.31, 0.24, 0.16, 0.12];
  AGE_BANDS.forEach((b, i) => (s.a[b] = Math.round(s.total * shares[i] * (0.85 + rnd() * 0.3))));
  for (let i = 0; i < 120; i++) {
    const k = dayKey(new Date(now.getTime() - i * 86400000));
    s.f[k] = Math.round((scale * 6 + rnd() * scale * 8) * (i < 14 ? 1.3 : 1));
    s.u[k] = Math.round(rnd() * scale * 2);
    s.unfollows += s.u[k];
  }
  return s;
}
