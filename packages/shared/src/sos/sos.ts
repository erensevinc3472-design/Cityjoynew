import { translations } from '../i18n/resources';
import type { LanguageCode } from '../i18n/languages';

/**
 * SOS - Aileme haber ver (PROJE.md 5.4). Kararlar (Eren): SMS yok, aile üyeleri uygulamayı kullanır;
 * ekleme karşılıklıdır (QR / davet bağlantısı / kod); SOS'ta konum listedeki herkese aynı anda gider;
 * SOS türü seçimi yok, tek düğme. Uygulama resmi acil çağrı değildir, hiçbir yeri kendiliğinden aramaz.
 */

/** Bir kişinin aile listesindeki en fazla kişi sayısı (veritabanı kuralı da bu sınırı denetler). */
export const FAMILY_MAX = 10;
export const INVITE_HOURS = 24;

export interface SosConfig {
  /** Canlı konum paylaşım süresi (dakika). */
  liveMinutes: number;
  /** Yanlışlıkla basmaya karşı geri sayım (saniye). */
  countdownSeconds: number;
}

/** Panelden değiştirilebilir (Panel > SOS ayarları); okunamazsa bu değerler kullanılır. */
export const DEFAULT_SOS_CONFIG: SosConfig = { liveMinutes: 30, countdownSeconds: 5 };
export const SOS_CONFIG_LIMITS = { liveMinutes: [10, 120], countdownSeconds: [3, 10] } as const;

export function clampSosConfig(c: Partial<SosConfig>): SosConfig {
  const clamp = (v: unknown, [min, max]: readonly [number, number], d: number) =>
    typeof v === 'number' && Number.isInteger(v) ? Math.min(max, Math.max(min, v)) : d;
  return {
    liveMinutes: clamp(c.liveMinutes, SOS_CONFIG_LIMITS.liveMinutes, DEFAULT_SOS_CONFIG.liveMinutes),
    countdownSeconds: clamp(c.countdownSeconds, SOS_CONFIG_LIMITS.countdownSeconds, DEFAULT_SOS_CONFIG.countdownSeconds),
  };
}

export interface FamilyMember {
  uid: string;
  name: string;
  /** ISO tarih. */
  since: string;
}

/** İki kişi arasındaki aile bağının kimliği (sıralı: "a_b"). */
export function familyLinkId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

/** Karışabilecek harfler (0/O, 1/I/L) yok. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;

/** Tek kullanımlık davet kodu; QR ve bağlantı aynı kodu taşır. 31^8 ≈ 850 milyar olasılık. */
export function generateInviteCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

/** "abcd-efgh", "ABCD EFGH" gibi yazımları "ABCDEFGH" yapar; geçersizse null. */
export function normalizeInviteCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === INVITE_CODE_LENGTH && [...code].every((ch) => CODE_ALPHABET.includes(ch)) ? code : null;
}

/** Ekranda okunaklı gösterim: "ABCD-EFGH". */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Davet bağlantısı: uygulama yüklüyse Ailem ekranını kod dolu açar. */
export function inviteLink(code: string): string {
  return `cityjoy://family?kod=${code}`;
}

export interface FamilyInvite {
  code: string;
  fromUid: string;
  fromName: string;
  /** ISO tarihler. */
  createdAt: string;
  expiresAt: string;
}

export type AcceptInviteError = 'invalid' | 'expired' | 'used' | 'self' | 'full' | 'already';

export class FamilyError extends Error {
  constructor(public readonly code: AcceptInviteError) {
    super(code);
    this.name = 'FamilyError';
  }
}

/**
 * SOS = gönderenin yardıma ihtiyacı var (Eren). aktif: yardım istiyor, konum paylaşılıyor;
 * guvende: gönderen "Güvendeyim" dedi; bitti: paylaşım durduruldu.
 */
export type SosStatus = 'aktif' | 'guvende' | 'bitti';

export interface SosLocation {
  lat: number;
  lng: number;
  /** Metre. */
  accuracy?: number;
  /** ISO tarih. */
  at: string;
}

export interface SosAlert {
  id: string;
  fromUid: string;
  fromName: string;
  recipients: string[];
  /** Deneme gönderimi: alıcılarda "TEST" olarak görünür. */
  test: boolean;
  status: SosStatus;
  location?: SosLocation;
  /** ISO tarihler. */
  createdAt: string;
  /** Canlı konumun güncellendiği son an; sonrasında paylaşım kendiliğinden biter. */
  liveUntil: string;
  /** Alıcının uygulaması bildirimi aldı / kişi açıp gördü (alıcı kimliği -> ISO tarih). */
  deliveredTo: Record<string, string>;
  seenBy: Record<string, string>;
}

/** Canlı konum sürüyor mu? Gönderen "Güvendeyim" ya da "Durdur" dediyse biter. */
export function isLive(a: Pick<SosAlert, 'status' | 'liveUntil'>, now = new Date()): boolean {
  return a.status === 'aktif' && new Date(a.liveUntil) > now;
}

/** Alıcı tarafında üstte gösterilecek mi: canlıysa ya da son 2 saatte gönderildiyse. */
export function isRecent(a: Pick<SosAlert, 'status' | 'liveUntil' | 'createdAt'>, now = new Date()): boolean {
  return isLive(a, now) || now.getTime() - new Date(a.createdAt).getTime() < 2 * 3600_000;
}

