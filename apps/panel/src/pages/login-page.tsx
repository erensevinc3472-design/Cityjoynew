import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { AuthError } from '@cityjoy/shared';

import { ScopeLabel } from '../components/scope-label';
import { isFirebaseConfigured } from '../lib/firebase';
import { authService } from '../lib/services';
import { DEMO_LOGIN_ENABLED, DEMO_USERS, useSession } from '../lib/session';
import { t } from '../lib/t';

function message(e: unknown): string {
  const code = e instanceof AuthError ? e.code : 'unknown';
  if (code === 'wrong-credentials' || code === 'invalid-email') return t('login.wrong');
  if (code === 'too-many-requests') return t('login.tooMany');
  if (code === 'network') return t('login.network');
  return t('login.unknown');
}

export function LoginPage() {
  const { user, noAccess, signInDemo, signOut } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const run = async (fn: () => Promise<unknown>) => {
    setError(undefined);
    setInfo(undefined);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => authService.signIn(email, password));
  };

  return (
    <main className="login">
      <div className="login-card">
        <p className="brand">CityJoy</p>
        <h1>{t('login.title')}</h1>

        {noAccess ? (
          <div className="note" role="alert">
            <strong>{t('login.noAccessTitle')}</strong>
            <p>{t('login.noAccessBody')}</p>
            <button className="btn secondary" onClick={() => signOut()}>{t('login.logout')}</button>
          </div>
        ) : isFirebaseConfigured ? (
          <form className="form" onSubmit={submit} noValidate>
            <label htmlFor="login-email">{t('login.email')}</label>
            <input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label htmlFor="login-password">{t('login.password')}</label>
            <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error ? <p className="error" role="alert">{error}</p> : null}
            {info ? <p className="note" role="status">{info}</p> : null}
            <button className="btn" type="submit" disabled={busy}>{t('login.submit')}</button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => run(async () => {
                await authService.sendPasswordReset(email).catch(() => {});
                setInfo(t('login.resetSent'));
              })}>
              {t('login.forgot')}
            </button>
            <p className="meta center">{t('login.or')}</p>
            <button className="btn secondary" type="button" disabled={busy} onClick={() => run(() => authService.signInWithGoogle())}>
              {t('login.google')}
            </button>
            <p className="meta">{t('login.mfaPending')}</p>
          </form>
        ) : (
          <p className="note">{t('login.notConnected')}</p>
        )}

        {DEMO_LOGIN_ENABLED ? (
          <>
            <h2>{t('login.demoTitle')}</h2>
            <p className="meta">{t('login.demoNote')}</p>
            <ul className="demo-list">
              {DEMO_USERS.map((u) => (
                <li key={u.uid}>
                  <button
                    className="demo"
                    onClick={() => {
                      signInDemo(u);
                      navigate('/');
                    }}>
                    <strong>{u.displayName}</strong>
                    <span>{t(`roles.${u.grants[0]!.role}`)} · <ScopeLabel scope={u.grants[0]!.scope} /></span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </main>
  );
}
