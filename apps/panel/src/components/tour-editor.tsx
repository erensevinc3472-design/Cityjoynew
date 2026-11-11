import { useState, type MouseEvent } from 'react';
import { TOUR_LIMITS, type TourPoint, type TourScene } from '@cityjoy/shared';

import { ImageField } from './image-field';
import { t } from '../lib/t';

/**
 * "İçini gez" düzenleyicisi (Eren, 11 Kasım 2026). Her sahne bir resim ve kısa addır (ör. "Dış görünüm", "İç mekân");
 * sahneler sırayla gösterilir, aralarında uygulamada sinematik geçiş olur. Resmin üstüne tıklanınca o noktaya numaralı
 * bir işaret eklenir; işaretin "Neye bakmalı?" ve "Neden önemli?" yazıları altta girilir. Resim yapay zekâ çizimiyse
 * uygulama köşede "temsilî çizim" yazar; ayrıntılar yayına almadan kontrol edilmeli.
 */
export function TourEditor({ uid, value, onChange, disabled }: { uid: string; value: TourScene[]; onChange(v: TourScene[]): void; disabled?: boolean }) {
  const L = TOUR_LIMITS;
  const [adding, setAdding] = useState<TourScene['image'] | undefined>(undefined);
  const set = (i: number, patch: Partial<TourScene>) => onChange(value.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const setPoint = (i: number, j: number, patch: Partial<TourPoint>) => set(i, { points: value[i].points.map((p, k) => (k === j ? { ...p, ...patch } : p)) });
  const move = (i: number, d: -1 | 1) => {
    const n = [...value];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    onChange(n);
  };
  const place = (i: number, e: MouseEvent<HTMLDivElement>) => {
    if (disabled || value[i].points.length >= L.points) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 1000;
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 1000;
    set(i, { points: [...value[i].points, { x, y, title: '', look: '', why: '' }] });
  };

  return (
    <fieldset className="form-section tour-editor">
      <legend>{t('travel.tour.title')}</legend>
      <p className="meta">{t('travel.tour.intro', { scenes: L.scenes, points: L.points })}</p>

      {value.map((s, i) => (
        <div key={s.image.path + i} className="card tour-scene">
          <div className="row-actions">
            <strong>{t('travel.tour.scene', { n: i + 1 })}</strong>
            <button type="button" className="link" disabled={disabled || i === 0} onClick={() => move(i, -1)}>{t('travel.tour.up')}</button>
            <button type="button" className="link" disabled={disabled || i === value.length - 1} onClick={() => move(i, 1)}>{t('travel.tour.down')}</button>
            <button type="button" className="link" disabled={disabled} onClick={() => window.confirm(t('travel.tour.confirmRemove')) && onChange(value.filter((_, k) => k !== i))}>
              {t('travel.tour.removeScene')}
            </button>
          </div>
          <div className="field">
            <label htmlFor={`tour-label-${i}`}>{t('travel.tour.label')}</label>
            <input id={`tour-label-${i}`} value={s.label} maxLength={L.label} placeholder={t('travel.tour.labelPlaceholder')} disabled={disabled} onChange={(e) => set(i, { label: e.target.value })} />
          </div>
          <p className="meta">{t('travel.tour.clickHint')}</p>
          <div className="tour-image" onClick={(e) => place(i, e)} role="presentation" style={{ position: 'relative', display: 'inline-block', maxWidth: 360, cursor: disabled ? 'default' : 'crosshair' }}>
            <img src={s.image.url} alt={s.label} style={{ display: 'block', width: '100%', borderRadius: 8 }} />
            {s.points.map((p, j) => (
              <span
                key={j}
                aria-hidden
                style={{
                  position: 'absolute', left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: 'translate(-50%, -50%)',
                  width: 26, height: 26, borderRadius: 13, background: '#E2B277', color: '#0B2328', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, border: '2px solid #fff', pointerEvents: 'none',
                }}>
                {j + 1}
              </span>
            ))}
          </div>
          {s.points.map((p, j) => (
            <div key={j} className="tour-point">
              <div className="row-actions">
                <strong>{t('travel.tour.point', { n: j + 1 })}</strong>
                <button type="button" className="link" disabled={disabled} onClick={() => set(i, { points: s.points.filter((_, k) => k !== j) })}>{t('travel.tour.removePoint')}</button>
              </div>
              <div className="field">
                <label htmlFor={`tp-${i}-${j}-t`}>{t('travel.tour.pointTitle')}</label>
                <input id={`tp-${i}-${j}-t`} value={p.title} maxLength={L.title} disabled={disabled} onChange={(e) => setPoint(i, j, { title: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`tp-${i}-${j}-l`}>{t('travel.tour.look')}</label>
                <textarea id={`tp-${i}-${j}-l`} rows={2} value={p.look} maxLength={L.text} disabled={disabled} onChange={(e) => setPoint(i, j, { look: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`tp-${i}-${j}-w`}>{t('travel.tour.why')}</label>
                <textarea id={`tp-${i}-${j}-w`} rows={2} value={p.why} maxLength={L.text} disabled={disabled} onChange={(e) => setPoint(i, j, { why: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      ))}

      {value.length < L.scenes ? (
        <ImageField
          label={t('travel.tour.addScene')}
          hint={t('travel.tour.addHint')}
          kind="seyahat"
          uid={uid}
          value={adding}
          disabled={disabled}
          onChange={(image) => {
            setAdding(undefined);
            if (image) onChange([...value, { label: '', image, points: [] }]);
          }}
        />
      ) : null}
    </fieldset>
  );
}
