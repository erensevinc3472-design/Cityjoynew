/**
 * Basın Masası > Önemli günler (PROJE.md 6.2, Karar Eren 5 Kasım 2026). Basın biriminin paylaşım takvimine yardım
 * eden günler: resmî ve millî bayramlar, dinî bayramlar, anma günleri, uluslararası günler ve kurumun kendi yerel
 * günleri. Ülke geneli liste `config/importantDays` belgesinde (admin düzenler; boşsa aşağıdaki başlangıç listesi
 * kullanılır), kurumun yerel günleri `orgDays/{kurum}` belgesinde durur.
 *
 * Tarafsızlık (PROJE.md 1.2): yalnızca resmî ve genel kabul görmüş günler; parti, dernek ya da siyasi anlam taşıyan
 * gün başlangıç listesine konmaz. Dinî bayram tarihleri Diyanet takviminden doğrulanmalıdır (admin düzeltir).
 */

export type ImportantDayKind = 'resmi' | 'dini' | 'anma' | 'uluslararasi' | 'yerel';
export const IMPORTANT_DAY_KINDS: ImportantDayKind[] = ['resmi', 'dini', 'anma', 'uluslararasi', 'yerel'];

export interface ImportantDay {
  id: string;
  title: string;
  kind: ImportantDayKind;
  /** Her yıl aynı gün: "AA-GG". */
  md?: string;
  /** Tek seferlik (dinî bayramlar gibi yıla göre değişen): "YYYY-AA-GG". */
  date?: string;
  /** Her yıl ayın n. haftanın günü (Anneler Günü: Mayıs'ın 2. pazarı). weekday 0 = pazar; n = -1 son. */
  nth?: { month: number; weekday: number; n: number };
  /** Kaç gün sürdüğü (bayramlar), verilmezse 1. */
  length?: number;
  /** Kısa paylaşım fikri. */
  idea?: string;
}

export const IMPORTANT_DAY_LIMITS = { title: [3, 80], idea: [0, 200], national: 300, local: 60 } as const;

const d = (id: string, title: string, kind: ImportantDayKind, when: Pick<ImportantDay, 'md' | 'date' | 'nth' | 'length'>, idea?: string): ImportantDay => ({
  id, title, kind, ...when, ...(idea ? { idea } : {}),
});

