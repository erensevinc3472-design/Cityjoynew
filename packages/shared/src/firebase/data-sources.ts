import { doc, getDoc, Timestamp, type Firestore } from 'firebase/firestore';

/** Dış veri kaynağının son çekim özeti (sunucu yazar, admin okur): Panel > Veri kaynakları. */
export interface DataSourceStatus {
  id: string;
  source: string;
  lastRunAt: number | null;
  lastSuccessAt: number | null;
  ok: number;
  failed: string[];
  runs: number;
}

const millis = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : null);

export const DATA_SOURCE_IDS = ['weather', 'pharmacy'] as const;

export function createDataSourceReader(db: Firestore) {
  return {
    /** Kaynak hiç çalışmadıysa null. */
    async get(id: string): Promise<DataSourceStatus | null> {
      const snap = await getDoc(doc(db, 'dataSources', id));
      if (!snap.exists()) return null;
      const d = snap.data();
      return {
        id,
        source: typeof d.source === 'string' ? d.source : '',
        lastRunAt: millis(d.lastRunAt),
        lastSuccessAt: millis(d.lastSuccessAt),
        ok: typeof d.ok === 'number' ? d.ok : 0,
        failed: Array.isArray(d.failed) ? d.failed.filter((x: unknown): x is string => typeof x === 'string') : [],
        runs: typeof d.runs === 'number' ? d.runs : 0,
      };
    },
  };
}
