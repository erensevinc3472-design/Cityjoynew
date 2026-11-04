import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  can,
  CONTEST_STAGES,
  isGrantActive,
  pollOptionIds,
  validateContest,
  validatePoll,
  type Contest,
  type ContestEntry,
  type ContestStage,
  type ContestStatus,
  type Poll,
  type PollStatus,
} from '@cityjoy/shared';
import { createCommunityAdmin } from '@cityjoy/shared/firebase';

import { firestore } from '../lib/firebase';
import { useCity } from '../lib/city';
import { locationRepository as repo } from '../lib/locations';
import { isAdminUser, useSession } from '../lib/session';
import { t } from '../lib/t';

/**
 * Panel > Anketler, Yarışmalar, Şehir Kulüpleri (13. madde 35). Anket ve yarışma admin'in (kurum talepleri ekip
 * aracılığıyla, ücret elle); kulüpleri il yöneticisi (kurumlar modülü) ekler, doğrular ve şehrin kulübünü seçer.
 * Her işlem işlem kaydına yazılır.
 */

type Msg = { kind: 'ok' | 'error'; text: string } | undefined;
const fmt = (ymd: string) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('tr-TR') : '');

function useAction(load: () => Promise<void>, errorKey: string) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Msg>();
  const act = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await fn();
      setMessage({ kind: 'ok', text: ok });
      await load();
    } catch {
      setMessage({ kind: 'error', text: t(errorKey) });
    } finally {
      setBusy(false);
    }
  };
  return { busy, message, setMessage, act };
}

