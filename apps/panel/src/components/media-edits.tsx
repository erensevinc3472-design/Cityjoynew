import { mediaEditTexts, playRange, type EditFont, type MediaEdit, type Post } from '@cityjoy/shared';

import { t } from '../lib/t';

/**
 * Paylaşım düzenleyicisinin yazı, çıkartma ve çizimleri (media-edit.ts) panelde de görünür: moderatör gönderiyi
 * uygulamadaki gibi görür ve medyanın üstündeki bütün yazıları ayrıca liste olarak okur (yasaklı içerik denetimi).
 */

const FONT: Record<EditFont, string> = {
  modern: '"Plus Jakarta Sans", system-ui, sans-serif',
  klasik: 'Fraunces, Georgia, serif',
  el: 'Caveat, "Segoe Script", cursive',
  kalin: 'Anton, Impact, sans-serif',
  daktilo: '"Space Mono", "Courier New", monospace',
};

const W = 240;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

function Layer({ edit, w, h }: { edit: MediaEdit; w: number; h: number }) {
  return (
    <div className="edit-layer" aria-hidden>
      {edit.strokes?.length ? (
        <svg width={w} height={h} viewBox="0 0 1000 1000" preserveAspectRatio="none">
          {edit.strokes.map((s, i) => (
            <polyline
              key={i}
              points={s.points.reduce<string[]>((a, v, k) => (k % 2 ? (a[a.length - 1] += `,${v}`, a) : [...a, String(v)]), []).join(' ')}
              fill="none"
              stroke={s.color}
              strokeOpacity={s.marker ? 0.45 : 1}
              strokeWidth={s.width * 1000}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ strokeWidth: Math.max(1, s.width * w) }}
            />
          ))}
        </svg>
      ) : null}
      {(edit.items ?? []).map((it, i) => {
        const pos = { left: it.x * w, top: it.y * h, transform: `translate(-50%, -50%) rotate(${it.rotation}deg) scale(${it.scale})` };
        if (it.kind === 'yazi') {
          const size = it.size * w;
          const bg = it.bg === 'dolu' ? it.bgColor : it.bg === 'yari' ? `${it.bgColor}99` : 'transparent';
          return (
            <span key={i} className="edit-item" dir="auto" style={{ ...pos, fontFamily: FONT[it.font], fontSize: size, color: it.color, background: bg, textAlign: it.align, maxWidth: w * 0.9, padding: `${size * 0.12}px ${size * 0.35}px`, borderRadius: size * 0.3 }}>
              {it.text}
            </span>
          );
        }
        return it.type === 'emoji' ? (
          <span key={i} className="edit-item" style={{ ...pos, fontSize: w * 0.14 }}>{it.label}</span>
        ) : (
          <span key={i} className="edit-item edit-sticker" dir="auto" style={{ ...pos, fontSize: w * 0.045 }}>{it.label}</span>
        );
      })}
    </div>
  );
}

/** Düzenlenmiş medya önizlemeleri ve üstündeki yazıların listesi; düzenleme yoksa hiçbir şey çizmez. */
export function MediaEdits({ post }: { post: Pick<Post, 'photos' | 'video' | 'edits'> }) {
  const edits = post.edits;
  if (!edits?.some(Boolean)) return null;
  const texts = mediaEditTexts(edits);
  const video = post.video && !post.photos?.length ? post.video : null;
  const v = video ? edits[0] : null;
  const range = video && v ? playRange(v, video.durationSec) : null;
  return (
    <div className="media-edits">
      <div className="photo-row">
        {video && v ? (
          <figure className="edit-frame" style={{ width: W, height: (W * video.height) / Math.max(1, video.width) }}>
            <video src={`${video.url}#t=${range!.start},${range!.end}`} controls muted={v.muted} preload="metadata" poster={video.poster} aria-label={t('moderation.posts.video', { seconds: video.durationSec })} />
            <Layer edit={v} w={W} h={(W * video.height) / Math.max(1, video.width)} />
          </figure>
        ) : (
          (post.photos ?? []).map((p, i) =>
            edits[i] ? (
              <figure key={p.path} className="edit-frame" style={{ width: W, height: (W * p.height) / p.width }}>
                <img src={p.url} alt={t('moderation.posts.photo', { n: i + 1 })} loading="lazy" />
                <Layer edit={edits[i]!} w={W} h={(W * p.height) / p.width} />
              </figure>
            ) : null,
          )
        )}
      </div>
      {texts.length ? (
        <div className="meta">
          {t('moderation.edits.texts')}: <span dir="auto">{texts.map((x) => `“${x}”`).join(' · ')}</span>
        </div>
      ) : null}
      {video && v ? (
        <div className="meta">
          {[range && v.trimStart !== undefined ? t('moderation.edits.trimmed', { from: fmt(range.start), to: fmt(range.end) }) : '', v.muted ? t('moderation.edits.muted') : ''].filter(Boolean).join(' · ')}
        </div>
      ) : null}
    </div>
  );
}
