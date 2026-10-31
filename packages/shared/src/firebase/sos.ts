import {
  arrayRemove,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import type { LanguageCode } from '../i18n/languages';
import type { Module } from '../permissions/types';
import {
  clampSosConfig,
  familyLinkId,
  FamilyError,
  FAMILY_MAX,
  generateInviteCode,
  INVITE_HOURS,
  normalizeInviteCode,
  type FamilyInvite,
  type FamilyMember,
  type FamilyRepository,
  type PushTarget,
  type PushTokenRepository,
  type SosAlert,
  type SosConfig,
  type SosRepository,
} from '../sos/sos';

const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : new Date().toISOString());
const isoMap = (m: Record<string, unknown> | undefined) => Object.fromEntries(Object.entries(m ?? {}).map(([k, v]) => [k, iso(v)]));
/** SOS kayıtları 30 gün sonra silinir (Firestore TTL politikası "deleteAt" alanına göre; KVKK). */
const RETENTION_DAYS = 30;
/** İnternet yoksa gönderim sonsuza dek beklemesin: kullanıcıya 112 önerilsin. */
const SEND_TIMEOUT_MS = 12_000;

export class SosSendTimeoutError extends Error {
  constructor() {
    super('sos-timeout');
    this.name = 'SosSendTimeoutError';
  }
}

function alertFromDoc(id: string, d: DocumentData): SosAlert {
  return {
    id,
    fromUid: d.fromUid,
    fromName: d.fromName,
    recipients: d.recipients ?? [],
    test: !!d.test,
    status: d.status,
    ...(d.location ? { location: { lat: d.location.lat, lng: d.location.lng, ...(d.location.accuracy != null ? { accuracy: d.location.accuracy } : {}), at: iso(d.location.at) } } : {}),
    createdAt: iso(d.createdAt),
    liveUntil: iso(d.liveUntil),
    deliveredTo: isoMap(d.deliveredTo),
    seenBy: isoMap(d.seenBy),
  };
}

export function createFirestoreFamilyRepository(db: Firestore): FamilyRepository {
  const links = collection(db, 'familyLinks');
  const invites = collection(db, 'familyInvites');

  const listMembers = async (uid: string): Promise<FamilyMember[]> => {
    const snap = await getDocs(query(links, where('members', 'array-contains', uid)));
    return snap.docs
      .map((d) => {
        const data = d.data();
        const other = (data.members as string[]).find((m) => m !== uid)!;
        return { uid: other, name: data.names?.[other] ?? '', since: iso(data.createdAt) };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  };

  return {
    listMembers,

    async createInvite(uid, name) {
      // Kullanılmamış eski davetler kaldırılır: aynı anda tek geçerli kod olur.
      const old = await getDocs(query(invites, where('fromUid', '==', uid)));
      const batch = writeBatch(db);
      old.docs.forEach((d) => batch.delete(d.ref));
      const code = generateInviteCode();
      const expires = new Date(Date.now() + INVITE_HOURS * 3600_000 - 60_000);
      batch.set(doc(invites, code), { fromUid: uid, fromName: name, createdAt: serverTimestamp(), expiresAt: Timestamp.fromDate(expires) });
      await batch.commit();
      return { code, fromUid: uid, fromName: name, createdAt: new Date().toISOString(), expiresAt: expires.toISOString() } satisfies FamilyInvite;
    },

    async cancelInvite(code) {
      await writeBatch(db).delete(doc(invites, code)).commit();
    },

    async acceptInvite(rawCode, uid, name) {
      const code = normalizeInviteCode(rawCode);
      if (!code) throw new FamilyError('invalid');
      const snap = await getDoc(doc(invites, code)).catch(() => null);
      if (!snap?.exists()) throw new FamilyError('invalid');
      const inv = snap.data();
      if (inv.fromUid === uid) throw new FamilyError('self');
      if (inv.usedBy) throw new FamilyError(inv.usedBy === uid ? 'already' : 'used');
      if ((inv.expiresAt as Timestamp).toMillis() < Date.now()) throw new FamilyError('expired');
      const mine = await listMembers(uid);
      if (mine.some((m) => m.uid === inv.fromUid)) throw new FamilyError('already');
      if (mine.length >= FAMILY_MAX) throw new FamilyError('full');

      const batch = writeBatch(db);
      batch.update(snap.ref, { usedBy: uid, usedAt: serverTimestamp() });
      batch.set(doc(links, familyLinkId(uid, inv.fromUid)), {
        members: [uid, inv.fromUid].sort(),
        names: { [uid]: name, [inv.fromUid]: inv.fromName },
        inviteCode: code,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      return { uid: inv.fromUid, name: inv.fromName, since: new Date().toISOString() };
    },

    async remove(uid, otherUid) {
      await writeBatch(db).delete(doc(links, familyLinkId(uid, otherUid))).commit();
    },

    async deleteAllOf(uid) {
      const [l, i, a] = await Promise.all([
        getDocs(query(links, where('members', 'array-contains', uid))),
        getDocs(query(invites, where('fromUid', '==', uid))),
        getDocs(query(collection(db, 'sosAlerts'), where('fromUid', '==', uid))),
      ]);
      const batch = writeBatch(db);
      [...l.docs, ...i.docs, ...a.docs].forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, 'pushTokens', uid));
      batch.delete(doc(db, 'pushCount', uid));
      await batch.commit();
    },
  };
}

export function createFirestoreSosRepository(db: Firestore): SosRepository {
  const alerts = collection(db, 'sosAlerts');
  return {
    async config() {
      try {
        const snap = await getDoc(doc(db, 'config', 'sos'));
        return clampSosConfig((snap.data() ?? {}) as Partial<SosConfig>);
      } catch {
        return clampSosConfig({});
      }
    },

    async send({ fromUid, fromName, recipients, test, location, liveMinutes }) {
      const ref = doc(alerts);
      const now = Date.now();
      const write = setDoc(ref, {
        fromUid,
        fromName,
        recipients,
        test,
        status: 'aktif',
        ...(location ? { location: { ...location, at: serverTimestamp() } } : {}),
        createdAt: serverTimestamp(),
        liveUntil: Timestamp.fromMillis(now + liveMinutes * 60_000),
        deleteAt: Timestamp.fromMillis(now + RETENTION_DAYS * 86400_000),
        deliveredTo: {},
        seenBy: {},
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SosSendTimeoutError()), SEND_TIMEOUT_MS);
      });
      try {
        await Promise.race([write, timeout]);
      } finally {
        clearTimeout(timer);
      }
      return ref.id;
    },

    async updateLocation(id, location) {
      await updateDoc(doc(alerts, id), { location: { ...location, at: serverTimestamp() } });
    },

    async setStatus(id, status) {
      await updateDoc(doc(alerts, id), { status });
    },

    async markDelivered(id, uid) {
      await updateDoc(doc(alerts, id), { [`deliveredTo.${uid}`]: serverTimestamp() });
    },

    async markSeen(id, uid) {
      await updateDoc(doc(alerts, id), { [`seenBy.${uid}`]: serverTimestamp() });
    },

    watch(id, onChange, onError) {
      return onSnapshot(doc(alerts, id), (s) => onChange(s.exists() ? alertFromDoc(s.id, s.data()) : null), onError);
    },

    watchIncoming(uid, onChange, onError) {
      return onSnapshot(
        query(alerts, where('recipients', 'array-contains', uid), orderBy('createdAt', 'desc'), limit(5)),
        (s) => onChange(s.docs.map((d) => alertFromDoc(d.id, d.data()))),
        onError,
      );
    },

    async listSent(uid) {
      const snap = await getDocs(query(alerts, where('fromUid', '==', uid), orderBy('createdAt', 'desc'), limit(30)));
      return snap.docs.map((d) => alertFromDoc(d.id, d.data()));
    },

    async delete(id) {
      await writeBatch(db).delete(doc(alerts, id)).commit();
    },
  };
}

