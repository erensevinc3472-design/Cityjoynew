import { LANGUAGES, type LanguageCode } from '../i18n/languages';
import { LEGAL_TEXT_VERSION } from '../models/user';

/**
 * Uygulama ayarları (Panel > Ayarlar > Uygulama ayarları; Eren onayladı, 14 Kasım 2026). Tek kayıt: config/app.
 * Uygulama açılışta bir kez okur ve telefonda saklar; bağlantı yoksa son bilinen hâli kullanır. Yalnızca admin yazar,
 * her değişiklik işlem kaydına ve geri alınabilsin diye ayar geçmişine yazılır.
 */

/** Geçici olarak kapatılabilen bölümler. Acil İhtiyaçlar ve SOS güvenlik için hiçbir zaman kapatılamaz. */
export const APP_SECTIONS = ['myCity', 'travel', 'social', 'explore', 'carsi', 'messages'] as const;
export type AppSection = (typeof APP_SECTIONS)[number];

/** Bölümün uygulamadaki yolu: bu yolla başlayan her ekran bölüm kapalıyken "geçici olarak kapalı" gösterir. */
export const APP_SECTION_PATHS: Record<AppSection, string> = {
  myCity: '/city',
  travel: '/travel',
  social: '/social',
  explore: '/explore',
  carsi: '/carsi',
  messages: '/messages',
};

export type BannerText = Record<LanguageCode, string>;
export type Platform = 'ios' | 'android';
export type PerPlatform = Record<Platform, string>;

export interface AppBanner {
  /** duyuru: üstte bant; bakim: uygulama kapanır, yalnızca bakım ekranı görünür. */
  kind: 'duyuru' | 'bakim';
  /** Türkçe zorunlu; boş kalan dilde Türkçe gösterilir. */
  text: BannerText;
  /** ISO tarih; boşsa hemen başlar / bitene kadar sürer. */
  startAt: string | null;
  endAt: string | null;
  /** İl plaka kodları; boşsa Türkiye geneli. */
  provinces: string[];
  /** "Sadece bana göster": yalnızca bu kişi görür (deneme). */
  onlyUid: string | null;
}

export interface AppContact {
  supportEmail: string;
  /** KVKK başvuru adresi (posta ya da KEP). */
  kvkkAddress: string;
  web: string;
  instagram: string;
  x: string;
  facebook: string;
  youtube: string;
  tiktok: string;
}
export const CONTACT_LINKS = ['web', 'instagram', 'x', 'facebook', 'youtube', 'tiktok'] as const;

/** Paneldan değiştirilebilen giriş resimleri; boşsa uygulamadaki gömülü resim kullanılır. */
export const APP_IMAGES = ['welcome', 'language', 'signIn'] as const;
export type AppImage = (typeof APP_IMAGES)[number];
/** Giriş resimleri dikey telefon ekranını doldurur: en az bu boyutta olmalı. */
export const APP_IMAGE_MIN = { width: 900, height: 1400 } as const;

export interface AppConfig {
  /** Bu sürümün altındaki uygulama açılmaz, güncelleme ister. */
  minVersion: PerPlatform;
  /** Bu sürümün altındakilere kapatılabilir "yeni sürüm var" önerisi çıkar. */
  suggestVersion: PerPlatform;
  /** Mağaza sayfası (güncelleme düğmesi açar). */
  storeUrl: PerPlatform;
  banner: AppBanner | null;
  closed: AppSection[];
  /** Yürürlükteki yasal metin sürümü; reaccept açıksa eski sürümü onaylamış kişi yeniden onaylar. */
  legal: { version: string; reaccept: boolean };
  contact: AppContact;
  images: Record<AppImage, string>;
}

export const APP_CONFIG_LIMITS = { text: 300, url: 500, version: 20, provinces: 81 } as const;

const emptyText = (): BannerText => Object.fromEntries(LANGUAGES.map((l) => [l.code, ''])) as BannerText;

