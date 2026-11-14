import { APP_SECTION_PATHS, APP_SECTIONS, type AppSection } from '@cityjoy/shared';
import type { AppContentKind } from '@cityjoy/shared/firebase';

/**
 * Panel > Uygulama görünümü: uygulamanın ekranları ve her ekranla ilgili panel sayfaları.
 * `screen` başlık anahtarıdır (appView.screens.*), `links` menü anahtarı + panel adresidir (menu.items.*),
 * `record` ekran tek bir kaydı gösteriyorsa o kaydın panel sayfasıdır. Eşleşme ilk uyan kuraldır.
 */
export interface ScreenLink {
  /** menu.items.* anahtarı ya da appView.links.* (kendi etiketi olan bağlantılar). */
  label: string;
  path: string;
}

export interface AppScreen {
  screen: string;
  links: ScreenLink[];
  counts: AppContentKind[];
  /** Bu ekran tek bir kaydı gösteriyorsa: kaydın panel sayfası (kimliği ekranda gösterilir). */
  record?: ScreenLink;
}

const L = (label: string, path: string): ScreenLink => ({ label, path });
const banner = L('appView.links.banner', '/uygulama-ayarlari?sekme=banner');
const sections = L('appView.links.sections', '/uygulama-ayarlari?sekme=closed');