/** Panel > SOS ayarları (admin). Kişilerin SOS kayıtları ve konumları panelde gösterilmez (gizlilik). */
export function createSosSettingsAdmin(db: Firestore, actorUid: string) {
  return {
    async get(): Promise<SosConfig> {
      return clampSosConfig(((await getDoc(doc(db, 'config', 'sos'))).data() ?? {}) as Partial<SosConfig>);
    },
    async save(c: SosConfig) {
      const clean = clampSosConfig(c);
      const module: Module = 'sos';
      const batch = writeBatch(db);
      batch.set(doc(db, 'config', 'sos'), { ...clean, updatedBy: actorUid, updatedAt: serverTimestamp() });
      batch.set(doc(collection(db, 'auditLog')), {
        actorUid,
        module,
        action: 'duzenle',
        targetId: 'config/sos',
        at: serverTimestamp(),
        summary: `SOS ayarları: canlı konum ${clean.liveMinutes} dk, geri sayım ${clean.countdownSeconds} sn`,
      });
      await batch.commit();
    },
  };
}

/** Telefon başına bildirim adresi (Expo push). Yalnızca sahibi ve aile üyeleri okur. */
export function createFirestorePushTokenRepository(db: Firestore): PushTokenRepository {
  const ref = (uid: string) => doc(db, 'pushTokens', uid);
  return {
    async save(uid, token, language: LanguageCode) {
      const snap = await getDoc(ref(uid));
      // En çok 5 telefon: en eski adres düşer.
      const tokens = [...((snap.get('tokens') as string[] | undefined) ?? []).filter((x) => x !== token), token].slice(-5);
      await setDoc(ref(uid), { tokens, language, updatedAt: serverTimestamp() });
    },
    async remove(uid, token) {
      await updateDoc(ref(uid), { tokens: arrayRemove(token), updatedAt: serverTimestamp() }).catch(() => {});
    },
    async forUsers(uids) {
      const docs = await Promise.all(uids.map((u) => getDoc(ref(u)).catch(() => null)));
      return docs.flatMap((d, i): PushTarget[] =>
        d?.exists() ? [{ uid: uids[i], tokens: (d.get('tokens') as string[]) ?? [], language: (d.get('language') as LanguageCode) ?? 'tr' }] : [],
      );
    },
  };
}