/** Başlangıç listesi (admin panelden düzenler). */
export const DEFAULT_IMPORTANT_DAYS: ImportantDay[] = [
  // Resmî ve millî bayramlar
  d('yilbasi', 'Yılbaşı', 'resmi', { md: '01-01' }, 'Yeni yıl kutlaması; yılbaşı gecesi ulaşım ve güvenlik bilgileri.'),
  d('23-nisan', 'Ulusal Egemenlik ve Çocuk Bayramı', 'resmi', { md: '04-23' }, 'Çocuklara yönelik etkinlikler ve tören programı.'),
  d('1-mayis', 'Emek ve Dayanışma Günü', 'resmi', { md: '05-01' }, 'Belediye çalışanlarına teşekkür; ulaşım düzenlemeleri.'),
  d('19-mayis', "Atatürk'ü Anma, Gençlik ve Spor Bayramı", 'resmi', { md: '05-19' }, 'Gençlik ve spor etkinlikleri, tören programı.'),
  d('15-temmuz', 'Demokrasi ve Millî Birlik Günü', 'resmi', { md: '07-15' }, 'Anma programı ve ücretsiz ulaşım bilgisi.'),
  d('30-agustos', 'Zafer Bayramı', 'resmi', { md: '08-30' }, 'Tören programı ve kutlama mesajı.'),
  d('29-ekim', 'Cumhuriyet Bayramı', 'resmi', { md: '10-29' }, 'Fener alayı, konser ve tören programı; yol kapanmaları.'),
  // Dinî bayramlar (Diyanet takviminden doğrulanmalı)
  d('ramazan-2026', 'Ramazan Bayramı', 'dini', { date: '2026-03-20', length: 3 }, 'Bayram mesajı; mezarlık servisleri ve ulaşım saatleri.'),
  d('kurban-2026', 'Kurban Bayramı', 'dini', { date: '2026-05-27', length: 4 }, 'Kurban satış ve kesim yerleri, temizlik çalışmaları.'),
  d('ramazan-2027', 'Ramazan Bayramı', 'dini', { date: '2027-03-09', length: 3 }, 'Bayram mesajı; mezarlık servisleri ve ulaşım saatleri.'),
  d('kurban-2027', 'Kurban Bayramı', 'dini', { date: '2027-05-16', length: 4 }, 'Kurban satış ve kesim yerleri, temizlik çalışmaları.'),
  // Anma ve belirli günler
  d('calisan-gazeteciler', 'Çalışan Gazeteciler Günü', 'anma', { md: '01-10' }, 'Yerel basına teşekkür mesajı.'),
  d('6-subat', '6 Şubat depremlerinde hayatını kaybedenleri anma', 'anma', { md: '02-06' }, 'Anma mesajı; toplanma alanları ve afet hazırlığı hatırlatması.'),
  d('istiklal-marsi', "İstiklal Marşı'nın Kabulü ve Mehmet Akif Ersoy'u Anma Günü", 'anma', { md: '03-12' }),
  d('tip-bayrami', 'Tıp Bayramı', 'anma', { md: '03-14' }, 'Sağlık çalışanlarına teşekkür.'),
  d('canakkale', 'Çanakkale Zaferi ve Şehitleri Anma Günü', 'anma', { md: '03-18' }, 'Anma töreni programı.'),
  d('anneler-gunu', 'Anneler Günü', 'anma', { nth: { month: 5, weekday: 0, n: 2 } }, 'Anneler Günü etkinlikleri.'),
  d('babalar-gunu', 'Babalar Günü', 'anma', { nth: { month: 6, weekday: 0, n: 3 } }),
  d('basin-bayrami', 'Gazeteciler ve Basın Bayramı', 'anma', { md: '07-24' }, 'Yerel basına teşekkür mesajı.'),
  d('gaziler-gunu', 'Gaziler Günü', 'anma', { md: '09-19' }),
  d('hayvanlari-koruma', 'Hayvanları Koruma Günü', 'anma', { md: '10-04' }, 'Sokak hayvanları için yapılan çalışmalar, mama noktaları.'),
  d('10-kasim', "Atatürk'ü Anma Günü", 'anma', { md: '11-10' }, 'Saat 09.05 saygı duruşu ve anma programı.'),
  d('ogretmenler-gunu', 'Öğretmenler Günü', 'anma', { md: '11-24' }, 'Öğretmenlere teşekkür mesajı.'),
  // Uluslararası günler
  d('kadinlar-gunu', 'Dünya Kadınlar Günü', 'uluslararasi', { md: '03-08' }, 'Kadınlara yönelik hizmetler ve etkinlikler.'),
  d('su-gunu', 'Dünya Su Günü', 'uluslararasi', { md: '03-22' }, 'Su tasarrufu önerileri.'),
  d('saglik-gunu', 'Dünya Sağlık Günü', 'uluslararasi', { md: '04-07' }),
  d('cevre-gunu', 'Dünya Çevre Günü', 'uluslararasi', { md: '06-05' }, 'Geri dönüşüm, temizlik ve ağaçlandırma çalışmaları.'),
  d('yaslilar-gunu', 'Dünya Yaşlılar Günü', 'uluslararasi', { md: '10-01' }, 'Yaşlılara yönelik evde bakım ve sosyal hizmetler.'),
  d('gida-gunu', 'Dünya Gıda Günü', 'uluslararasi', { md: '10-16' }, 'Gıda israfını önleme önerileri, sosyal market.'),
  d('cocuk-haklari', 'Dünya Çocuk Hakları Günü', 'uluslararasi', { md: '11-20' }),
  d('kadina-siddet', 'Kadına Yönelik Şiddete Karşı Uluslararası Mücadele Günü', 'uluslararasi', { md: '11-25' }, 'Destek hatları ve başvuru noktaları (ALO 183).'),
  d('engelliler-gunu', 'Dünya Engelliler Günü', 'uluslararasi', { md: '12-03' }, 'Erişilebilirlik çalışmaları ve engelli hizmetleri.'),
];

const pad = (n: number) => String(n).padStart(2, '0');
/** Yerel tarih anahtarı "YYYY-AA-GG". */
export const dateKey = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

