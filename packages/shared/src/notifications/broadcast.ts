import { regionWithin, type AnnouncementRegion, type Publisher } from '../announcements/announcements';
import { isMemberActive, isOrganizationActive } from '../organizations/staff';
import type { Organization, OrganizationMember } from '../organizations/types';
import { isGrantActive } from '../permissions/can';
import { scopeKey } from '../permissions/grants';
import type { PermissionGrant } from '../permissions/types';

/**
 * Bölgeye toplu bildirim (PROJE.md 7, 6.2 madde 9). Panelden il / ilçe / mahalledeki kişilerin telefonuna bildirim:
 * kurum (Bildirimler bölümünde "Bildirim gönder" görevi olan personel), muhtar ve il yöneticisi kendi bölgesine,
 * admin her yere. Gönderen kişilerin kim olduğunu görmez, yalnızca yaklaşık kaç kişiye ulaşacağını görür.
 * İl geneli bildirim, admin dışında gönderilirse önce admin onayına gider (Eren onayladı, 6.5). Yaş, cinsiyet ve
 * ilgi alanı hedeflemesi ayrı açık rıza ister, sonra gelecek. Kampanya türü (işletme tanıtımı) bu sürümde yok.
 */
export const BROADCAST_KINDS = ['duyuru', 'acil'] as const;
export type BroadcastKind = (typeof BROADCAST_KINDS)[number];

/** Telefon bildiriminde görünen kısa metinler (uzun yazı kesilir; tam metin uygulamada açılır). */
export const BROADCAST_LIMITS = { title: [3, 65], body: [10, 300], reviewNote: [5, 300] } as const;
/** Bir hesap (kurum ya da kişi yetkisi) Türkiye günü içinde en çok bu kadar toplu bildirim gönderir (admin hariç). */
export const BROADCAST_DAILY_LIMIT = 3;
/** Bu sayıdan az kişiye ulaşacaksa sayı gösterilmez ("50'den az"): küçük grupta kimse tanınmasın. */
export const BROADCAST_MIN_SHOWN = 50;
/** Admin'in yayınlayan hesabı. */
export const CITYJOY_PUBLISHER = 'cityjoy';

export type BroadcastStatus = 'onay-bekliyor' | 'gonderildi' | 'reddedildi';

export type BroadcastAuthor = Publisher['author'] | { type: 'cityjoy' };

export interface BroadcastInput {
  /** Yayınlayan hesap: kurum kimliği, yetki anahtarı ya da "cityjoy" (admin). */
  publisherKey: string;
  kind: BroadcastKind;
  title: string;
  body: string;
  region: AnnouncementRegion;
}

export interface Broadcast extends Omit<BroadcastInput, 'publisherKey'> {
  id: string;
  publisherKey: string;
  author: BroadcastAuthor;
  /** Bildirimde görünen gönderen adı (kurum adı; kişide "Muhtarlık" / "CityJoy"). */
  sourceName: string;
  status: BroadcastStatus;
  preparedBy: string;
  createdAt: string;
  sentAt?: string;
  /** Telefonuna bildirim giden kişi sayısı (yaklaşık; telefonu kayıtlı olmayanlar ve bildirimi kapatanlar hariç). */
  sentCount?: number;
  reviewedBy?: string;
  reviewNote?: string;
}

export type BroadcastError = 'title' | 'body' | 'region' | 'kind';

/** Bölgenin biçimi: il kodu, ilçe ilin, mahalle ilçenin içinde. */
export function regionShapeOk(r: AnnouncementRegion | undefined): r is AnnouncementRegion {
  if (!r || typeof r.provinceCode !== 'string' || !/^[0-8][0-9]$/.test(r.provinceCode)) return false;
  if (r.districtId !== undefined && (typeof r.districtId !== 'string' || !r.districtId.startsWith(`${r.provinceCode}-`))) return false;
  if (r.neighbourhoodId !== undefined && (typeof r.neighbourhoodId !== 'string' || !r.districtId || !r.neighbourhoodId.startsWith(`${r.districtId}-`))) return false;
  return true;
}

export function validateBroadcast(b: BroadcastInput): BroadcastError[] {
  const errors: BroadcastError[] = [];
  const len = (s: unknown) => (typeof s === 'string' ? s.trim().length : -1);
  const within = (n: number, [min, max]: readonly [number, number]) => n >= min && n <= max;
  if (!within(len(b.title), BROADCAST_LIMITS.title)) errors.push('title');
  if (!within(len(b.body), BROADCAST_LIMITS.body)) errors.push('body');
  if (!BROADCAST_KINDS.includes(b.kind)) errors.push('kind');
  if (!regionShapeOk(b.region)) errors.push('region');
  return errors;
}

/** İl geneli (ilçe seçilmemiş) bildirim admin dışında gönderilince önce admin onayına gider. */
export const broadcastNeedsApproval = (region: AnnouncementRegion, isAdmin: boolean) => !isAdmin && !region.districtId;

/** Ulaşılacak kişi sayısı panelde böyle görünür: küçük gruplarda sayı yerine "50'den az". */
export const reachShown = (count: number): number | null => (count < BROADCAST_MIN_SHOWN ? null : count);

/**
 * Kişinin toplu bildirim gönderebildiği hesaplar (panelde "hangi hesapla?"): Bildirimler bölümünde "Bildirim gönder"
 * görevi olan kurum ve kişi yetkileri; admin için "CityJoy" (ülke geneli). Asıl denetim sunucuda aynı mantıkla.
 */
export function broadcastersFor(
  grants: readonly PermissionGrant[],
  memberships: readonly { org: Organization; member: OrganizationMember }[],
  isAdmin: boolean,
  now = new Date(),
): Publisher[] {
  const out: Publisher[] = [];
  for (const { org, member } of memberships) {
    if (!isOrganizationActive(org, now) || !isMemberActive(member, now) || !org.modules.includes('bildirimler')) continue;
    const actions = member.assignments.bildirimler ?? [];
    if (actions.includes('bildirim-gonder')) out.push({ key: org.id, author: { type: 'kurum', orgId: org.id, name: org.name }, scope: org.scope, actions });
  }
  for (const g of grants) {
    if (g.orgId || (g.role !== 'muhtar' && g.role !== 'il-yoneticisi') || !isGrantActive(g, now)) continue;
    const actions = g.modules.bildirimler ?? [];
    if (actions.includes('bildirim-gonder')) {
      const key = scopeKey(g.scope);
      out.push({ key, author: { type: 'kisi', role: g.role, grantKey: key }, scope: g.scope, actions });
    }
  }
  if (isAdmin) out.unshift({ key: CITYJOY_PUBLISHER, author: { type: 'kisi', role: 'il-yoneticisi', grantKey: CITYJOY_PUBLISHER }, scope: { level: 'ulke' }, actions: ['bildirim-gonder'] });
  return out;
}

/** Bölge, hesabın bölgesinin içinde mi? */
export const broadcastRegionOk = (p: Pick<Publisher, 'scope'>, region: AnnouncementRegion) => regionWithin(region, p.scope);
