import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  can,
  DEFAULT_SERVICE_CATEGORIES,
  isGrantActive,
  isFeatured,
  type Approval,
  type Business,
  type MembershipTier,
  type VerificationStatus,
} from '@cityjoy/shared';
import { createApprovalAdmin, createBusinessAdmin } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { locationRepository } from '../lib/locations';
import { useSession } from '../lib/session';
import { t } from '../lib/t';

const TIERS: MembershipTier[] = ['ucretsiz', 'standart', 'pro', 'premium'];
const DAY = 86400000;

/**
 * İşletmeler (PROJE.md 5.6-5.7, 6.4): doğrulama, yayından kaldırma, üyelik kademesi ve öne çıkma.
 * Ödeme sistemi gelene kadar kademe ve öne çıkma elle verilir. Uygulamadaki İşletmem'in panel karşılığı.
 */
export function BusinessesPage() {
  const { user } = useSession();
  const canEdit = !!user && !user.isDemo && can(user.grants, { module: 'isletme-dogrulama', action: 'onayla' }) && user.grants.some((g) => g.role === 'admin');
  const admin = user ? createBusinessAdmin(firestore, user.uid) : null;
  // İl yöneticisi doğrulamayı kendisi yapmaz, admin'e önerir (PROJE.md 6.5: iki aşamalı onay).
  const approvals = user && !user.isDemo ? createApprovalAdmin(firestore, { uid: user.uid, email: user.email ?? '', name: user.displayName }) : null;
  const canPropose = (b: Business) =>
    !canEdit && !!approvals && b.ownerUid !== user!.uid && b.verification.status !== 'dogrulandi' &&
    can(user!.grants, { module: 'isletme-dogrulama', action: 'onayla', region: b.location });
  // Ülke yetkisi yoksa yalnızca yetkili olunan iller (kurallar da başka ili okutmaz).
  const viewScopes = (user?.grants ?? []).filter((g) => isGrantActive(g, new Date()) && g.modules['isletme-dogrulama']?.includes('goruntule')).map((g) => g.scope);
  const national = viewScopes.some((s) => s.level === 'ulke');
  const allowedKey = viewScopes.flatMap((s) => (s.level === 'il' ? [s.provinceCode] : [])).sort().join();
  const provinces = useMemo(
    () => locationRepository.getProvinces().filter((p) => national || allowedKey.split(',').includes(p.code)),
    [national, allowedKey],
  );

  const [provinceCode, setProvinceCode] = useState(() => (national ? '' : (provinces[0]?.code ?? '')));
  const [list, setList] = useState<Business[] | null>(null);
  const [pending, setPending] = useState<Map<string, Approval>>(new Map());
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    if (user?.isDemo) return setList([]);
    if (!national && !provinceCode) return setList([]);
    try {
      setList(await createBusinessAdmin(firestore, 'okuma').list(provinceCode ? { provinceCode } : {}));
      // Bekleyen doğrulama istekleri (onay yetkisi yoksa gösterilmez).
      const open = await createApprovalAdmin(firestore, { uid: '', email: '', name: '' }).listPending(provinceCode || undefined).catch(() => []);
      setPending(new Map(open.filter((a) => a.kind === 'isletme-dogrulama').map((a) => [a.targetId, a])));
    } catch {
      setLoadError(true);
    }
  }, [user, provinceCode, national]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<void>, okText = t('businesses.saved')) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
      setMessage({ kind: 'ok', text: okText });
      await load();
    } catch {
      setMessage({ kind: 'error', text: t('businesses.error') });
    } finally {
      setBusy(false);
    }
  };

  const categoryName = (id: string) => DEFAULT_SERVICE_CATEGORIES.find((c) => c.id === id)?.names.tr ?? id;
  const place = (b: Business) =>
    [locationRepository.getDistrict(b.location.districtId)?.name, locationRepository.getProvince(b.location.provinceCode)?.name].filter(Boolean).join(', ');
  const now = new Date();

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('businesses.title')}</h1>
          <p className="meta">{t('businesses.intro')}</p>
        </div>
      </header>
      {user?.isDemo ? <p className="note">{t('businesses.demoReadOnly')}</p> : !canEdit ? <p className="note">{t('businesses.readOnly')}</p> : null}
      <p className="note">{t('businesses.manualNote')}</p>

      <div className="toolbar">
        <label htmlFor="biz-province" className="sr-only">{t('businesses.province')}</label>
        <select id="biz-province" value={provinceCode} onChange={(e) => setProvinceCode(e.target.value)} disabled={!national && provinces.length < 2}>
          {national ? <option value="">{t('businesses.allProvinces')}</option> : null}
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </select>
      </div>
      {message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('businesses.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('businesses.retry')}</button>
        </div>
      ) : list === null ? (
        <div className="state" aria-live="polite">{t('businesses.loading')}</div>
      ) : list.length === 0 ? (
        <div className="state">{t('businesses.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('businesses.name')}</th>
                <th scope="col">{t('businesses.status')}</th>
                <th scope="col">{t('businesses.verification')}</th>
                <th scope="col">{t('businesses.tier')}</th>
                <th scope="col">{t('businesses.featured')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => {
                const featured = isFeatured(b, now);
                return (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.name}</strong>
                      <div className="meta">{t(`businesses.types.${b.type}`)} · {place(b)}</div>
                      <div className="meta">{b.categoryIds.map(categoryName).join(', ')}</div>
                      <div className="meta" dir="ltr">{b.phone}</div>
                      <div className="meta">{t('businesses.followers', { count: b.followerCount })}</div>
                      {/* Yetkililer (sahibi atar); admin kötüye kullanımda çıkarır, işlem kayda geçer. */}
                      {b.managers.map((m) => (
                        <div key={m.uid} className="meta">
                          {t('businesses.manager', { name: m.name, post: t(`businesses.managerPost.${m.post}`) })}
                          {canEdit ? (
                            <button className="link" disabled={busy} onClick={() => window.confirm(t('businesses.removeManagerConfirm', { name: m.name, business: b.name })) && act(() => admin!.removeManager(b, m.uid))}>
                              {t('businesses.removeManager')}
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </td>
                    <td>
                      <span className={b.status === 'yayinda' ? 'pill ok' : b.status === 'kaldirildi' ? 'pill warn' : 'pill'}>{t(`businesses.statuses.${b.status}`)}</span>
                      {canEdit && b.status !== 'gizli' ? (
                        <div className="row-actions">
                          <button className="link" disabled={busy} onClick={() => act(() => admin!.setRemoved(b, b.status !== 'kaldirildi'))}>
                            {b.status === 'kaldirildi' ? t('businesses.restore') : t('businesses.remove')}
                          </button>
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span className={b.verification.status === 'dogrulandi' ? 'pill ok' : 'pill'}>{t(`businesses.verifications.${b.verification.status}`)}</span>
                      {b.verification.verifiedAt ? <div className="meta">{new Date(b.verification.verifiedAt).toLocaleDateString('tr-TR')}</div> : null}
                      {pending.get(b.id) ? (
                        <div className="meta">{pending.get(b.id)!.status === 'il-onayi-bekliyor' ? t('businesses.pendingFirst') : t('businesses.pendingAdmin')}</div>
                      ) : canPropose(b) ? (
                        <div className="row-actions">
                          <button
                            className="link"
                            disabled={busy}
                            onClick={() => window.confirm(t('businesses.proposeConfirm', { name: b.name })) && act(() => approvals!.proposeBusiness(b), t('businesses.proposed'))}>
                            {t('businesses.propose')}
                          </button>
                        </div>
                      ) : null}
                      {canEdit ? (
                        <div className="row-actions">
                          {(['dogrulandi', 'inceleniyor', 'dogrulanmadi'] as VerificationStatus[])
                            .filter((s) => s !== b.verification.status)
                            .map((s) => (
                              <button key={s} className="link" disabled={busy} onClick={() => act(() => admin!.setVerification(b, s))}>
                                {t(`businesses.setVerification.${s}`)}
                              </button>
                            ))}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {canEdit ? (
                        <select
                          aria-label={t('businesses.tierFor', { name: b.name })}
                          value={b.membership.tier}
                          disabled={busy}
                          onChange={(e) => {
                            const tier = e.target.value as MembershipTier;
                            act(() => admin!.setTier(b, tier, tier === 'ucretsiz' ? undefined : new Date(Date.now() + 30 * DAY)));
                          }}>
                          {TIERS.map((tier) => (
                            <option key={tier} value={tier}>{t(`businesses.tiers.${tier}`)}</option>
                          ))}
                        </select>
                      ) : (
                        t(`businesses.tiers.${b.membership.tier}`)
                      )}
                      {b.membership.endsAt ? <div className="meta">{t('businesses.until', { date: new Date(b.membership.endsAt).toLocaleDateString('tr-TR') })}</div> : null}
                    </td>
                    <td>
                      {featured ? <span className="pill warn">{t('businesses.ad')}</span> : <span className="meta">-</span>}
                      {featured && b.featuredUntil ? <div className="meta">{t('businesses.until', { date: new Date(b.featuredUntil).toLocaleDateString('tr-TR') })}</div> : null}
                      {canEdit && !featured && b.verification.status !== 'dogrulandi' ? <div className="meta">{t('businesses.featureNeedsVerification')}</div> : null}
                      {canEdit && (featured || b.verification.status === 'dogrulandi') ? (
                        <div className="row-actions">
                          <button className="link" disabled={busy} onClick={() => act(() => admin!.setFeatured(b, featured ? null : new Date(Date.now() + 30 * DAY)))}>
                            {featured ? t('businesses.unfeature') : t('businesses.feature30')}
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="count">{t('businesses.count', { count: list.length })} {t('businesses.rankingNote')}</p>
        </div>
      )}
    </section>
  );
}
