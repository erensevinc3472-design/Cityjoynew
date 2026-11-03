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

/** Büyük sayı kutusu. onClick verilirse ayrıntı grafiğini açan düğme olur. */
export function StatTile({ label, value, hint, highlight, children, onClick, display }: {
  label: string;
  value: number | null;
  hint?: ReactNode;
  highlight?: boolean;
  children?: ReactNode;
  onClick?: () => void;
  /** Sayı yerine gösterilecek metin (örn. yüzde). */
  display?: string;
}) {
  const body = (
    <>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{display ?? show(value)}</span>
      {hint ? <span className="stat-hint">{hint}</span> : null}
      {children}
    </>
  );
  const cls = highlight ? 'card stat highlight' : 'card stat';
  return onClick ? (
    <button type="button" className={`${cls} clickable`} onClick={onClick}>{body}<span className="stat-more" aria-hidden="true">›</span></button>
  ) : (
    <div className={cls}>{body}</div>
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

export interface DrillRow {
  key: string;
  label: string;
  value: number;
  /** Verilirse satır ayrıntıyı açan düğme olur. */
  onOpen?: () => void;
  /** Soluk gösterilen satır (Diğer, konum belirtmemiş). */
  muted?: boolean;
}

/**
 * Tıklanabilir yatay çubuklar (kitle ayrıntısı): değer ve toplam içindeki payı. Ekran okuyucu için satırlar düğme ya da
 * düz metin olarak okunur; ayrı tablo gerekmez.
 */
export function DrillList({ title, rows, total, tone = 'teal', empty }: { title: string; rows: DrillRow[]; total: number; tone?: 'gold' | 'teal'; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      {rows.length ? null : <p className="meta">{empty ?? t('charts.empty')}</p>}
      <ul className={`bars drill ${tone}`}>
        {rows.map((r) => {
          const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
          const inner = (
            <>
              <span className="bar-label">{r.label}</span>
              <span className="bar-track" aria-hidden="true">
                <span className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} />
              </span>
              <span className="bar-value">{fmt(r.value)} <small>%{pct}</small></span>
              {r.onOpen ? <span className="bar-more" aria-hidden="true">›</span> : <span />}
            </>
          );
          return (
            <li key={r.key} className={r.muted ? 'muted' : undefined}>
              {r.onOpen ? <button type="button" onClick={r.onOpen}>{inner}</button> : <div>{inner}</div>}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
