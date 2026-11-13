import { applicationDefault } from 'firebase-admin/app';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { cleanUsageReport, COST_SAMPLE_PCT, costDayKey, isCostSampled, type ServerUsage } from '@cityjoy/shared';

/**
 * Özelliklere göre harcama (Eren, 13 Kasım 2026; packages/shared/src/billing/cost.ts).
 * - reportUsage: örneklemdeki kullanıcının uygulaması koleksiyona göre okuma/yazma sayısını yollar; o günün
 *   `billing/cost-{gün}` belgesine artırımla eklenir (çağrı başına bir yazma).
 * - costReport (her gece): dünün sunucu işi çağrı/süre, toplam veritabanı işlemleri ve dosya indirme/saklama bilgisi
 *   Google Cloud Monitoring'den okunur ve aynı belgeye yazılır. Okunamazsa hata belgeye not edilir.
 */
export class UsageError extends Error {
  constructor(readonly code: 'gecersiz' | 'orneklem-disi') {
    super(code);
  }
}

export async function handleReportUsage(db: Firestore, uid: string, data: unknown, now: Date): Promise<void> {
  if (!isCostSampled(uid)) throw new UsageError('orneklem-disi');
  const r = cleanUsageReport(data);
  if (!r) throw new UsageError('gecersiz');
  const day = costDayKey(now);
  const inc: Record<string, unknown> = { day, 'client.reporters': FieldValue.increment(1), 'client.samplePct': COST_SAMPLE_PCT };
  for (const [k, n] of Object.entries(r.reads)) inc[`client.reads.${k}`] = FieldValue.increment(n);
  for (const [k, n] of Object.entries(r.writes)) inc[`client.writes.${k}`] = FieldValue.increment(n);
  const ref = db.doc(`billing/cost-${day}`);
  // update nokta yollarını alan olarak işler; belge yoksa önce boş oluşturulur.
  await ref.update(inc).catch(async () => {
    await ref.set({ day }, { merge: true });
    await ref.update(inc);
  });
}

/** Cloud Monitoring zaman serisi isteği (tek gün, toplanmış). */
export type MonitoringFetch = (filter: string, aligner: string, groupBy: string[], start: Date, end: Date) => Promise<{ labels: Record<string, string>; value: number }[]>;

export const cloudMonitoring =
  (projectId: string): MonitoringFetch =>
  async (filter, aligner, groupBy, start, end) => {
    const { access_token } = await applicationDefault().getAccessToken();
    const p = new URLSearchParams({
      filter,
      'interval.startTime': start.toISOString(),
      'interval.endTime': end.toISOString(),
      'aggregation.alignmentPeriod': `${Math.round((end.getTime() - start.getTime()) / 1000)}s`,
      'aggregation.perSeriesAligner': aligner,
      'aggregation.crossSeriesReducer': 'REDUCE_SUM',
    });
    groupBy.forEach((g) => p.append('aggregation.groupByFields', g));
    const out: { labels: Record<string, string>; value: number }[] = [];
    let token = '';
    do {
      if (token) p.set('pageToken', token);
      const res = await fetch(`https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?${p}`, { headers: { Authorization: `Bearer ${access_token}` } });
      if (!res.ok) throw new Error(`monitoring ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const j = (await res.json()) as {
        timeSeries?: { resource?: { labels?: Record<string, string> }; metric?: { labels?: Record<string, string> }; points?: { value?: { int64Value?: string; doubleValue?: number } }[] }[];
        nextPageToken?: string;
      };
      for (const s of j.timeSeries ?? []) {
        const v = (s.points ?? []).reduce((sum, pt) => sum + Number(pt.value?.int64Value ?? pt.value?.doubleValue ?? 0), 0);
        out.push({ labels: { ...s.resource?.labels, ...s.metric?.labels }, value: v });
      }
      token = j.nextPageToken ?? '';
    } while (token);
    return out;
  };

const sum = (l: { value: number }[]) => l.reduce((s, x) => s + x.value, 0);

/** Dünün (Türkiye günü) sunucu kullanımını okur ve yazar. Döner: gün anahtarı. */
export async function handleCostReport(db: Firestore, monitor: MonitoringFetch, now: Date): Promise<string> {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 21)); // Türkiye gece yarısı
  if (end > now) end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end.getTime() - 86400_000);
  const day = costDayKey(start);
  const ref = db.doc(`billing/cost-${day}`);
  try {
    const functions: ServerUsage['functions'] = {};
    const put = (name: string | undefined, k: 'calls' | 'seconds', v: number) => {
      if (!name) return;
      const f = (functions[name] ??= { calls: 0, seconds: 0 });
      f[k] += v;
    };
    // 2. nesil işler Cloud Run hizmeti olarak çalışır (hizmet adı küçük harfli iş adıdır).
    const [runCalls, runTime, v1Calls, reads, writes, deletes, egress, stored] = await Promise.all([
      monitor('metric.type="run.googleapis.com/request_count" resource.type="cloud_run_revision"', 'ALIGN_SUM', ['resource.label.service_name'], start, end),
      monitor('metric.type="run.googleapis.com/container/billable_instance_time" resource.type="cloud_run_revision"', 'ALIGN_SUM', ['resource.label.service_name'], start, end),
      monitor('metric.type="cloudfunctions.googleapis.com/function/execution_count"', 'ALIGN_SUM', ['resource.label.function_name'], start, end),
      monitor('metric.type="firestore.googleapis.com/document/read_ops_count"', 'ALIGN_SUM', [], start, end),
      monitor('metric.type="firestore.googleapis.com/document/write_ops_count"', 'ALIGN_SUM', [], start, end),
      monitor('metric.type="firestore.googleapis.com/document/delete_ops_count"', 'ALIGN_SUM', [], start, end),
      monitor('metric.type="storage.googleapis.com/network/sent_bytes_count"', 'ALIGN_SUM', [], start, end),
      monitor('metric.type="storage.googleapis.com/storage/total_bytes"', 'ALIGN_MAX', [], start, end),
    ]);
    runCalls.forEach((x) => put(x.labels.service_name, 'calls', x.value));
    runTime.forEach((x) => put(x.labels.service_name, 'seconds', x.value));
    v1Calls.forEach((x) => put(x.labels.function_name, 'calls', x.value));
    // 1. nesil işte (yalnızca hesap silme) süre ölçülmez; çağrı başına yaklaşık 1 sn sayılır.
    v1Calls.forEach((x) => put(x.labels.function_name, 'seconds', x.value));
    const server: ServerUsage = {
      functions,
      firestore: { reads: sum(reads), writes: sum(writes), deletes: sum(deletes) },
      storage: { egressBytes: sum(egress), storedBytes: sum(stored) },
    };
    await ref.set({ day, server, serverError: FieldValue.delete() }, { merge: true });
  } catch (e) {
    await ref.set({ day, serverError: String((e as Error).message ?? e).slice(0, 300) }, { merge: true });
  }
  return day;
}
