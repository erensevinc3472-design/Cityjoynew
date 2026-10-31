import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { MESSAGE_LIMITS, quotaAfter, threadId, unreadKey, type Chat, type ChatContext, type ChatMessage, type MessageReportReason } from '../messages/messages';
import { addAudit, iso } from './grants';

const CHATS = 'chats';
const QUOTA = 'chatQuota';
const REPORTS = 'messageReports';

function chatFromDoc(id: string, d: DocumentData): Chat {
  const times = (m: unknown) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries((m ?? {}) as Record<string, unknown>)) {
      const at = iso(v);
      if (at) out[k] = at;
    }
    return out;
  };
  return {
    id,
    members: d.members,
    names: d.names ?? {},
    startedBy: d.startedBy,
    accepted: d.accepted === true,
    ...(d.last ? { last: { id: d.last.id, text: d.last.text ?? '', from: d.last.from, at: iso(d.last.at) ?? new Date().toISOString() } } : {}),
    unread: d.unread ?? {},
    seen: times(d.seen),
    hidden: times(d.hidden),
    ...(d.context ? { context: { type: d.context.type, id: d.context.id, title: d.context.title ?? '' } } : {}),
    // Sunucu zamanı henüz yazılmadıysa (yerel önbellek) şimdiki zaman sayılır.
    updatedAt: iso(d.updatedAt) ?? new Date().toISOString(),
  };
}

function messageFromDoc(id: string, d: DocumentData): ChatMessage {
  return { id, from: d.from, text: d.text ?? '', status: d.status ?? 'aktif', createdAt: iso(d.createdAt) ?? new Date().toISOString() };
}

export interface MessageReport {
  id: string;
  chatId: string;
  messageId: string;
  reporterUid: string;
  reportedUid: string;
  text: string;
  reason: MessageReportReason;
  createdAt: string;
}

/**
 * Uygulama: birebir sohbetler. Sohbet belgesi "kişi_kişi" kimliklidir; mesaj ve sohbet özeti (son mesaj, okunmamış
 * sayısı) aynı toplu yazımda değişir, kurallar ikisinin birbirini tuttuğunu denetler. İlk mesaj günlük yeni sohbet
 * sınırına sayılır (spam önlemi, sunucu işlevi olmadan).
 */
