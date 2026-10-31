import { useId, useState } from 'react';
import type { MediaKind, Photo } from '@cityjoy/shared';
import { PhotoTooLargeError, uploadMedia } from '@cityjoy/shared/firebase';

import { storage } from '../lib/firebase';
import { prepareImage } from '../lib/image';
import { t } from '../lib/t';

/**
 * Tek görsel alanı (etkinlik kapağı, kurum logosu). Dosya seçilince tarayıcıda küçültülür ve hemen yüklenir; kayıt
 * "Kaydet" ile yazılır. Kayıttan çıkan eski dosyayı sunucu siler. Dosya deposu Blaze plan ister.
 */
export function ImageField({
  label,
  hint,
  kind,
  uid,
  value,
  onChange,
  disabled,
  round,
}: {
  label: string;
  hint?: string;
  kind: MediaKind;
  uid: string;
  value?: Photo;
  onChange(p: Photo | undefined): void;
  disabled?: boolean;
  /** Logo: yuvarlak önizleme. */
  round?: boolean;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      onChange(await uploadMedia(storage, uid, kind, await prepareImage(file)));
    } catch (e) {
      setError(e instanceof PhotoTooLargeError ? t('image.tooLarge') : (e as Error).message === 'not-image' ? t('image.notImage') : t('image.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {value ? (
        <div className="image-field">
          <img src={value.url} alt={label} className={round ? 'round' : undefined} />
          <button type="button" className="btn secondary" disabled={disabled || busy} onClick={() => onChange(undefined)}>
            {t('image.remove')}
          </button>
        </div>
      ) : null}
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp,image/heic" disabled={disabled || busy} onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
      {busy ? <span className="meta" aria-live="polite">{t('image.uploading')}</span> : null}
      {error ? <span className="error" role="alert">{error}</span> : hint ? <span className="meta">{hint}</span> : null}
    </div>
  );
}
