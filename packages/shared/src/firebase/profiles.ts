import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';

import { ageGroup, type UserProfile } from '../models/user';
import { DEFAULT_OCCUPATIONS } from '../services/occupations';
import type { NewProfileInput, Occupation, OccupationRepository, ProfilePatch, ProfileRepository } from '../services/types';

const iso = (v: unknown): string | undefined => (v instanceof Timestamp ? v.toDate().toISOString() : undefined);

export function createFirestoreProfileRepository(db: Firestore): ProfileRepository {
  const ref = (uid: string) => doc(db, 'users', uid);

  return {
    async get(uid) {
      const snap = await getDoc(ref(uid));
      if (!snap.exists()) return null;
      const d = snap.data();
      return {
        ...(d as Omit<UserProfile, 'createdAt' | 'locationChangedAt'>),
        createdAt: iso(d.createdAt) ?? new Date().toISOString(),
        locationChangedAt: iso(d.locationChangedAt),
      };
    },

    async create(input: NewProfileInput) {
      await setDoc(ref(input.uid), {
        uid: input.uid,
        displayName: input.displayName.trim(),
        language: input.language,
        birthYear: input.birthYear,
        phoneVerified: false,
        emailVerified: false,
        // 13-17 yaş hesapları varsayılan (ve kural gereği) gizli.
        isPrivate: ageGroup(input.birthYear) !== 'yetiskin',
        consents: input.consents,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },

    async update(uid, patch: ProfilePatch, current) {
      const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
      for (const key of ['displayName', 'language', 'gender', 'occupationId', 'interests', 'isPrivate'] as const) {
        if (patch[key] !== undefined) data[key] = patch[key];
      }
      if (patch.location !== undefined) {
        const loc = patch.location;
        data.location = loc
          ? Object.fromEntries(Object.entries(loc).filter(([, v]) => v !== undefined))
          : deleteField();
        if ((loc?.neighbourhoodId ?? null) !== (current.location?.neighbourhoodId ?? null)) {
          data.locationChangedAt = serverTimestamp();
        }
      }
      if (patch.targeting) data['consents.targeting'] = patch.targeting;
      if (patch.commercialMessages) data['consents.commercialMessages'] = patch.commercialMessages;
      await updateDoc(ref(uid), data);
    },

    async delete(uid) {
      await deleteDoc(ref(uid));
    },
  };
}

export function createFirestoreOccupationRepository(db: Firestore): OccupationRepository {
  return {
    async listActive() {
      try {
        const snap = await getDocs(collection(db, 'occupations'));
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Occupation, 'id'>) }))
          .filter((o) => o.active)
          .sort((a, b) => a.order - b.order);
        return list.length ? list : DEFAULT_OCCUPATIONS;
      } catch {
        return DEFAULT_OCCUPATIONS;
      }
    },
  };
}
