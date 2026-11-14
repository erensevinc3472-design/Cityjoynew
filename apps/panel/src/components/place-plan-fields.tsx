import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseGeo, type LatLng, type PlaceHours } from '@cityjoy/shared';

export interface PlanFieldsValue {
  location?: LatLng;
  hours?: PlaceHours;
  durationMinutes?: number;
}

/** Haftanın günleri pazartesiden başlayarak (değerler 0 = pazar). */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/**
 * Gezilecek yer formunda "Gezimi planla ve Yakınımda için" bölümü (Karar, Eren, 12 Kasım 2026): konum (Google Haritalar
 * koordinatı ya da uzun bağlantı yapıştırılır), önerilen kalış (dakika), hesaplanabilir açılış saatleri.
 */
export function PlacePlanFields({ value, onChange, disabled }: { value: PlanFieldsValue; onChange(patch: PlanFieldsValue): void; disabled?: boolean }) {
  const { t } = useTranslation();
  const [geoText, setGeoText] = useState(value.location ? `${value.location.lat}, ${value.location.lng}` : '');
  const parsed = geoText.trim() ? parseGeo(geoText) : null;
  const h = value.hours;
  const mode = !h ? 'none' : h.allDay ? 'all' : 'set';
  const days = t('travel.plan.days').split('|');

  const setGeo = (text: string) => {
    setGeoText(text);
    const g = text.trim() ? parseGeo(text) : null;
    onChange({ location: g ?? undefined });
  };
  const setMode = (m: string) =>
    onChange({
      hours:
        m === 'none'
          ? undefined
          : m === 'all'
            ? { allDay: true, closedDays: h?.closedDays ?? [], prayer: h?.prayer ?? false }
            : { allDay: false, open: h?.open ?? '09:00', close: h?.close ?? '18:00', closedDays: h?.closedDays ?? [], prayer: h?.prayer ?? false },
    });
  const patchHours = (p: Partial<PlaceHours>) => h && onChange({ hours: { ...h, ...p } });

  return (
    <fieldset className="card" style={{ padding: 16, display: 'grid', gap: 12 }} disabled={disabled}>
      <legend style={{ fontWeight: 600 }}>{t('travel.plan.title')}</legend>
      <p className="meta">{t('travel.plan.intro')}</p>

      <div className="field">
        <label htmlFor="p-geo">{t('travel.plan.location')}</label>
        <input id="p-geo" value={geoText} onChange={(e) => setGeo(e.target.value)} placeholder="40.1826, 29.0619" />
        <p className="meta">{t('travel.plan.locationHint')}</p>
        {geoText.trim() ? (
          parsed ? (
            <p className="meta">
              {t('travel.plan.locationOk', { lat: parsed.lat, lng: parsed.lng })} ·{' '}
              <a href={`https://www.google.com/maps?q=${parsed.lat},${parsed.lng}`} target="_blank" rel="noreferrer">{t('travel.plan.openMap')}</a> ·{' '}
              <button type="button" className="link" onClick={() => setGeo('')}>{t('travel.plan.clear')}</button>
            </p>
          ) : (
            <p className="meta" role="alert" style={{ color: 'var(--danger, #b42318)' }}>{t('travel.plan.locationBad')}</p>
          )
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="p-mins">{t('travel.plan.duration')}</label>
        <input
          id="p-mins"
          type="number"
          min={10}
          max={720}
          step={5}
          value={value.durationMinutes ?? ''}
          onChange={(e) => onChange({ durationMinutes: e.target.value ? Math.round(Number(e.target.value)) : undefined })}
        />
        <p className="meta">{t('travel.plan.durationHint')}</p>
      </div>

      <fieldset className="checkbox-group" aria-label={t('travel.plan.hours')}>
        <legend style={{ fontWeight: 600, width: '100%' }}>{t('travel.plan.hours')}</legend>
        {(['none', 'all', 'set'] as const).map((m) => (
          <label key={m}>
            <input type="radio" name="p-hours-mode" checked={mode === m} onChange={() => setMode(m)} />
            {t(m === 'none' ? 'travel.plan.hoursNone' : m === 'all' ? 'travel.plan.hoursAllDay' : 'travel.plan.hoursSet')}
          </label>
        ))}
      </fieldset>
      {h && !h.allDay ? (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div className="field">
            <label htmlFor="p-open">{t('travel.plan.open')}</label>
            <input id="p-open" type="time" value={h.open ?? ''} onChange={(e) => patchHours({ open: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="p-close">{t('travel.plan.close')}</label>
            <input id="p-close" type="time" value={h.close ?? ''} onChange={(e) => patchHours({ close: e.target.value })} />
          </div>
        </div>
      ) : null}
      {h ? (
        <>
          <fieldset className="checkbox-group">
            <legend style={{ width: '100%' }}>{t('travel.plan.closedDays')}</legend>
            {WEEK.map((d) => (
              <label key={d}>
                <input
                  type="checkbox"
                  checked={h.closedDays.includes(d)}
                  onChange={(e) => patchHours({ closedDays: e.target.checked ? [...h.closedDays, d] : h.closedDays.filter((x) => x !== d) })}
                />
                {days[d]}
              </label>
            ))}
          </fieldset>
          <label className="check">
            <input type="checkbox" checked={h.prayer} onChange={(e) => patchHours({ prayer: e.target.checked })} /> {t('travel.plan.prayer')}
          </label>
          <p className="meta">{t('travel.plan.hoursHint')}</p>
        </>
      ) : null}
    </fieldset>
  );
}