function Message({ message }: { message: Msg }) {
  return message ? <p className={message.kind === 'error' ? 'error' : 'note'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null;
}

function ProvinceSelect({ id, value, options, onChange }: { id: string; value: string; options: string[]; onChange(v: string): void }) {
  if (options.length < 2) return null;
  return (
    <div className="field">
      <label htmlFor={id}>{t('community.province')}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((p) => (
          <option key={p} value={p}>{repo.getProvince(p)?.name ?? p}</option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------- Anketler

const emptyPoll = { question: '', options: '', sponsorName: '', districtId: '', endsOn: '', notPolitical: false };

export function PollsPage() {
  const { user } = useSession();
  const city = useCity();
  const admin = isAdminUser(user);
  const canEdit = admin && !!user && !user.isDemo;
  const provinces = useMemo(() => repo.getProvinces().map((p) => p.code), []);
  const [provinceCode, setProvinceCode] = useState(city.provinceCode || '16');
  const service = useMemo(() => (user ? createCommunityAdmin(firestore, user.uid) : null), [user]);
  const [list, setList] = useState<Poll[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState(emptyPoll);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoadError(false);
    if (!service) return;
    if (user?.isDemo) return setList([]);
    try {
      setList(await service.listPolls(provinceCode));
    } catch {
      setLoadError(true);
    }
  }, [service, provinceCode, user?.isDemo]);
  useEffect(() => {
    load();
  }, [load]);
  const { busy, message, act } = useAction(load, 'community.error');

  if (!admin) return <section className="page"><p className="note">{t('community.adminOnly')}</p></section>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const labels = draft.options.split('\n').map((s) => s.trim()).filter(Boolean);
    const ids = pollOptionIds(labels.length);
    const input = { question: draft.question, options: labels.map((label, n) => ({ id: ids[n] ?? String(n), label })), sponsorName: draft.sponsorName, provinceCode, districtId: draft.districtId || undefined, endsOn: draft.endsOn };
    const errs: string[] = validatePoll(input);
    if (!draft.notPolitical) errs.push('political');
    setErrors(errs);
    if (errs.length || !service) return;
    act(async () => {
      await service.savePoll(null, input);
      setDraft(emptyPoll);
    }, t('community.polls.published'));
  };
  const setStatus = (p: Poll, s: PollStatus) => act(() => service!.setPollStatus(p, s), t('community.saved'));

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('community.polls.title')}</h1>
          <p className="meta">{t('community.polls.intro')}</p>
        </div>
      </header>
      <Message message={message} />
      <ProvinceSelect id="pl-province" value={provinceCode} options={provinces} onChange={setProvinceCode} />

      {canEdit ? (
        <form className="card" onSubmit={submit}>
          <h2 className="card-title">{t('community.polls.new')}</h2>
          <div className="field">
            <label htmlFor="pl-q">{t('community.polls.question')}</label>
            <input id="pl-q" value={draft.question} maxLength={140} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="pl-o">{t('community.polls.options')}</label>
            <textarea id="pl-o" rows={4} value={draft.options} onChange={(e) => setDraft({ ...draft, options: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="pl-s">{t('community.polls.sponsor')}</label>
            <input id="pl-s" value={draft.sponsorName} maxLength={80} onChange={(e) => setDraft({ ...draft, sponsorName: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="pl-d">{t('community.polls.district')}</label>
            <select id="pl-d" value={draft.districtId} onChange={(e) => setDraft({ ...draft, districtId: e.target.value })}>
              <option value="">{t('community.polls.wholeProvince')}</option>
              {repo.getDistricts(provinceCode).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pl-e">{t('community.polls.endsOn')}</label>
            <input id="pl-e" type="date" value={draft.endsOn} onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })} />
          </div>
          <label className="check">
            <input type="checkbox" checked={draft.notPolitical} onChange={(e) => setDraft({ ...draft, notPolitical: e.target.checked })} /> {t('community.polls.notPolitical')}
          </label>
          {errors.length ? <p className="error" role="alert">{errors.map((k) => t(`community.polls.errors.${k}`)).join(' ')}</p> : null}
          <button className="btn" disabled={busy}>{t('community.polls.publish')}</button>
        </form>
      ) : null}

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('community.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('community.retry')}</button>
        </div>
      ) : list === null ? (
        <div className="state" aria-live="polite">{t('community.loading')}</div>
      ) : !list.length ? (
        <div className="state">{t('community.polls.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('community.polls.question')}</th>
                <th scope="col">{t('community.statusCol')}</th>
                <th scope="col" className="num">{t('community.polls.votes')}</th>
                <th scope="col"><span className="sr-only">{t('community.actionsCol')}</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.question}</strong>
                    <div className="meta">
                      {[p.sponsorName, repo.getDistrict(p.districtId ?? '')?.name, t('community.polls.until', { date: fmt(p.endsOn) })].filter(Boolean).join(' · ')}
                    </div>
                    <div className="meta">{p.options.map((o) => `${o.label}: ${p.counts[o.id] ?? 0}`).join(' · ')}</div>
                  </td>
                  <td><span className={p.status === 'yayinda' ? 'pill ok' : 'pill'}>{t(`community.polls.status.${p.status}`)}</span></td>
                  <td className="num">{p.voteCount}</td>
                  <td className="row-actions">
                    {canEdit && p.status !== 'yayinda' ? <button className="link" disabled={busy} onClick={() => setStatus(p, 'yayinda')}>{t('community.polls.reopen')}</button> : null}
                    {canEdit && p.status === 'yayinda' ? <button className="link" disabled={busy} onClick={() => setStatus(p, 'kapali')}>{t('community.polls.close')}</button> : null}
                    {canEdit && p.status !== 'gizlendi' ? <button className="link" disabled={busy} onClick={() => setStatus(p, 'gizlendi')}>{t('community.hide')}</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Yarışmalar

const emptyContest = { title: '', description: '', prize: '', stage: 'il' as ContestStage, provinceCode: '16', regionName: '', stageCount: 1 as 1 | 2 | 3, joinEndsOn: '', voteEndsOn: '', terms: '' };
const CONTEST_FLOW: ContestStatus[] = ['katilim', 'oylama', 'sonuc'];

export function ContestsPage() {
  const { user } = useSession();
  const admin = isAdminUser(user);
  const canEdit = admin && !!user && !user.isDemo;
  const service = useMemo(() => (user ? createCommunityAdmin(firestore, user.uid) : null), [user]);
  const [list, setList] = useState<Contest[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState(emptyContest);
  const [errors, setErrors] = useState<string[]>([]);
  const [open, setOpen] = useState<Contest | null>(null);
  const [entries, setEntries] = useState<ContestEntry[] | null>(null);

  const loadEntries = useCallback(async (c: Contest | null) => {
    setEntries(null);
    if (c && service && !user?.isDemo) setEntries(await service.listAllEntries(c.id).catch(() => []));
    else setEntries([]);
  }, [service, user?.isDemo]);
  const load = useCallback(async () => {
    setLoadError(false);
    if (!service) return;
    if (user?.isDemo) return setList([]);
    try {
      const all = await service.listContests();
      setList(all);
      setOpen((o) => (o ? (all.find((x) => x.id === o.id) ?? null) : o));
    } catch {
      setLoadError(true);
    }
  }, [service, user?.isDemo]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadEntries(open);
  }, [open?.id, loadEntries]); // eslint-disable-line react-hooks/exhaustive-deps
  const { busy, message, act } = useAction(async () => (await load(), await loadEntries(open)), 'community.error');

  if (!admin) return <section className="page"><p className="note">{t('community.adminOnly')}</p></section>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateContest(draft);
    setErrors(errs);
    if (errs.length || !service) return;
    act(async () => {
      await service.saveContest(null, draft);
      setDraft(emptyContest);
    }, t('community.contests.published'));
  };
  const entryStatus = (e: ContestEntry, s: 'onayli' | 'diskalifiye') => {
    const reason = s === 'diskalifiye' ? window.prompt(t('community.reasonPrompt'), '') : '';
    if (reason === null || !open) return;
    act(() => service!.setEntryStatus(open, e, s, reason.trim().slice(0, 120)), t('community.saved'));
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{t('community.contests.title')}</h1>
          <p className="meta">{t('community.contests.intro')}</p>
        </div>
      </header>
      <Message message={message} />

      {canEdit ? (
        <form className="card" onSubmit={submit}>
          <h2 className="card-title">{t('community.contests.new')}</h2>
          <div className="field">
            <label htmlFor="ct-t">{t('community.contests.name')}</label>
            <input id="ct-t" value={draft.title} maxLength={80} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ct-d">{t('community.contests.description')}</label>
            <textarea id="ct-d" rows={3} maxLength={400} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ct-p">{t('community.contests.prize')}</label>
            <input id="ct-p" value={draft.prize} maxLength={120} onChange={(e) => setDraft({ ...draft, prize: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ct-s">{t('community.contests.stage')}</label>
            <select id="ct-s" value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value as ContestStage })}>
              {CONTEST_STAGES.map((s) => (
                <option key={s} value={s}>{t(`community.contests.stages.${s}`)}</option>
              ))}
            </select>
          </div>
          {draft.stage === 'il' ? (
            <ProvinceSelect id="ct-pr" value={draft.provinceCode} options={repo.getProvinces().map((p) => p.code)} onChange={(v) => setDraft({ ...draft, provinceCode: v })} />
          ) : draft.stage === 'bolge' ? (
            <div className="field">
              <label htmlFor="ct-r">{t('community.contests.region')}</label>
              <input id="ct-r" value={draft.regionName} maxLength={40} onChange={(e) => setDraft({ ...draft, regionName: e.target.value })} />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="ct-n">{t('community.contests.stageCount')}</label>
            <select id="ct-n" value={draft.stageCount} onChange={(e) => setDraft({ ...draft, stageCount: Number(e.target.value) as 1 | 2 | 3 })}>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ct-j">{t('community.contests.joinEndsOn')}</label>
            <input id="ct-j" type="date" value={draft.joinEndsOn} onChange={(e) => setDraft({ ...draft, joinEndsOn: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ct-v">{t('community.contests.voteEndsOn')}</label>
            <input id="ct-v" type="date" value={draft.voteEndsOn} onChange={(e) => setDraft({ ...draft, voteEndsOn: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ct-terms">{t('community.contests.terms')}</label>
            <textarea id="ct-terms" rows={6} maxLength={6000} value={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} />
            <p className="meta">{t('community.contests.termsHint')}</p>
          </div>
          {errors.length ? <p className="error" role="alert">{errors.map((k) => t(`community.contests.errors.${k}`)).join(' ')}</p> : null}
          <button className="btn" disabled={busy}>{t('community.contests.publish')}</button>
        </form>
      ) : null}

      {loadError ? (
        <div className="state" role="alert">
          <p>{t('community.loadError')}</p>
          <button className="btn secondary" onClick={load}>{t('community.retry')}</button>
        </div>
      ) : list === null ? (
        <div className="state" aria-live="polite">{t('community.loading')}</div>
      ) : !list.length ? (
        <div className="state">{t('community.contests.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('community.contests.name')}</th>
                <th scope="col">{t('community.statusCol')}</th>
                <th scope="col" className="num">{t('community.contests.entries')}</th>
                <th scope="col"><span className="sr-only">{t('community.actionsCol')}</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.title}</strong>
                    <div className="meta">
                      {[t(`community.contests.stages.${c.stage}`), c.provinceCode ? repo.getProvince(c.provinceCode)?.name : c.regionName, t('community.contests.dates', { join: fmt(c.joinEndsOn), vote: fmt(c.voteEndsOn) })].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td><span className={c.status === 'gizlendi' ? 'pill' : 'pill ok'}>{t(`community.contests.status.${c.status}`)}</span></td>
                  <td className="num">{c.entryCount}</td>
                  <td className="row-actions">
                    <button className="link" onClick={() => setOpen(open?.id === c.id ? null : c)}>{open?.id === c.id ? t('community.contests.closeEntries') : t('community.contests.showEntries')}</button>
                    {canEdit
                      ? CONTEST_FLOW.filter((s) => s !== c.status).map((s) => (
                          <button key={s} className="link" disabled={busy} onClick={() => act(() => service!.setContestStatus(c, s), t('community.saved'))}>{t(`community.contests.to.${s}`)}</button>
                        ))
                      : null}
                    {canEdit && c.status !== 'gizlendi' ? <button className="link" disabled={busy} onClick={() => act(() => service!.setContestStatus(c, 'gizlendi'), t('community.saved'))}>{t('community.hide')}</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <div className="card">
          <h2 className="card-title">{t('community.contests.entriesOf', { name: open.title })}</h2>
          <p className="note">{t('community.contests.reviewHint')}</p>
          {entries === null ? (
            <div className="state" aria-live="polite">{t('community.loading')}</div>
          ) : !entries.length ? (
            <div className="state">{t('community.contests.noEntries')}</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('community.contests.entrant')}</th>
                    <th scope="col">{t('community.statusCol')}</th>
                    <th scope="col" className="num">{t('community.contests.votes')}</th>
                    <th scope="col"><span className="sr-only">{t('community.actionsCol')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.displayName}</strong>
                        <div className="meta">
                          <a href={e.mediaUrl} target="_blank" rel="noreferrer noopener">{t('community.contests.watch')}</a>
                          {e.note ? ` · ${e.note}` : ''}
                        </div>
                      </td>
                      <td><span className={e.status === 'onayli' ? 'pill ok' : 'pill'}>{t(`community.contests.entry.${e.status}`)}</span></td>
                      <td className="num">{e.voteCount}</td>
                      <td className="row-actions">
                        {canEdit && e.status !== 'onayli' ? <button className="link" disabled={busy} onClick={() => entryStatus(e, 'onayli')}>{t('community.contests.approve')}</button> : null}
                        {canEdit && e.status !== 'diskalifiye' ? <button className="link" disabled={busy} onClick={() => entryStatus(e, 'diskalifiye')}>{t('community.contests.disqualify')}</button> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------- Şehir Kulüpleri
