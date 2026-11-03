import type { ReactNode } from 'react';

import { t } from '../lib/t';

const fmt = (n: number) => n.toLocaleString('tr-TR');

/** Sayı yoksa (yetki yetmedi ya da okunamadı) "—". */
export const show = (n: number | null | undefined) => (n === null || n === undefined ? '—' : fmt(n));

/** Önceki döneme göre değişim (yüzde); önceki dönem boşsa gösterilmez. */
export function Change({ now, before }: { now: number | null; before: number | null }) {
  if (now === null || before === null || before === 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return (
    <span className={pct >= 0 ? 'up' : 'down'}>
      {pct >= 0 ? '▲' : '▼'} %{Math.abs(pct)}
    </span>
  );
}

/** Büyük sayı kutusu. */
export function StatTile({ label, value, hint, highlight, children }: {
  label: string;
  value: number | null;
  hint?: ReactNode;
  highlight?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={highlight ? 'card stat highlight' : 'card stat'}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{show(value)}</span>
      {hint ? <span className="stat-hint">{hint}</span> : null}
      {children}
    </div>
  );
}

export interface Datum {
  label: string;
  value: number | null;
}

/** Yatay çubuklar: kategoriye göre dağılım. Ekran okuyucu için aynı veri tablo olarak da verilir. */
export function BarList({ title, data, tone = 'gold' }: { title: string; data: Datum[]; tone?: 'gold' | 'teal' }) {
  const max = Math.max(1, ...data.map((d) => d.value ?? 0));
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      {data.length ? null : <p className="meta">{t('charts.empty')}</p>}
      <ul className={`bars ${tone}`} aria-hidden="true">
        {data.map((d) => (
          <li key={d.label} title={`${d.label}: ${show(d.value)}`}>
            <span className="bar-label">{d.label}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${((d.value ?? 0) / max) * 100}%` }} />
            </span>
            <span className="bar-value">{show(d.value)}</span>
          </li>
        ))}
      </ul>
      <DataTable title={title} data={data} />
    </figure>
  );
}

/** Dikey çubuklar: haftalık değişim. Son çubuk (bu hafta) tam renk. */
export function ColumnChart({ title, data }: { title: string; data: Datum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value ?? 0));
  const last = data.length - 1;
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      {data.length ? null : <p className="meta">{t('charts.empty')}</p>}
      <div className="columns" aria-hidden="true">
        {data.map((d, i) => (
          <div key={d.label} className={i === last ? 'col current' : 'col'} title={`${d.label}: ${show(d.value)}`}>
            <span className="col-value">{i === last ? show(d.value) : ''}</span>
            <span className="col-bar" style={{ height: `${Math.max(2, ((d.value ?? 0) / max) * 100)}%` }} />
            <span className="col-label">{i === 0 || i === last || i === Math.floor(last / 2) ? d.label : ''}</span>
          </div>
        ))}
      </div>
      <DataTable title={title} data={data} />
    </figure>
  );
}

function DataTable({ title, data }: { title: string; data: Datum[] }) {
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <tbody>
        {data.map((d) => (
          <tr key={d.label}>
            <th scope="row">{d.label}</th>
            <td>{show(d.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Son n hafta (7 günlük dilimler, en eskisi başta), etiket dilimin ilk günü. */
export function lastWeeks(n: number, now = new Date()): { label: string; from: Date; to: Date }[] {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return Array.from({ length: n }, (_, i) => {
    const to = new Date(end.getTime() - (n - 1 - i) * 7 * 86400000);
    const from = new Date(to.getTime() - 7 * 86400000);
    const label = i === n - 1 ? t('charts.thisWeek') : from.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    return { label, from, to };
  });
}

export const daysAgo = (days: number, now = new Date()) => new Date(now.getTime() - days * 86400000);
