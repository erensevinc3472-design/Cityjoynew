import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { rankEntries, sortContests, type Contest, type ContestEntry, type ContestInput, type ContestStatus, type EntryStatus } from '../polls/contests';
import { type Poll, type PollInput, type PollStatus } from '../polls/polls';
import { addAudit } from './grants';
import { countUsage } from './limits';

/**
 * Sosyal Harmoni: Anketler ve Yarışmalar (13. madde 35; Kulüpler 4 Kasım'da kaldırıldı, Eren). Okuma il başına tek sorgu (en çok 50), oy iki
 * yazım (oy belgesi + sayaç) ve günlük oy sayacı; kuralları `firestore.rules` denetler (tek oy, kendine oy yok, süre).
 */

const VISIBLE: ContestStatus[] = ['katilim', 'oylama', 'sonuc'];
const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : typeof v === 'string' ? v : '');
/** Gün sonuna kadar açık: kurallar bu zaman damgasını denetler. */
const endOfDay = (ymd: string) => Timestamp.fromDate(new Date(`${ymd}T23:59:59`));
const opt = (s: string | undefined) => (s?.trim() ? s.trim() : undefined);
const strip = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

const pollFrom = (id: string, d: DocumentData): Poll => ({
  id,
  question: d.question,
  options: d.options ?? [],
  sponsorName: d.sponsorName,
  provinceCode: d.provinceCode,
  districtId: d.districtId,
  endsOn: d.endsOn,
  status: d.status,
  counts: d.counts ?? {},
  voteCount: d.voteCount ?? 0,
  createdAt: iso(d.createdAt),
});
const contestFrom = (id: string, d: DocumentData): Contest => ({ ...(d as Contest), id, entryCount: d.entryCount ?? 0, createdAt: iso(d.createdAt) });
const entryFrom = (contestId: string, id: string, d: DocumentData): ContestEntry => ({ ...(d as ContestEntry), id, contestId, voteCount: d.voteCount ?? 0, createdAt: iso(d.createdAt) });

/** Uygulama tarafı. */
export function createFirestoreCommunityRepository(db: Firestore) {
  return {
    async listPolls(provinceCode: string): Promise<Poll[]> {
      const s = await getDocs(query(collection(db, 'polls'), where('provinceCode', '==', provinceCode), where('status', 'in', ['yayinda', 'kapali']), limit(50)));
      return s.docs.map((d) => pollFrom(d.id, d.data())).sort((a, b) => b.endsOn.localeCompare(a.endsOn));
    },
    /** Kendi oyu (gizli: yalnızca kendisi okur); yoksa null. */
    async myPollVote(pollId: string, uid: string): Promise<string | null> {
      const s = await getDoc(doc(db, 'pollVotes', `${pollId}_${uid}`));
      return s.exists() ? (s.get('optionId') as string) : null;
    },
    async votePoll(pollId: string, uid: string, optionId: string): Promise<void> {
      const batch = writeBatch(db);
      await countUsage(db, batch, { type: 'u', id: uid }, 'oy', uid);
      batch.set(doc(db, 'pollVotes', `${pollId}_${uid}`), { pollId, uid, optionId, createdAt: serverTimestamp() });
      batch.update(doc(db, 'polls', pollId), { [`counts.${optionId}`]: increment(1), voteCount: increment(1) });
      await batch.commit();
    },

    async listContests(provinceCode: string): Promise<Contest[]> {
      // İlin yarışmaları ve ülke geneli (bölge / Türkiye aşaması) iki küçük sorgu.
      const [own, wide] = await Promise.all([
        getDocs(query(collection(db, 'contests'), where('provinceCode', '==', provinceCode), where('status', 'in', VISIBLE), limit(30))),
        getDocs(query(collection(db, 'contests'), where('provinceCode', '==', ''), where('status', 'in', VISIBLE), limit(30))),
      ]);
      return sortContests([...own.docs, ...wide.docs].map((d) => contestFrom(d.id, d.data())).filter((c) => c.status !== 'gizlendi'));
    },
    async getContest(id: string): Promise<Contest | null> {
      const s = await getDoc(doc(db, 'contests', id));
      return s.exists() ? contestFrom(s.id, s.data()) : null;
    },
    /** Onaylı katılımcılar, oya göre (en çok 100). */
    async listEntries(contestId: string): Promise<ContestEntry[]> {
      const s = await getDocs(query(collection(db, 'contests', contestId, 'entries'), where('status', '==', 'onayli'), limit(100)));
      return rankEntries(s.docs.map((d) => entryFrom(contestId, d.id, d.data())));
    },
    async myEntry(contestId: string, uid: string): Promise<ContestEntry | null> {
      const s = await getDoc(doc(db, 'contests', contestId, 'entries', uid));
      return s.exists() ? entryFrom(contestId, s.id, s.data()) : null;
    },
    async join(contestId: string, uid: string, e: { displayName: string; mediaUrl: string; note?: string }): Promise<void> {
      await setDoc(
        doc(db, 'contests', contestId, 'entries', uid),
        strip({ ownerUid: uid, displayName: e.displayName.trim(), mediaUrl: e.mediaUrl.trim(), note: opt(e.note), termsAccepted: true, status: 'bekliyor', voteCount: 0, createdAt: serverTimestamp() }),
      );
    },
    /** Bu yarışmada oy verdiği katılımcılar (kendi oy belgeleri). */
    async myContestVotes(contestId: string, uid: string): Promise<Set<string>> {
      const s = await getDocs(query(collection(db, 'contestVotes'), where('uid', '==', uid), where('contestId', '==', contestId), limit(100)));
      return new Set(s.docs.map((d) => d.get('entryId') as string));
    },
    async voteEntry(contestId: string, entryId: string, uid: string): Promise<void> {
      const batch = writeBatch(db);
      await countUsage(db, batch, { type: 'u', id: uid }, 'oy', uid);
      batch.set(doc(db, 'contestVotes', `${contestId}_${entryId}_${uid}`), { contestId, entryId, uid, createdAt: serverTimestamp() });
      batch.update(doc(db, 'contests', contestId, 'entries', entryId), { voteCount: increment(1) });
      await batch.commit();
    },

  };
}

