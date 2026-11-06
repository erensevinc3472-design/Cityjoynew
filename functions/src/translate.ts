/**
 * "Çevir" düğmesi (Karar Eren, 6 Kasım 2026; PROJE.md bölüm 2). Metni okuyanın diline çevirir.
 * - Aynı metin aynı dile bir kez çevrilir: `translations/{özet}_{dil}` (yalnızca sunucu okur / yazar; kurallar kapalı).
 *   Saklanan çeviriyi yeniden istemek sınırdan düşmez. 90 günden eski kayıtlar günlük temizlikte silinir.
 * - Kişi başına günlük sınır `usage/u-{uid}~ceviri` sayacıyla (Panel > Sınırlar, `ceviri`).
 * - Sağlayıcı dışarıdan verilir (testte sahte, bulutta Google Cloud Translation; anahtar yok, işlevin hizmet hesabı).
 */
import { createHash } from 'node:crypto';

import { applicationDefault } from 'firebase-admin/app';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import {
  isLanguageCode,
  nextUsage,
  normalizeLimits,
  translationInput,
  usageId,
  type LanguageCode,
  type TranslationResult,
} from '@cityjoy/shared';

export type Translator = (text: string, target: LanguageCode) => Promise<{ text: string; source: string }>;

/** gecersiz: boş metin / desteklenmeyen dil; sinir: günlük hak doldu; hizmet: sağlayıcı cevap vermedi. */
export class TranslateError extends Error {
  constructor(
    readonly code: 'gecersiz' | 'sinir' | 'hizmet',
    readonly resetAt?: string,
  ) {
    super(code);
    this.name = 'TranslateError';
  }
}

export const TRANSLATION_KEEP_DAYS = 90;

export const translationId = (text: string, target: LanguageCode) =>
  `${createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 40)}_${target}`;

const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : null);

export async function handleTranslate(
  db: Firestore,
  translate: Translator,
  uid: string,
  rawText: unknown,
  rawTarget: unknown,
  now: Date,
): Promise<TranslationResult> {
  const text = typeof rawText === 'string' ? translationInput(rawText) : '';
  if (!text || !isLanguageCode(rawTarget)) throw new TranslateError('gecersiz');
  const target = rawTarget;
  const cacheRef = db.doc(`translations/${translationId(text, target)}`);
  const cached = await cacheRef.get();
  if (cached.exists) {
    const source = (cached.get('source') as string) ?? '';
    return { text: cached.get('text') as string, source, same: source === target };
  }

  const usageRef = db.doc(`usage/${usageId({ type: 'u', id: uid }, 'ceviri')}`);
  const [usage, limitsSnap] = await Promise.all([usageRef.get(), db.doc('config/limits').get()]);
  const limit = normalizeLimits(limitsSnap.exists ? limitsSnap.data() : null).ceviri;
  const old = usage.exists ? { windowStart: iso(usage.get('windowStart')) ?? new Date(0).toISOString(), count: (usage.get('count') as number) ?? 0 } : null;
  const step = nextUsage(old, 'ceviri', limit, now);
  if (!step.allowed) throw new TranslateError('sinir', step.resetAt);

  let out: { text: string; source: string };
  try {
    out = await translate(text, target);
  } catch {
    throw new TranslateError('hizmet');
  }
  const source = (out.source ?? '').toLowerCase().split(/[-_]/)[0];
  const same = source === target;
  const result = { text: same ? text : out.text, source, same };
  const batch = db.batch();
  batch.set(cacheRef, { text: result.text, source, target, createdAt: Timestamp.fromDate(now) });
  batch.set(usageRef, {
    type: 'u',
    sid: uid,
    kind: 'ceviri',
    windowStart: step.reset ? Timestamp.fromDate(now) : usage.get('windowStart'),
    count: step.count,
  });
  await batch.commit();
  return result;
}

/** Günlük temizlik: 90 günden eski saklanan çeviriler (yeniden istenirse tekrar çevrilir). */
export async function deleteOldTranslations(db: Firestore, now: Date): Promise<number> {
  const cutoff = Timestamp.fromMillis(now.getTime() - TRANSLATION_KEEP_DAYS * 86_400_000);
  let total = 0;
  for (;;) {
    const snap = await db.collection('translations').where('createdAt', '<', cutoff).limit(400).get();
    if (snap.empty) return total;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
  }
}

/** Google Cloud Translation (v2). İşlevin hizmet hesabıyla çalışır; Google Cloud'da "Cloud Translation API" açık olmalı. */
export const googleTranslator: Translator = async (text, target) => {
  const { access_token } = await applicationDefault().getAccessToken();
  const res = await fetch('https://translation.googleapis.com/language/translate/v2', {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, target, format: 'text' }),
  });
  if (!res.ok) throw new Error(`translate ${res.status}`);
  const body = (await res.json()) as { data?: { translations?: { translatedText?: string; detectedSourceLanguage?: string }[] } };
  const t = body.data?.translations?.[0];
  if (!t?.translatedText) throw new Error('translate: boş cevap');
  return { text: t.translatedText, source: t.detectedSourceLanguage ?? '' };
};
