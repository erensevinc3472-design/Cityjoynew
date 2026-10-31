/**
 * Mesajlar (PROJE.md 5.11). İlk sürümde yalnızca birebir, yalnızca yazı (fotoğraf, ses, video ve grup sohbeti yok;
 * Eren onayladı). Takipleşilmeyen kişiden gelen ilk mesaj "mesaj isteği" olarak düşer; alıcı kabul edene (ya da
 * cevap yazana) kadar sohbetler listesinde değil, İstekler'de görünür. Yetişkinle 13-17 yaş arası kişi birbirine
 * mesaj atamaz. Engel iki yönde de yazışmayı durdurur. Kurallar aynı sınırları sunucuda denetler.
 */
export const MESSAGE_LIMITS = {
  text: [1, 1000],
  /** Sohbet ekranında okunan son mesaj sayısı. */
  pageSize: 50,
  /** Sohbet listesinde gösterilen en yeni sohbet. */
  listSize: 50,
  /** Yeni sohbet (ilk mesaj) sınırı, 24 saatte: spam önlemi. Yeni hesaplarda (ilk 7 gün) daha düşük. */
  newChatsPerDay: 30,
  newChatsPerDayNewAccount: 10,
  newAccountDays: 7,
  /** Sohbet listesindeki önizleme. */
  preview: 80,
} as const;

export const MESSAGE_REPORT_REASONS = ['taciz', 'dolandiricilik', 'spam', 'uygunsuz', 'diger'] as const;
export type MessageReportReason = (typeof MESSAGE_REPORT_REASONS)[number];

/** İki kişinin tek sohbeti: kimlikler sıralanıp birleştirilir, böylece aynı iki kişi için ikinci sohbet açılmaz. */
export function chatId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

/**
 * Sohbetin konusu: işletmeye yazılan sohbet (müşteri başlatır, istek aşaması yok; işletme sahibinde "İşletmem" bölümüne
 * düşer). Aynı iki kişinin konusuz sohbetiyle ve başka işletmeler için açılan sohbetlerle karışmaz.
 */
export interface ChatContext {
  type: 'isletme';
  id: string;
  /** İşletmenin adı (sohbet açılırken yazılır). */
  title: string;
}

/** Sohbet kimliği: iki kişi (sıralı), konu varsa sonuna konunun kimliği ("__b_" işletme). */
export function threadId(a: string, b: string, context?: Pick<ChatContext, 'type' | 'id'> | null): string {
  return context ? `${chatId(a, b)}__b_${context.id}` : chatId(a, b);
}

export function otherMember(chat: Pick<Chat, 'members'>, me: string): string {
  return chat.members[0] === me ? chat.members[1] : chat.members[0];
}

export interface Chat {
  id: string;
  members: [string, string];
  /** Herkese açık Keşfet adları ("Ayşe K."), sohbet açılırken yazılır. */
  names: Record<string, string>;
  startedBy: string;
  /** Takipleşen iki kişide baştan true; değilse alıcı kabul edince (ya da cevap yazınca) true. */
  accepted: boolean;
  last?: { id: string; text: string; from: string; at: string };
  unread: Record<string, number>;
  context?: ChatContext;
  /** "Sohbeti sil": kişinin sohbeti listesinden kaldırdığı an (ISO). Karşı tarafın kopyasına dokunulmaz. */
  hidden: Record<string, string>;
  /** Okundu bilgisi açık olan kişinin sohbeti en son gördüğü an (ISO). */
  seen: Record<string, string>;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  /** silindi: gönderen sildi; kaldirildi: moderatör kaldırdı. */
  status: 'aktif' | 'silindi' | 'kaldirildi';
  createdAt: string;
}

/** Sohbet bana göre nerede: Sohbetler mi, İstekler mi (bana gelen, kabul etmediğim). */
export function isRequestFor(chat: Pick<Chat, 'accepted' | 'startedBy'>, me: string): boolean {
  return !chat.accepted && chat.startedBy !== me;
}

export type InboxSection = 'sohbetler' | 'istekler' | 'isletmem';

/** Sohbet gelen kutumda hangi bölümde: müşterilerin işletmeme yazdıkları "İşletmem"de, gelen istekler "İstekler"de. */
export function inboxSection(chat: Pick<Chat, 'accepted' | 'startedBy' | 'context'>, me: string): InboxSection {
  if (chat.context?.type === 'isletme' && chat.startedBy !== me) return 'isletmem';
  return isRequestFor(chat, me) ? 'istekler' : 'sohbetler';
}

/** Sildiğim sohbet, sonra yeni mesaj gelmediyse listemde görünmez. */
export function isHiddenFor(chat: Pick<Chat, 'hidden' | 'last'>, me: string): boolean {
  const at = chat.hidden[me];
  return !!at && (!chat.last || chat.last.at <= at);
}

/** Listede görünen ad: müşteri işletmenin adını, diğerleri kişinin adını görür. */
export function chatTitle(chat: Pick<Chat, 'names' | 'members' | 'context' | 'startedBy'>, me: string): string {
  if (chat.context && chat.startedBy === me) return chat.context.title;
  return chat.names[otherMember(chat, me)] ?? '?';
}

export function validateMessage(text: string): 'empty' | 'tooLong' | null {
  const t = text.trim();
  if (t.length < MESSAGE_LIMITS.text[0]) return 'empty';
  if (t.length > MESSAGE_LIMITS.text[1]) return 'tooLong';
  return null;
}

export type ScamSignal = 'iban' | 'kapora' | 'link';

/**
 * Dolandırıcılık uyarısı (PROJE.md 5.11): mesajda IBAN, kapora / ön ödeme ya da dış bağlantı geçerse sohbette
 * uyarı gösterilir. Mesaj engellenmez; kişi bilgilendirilir.
 */
export function scamSignal(text: string): ScamSignal | null {
  const compact = text.replace(/\s+/g, '').toUpperCase();
  if (/TR\d{24}/.test(compact) || /\bIBAN\b/i.test(text)) return 'iban';
  if (/kapora|ön ?ödeme|on ?odeme|peşin ödeme|pesin odeme|depozito|havale|eft\b/i.test(text)) return 'kapora';
  if (/(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|xyz|info|me|ly|io|site|online|shop)(\/\S*)?\b/i.test(text)) return 'link';
  return null;
}

/** Bir günlük pencere (sınır sayacı): pencere dolmuşsa yeniden başlar. */
export function quotaAfter(old: { windowStart: string; count: number } | null, now: Date): { reset: boolean; count: number } {
  const expired = !old || now.getTime() - new Date(old.windowStart).getTime() >= 24 * 60 * 60 * 1000;
  return expired ? { reset: true, count: 1 } : { reset: false, count: old.count + 1 };
}
