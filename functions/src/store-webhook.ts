import { timingSafeEqual } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';

import { handleStoreEvent, revenueCatState } from './memberships';

// Pro abonelik (Karar Eren, 12 Kasım 2026; PROJE.md 15.2): satın alma servisi (RevenueCat) her mağaza olayında buraya
// bildirir. Gizli bilgiler Secret Manager'da: REVENUECAT_WEBHOOK_AUTH (servis panelinde webhook'a yazılan
// "Authorization" değeri) ve REVENUECAT_API_KEY (servisin gizli API anahtarı). Koda ve repoya konmaz.
const storeWebhookAuth = defineSecret('REVENUECAT_WEBHOOK_AUTH');
const storeApiKey = defineSecret('REVENUECAT_API_KEY');
export const storeEvents = onRequest({ secrets: [storeWebhookAuth, storeApiKey], maxInstances: 2 }, async (req, res) => {
  const expected = storeWebhookAuth.value();
  const given = String(req.get('authorization') ?? '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (req.method !== 'POST' || !expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).send('yetkisiz');
    return;
  }
  try {
    await handleStoreEvent(getFirestore(), req.body, { fetchState: revenueCatState(storeApiKey.value()), now: new Date() });
    res.status(200).send('ok');
  } catch (e) {
    console.error('storeEvents', e);
    // 5xx: servis bildirimi sonra yeniden dener.
    res.status(500).send('hata');
  }
});
