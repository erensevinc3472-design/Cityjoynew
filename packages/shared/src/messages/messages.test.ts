import { describe, expect, it } from 'vitest';

import { chatId, isRequestFor, otherMember, quotaAfter, scamSignal, validateMessage } from '../index';

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
});
