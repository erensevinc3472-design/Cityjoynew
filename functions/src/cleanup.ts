import type { Firestore } from 'firebase-admin/firestore';

/**
 * Süresi dolan SOS kayıtlarını siler (gönderilişinden 30 gün sonra, `deleteAt`; PROJE.md 5.12). Günde bir çalışır,
 * Firestore TTL ayarına gerek kalmaz. Silinen sayıyı döndürür.
 */
export async function deleteExpiredSos(db: Firestore, now: Date): Promise<number> {
  return deleteExpired(db, 'sosAlerts', now);
}

/** Bildirim tekrarını önleyen süreli kayıtlar (takip bildirimi; `deleteAt` olmayan duyuru kayıtları kalır). */
export async function deleteExpiredPushLog(db: Firestore, now: Date): Promise<number> {
  return deleteExpired(db, 'pushLog', now);
}

async function deleteExpired(db: Firestore, collection: string, now: Date): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await db.collection(collection).where('deleteAt', '<=', now).limit(400).get();
    if (snap.empty) return total;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
  }
}

/**
 * Hesap silinince geride kalan kişisel kayıtları siler. Uygulama silmeden önce kişinin bütün verisini zaten siler
 * (hesap ekranı); bu, telefon yarıda kapanırsa ya da hesap konsoldan silinirse kalanları temizleyen güvenlik ağıdır.
 */
export async function deleteUserLeftovers(db: Firestore, uid: string): Promise<void> {
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await Promise.all(['pushTokens', 'publicProfiles', 'chatQuota'].map((c) => db.doc(`${c}/${uid}`).delete()));
}