const RULES: { match: RegExp; screen: AppScreen }[] = [
  { match: /^\/(home)?$/, screen: { screen: 'home', links: [L('vitrin', '/sehir-vitrini'), L('gonderiler', '/duyurular'), L('etkinlikler', '/etkinlikler'), banner, sections], counts: ['showcases', 'announcements', 'events'] } },
  { match: /^\/city\/showcase/, screen: { screen: 'showcase', links: [L('vitrin', '/sehir-vitrini')], counts: ['showcases'] } },
  { match: /^\/city\/food/, screen: { screen: 'food', links: [L('isletme-dogrulama', '/isletmeler'), L('firsatlar', '/firsatlar'), L('vitrin', '/sehir-vitrini'), L('hizmet-kategorileri', '/hizmet-kategorileri')], counts: ['businesses', 'deals'] } },
  { match: /^\/city/, screen: { screen: 'myCity', links: [L('sehir-rehberi', '/sehir-rehberi'), L('vitrin', '/sehir-vitrini'), L('isletme-dogrulama', '/isletmeler'), L('firsatlar', '/firsatlar'), L('konumlar', '/konumlar')], counts: ['businesses', 'deals', 'showcases'] } },
  { match: /^\/neighbourhood/, screen: { screen: 'myCity', links: [L('konumlar', '/konumlar'), L('sehir-rehberi', '/sehir-rehberi')], counts: [] } },
  { match: /^\/business\/[^/]+$/, screen: { screen: 'business', links: [L('firsatlar', '/firsatlar'), L('uyelikler', '/uyelikler'), L('moderasyon', '/moderasyon')], counts: [], record: L('isletme-dogrulama', '/isletmeler') } },
  { match: /^\/business/, screen: { screen: 'myBusiness', links: [L('isletme-dogrulama', '/isletmeler'), L('uyelikler', '/uyelikler')], counts: [] } },
  { match: /^\/deals/, screen: { screen: 'deals', links: [L('firsatlar', '/firsatlar'), L('isletme-dogrulama', '/isletmeler')], counts: ['deals'] } },
  { match: /^\/events\/[^/]+$/, screen: { screen: 'event', links: [L('onaylar', '/onaylar')], counts: [], record: L('etkinlikler', '/etkinlikler') } },
  { match: /^\/events/, screen: { screen: 'events', links: [L('etkinlikler', '/etkinlikler'), L('onaylar', '/onaylar')], counts: ['events'] } },
  { match: /^\/announcements\/[^/]+$/, screen: { screen: 'announcement', links: [L('onaylar', '/onaylar')], counts: [], record: L('gonderiler', '/duyurular') } },
  { match: /^\/(announcements|news)/, screen: { screen: 'announcements', links: [L('gonderiler', '/duyurular'), L('veri-kaynaklari', '/veri-kaynaklari')], counts: ['announcements'] } },
  { match: /^\/travel\/place\/[^/]+$/, screen: { screen: 'place', links: [L('tatil-fikirleri', '/tatil-fikirleri')], counts: [], record: L('seyahat', '/seyahat') } },
  { match: /^\/travel\/yoldayim/, screen: { screen: 'roadside', links: [L('yol-ustu', '/yol-ustu-verisi')], counts: [] } },
  { match: /^\/travel/, screen: { screen: 'travel', links: [L('seyahat', '/seyahat'), L('tatil-fikirleri', '/tatil-fikirleri'), L('yol-ustu', '/yol-ustu-verisi'), sections], counts: [] } },
  { match: /^\/(social|explore|activities|follows)/, screen: { screen: 'social', links: [L('moderasyon', '/moderasyon'), L('profiller', '/profiller'), L('rozetler', '/rozetler'), sections], counts: [] } },
  { match: /^\/u\/[^/]+$/, screen: { screen: 'profile', links: [L('rozetler', '/rozetler'), L('moderasyon', '/moderasyon')], counts: [], record: L('profiller', '/profiller') } },
  { match: /^\/official\/[^/]+$/, screen: { screen: 'official', links: [L('profile', '/profil')], counts: [], record: L('kurumlar', '/kurumlar') } },
  { match: /^\/carsi/, screen: { screen: 'carsi', links: [L('moderasyon', '/moderasyon'), sections], counts: [] } },
  { match: /^\/messages/, screen: { screen: 'messages', links: [L('moderasyon', '/moderasyon'), sections], counts: [] } },
  { match: /^\/services/, screen: { screen: 'services', links: [L('hizmet-kategorileri', '/hizmet-kategorileri'), L('diger-ihtiyaclar', '/diger-ihtiyaclar'), L('meslekler', '/meslekler')], counts: [] } },
  { match: /^\/(urgent|sos)/, screen: { screen: 'urgent', links: [L('acil-numaralar', '/acil-numaralar'), L('sos', '/sos-ayarlari')], counts: [] } },
  { match: /^\/notifications/, screen: { screen: 'notifications', links: [L('bildirimler', '/bildirimler'), L('toplu-bildirim', '/toplu-bildirim')], counts: [] } },
  { match: /^\/polls/, screen: { screen: 'polls', links: [L('anketler', '/anketler')], counts: [] } },
  { match: /^\/contests/, screen: { screen: 'contests', links: [L('yarismalar', '/yarismalar'), L('sponsorlar', '/sponsorlar')], counts: [] } },
  { match: /^\/weather/, screen: { screen: 'weather', links: [L('veri-kaynaklari', '/veri-kaynaklari')], counts: [] } },
  { match: /^\/legal/, screen: { screen: 'legal', links: [L('appView.links.legal', '/uygulama-ayarlari?sekme=legal')], counts: [] } },
  { match: /^\/(account|me)/, screen: { screen: 'account', links: [L('appView.links.contact', '/uygulama-ayarlari?sekme=contact'), L('profiller', '/profiller')], counts: [] } },
  { match: /^\/(welcome|language|sign-in|sign-up)/, screen: { screen: 'entry', links: [L('appView.links.images', '/uygulama-ayarlari?sekme=images')], counts: [] } },
];

const OTHER: AppScreen = { screen: 'other', links: [L('uygulama-ayarlari', '/uygulama-ayarlari')], counts: [] };

export function screenFor(pathname: string): AppScreen {
  return RULES.find((r) => r.match.test(pathname))?.screen ?? OTHER;
}

/** Ekranın ait olduğu, panelden kapatılabilen bölüm (Acil İhtiyaçlar hiçbir zaman). */
export function sectionFor(pathname: string): AppSection | null {
  return APP_SECTIONS.find((s) => pathname === APP_SECTION_PATHS[s] || pathname.startsWith(`${APP_SECTION_PATHS[s]}/`)) ?? null;
}

/** Ekrandaki kaydın kimliği (/business/abc → abc). */
export function recordIdOf(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  return parts.length >= 2 ? decodeURIComponent(parts[parts.length - 1]) : null;
}
