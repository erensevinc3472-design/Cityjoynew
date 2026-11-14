import { Link } from 'react-router';

import { appViewHref } from '../pages/app-view-page';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';

/** Kaydı Panel > Uygulama görünümünde, uygulamadaki ekranıyla açar (yalnızca yöneticiler; sayfa da yalnızca onlara açık). */
export function OpenInApp({ path }: { path: string }) {
  const { user } = useSession();
  if (!user || !isAdminUser(user)) return null;
  return (
    <Link className="meta open-in-app" to={appViewHref(path)}>
      {t('appView.openInApp')}
    </Link>
  );
}
