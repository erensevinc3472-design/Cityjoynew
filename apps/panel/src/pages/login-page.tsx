import { useNavigate } from 'react-router';

import { ScopeLabel } from '../components/scope-label';
import { DEMO_LOGIN_ENABLED, DEMO_USERS, useSession } from '../lib/session';
import { t } from '../lib/t';

export function LoginPage() {
  const { signInDemo } = useSession();
  const navigate = useNavigate();

  return (
    <main className="login">
      <div className="login-card">
        <p className="brand">CityJoy</p>
        <h1>{t('login.title')}</h1>
        <p className="note">{t('login.notConnected')}</p>
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
