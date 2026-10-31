import { describe, expect, it } from 'vitest';

import { chatId, inboxSection, isHiddenFor, isRequestFor, otherMember, quotaAfter, scamSignal, threadId, validateMessage } from '../index';

describe('mesajlar', () => {
  it('iki kişinin tek sohbeti olur', () => {
    expect(chatId('b', 'a')).toBe('a_b');
    expect(chatId('a', 'b')).toBe('a_b');
    expect(otherMember({ members: ['a', 'b'] }, 'a')).toBe('b');
  });

  it('kabul edilmemiş sohbet yalnızca alıcıda istektir', () => {
    expect(isRequestFor({ accepted: false, startedBy: 'a' }, 'b')).toBe(true);
    expect(isRequestFor({ accepted: false, startedBy: 'a' }, 'a')).toBe(false);
    expect(isRequestFor({ accepted: true, startedBy: 'a' }, 'b')).toBe(false);
  });

  it('mesaj uzunluğu', () => {
    expect(validateMessage('  ')).toBe('empty');
    expect(validateMessage('a'.repeat(1001))).toBe('tooLong');
    expect(validateMessage('Merhaba')).toBeNull();
  });

  it('dolandırıcılık işaretleri', () => {
    expect(scamSignal('IBAN: TR12 0006 1005 1978 6457 8413 26')).toBe('iban');
    expect(scamSignal('Önce kapora gönderin lütfen')).toBe('kapora');
    expect(scamSignal('Şuradan bakın: bit.ly/abc')).toBe('link');
    expect(scamSignal('https://ornek.com/ilan')).toBe('link');
    expect(scamSignal('Yarın saat 3 te parkta buluşalım mı?')).toBeNull();
  });

  it('günlük sayaç', () => {
    const now = new Date('2026-10-28T12:00:00Z');
    expect(quotaAfter(null, now)).toEqual({ reset: true, count: 1 });
    expect(quotaAfter({ windowStart: '2026-10-28T01:00:00Z', count: 4 }, now)).toEqual({ reset: false, count: 5 });
    expect(quotaAfter({ windowStart: '2026-10-27T11:00:00Z', count: 30 }, now)).toEqual({ reset: true, count: 1 });
  });

  it('işletme sohbeti ayrı kimlikli; sahibinde İşletmem, müşteride Sohbetler', () => {
    const ctx = { type: 'isletme' as const, id: 'kafe', title: 'Kafe' };
    expect(threadId('b', 'a', ctx)).toBe('a_b__b_kafe');
    expect(threadId('b', 'a')).toBe(chatId('a', 'b'));
    const chat = { accepted: true, startedBy: 'musteri', context: ctx };
    expect(inboxSection(chat, 'sahip')).toBe('isletmem');
    expect(inboxSection(chat, 'musteri')).toBe('sohbetler');
    expect(inboxSection({ accepted: false, startedBy: 'x' }, 'y')).toBe('istekler');
  });

  it('silinen sohbet yeni mesaj gelene kadar gizli', () => {
    const last = { id: 'm', text: '', from: 'x', at: '2026-10-30T10:00:00.000Z' };
    expect(isHiddenFor({ hidden: { me: '2026-10-30T11:00:00.000Z' }, last }, 'me')).toBe(true);
    expect(isHiddenFor({ hidden: { me: '2026-10-30T09:00:00.000Z' }, last }, 'me')).toBe(false);
    expect(isHiddenFor({ hidden: {}, last }, 'me')).toBe(false);
  });
});