export const DEFAULT_APP_CONFIG: AppConfig = {
  minVersion: { ios: '0.0.0', android: '0.0.0' },
  suggestVersion: { ios: '0.0.0', android: '0.0.0' },
  storeUrl: { ios: '', android: '' },
  banner: null,
  closed: [],
  legal: { version: LEGAL_TEXT_VERSION, reaccept: false },
  contact: { supportEmail: '', kvkkAddress: '', web: '', instagram: '', x: '', facebook: '', youtube: '', tiktok: '' },
  images: { welcome: '', language: '', signIn: '' },
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** "1.2.3" biçimi (1-3 parça); değilse boş. */
export function cleanVersion(v: unknown): string {
  const s = str(v, APP_CONFIG_LIMITS.version);
  return /^\d{1,4}(\.\d{1,4}){0,2}$/.test(s) ? s : '';
}

export function cleanHttps(v: unknown): string {
  const s = str(v, APP_CONFIG_LIMITS.url);
  return /^https:\/\/[^\s]+$/i.test(s) ? s : '';
}

export function cleanEmail(v: unknown): string {
  const s = str(v, 120);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : '';
}

function cleanIso(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** a < b ise eksi, eşitse 0, büyükse artı. Eksik parça 0 sayılır ("1.2" = "1.2.0"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

const perPlatform = (raw: unknown, clean: (v: unknown) => string, fallback: PerPlatform): PerPlatform => {
  const r = (raw ?? {}) as Record<string, unknown>;
  return { ios: clean(r.ios) || fallback.ios, android: clean(r.android) || fallback.android };
};

/** Veritabanından ya da formdan gelen ayarı temizler; geçersiz alan varsayılana döner. */
export function normalizeAppConfig(raw: unknown): AppConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const d = DEFAULT_APP_CONFIG;
  const b = r.banner as Record<string, unknown> | null | undefined;
  let banner: AppBanner | null = null;
  if (b && typeof b === 'object') {
    const text = emptyText();
    const bt = (b.text ?? {}) as Record<string, unknown>;
    LANGUAGES.forEach((l) => (text[l.code] = str(bt[l.code], APP_CONFIG_LIMITS.text)));
    if (text.tr) {
      banner = {
        kind: b.kind === 'bakim' ? 'bakim' : 'duyuru',
        text,
        startAt: cleanIso(b.startAt),
        endAt: cleanIso(b.endAt),
        provinces: Array.isArray(b.provinces)
          ? [...new Set(b.provinces.filter((p): p is string => typeof p === 'string' && /^\d{2}$/.test(p)))].slice(0, APP_CONFIG_LIMITS.provinces)
          : [],
        onlyUid: typeof b.onlyUid === 'string' && /^[A-Za-z0-9]{6,128}$/.test(b.onlyUid) ? b.onlyUid : null,
      };
    }
  }
  const c = (r.contact ?? {}) as Record<string, unknown>;
  const im = (r.images ?? {}) as Record<string, unknown>;
  const legal = (r.legal ?? {}) as Record<string, unknown>;
  return {
    minVersion: perPlatform(r.minVersion, cleanVersion, d.minVersion),
    suggestVersion: perPlatform(r.suggestVersion, cleanVersion, d.suggestVersion),
    storeUrl: perPlatform(r.storeUrl, cleanHttps, d.storeUrl),
    banner,
    closed: Array.isArray(r.closed) ? APP_SECTIONS.filter((s) => (r.closed as unknown[]).includes(s)) : [],
    legal: {
      version: /^[a-z0-9-]{1,40}$/.test(String(legal.version ?? '')) ? String(legal.version) : d.legal.version,
      reaccept: legal.reaccept === true,
    },
    contact: {
      supportEmail: cleanEmail(c.supportEmail),
      kvkkAddress: str(c.kvkkAddress, APP_CONFIG_LIMITS.text),
      web: cleanHttps(c.web),
      instagram: cleanHttps(c.instagram),
      x: cleanHttps(c.x),
      facebook: cleanHttps(c.facebook),
      youtube: cleanHttps(c.youtube),
      tiktok: cleanHttps(c.tiktok),
    },
    images: Object.fromEntries(APP_IMAGES.map((k) => [k, cleanHttps(im[k])])) as Record<AppImage, string>,
  };
}

/** Uygulama sürümüne göre: zorunlu güncelleme, öneri ya da hiçbiri. */
export function updateNeed(cfg: AppConfig, platform: Platform, version: string): 'zorunlu' | 'oneri' | null {
  if (!cleanVersion(version)) return null;
  if (compareVersions(version, cfg.minVersion[platform]) < 0) return 'zorunlu';
  if (compareVersions(version, cfg.suggestVersion[platform]) < 0) return 'oneri';
  return null;
}

export interface BannerViewer {
  now: Date;
  provinceCode?: string | null;
  uid?: string | null;
}

/** Şu an bu kişiye görünen bant (süresi, ili ve "sadece bana" denetlenir); yoksa null. */
export function activeBanner(cfg: AppConfig, v: BannerViewer): AppBanner | null {
  const b = cfg.banner;
  if (!b) return null;
  const t = v.now.getTime();
  if (b.startAt && t < new Date(b.startAt).getTime()) return null;
  if (b.endAt && t >= new Date(b.endAt).getTime()) return null;
  if (b.onlyUid && b.onlyUid !== v.uid) return null;
  if (b.provinces.length && (!v.provinceCode || !b.provinces.includes(v.provinceCode))) return null;
  return b;
}

export function bannerText(b: AppBanner, lang: LanguageCode): string {
  return b.text[lang] || b.text.tr;
}

/** Bant durumu (panel durum kutusu için). */
export function bannerPhase(b: AppBanner | null, now: Date): 'yok' | 'bekliyor' | 'yayinda' | 'bitti' {
  if (!b) return 'yok';
  if (b.startAt && now < new Date(b.startAt)) return 'bekliyor';
  if (b.endAt && now >= new Date(b.endAt)) return 'bitti';
  return 'yayinda';
}

/** Ekranın yolu kapalı bir bölüme düşüyorsa o bölüm. */
export function closedSectionOf(cfg: AppConfig, pathname: string): AppSection | null {
  return cfg.closed.find((s) => pathname === APP_SECTION_PATHS[s] || pathname.startsWith(`${APP_SECTION_PATHS[s]}/`)) ?? null;
}

/** Kişinin onayladığı metin sürümü eskiyse ve yeniden onay açıksa true. */
export function needsReaccept(cfg: AppConfig, acceptedVersion: string | undefined): boolean {
  return cfg.legal.reaccept && !!acceptedVersion && acceptedVersion !== cfg.legal.version;
}

/** Yanlışlıkla açılırsa herkesi etkileyen değişiklikler: panel ikinci kez onay ister. */
export function riskyChanges(before: AppConfig, after: AppConfig): ('bakim' | 'zorunlu' | 'bolum' | 'yasal')[] {
  const out: ('bakim' | 'zorunlu' | 'bolum' | 'yasal')[] = [];
  if (after.banner?.kind === 'bakim' && !after.banner.onlyUid && JSON.stringify(after.banner) !== JSON.stringify(before.banner)) out.push('bakim');
  if (compareVersions(after.minVersion.ios, before.minVersion.ios) > 0 || compareVersions(after.minVersion.android, before.minVersion.android) > 0) out.push('zorunlu');
  if (after.closed.some((s) => !before.closed.includes(s))) out.push('bolum');
  if (after.legal.reaccept && (!before.legal.reaccept || after.legal.version !== before.legal.version)) out.push('yasal');
  return out;
}

/** Değişen bölümler (işlem kaydı özeti ve geçmiş listesi için). */
export const APP_CONFIG_PARTS = ['banner', 'update', 'closed', 'images', 'contact', 'legal'] as const;
export type AppConfigPart = (typeof APP_CONFIG_PARTS)[number];

export function changedParts(before: AppConfig, after: AppConfig): AppConfigPart[] {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const out: AppConfigPart[] = [];
  if (!same(before.banner, after.banner)) out.push('banner');
  if (!same([before.minVersion, before.suggestVersion, before.storeUrl], [after.minVersion, after.suggestVersion, after.storeUrl])) out.push('update');
  if (!same(before.closed, after.closed)) out.push('closed');
  if (!same(before.images, after.images)) out.push('images');
  if (!same(before.contact, after.contact)) out.push('contact');
  if (!same(before.legal, after.legal)) out.push('legal');
  return out;
}

/** Hazır bant metinleri, beş dilde (panelde tek dokunuşla doldurulur, istenirse düzeltilir). */
export const BANNER_TEMPLATES: { id: string; kind: AppBanner['kind']; text: BannerText }[] = [
  {
    id: 'planli-bakim',
    kind: 'duyuru',
    text: {
      tr: 'Kısa bir planlı bakım yapılacak. Bu sırada bazı bölümler yavaş çalışabilir.',
      en: 'A short planned maintenance is coming. Some sections may be slow during this time.',
      de: 'Eine kurze geplante Wartung steht an. Einige Bereiche können in dieser Zeit langsamer sein.',
      ar: 'ستتم صيانة مخططة قصيرة. قد تعمل بعض الأقسام ببطء خلال هذا الوقت.',
      ru: 'Скоро короткое плановое обслуживание. В это время некоторые разделы могут работать медленнее.',
    },
  },
  {
    id: 'aksama',
    kind: 'duyuru',
    text: {
      tr: 'Bazı bölümlerde aksama yaşanıyor. Çözmek için çalışıyoruz, anlayışın için teşekkürler.',
      en: 'Some sections are having problems. We are working on it, thank you for your patience.',
      de: 'In einigen Bereichen gibt es Störungen. Wir arbeiten daran, danke für deine Geduld.',
      ar: 'تواجه بعض الأقسام مشكلات. نحن نعمل على حلها، شكرًا لتفهمك.',
      ru: 'В некоторых разделах есть сбои. Мы уже работаем над этим, спасибо за терпение.',
    },
  },
  {
    id: 'yeni-ozellik',
    kind: 'duyuru',
    text: {
      tr: 'Yeni özellikler geldi! Uygulamayı güncelleyip hemen dene.',
      en: 'New features are here! Update the app and try them now.',
      de: 'Neue Funktionen sind da! Aktualisiere die App und probiere sie aus.',
      ar: 'وصلت ميزات جديدة! حدّث التطبيق وجرّبها الآن.',
      ru: 'Появились новые функции! Обновите приложение и попробуйте их.',
    },
  },
  {
    id: 'bakim-modu',
    kind: 'bakim',
    text: {
      tr: 'CityJoy şu an bakımda. Kısa süre içinde geri döneceğiz.',
      en: 'CityJoy is under maintenance right now. We will be back shortly.',
      de: 'CityJoy wird gerade gewartet. Wir sind bald wieder da.',
      ar: 'CityJoy قيد الصيانة الآن. سنعود قريبًا.',
      ru: 'CityJoy сейчас на обслуживании. Мы скоро вернёмся.',
    },
  },
];

export const emptyBanner = (): AppBanner => ({ kind: 'duyuru', text: emptyText(), startAt: null, endAt: null, provinces: [], onlyUid: null });