/** Ayın n. haftanın günü (n = -1: son). */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  if (n > 0) {
    const first = new Date(year, month - 1, 1);
    return new Date(year, month - 1, 1 + ((weekday - first.getDay() + 7) % 7) + (n - 1) * 7);
  }
  const last = new Date(year, month, 0);
  return new Date(year, month - 1, last.getDate() - ((last.getDay() - weekday + 7) % 7));
}

/** Günün o yıldaki başlangıcı (tek seferlik gün başka yıldaysa null). */
export function startInYear(day: ImportantDay, year: number): Date | null {
  if (day.date) {
    const [y, m, dd] = day.date.split('-').map(Number);
    return y === year ? new Date(y, m - 1, dd) : null;
  }
  if (day.md) {
    const [m, dd] = day.md.split('-').map(Number);
    return new Date(year, m - 1, dd);
  }
  if (day.nth) return nthWeekday(year, day.nth.month, day.nth.weekday, day.nth.n);
  return null;
}

export interface DayOccurrence {
  day: ImportantDay;
  /** Bu takvim günü ("YYYY-AA-GG"). */
  date: string;
  /** Çok günlü bayramda kaçıncı gün (1'den). */
  nthDay: number;
}

/** [from, to) aralığına düşen bütün günler (çok günlü bayramların her günü ayrı). */
export function occurrencesBetween(days: readonly ImportantDay[], from: Date, to: Date): DayOccurrence[] {
  const out: DayOccurrence[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let y = start.getFullYear() - 1; y <= to.getFullYear(); y++) {
    for (const day of days) {
      const s = startInYear(day, y);
      if (!s) continue;
      for (let i = 0; i < Math.max(1, day.length ?? 1); i++) {
        const dt = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i);
        if (dt >= start && dt < to) out.push({ day, date: dateKey(dt), nthDay: i + 1 });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.day.title.localeCompare(b.day.title, 'tr'));
}

/** Önümüzdeki n gün içindeki günler (bayramın yalnızca ilk günü), kaç gün kaldığıyla. */
export function upcomingDays(days: readonly ImportantDay[], now = new Date(), within = 30): (DayOccurrence & { inDays: number })[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return occurrencesBetween(days, today, new Date(today.getTime() + (within + 1) * 86400000))
    .filter((o) => o.nthDay === 1)
    .map((o) => {
      const [y, m, dd] = o.date.split('-').map(Number);
      return { ...o, inDays: Math.round((new Date(y, m - 1, dd).getTime() - today.getTime()) / 86400000) };
    });
}

export type ImportantDayError = 'title' | 'date' | 'idea' | 'length';

/** Panel formu denetimi. */
export function validateImportantDay(day: ImportantDay): ImportantDayError[] {
  const errs: ImportantDayError[] = [];
  const title = day.title.trim();
  if (title.length < IMPORTANT_DAY_LIMITS.title[0] || title.length > IMPORTANT_DAY_LIMITS.title[1]) errs.push('title');
  const okMd = (s: string) => /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(s) && !Number.isNaN(new Date(`2024-${s}T00:00:00`).getTime()) && new Date(`2024-${s}T00:00:00`).getDate() === Number(s.slice(3));
  const whenCount = [day.md, day.date, day.nth].filter(Boolean).length;
  if (whenCount !== 1 || (day.md && !okMd(day.md)) || (day.date && !(/^20[0-9]{2}-/.test(day.date) && okMd(day.date.slice(5))))) errs.push('date');
  if ((day.idea ?? '').length > IMPORTANT_DAY_LIMITS.idea[1]) errs.push('idea');
  if (day.length !== undefined && (!Number.isInteger(day.length) || day.length < 1 || day.length > 10)) errs.push('length');
  return errs;
}

/** Kaydetmeden önce gereksiz alanları ayıklar (Firestore'a undefined gitmesin). */
export function cleanImportantDay(day: ImportantDay): ImportantDay {
  return {
    id: day.id, title: day.title.trim(), kind: day.kind,
    ...(day.md ? { md: day.md } : {}), ...(day.date ? { date: day.date } : {}), ...(day.nth ? { nth: day.nth } : {}),
    ...(day.length && day.length > 1 ? { length: day.length } : {}),
    ...(day.idea?.trim() ? { idea: day.idea.trim() } : {}),
  };
}
