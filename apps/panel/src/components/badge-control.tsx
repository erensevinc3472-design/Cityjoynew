import { useState, type FormEvent } from 'react';
import { BADGE_LIMITS, type BadgeDefinition, type PublicProfile } from '@cityjoy/shared';
import { createBadgeAdmin } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { t } from '../lib/t';

/** Kişinin rozetleri (adlarıyla); listeden silinmiş rozet görünmez. */
export function BadgePills({ ids, defs }: { ids: string[] | undefined; defs: BadgeDefinition[] }) {
  const list = (ids ?? []).map((id) => defs.find((d) => d.id === id)).filter((d): d is BadgeDefinition => !!d);
  return (
    <>
      {list.map((b) => (
        <span key={b.id} className="pill badge-pill">★ {b.name.tr}</span>
      ))}
    </>
  );
}

/**
 * Rozet ver (yalnızca admin; Eren, 13 Kasım 2026): kişi rozet istemez, ekip keşfettiği ya da güvendiği kişiye verir.
 * En çok 3 rozet seçilir; hepsini kaldırmak rozetleri geri alır. Her değişiklik işlem kaydına yazılır.
 */
export function BadgeControl({
  actorUid,
  profile,
  defs,
  onDone,
}: {
  actorUid: string;
  profile: Pick<PublicProfile, 'uid' | 'displayName' | 'badges'>;
  defs: BadgeDefinition[];
  onDone: (ok: boolean, badges?: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(profile.badges ?? []);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        className="link"
        onClick={() => {
          setPicked(profile.badges ?? []);
          setOpen(true);
        }}>
        {t('badges.give')}
      </button>
    );
  }

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= BADGE_LIMITS.perProfile ? p : [...p, id]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await createBadgeAdmin(firestore, actorUid).setProfileBadges(profile, picked, defs);
      setOpen(false);
      onDone(true, saved);
    } catch {
      onDone(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="suspend-form" onSubmit={submit} aria-label={t('badges.formLabel', { name: profile.displayName })}>
      <fieldset className="badge-choices">
        <legend>{t('badges.pick', { max: BADGE_LIMITS.perProfile })}</legend>
        {defs.map((b) => (
          <label key={b.id} className="check">
            <input type="checkbox" checked={picked.includes(b.id)} disabled={!picked.includes(b.id) && picked.length >= BADGE_LIMITS.perProfile} onChange={() => toggle(b.id)} />{' '}
            {b.name.tr}
            {b.publisher ? <small className="meta"> · {t('badges.publisherHint')}</small> : null}
          </label>
        ))}
      </fieldset>
      <p className="meta">{t('badges.effect')}</p>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy}>{t('badges.save')}</button>
        <button className="btn secondary" type="button" disabled={busy} onClick={() => setOpen(false)}>{t('badges.cancel')}</button>
      </div>
    </form>
  );
}
