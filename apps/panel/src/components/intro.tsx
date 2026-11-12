import { t } from '../lib/t';

/** Bölünmez kısaltmalar: "ör. Osmangazi" gibi yerlerde cümle bitmiş sayılmaz. */
const ABBREVIATIONS = new Set(['ör', 'örn', 'vb', 'vs', 'bkz', 'no', 'dr', 'prof', 'sn', 'st']);

/** Metni ilk cümle ve geri kalan olarak ayırır. */
export function splitIntro(text: string): [string, string] {
  const re = /[.!?](?=\s+\S)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const word = text.slice(0, m.index).split(/[\s(]/).pop()?.toLocaleLowerCase('tr') ?? '';
    if (ABBREVIATIONS.has(word) || /^\d+$/.test(word)) continue;
    const first = text.slice(0, m.index + 1).trim();
    const rest = text.slice(m.index + 1).trim();
    return [first, rest];
  }
  return [text, ''];
}

/**
 * Sayfa açıklaması (Eren, 12 Kasım 2026 panel yenileme): ilk cümle görünür, ayrıntı "ⓘ Nasıl çalışır?" altında açılır.
 */
export function Intro({ text }: { text: string }) {
  const [first, rest] = splitIntro(text);
  if (!rest) return <p className="meta">{first}</p>;
  return (
    <div className="intro">
      <p className="meta">{first}</p>
      <details>
        <summary>
          <span aria-hidden="true">ⓘ</span> {t('common.howItWorks')}
        </summary>
        <p className="meta">{rest}</p>
      </details>
    </div>
  );
}