export function remainingSeconds(a: Pick<SosAlert, 'liveUntil'>, now = new Date()): number {
  return Math.max(0, Math.round((new Date(a.liveUntil).getTime() - now.getTime()) / 1000));
}

/** Konumu herhangi bir harita uygulamasında açan bağlantı. */
export function mapsUrl(loc: Pick<SosLocation, 'lat' | 'lng'>): string {
  return `https://www.google.com/maps/search/?api=1&query=${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}`;
}

/** Canlı konum güncellemesi: en sık 30 saniyede bir ya da 50 metreden fazla yer değişince (maliyet ve pil). */
export function shouldSendLocation(prev: SosLocation | undefined, next: Omit<SosLocation, 'at'>, now = new Date()): boolean {
  if (!prev) return true;
  const elapsed = now.getTime() - new Date(prev.at).getTime();
  return elapsed >= 30_000 || (elapsed >= 10_000 && distanceMeters(prev, next) > 50);
}

export function distanceMeters(a: Pick<SosLocation, 'lat' | 'lng'>, b: Pick<SosLocation, 'lat' | 'lng'>): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface FamilyRepository {
  listMembers(uid: string): Promise<FamilyMember[]>;
  /** Yeni davet kodu (24 saat, tek kullanımlık). */
  createInvite(uid: string, name: string): Promise<FamilyInvite>;
  cancelInvite(code: string): Promise<void>;
  /** Kodu kabul eder; bağ iki taraf için de kurulur. Hata: FamilyError. */
  acceptInvite(code: string, uid: string, name: string): Promise<FamilyMember>;
  /** Listeden ayrılır (iki taraftan da silinir). */
  remove(uid: string, otherUid: string): Promise<void>;
  /** Hesap silinirken: tüm aile bağları, davetler, gönderilen SOS kayıtları. */
  deleteAllOf(uid: string): Promise<void>;
}

export interface SosRepository {
  config(): Promise<SosConfig>;
  /** SOS'u gönderir; sunucu kaydı onaylayınca döner (internet yoksa zaman aşımıyla hata verir). */
  send(input: { fromUid: string; fromName: string; recipients: string[]; test: boolean; location?: Omit<SosLocation, 'at'>; liveMinutes: number }): Promise<string>;
  updateLocation(id: string, location: Omit<SosLocation, 'at'>): Promise<void>;
  setStatus(id: string, status: SosStatus): Promise<void>;
  markDelivered(id: string, uid: string): Promise<void>;
  markSeen(id: string, uid: string): Promise<void>;
  /** Tek bir SOS'u canlı izler (gönderen ve alıcılar). */
  watch(id: string, onChange: (a: SosAlert | null) => void, onError?: (e: unknown) => void): () => void;
  /** Bana gelen son SOS'ları canlı izler. */
  watchIncoming(uid: string, onChange: (list: SosAlert[]) => void, onError?: (e: unknown) => void): () => void;
  listSent(uid: string): Promise<SosAlert[]>;
  delete(id: string): Promise<void>;
}

/** Android bildirim kanalı ve arka plan konum görevinin adı (uygulama ve yerel yapılandırma aynı adı kullanır). */
export const SOS_CHANNEL_ID = 'sos';
export const SOS_BACKGROUND_TASK = 'cityjoy-sos-location';

/** Bir kişinin bildirim adresleri (telefon başına bir) ve bildirimin yazılacağı dil. */
export interface PushTarget {
  uid: string;
  tokens: string[];
  language: LanguageCode;
}

/** Expo bildirim servisine gönderilen ileti. */
export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: { sosId: string };
  sound: 'default';
  priority: 'high';
  channelId: string;
  /** iOS: odak modunda da görünür. */
  interruptionLevel: 'time-sensitive';
  /** Saniye: 1 saatten eski SOS bildirimi teslim edilmez. */
  ttl: number;
}

const fill = (text: string, name: string) => text.replace('{{name}}', name);

/**
 * SOS bildirimleri, her alıcının kendi dilinde. "yardim": SOS gönderildi (gönderen yardım istiyor);
 * "guvende": gönderen güvende olduğunu bildirdi.
 */
export function sosPushMessages(targets: readonly PushTarget[], alert: { id: string; fromName: string; test: boolean }, kind: 'yardim' | 'guvende'): PushMessage[] {
  return targets.flatMap((target) => {
    const tr = (translations[target.language] ?? translations.tr).sos;
    const title = kind === 'guvende' ? fill(tr.pushSafeTitle, alert.fromName) : alert.test ? fill(tr.pushTestTitle, alert.fromName) : fill(tr.pushHelpTitle, alert.fromName);
    const body = kind === 'guvende' ? tr.pushSafeBody : tr.pushHelpBody;
    return [...new Set(target.tokens)].map((to) => ({
      to,
      title,
      body,
      data: { sosId: alert.id },
      sound: 'default' as const,
      priority: 'high' as const,
      channelId: SOS_CHANNEL_ID,
      interruptionLevel: 'time-sensitive' as const,
      ttl: 3600,
    }));
  });
}

export interface PushTokenRepository {
  save(uid: string, token: string, language: LanguageCode): Promise<void>;
  /** Çıkış yapılınca bu telefona artık bildirim gitmez. */
  remove(uid: string, token: string): Promise<void>;
  /** Aile üyelerinin bildirim adresleri (okunamayanlar atlanır). */
  forUsers(uids: readonly string[]): Promise<PushTarget[]>;
}