export function createFirestoreMessageRepository(db: Firestore) {
  const chatRef = (id: string) => doc(db, CHATS, id);
  const messages = (id: string) => collection(db, CHATS, id, 'messages');

  return {
    /** Benim sohbetlerim, en yeni üstte (ekran açıkken canlı). Döner: dinlemeyi bırakma işlevi. */
    watchChats(me: string, onChange: (chats: Chat[]) => void, onError: () => void): () => void {
      return onSnapshot(
        query(collection(db, CHATS), where('members', 'array-contains', me), orderBy('updatedAt', 'desc'), limit(MESSAGE_LIMITS.listSize)),
        (s) => onChange(s.docs.map((d) => chatFromDoc(d.id, d.data()))),
        onError,
      );
    },

    /** Bir işletmeye yazılan sohbetler (mesaj izni olan yetkili için; sahibi zaten üyedir). */
    watchBusinessChats(businessId: string, onChange: (chats: Chat[]) => void, onError: () => void): () => void {
      return onSnapshot(
        query(collection(db, CHATS), where('context.id', '==', businessId), orderBy('updatedAt', 'desc'), limit(MESSAGE_LIMITS.listSize)),
        (s) => onChange(s.docs.map((d) => chatFromDoc(d.id, d.data()))),
        onError,
      );
    },

    async getChat(id: string): Promise<Chat | null> {
      const snap = await getDoc(chatRef(id));
      return snap.exists() ? chatFromDoc(snap.id, snap.data()) : null;
    },

    watchChat(id: string, onChange: (chat: Chat | null) => void, onError: () => void): () => void {
      return onSnapshot(chatRef(id), (s) => onChange(s.exists() ? chatFromDoc(s.id, s.data()) : null), onError);
    },

    /** Sohbetin son mesajları, eskiden yeniye. Sohbeti sildiysem yalnızca sonrakiler (`after`, ISO). */
    watchMessages(id: string, onChange: (list: ChatMessage[]) => void, onError: () => void, after?: string): () => void {
      const since = after ? [where('createdAt', '>', Timestamp.fromDate(new Date(after)))] : [];
      return onSnapshot(
        query(messages(id), ...since, orderBy('createdAt', 'desc'), limit(MESSAGE_LIMITS.pageSize)),
        (s) => onChange(s.docs.map((d) => messageFromDoc(d.id, d.data())).reverse()),
        onError,
      );
    },

    /**
     * Mesaj gönderir. Sohbet yoksa açılır: takipleşiyorlarsa doğrudan sohbet, değilse alıcıda istek. İsteği alan kişi
     * cevap yazınca sohbet kabul edilmiş olur. İşletmeye yazılan sohbet (`context`) baştan açıktır; adı işletmenin adıdır.
     */
    async send(
      me: string,
      other: string,
      text: string,
      opts: { chat: Chat | null; myName: string; otherName: string; mutual: boolean; context?: ChatContext },
    ): Promise<void> {
      const id = opts.chat?.id ?? threadId(me, other, opts.context);
      const ref = doc(messages(id));
      const body = text.trim();
      const last = { id: ref.id, text: body.slice(0, MESSAGE_LIMITS.preview), from: me, at: serverTimestamp() };
      const batch = writeBatch(db);
      batch.set(ref, { from: me, text: body, status: 'aktif', createdAt: serverTimestamp() });
      if (!opts.chat) {
        const quota = await getDoc(doc(db, QUOTA, me));
        const next = quotaAfter(quota.exists() ? { windowStart: iso(quota.get('windowStart')) ?? new Date(0).toISOString(), count: quota.get('count') ?? 0 } : null, new Date());
        batch.set(doc(db, QUOTA, me), next.reset ? { windowStart: serverTimestamp(), count: 1 } : { windowStart: quota.get('windowStart'), count: next.count });
        batch.set(chatRef(id), {
          members: [me, other].sort(),
          names: { [me]: opts.myName, [other]: opts.context ? opts.context.title : opts.otherName },
          startedBy: me,
          accepted: opts.context ? true : opts.mutual,
          ...(opts.context ? { context: { type: opts.context.type, id: opts.context.id, title: opts.context.title } } : {}),
          last,
          unread: { [me]: 0, [other]: 1 },
          seen: {},
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.update(chatRef(id), {
          last,
          [`unread.${other}`]: increment(1),
          updatedAt: serverTimestamp(),
          // İsteği alan kişi cevap yazınca sohbet kabul edilmiş olur.
          ...(!opts.chat.accepted && opts.chat.startedBy !== me ? { accepted: true } : {}),
        });
      }
      await batch.commit();
    },

    /**
     * Okunmamış sayısı sıfırlanır; okundu bilgisi açıksa "gördüm" zamanı yazılır. Yetkili işletmenin ortak sayacını
     * sıfırlar, "gördüm" yazmaz.
     */
    async markRead(chat: Chat, me: string, receipts: boolean): Promise<void> {
      const key = unreadKey(chat, me);
      const seen = receipts && chat.members.includes(me);
      if (!chat.unread[key] && !seen) return;
      const batch = writeBatch(db);
      batch.update(chatRef(chat.id), { [`unread.${key}`]: 0, ...(seen ? { [`seen.${me}`]: serverTimestamp() } : {}) });
      await batch.commit();
    },

    /** Mesaj isteğini kabul et (cevap yazmadan). */
    async accept(id: string): Promise<void> {
      const batch = writeBatch(db);
      batch.update(chatRef(id), { accepted: true });
      await batch.commit();
    },

    /** "Sohbeti sil": sohbet yalnızca benim listemden kalkar; karşı taraf yeniden yazarsa geri gelir, eski mesajlar görünmez. */
    async hide(chat: Chat, me: string): Promise<void> {
      const batch = writeBatch(db);
      batch.update(chatRef(chat.id), { [`hidden.${me}`]: serverTimestamp(), [`unread.${me}`]: 0 });
      await batch.commit();
    },

    /** Gönderen kendi mesajını siler: yazı boşaltılır, "mesaj silindi" görünür. Son mesajsa önizleme de boşalır. */
    async deleteMessage(chat: Chat, message: ChatMessage): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(messages(chat.id), message.id), { status: 'silindi', text: '' });
      if (chat.last?.id === message.id) batch.update(chatRef(chat.id), { 'last.text': '' });
      await batch.commit();
    },

    /** Karşı tarafın mesajını şikâyet et: mesajın o anki kopyası saklanır, yalnızca admin görür. Kişi başına bir. */
    async report(chat: Chat, message: ChatMessage, me: string, reason: MessageReportReason): Promise<void> {
      const batch = writeBatch(db);
      batch.set(doc(db, REPORTS, `${me}_${message.id}`), {
        chatId: chat.id,
        messageId: message.id,
        reporterUid: me,
        reportedUid: message.from,
        text: message.text,
        reason,
        status: 'acik',
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    },

    async hasReported(messageId: string, me: string): Promise<boolean> {
      const snap = await getDoc(doc(db, REPORTS, `${me}_${messageId}`)).catch(() => null);
      return !!snap?.exists();
    },

    /** Hesap silinirken: yazdığım mesajlar ve sohbetlerim silinir (KVKK). */
    async deleteAllOf(me: string): Promise<void> {
      const chats = await getDocs(query(collection(db, CHATS), where('members', 'array-contains', me)));
      for (const c of chats.docs) {
        const mine = await getDocs(query(messages(c.id), where('from', '==', me)));
        for (let i = 0; i < mine.docs.length; i += 400) {
          const batch = writeBatch(db);
          mine.docs.slice(i, i + 400).forEach((m) => batch.delete(m.ref));
          await batch.commit();
        }
        const batch = writeBatch(db);
        batch.delete(c.ref);
        await batch.commit();
      }
    },
  };
}

/** Panel (yalnızca admin): mesaj şikâyetleri. Admin yalnızca şikâyet edilen mesajın kopyasını görür, sohbetin tamamını değil. */
export function createMessageModeration(db: Firestore, actorUid: string) {
  return {
    async listReports(): Promise<MessageReport[]> {
      const snap = await getDocs(query(collection(db, REPORTS), where('status', '==', 'acik'), orderBy('createdAt', 'desc'), limit(100)));
      return snap.docs.map((d) => ({
        id: d.id,
        chatId: d.get('chatId'),
        messageId: d.get('messageId'),
        reporterUid: d.get('reporterUid'),
        reportedUid: d.get('reportedUid'),
        text: d.get('text') ?? '',
        reason: d.get('reason'),
        createdAt: iso(d.get('createdAt')) ?? '',
      }));
    },

    /** Mesajı kaldırır (yazı boşaltılır, sohbette "kaldırıldı" görünür) ve şikâyeti kapatır. */
    async remove(r: MessageReport): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, CHATS, r.chatId, 'messages', r.messageId), { status: 'kaldirildi', text: '' });
      batch.update(doc(db, REPORTS, r.id), { status: 'incelendi' });
      addAudit(db, batch, { actorUid, module: 'moderasyon', action: 'sil', targetId: `${r.chatId}/${r.messageId}`, summary: `Mesaj kaldırıldı (şikâyet): ${r.text.slice(0, 60)}` });
      await batch.commit();
    },

    async dismiss(r: MessageReport): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, REPORTS, r.id), { status: 'incelendi' });
      addAudit(db, batch, { actorUid, module: 'moderasyon', action: 'duzenle', targetId: `${r.chatId}/${r.messageId}`, summary: `Mesaj şikâyeti reddedildi: ${r.text.slice(0, 60)}` });
      await batch.commit();
    },
  };
}
