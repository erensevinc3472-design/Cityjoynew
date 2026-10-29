import type { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
export type Look = { icon: IconName; colors: readonly [string, string] };

/** Benim Şehrim simgelerinin renkleri (tasarım: benim-sehrim.html): her bölüm kendi renginde, açıktan koyuya. */
export const LOOK = {
  belediye: { icon: 'account-balance', colors: ['#F6D38B', '#C98A2C'] },
  kurumlar: { icon: 'corporate-fare', colors: ['#5FD0F5', '#1C7FD6'] },
  muzeler: { icon: 'museum', colors: ['#D59CF0', '#8B3FC8'] },
  cafe: { icon: 'restaurant', colors: ['#FFB25C', '#EE5A24'] },
  etkinlik: { icon: 'event-available', colors: ['#F78FB6', '#D3336F'] },
  eczane: { icon: 'medical-services', colors: ['#F48A8A', '#D63A3A'] },
  ulasim: { icon: 'directions-bus', colors: ['#4FDCCB', '#11907F'] },
  parkPazar: { icon: 'park', colors: ['#7FDB86', '#2E9B48'] },
  emlak: { icon: 'home-work', colors: ['#9EA8F5', '#4F5BD5'] },
  otopark: { icon: 'local-parking', colors: ['#6CB6FA', '#2165C9'] },
  gonullu: { icon: 'volunteer-activism', colors: ['#FF8FA3', '#E0335A'] },
  rehber: { icon: 'help-outline', colors: ['#B7E26B', '#5E9E1E'] },
  meydan: { icon: 'explore', colors: ['#5FD0F5', '#1C7FD6'] },
  vitrin: { icon: 'auto-awesome', colors: ['#FFB25C', '#EE7A1C'] },
  toplanma: { icon: 'emergency-share', colors: ['#F48A8A', '#D63A3A'] },
} as const satisfies Record<string, Look>;

/**
 * Önemli Kurumlar alt başlıkları, tasarımdaki sırayla (onemli-kurumlar.html). Kurumlar tek bölümde tutulur, burada
 * kategoriye göre toplanır; Muhtarlıklar kendi bölümünden gelir. Bilgisi olmayan başlık (eczane, sağlık kabini, banka)
 * "Yakında" görünür.
 */
export const INSTITUTION_GROUPS: { id: string; look: Look; categories?: string[]; section?: 'muhtarliklar' }[] = [
  { id: 'muhtarlik', section: 'muhtarliklar', look: { icon: 'location-city', colors: ['#F6D38B', '#C98A2C'] } },
  { id: 'kamu', categories: ['valilik', 'kaymakamlik', 'il-mudurlugu', 'adliye', 'goc-idaresi', 'diger'], look: { icon: 'account-balance', colors: ['#8EA2F7', '#5468E0'] } },
  { id: 'hastane', categories: ['hastane-devlet', 'hastane-ozel'], look: { icon: 'medical-services', colors: ['#F48A8A', '#E04848'] } },
  { id: 'eczane', look: { icon: 'local-pharmacy', colors: ['#7FDB86', '#2E9B48'] } },
  { id: 'emniyet', categories: ['emniyet', 'jandarma'], look: { icon: 'local-police', colors: ['#B49CF7', '#7651E0'] } },
  { id: 'itfaiye', categories: ['itfaiye'], look: { icon: 'fire-truck', colors: ['#FFB25C', '#EE6A24'] } },
  { id: 'nufus', categories: ['nufus-mudurlugu'], look: { icon: 'badge', colors: ['#4FDCCB', '#11907F'] } },
  { id: 'noter', categories: ['noter'], look: { icon: 'gavel', colors: ['#E8C07A', '#B98A3A'] } },
  { id: 'ptt', categories: ['ptt'], look: { icon: 'mail', colors: ['#FFD86B', '#D9A400'] } },
  { id: 'vergi', categories: ['vergi-dairesi'], look: { icon: 'receipt-long', colors: ['#9EA8F5', '#4F5BD5'] } },
  { id: 'sgk', categories: ['sgk'], look: { icon: 'health-and-safety', colors: ['#5FD0F5', '#1C7FD6'] } },
  { id: 'kabin', look: { icon: 'healing', colors: ['#F7A6C8', '#D04C88'] } },
  { id: 'asm', categories: ['aile-sagligi-merkezi'], look: { icon: 'local-hospital', colors: ['#F48A8A', '#E04848'] } },
  { id: 'egitim', categories: ['okul', 'halk-egitim'], look: { icon: 'school', colors: ['#D59CF0', '#8B3FC8'] } },
  { id: 'kutuphane', categories: ['kutuphane'], look: { icon: 'menu-book', colors: ['#C9A27A', '#8A5A35'] } },
  { id: 'banka', look: { icon: 'account-balance-wallet', colors: ['#7FDB86', '#2E9B48'] } },
];
