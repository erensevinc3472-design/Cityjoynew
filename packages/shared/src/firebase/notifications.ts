import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, writeBatch, type Firestore } from 'firebase/firestore';

import {
  normalizeNotificationSettings,
  normalizePrefs,
  normalizeTriggers,
  type NotificationPrefs,
  type NotificationSettings,
  type NotificationTriggers,
} from '../notifications/notifications';
import { addAudit } from './grants';

const prefsRef = (db: Firestore, uid: string) => doc(db, 'users', uid, 'settings', 'notifications');
const triggersRef = (db: Firestore) => doc(db, 'config', 'notificationTriggers');

/** Kişinin bildirim tercihleri: kendi özel belgesinde (yalnızca kendisi okur ve yazar). */
export function createNotificationSettings(db: Firestore) {
  return {
    async get(uid: string): Promise<NotificationPrefs> {
      const snap = await getDoc(prefsRef(db, uid));
      return normalizePrefs(snap.exists() ? snap.data() : null);
    },
    async save(uid: string, prefs: NotificationPrefs): Promise<void> {
      const p = normalizePrefs(prefs);
      await setDoc(prefsRef(db, uid), { categories: p.categories, quietHours: p.quietHours, updatedAt: serverTimestamp() });
    },
    /** Hesap silinirken. */
    delete: (uid: string) => deleteDoc(prefsRef(db, uid)),
  };
}

/**
 * Panel (admin): hangi olayların bildirim ürettiği (PROJE.md 7: "her tetikleyici panelde açılıp kapatılabilir").
 * Acil duyuru ve SOS kapatılamaz. Aynı belgede telefon bildiriminin öncelikleri ve günlük sesli tavan (sunucu okur).
 * Uygulama oturum başına bir kez okur; her değişiklik işlem kaydına yazılır.
 */
export function createNotificationTriggers(db: Firestore) {
  return {
    async get(): Promise<NotificationTriggers> {
      const snap = await getDoc(triggersRef(db));
      return normalizeTriggers(snap.exists() ? snap.get('triggers') : null);
    },
    async save(actorUid: string, triggers: NotificationTriggers): Promise<NotificationTriggers> {
      const clean = normalizeTriggers(triggers);
      const batch = writeBatch(db);
      batch.set(triggersRef(db), { triggers: clean, updatedBy: actorUid, updatedAt: serverTimestamp() }, { merge: true });
      const off = Object.entries(clean).filter(([, on]) => !on).map(([k]) => k);
      addAudit(db, batch, {
        actorUid,
        module: 'bildirimler',
        action: 'duzenle',
        targetId: 'notificationTriggers',
        summary: off.length ? `Bildirim tetikleyicileri güncellendi (kapalı: ${off.join(', ')})` : 'Bildirim tetikleyicileri güncellendi (hepsi açık)',
      });
      await batch.commit();
      return clean;
    },
    async getSettings(): Promise<NotificationSettings> {
      const snap = await getDoc(triggersRef(db));
      return normalizeNotificationSettings(snap.exists() ? snap.data() : null);
    },
    /** Panelin tamamı: tetikleyiciler, öncelikler ve günlük sesli tavan. */
    async saveSettings(actorUid: string, settings: NotificationSettings): Promise<NotificationSettings> {
      const clean = normalizeNotificationSettings(settings);
      const batch = writeBatch(db);
      batch.set(triggersRef(db), { ...clean, updatedBy: actorUid, updatedAt: serverTimestamp() });
      const off = Object.entries(clean.triggers).filter(([, on]) => !on).map(([k]) => k);
      const prio = Object.entries(clean.priorities).map(([k, v]) => `${k}: ${v}`).join(', ');
      addAudit(db, batch, {
        actorUid,
        module: 'bildirimler',
        action: 'duzenle',
        targetId: 'notificationTriggers',
        summary: `Bildirim ayarları güncellendi (kapalı: ${off.join(', ') || 'yok'}; öncelikler: ${prio}; günlük sesli tavan: ${clean.dailySoundCap})`,
      });
      await batch.commit();
      return clean;
    },
  };
}
