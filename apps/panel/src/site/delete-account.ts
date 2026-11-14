/**
 * Web'den hesap silme (Google Play şartı: uygulama dışından silme yolu; Apple: hesabı silme). Kişi kendi hesabına
 * giriş yapar, onaylar; uygulamadaki "Hesabı sil" ile aynı sırayla verisi, en son hesabı silinir. Yönetici işlemi
 * gerekmez; kimlik giriş ile doğrulandığı için başkası adına silme isteği yapılamaz.
 */
import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { AuthError, type AuthErrorCode } from '@cityjoy/shared';
import { createFirebaseAuthService, deleteAllUserData } from '@cityjoy/shared/firebase';

// Değerler .env.local dosyasından gelir (GitHub'a gönderilmez), panel ile aynı.
const env = import.meta.env;
const app = getApps().length
  ? getApp()
  : initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY ?? '',
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
      projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
      appId: env.VITE_FIREBASE_APP_ID ?? '',
    });
const auth = getAuth(app);
auth.languageCode = 'tr';
const db = getFirestore(app);
if (env.VITE_FIREBASE_EMULATOR === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
const service = createFirebaseAuthService(auth, { languageCode: () => 'tr' });

const MESSAGES: Record<AuthErrorCode | 'empty' | 'reset-email', string> = {
  'wrong-credentials': 'E-posta ya da şifre yanlış.',
  'invalid-email': 'E-posta adresi geçerli değil.',
  'too-many-requests': 'Çok fazla deneme yapıldı. Biraz bekleyip yeniden dene.',
  network: 'İnternet bağlantısı yok gibi görünüyor.',
  'popup-closed': 'Google penceresi kapandı. Yeniden dene.',
  'account-suspended': 'Bu hesap askıya alınmış. Silme isteği için aşağıdaki adrese yaz.',
  'requires-recent-login': 'Güvenlik için yeniden giriş yapman gerekiyor.',
  'email-in-use': 'Bir sorun oluştu. Yeniden dene.',
  'weak-password': 'Bir sorun oluştu. Yeniden dene.',
  unknown: 'Bir sorun oluştu. Yeniden dene.',
  empty: 'E-posta ve şifreni yaz.',
  'reset-email': 'Şifre sıfırlama bağlantısı için önce e-posta adresini yaz.',
};
const errorText = (e: unknown) => MESSAGES[e instanceof AuthError ? e.code : 'unknown'];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const signin = $('signin');
const confirm = $('confirm');
const done = $('done');
const signinMsg = $('signin-msg');
const confirmMsg = $('confirm-msg');
const email = $<HTMLInputElement>('email');
const password = $<HTMLInputElement>('password');
const agree = $<HTMLInputElement>('agree');
const deleteBtn = $<HTMLButtonElement>('delete-btn');
let usedPassword: string | undefined;

const say = (el: HTMLElement, text: string, kind: 'error' | 'ok' | '' = '') => {
  el.textContent = text;
  el.className = `msg ${kind}`.trim();
};
const busy = (buttons: HTMLButtonElement[], on: boolean) => buttons.forEach((b) => (b.disabled = on));

function show(user: { email: string | null } | null) {
  signin.hidden = !!user;
  confirm.hidden = !user;
  if (user) {
    $('who').textContent = user.email ?? '';
    agree.checked = false;
    deleteBtn.disabled = true;
    say(confirmMsg, '');
    $('confirm-title').focus?.();
  }
}

service.onChange((u) => {
  if (done.hidden) show(u);
});

$('email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btns = [$<HTMLButtonElement>('email-btn'), $<HTMLButtonElement>('google-btn')];
  if (!email.value.trim() || !password.value) return say(signinMsg, MESSAGES.empty, 'error');
  busy(btns, true);
  say(signinMsg, '');
  try {
    usedPassword = password.value;
    await service.signIn(email.value.trim(), password.value);
    password.value = '';
  } catch (err) {
    usedPassword = undefined;
    say(signinMsg, errorText(err), 'error');
  } finally {
    busy(btns, false);
  }
});

$('google-btn').addEventListener('click', async () => {
  say(signinMsg, '');
  usedPassword = undefined;
  try {
    await service.signInWithGoogle();
  } catch (err) {
    say(signinMsg, errorText(err), 'error');
  }
});

$('reset-btn').addEventListener('click', async () => {
  if (!email.value.trim()) return say(signinMsg, MESSAGES['reset-email'], 'error');
  try {
    await service.sendPasswordReset(email.value.trim());
  } catch {
    // Hesap var mı yok mu belli edilmez.
  }
  say(signinMsg, 'Bu adrese kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi.', 'ok');
});

agree.addEventListener('change', () => {
  deleteBtn.disabled = !agree.checked;
});

$('signout-btn').addEventListener('click', () => {
  usedPassword = undefined;
  service.signOut().catch(() => {});
});

deleteBtn.addEventListener('click', async () => {
  if (!agree.checked) return;
  const btns = [deleteBtn, $<HTMLButtonElement>('signout-btn')];
  busy(btns, true);
  say(confirmMsg, 'Siliniyor, sayfayı kapatma…');
  try {
    await service.deleteAccountAndData(usedPassword, (uid) => deleteAllUserData(db, uid));
    usedPassword = undefined;
    confirm.hidden = true;
    signin.hidden = true;
    done.hidden = false;
  } catch (err) {
    say(confirmMsg, errorText(err), 'error');
    busy(btns, false);
    deleteBtn.disabled = !agree.checked;
  }
});
