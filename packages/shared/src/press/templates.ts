/**
 * Basın Masası > Hazır şablonlar (PROJE.md 6.2 madde 13, Karar Eren 5 Kasım 2026). Sık yazılan duyuru ve haberler
 * şablon olarak saklanır; "Şablondan başla" ile form dolar, köşeli parantezli boşluklar ([tarih], [saat]) doldurulur.
 * Hesap başına tek belge: `pressTemplates/{yayınlayan hesap}` (kurum kimliği ya da kişi yetkisinin anahtarı).
 */

import type { AnnouncementKind, NewsCategory } from '../announcements/announcements';

export interface PressTemplate {
  id: string;
  /** Listede görünen ad. */
  name: string;
  kind: Exclude<AnnouncementKind, 'acil'> | 'acil';
  title: string;
  body: string;
  category?: NewsCategory;
}

export const TEMPLATE_LIMITS = { name: [2, 60], max: 30 } as const;

/** Köşeli parantez içindeki doldurulmamış boşluklar ([tarih], [saat]...). */
export function placeholdersIn(text: string): string[] {
  return [...new Set(text.match(/\[[^\]\n]{1,30}\]/g) ?? [])];
}

/** Başlangıç şablonları (kurum "Örnek şablonları ekle" ile listesine alır, sonra düzenler). */
export const STARTER_TEMPLATES: PressTemplate[] = [
  {
    id: 'su-kesintisi', name: 'Su kesintisi', kind: 'duyuru', title: '[mahalle] su kesintisi',
    body: 'Değerli hemşehrilerimiz, [tarih] günü saat [başlangıç] ile [bitiş] arasında [mahalle] mahallesinde [neden] nedeniyle su kesintisi yapılacaktır. Anlayışınız için teşekkür ederiz.',
  },
  {
    id: 'yol-calismasi', name: 'Yol çalışması', kind: 'duyuru', title: '[cadde] yol çalışması',
    body: '[tarih] tarihinden itibaren [cadde] üzerinde [çalışma] çalışması yapılacaktır. Çalışma süresince araç trafiği [güzergâh] güzergâhına yönlendirilecektir. Sürücülerimizin dikkatli olmasını rica ederiz.',
  },
  {
    id: 'etkinlik', name: 'Etkinlik duyurusu', kind: 'haber', category: 'kultur-sanat', title: '[etkinlik] [tarih] günü [yer]da',
    body: '[etkinlik], [tarih] günü saat [saat]te [yer]da gerçekleştirilecektir. Etkinlik ücretsizdir; tüm hemşehrilerimizi bekliyoruz.',
  },
  {
    id: 'bayram', name: 'Bayram kutlaması', kind: 'haber', category: 'gundem', title: '[bayram] kutlu olsun',
    body: '[bayram] dolayısıyla tüm hemşehrilerimizin bayramını kutlar; sağlık, huzur ve mutluluk dolu bir bayram geçirmenizi dileriz. Bayram süresince [hizmet bilgisi].',
  },
  {
    id: 'anma', name: 'Anma mesajı', kind: 'haber', category: 'gundem', title: '[gün] anma programı',
    body: '[gün] dolayısıyla [tarih] günü saat [saat]te [yer]da anma töreni düzenlenecektir. Tüm hemşehrilerimizi törene davet ediyoruz.',
  },
  {
    id: 'hizmet', name: 'Hizmet duyurusu', kind: 'haber', category: 'hizmet', title: '[hizmet] başladı',
    body: '[hizmet], [tarih] itibarıyla [kapsam] için hizmet vermeye başlamıştır. Başvuru ve bilgi için [iletişim].',
  },
];

export type TemplateError = 'name' | 'title' | 'body';

export function validateTemplate(t: PressTemplate): TemplateError[] {
  const errs: TemplateError[] = [];
  const name = t.name.trim().length;
  if (name < TEMPLATE_LIMITS.name[0] || name > TEMPLATE_LIMITS.name[1]) errs.push('name');
  if (t.title.trim().length < 3 || t.title.length > 100) errs.push('title');
  if (t.body.trim().length < 10 || t.body.length > 2000) errs.push('body');
  return errs;
}

export function cleanTemplate(t: PressTemplate): PressTemplate {
  return {
    id: t.id, name: t.name.trim(), kind: t.kind, title: t.title.trim(), body: t.body.trim(),
    ...(t.kind === 'haber' && t.category ? { category: t.category } : {}),
  };
}