/** Panel: anket ve yarışma admin'in. Her işlem işlem kaydına yazılır. */
export function createCommunityAdmin(db: Firestore, actorUid: string) {
  const audit = (batch: ReturnType<typeof writeBatch>, module: 'bildirimler' | 'etkinlikler' | 'kurumlar', targetId: string, summary: string, provinceCode?: string) =>
    addAudit(db, batch, { actorUid, module, action: 'duzenle', targetId, summary, ...(provinceCode ? { scope: { level: 'il' as const, provinceCode } } : {}) });

  return {
    async listPolls(provinceCode: string): Promise<Poll[]> {
      const s = await getDocs(query(collection(db, 'polls'), where('provinceCode', '==', provinceCode), limit(100)));
      return s.docs.map((d) => pollFrom(d.id, d.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async savePoll(id: string | null, p: PollInput): Promise<void> {
      const ref = id ? doc(db, 'polls', id) : doc(collection(db, 'polls'));
      const body = strip({
        question: p.question.trim(),
        options: p.options.map((o) => ({ id: o.id, label: o.label.trim() })),
        sponsorName: p.sponsorName.trim(),
        provinceCode: p.provinceCode,
        districtId: p.districtId || undefined,
        endsOn: p.endsOn,
        endsAt: endOfDay(p.endsOn),
      });
      const batch = writeBatch(db);
      // Yeni ankette sayılar sıfırdan; düzenlemede sayılar korunur (seçenek değişmez).
      if (id) batch.update(ref, { ...body, updatedAt: serverTimestamp() });
      else batch.set(ref, { ...body, status: 'yayinda', counts: Object.fromEntries(p.options.map((o) => [o.id, 0])), voteCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      audit(batch, 'bildirimler', ref.id, `Anket ${id ? 'düzenlendi' : 'yayınlandı'}: ${body.question}`, p.provinceCode);
      await batch.commit();
    },
    async setPollStatus(p: Poll, status: PollStatus): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, 'polls', p.id), { status, updatedAt: serverTimestamp() });
      audit(batch, 'bildirimler', p.id, `Anket durumu: ${status} (${p.question})`, p.provinceCode);
      await batch.commit();
    },

    async listContests(): Promise<Contest[]> {
      const s = await getDocs(query(collection(db, 'contests'), limit(200)));
      return sortContests(s.docs.map((d) => contestFrom(d.id, d.data())));
    },
    async saveContest(id: string | null, c: ContestInput): Promise<void> {
      const ref = id ? doc(db, 'contests', id) : doc(collection(db, 'contests'));
      const body = strip({
        title: c.title.trim(),
        description: c.description.trim(),
        prize: opt(c.prize) ?? '',
        stage: c.stage,
        provinceCode: c.stage === 'il' ? (c.provinceCode ?? '') : '',
        regionName: c.stage === 'bolge' ? opt(c.regionName) : undefined,
        stageCount: c.stageCount,
        joinEndsOn: c.joinEndsOn,
        voteEndsOn: c.voteEndsOn,
        joinEndsAt: endOfDay(c.joinEndsOn),
        voteEndsAt: endOfDay(c.voteEndsOn),
        terms: c.terms.trim(),
      });
      const batch = writeBatch(db);
      if (id) batch.update(ref, { ...body, updatedAt: serverTimestamp() });
      else batch.set(ref, { ...body, status: 'katilim', entryCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      audit(batch, 'etkinlikler', ref.id, `Yarışma ${id ? 'düzenlendi' : 'yayınlandı'}: ${body.title}`, body.provinceCode || undefined);
      await batch.commit();
    },
    async setContestStatus(c: Contest, status: ContestStatus): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, 'contests', c.id), { status, updatedAt: serverTimestamp() });
      audit(batch, 'etkinlikler', c.id, `Yarışma durumu: ${status} (${c.title})`, c.provinceCode || undefined);
      await batch.commit();
    },
    /** Tüm katılımlar (bekleyen dahil). */
    async listAllEntries(contestId: string): Promise<ContestEntry[]> {
      const s = await getDocs(query(collection(db, 'contests', contestId, 'entries'), limit(500)));
      return s.docs.map((d) => entryFrom(contestId, d.id, d.data())).sort((a, b) => b.voteCount - a.voteCount || a.createdAt.localeCompare(b.createdAt));
    },
    /** Onay / diskalifiye; yarışmanın katılımcı sayısı onaylılarla birlikte değişir. */
    async setEntryStatus(c: Contest, e: ContestEntry, status: EntryStatus, reason = ''): Promise<void> {
      const batch = writeBatch(db);
      batch.update(doc(db, 'contests', c.id, 'entries', e.id), { status, reviewedBy: actorUid, updatedAt: serverTimestamp() });
      const delta = (status === 'onayli' ? 1 : 0) - (e.status === 'onayli' ? 1 : 0);
      if (delta) batch.update(doc(db, 'contests', c.id), { entryCount: increment(delta) });
      audit(batch, 'etkinlikler', `${c.id}/${e.id}`, `Katılım ${status}: ${e.displayName}${reason ? ` (${reason})` : ''}`, c.provinceCode || undefined);
      await batch.commit();
    },

  };
}
