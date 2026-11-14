import { describe, expect, it } from 'vitest';

import { mediaEditTexts, playRange, sanitizeMediaEdit, sanitizeMediaEdits } from './media-edit';

describe('paylaşım düzenleyicisi verisi', () => {
  it('yazı ve çıkartmayı temizler, sınırları uygular', () => {
    const e = sanitizeMediaEdit({
      items: [
        { kind: 'yazi', x: 2, y: -1, scale: 99, rotation: 720, text: '  Akşam  ', font: 'yok', color: 'red', bg: 'dolu', bgColor: '#E2B277', align: 'left', size: 1 },
        { kind: 'yazi', text: '   ' },
        { kind: 'cikartma', type: 'bahset', label: '@Ayşe', uid: 'u1' },
        { kind: 'cikartma', type: 'emoji', label: '🔥', uid: 'bad uid!' },
        { kind: 'baska' },
      ],
    })!;
    expect(e.items).toHaveLength(3);
    expect(e.items![0]).toMatchObject({ x: 1, y: 0, scale: 5, rotation: 360, text: 'Akşam', font: 'modern', color: '#FFFFFF', bg: 'dolu', bgColor: '#E2B277', align: 'left', size: 0.4 });
    expect(e.items![1]).toMatchObject({ type: 'bahset', uid: 'u1' });
    expect(e.items![2]).not.toHaveProperty('uid');
  });

  it('çizgileri 0-1000 aralığına ve çift sayıya indirir, tek noktalıyı atar', () => {
    const e = sanitizeMediaEdit({ strokes: [{ points: [1, 2, 3000, -5, 7], color: '#000000', width: 9, marker: true }, { points: [1, 2] }] })!;
    expect(e.strokes).toEqual([{ points: [1, 2, 1000, 0], color: '#000000', width: 0.08, marker: true }]);
  });

  it('video alanları yalnızca video süresi verilince kalır; tam uzunluk kırpma sayılmaz', () => {
    expect(sanitizeMediaEdit({ muted: true, trimStart: 2, trimEnd: 9 })).toBeNull();
    expect(sanitizeMediaEdit({ muted: true, trimStart: 2, trimEnd: 9, coverAt: 3 }, 20)).toEqual({ muted: true, trimStart: 2, trimEnd: 9, coverAt: 3 });
    expect(sanitizeMediaEdit({ trimStart: 0, trimEnd: 20 }, 20)).toBeNull();
    expect(sanitizeMediaEdit({ trimStart: 5, trimEnd: 5.5 }, 20)).toBeNull();
  });

  it('liste medya sayısına kısılır; hiç düzenleme yoksa undefined', () => {
    expect(sanitizeMediaEdits([null, {}], 2)).toBeUndefined();
    const l = sanitizeMediaEdits([null, { items: [{ kind: 'yazi', text: 'a' }] }, { items: [{ kind: 'yazi', text: 'b' }] }], 2)!;
    expect(l).toHaveLength(2);
    expect(l[0]).toBeNull();
  });

  it('süzgeç için yazıları ve emoji dışı etiketleri toplar; oynatma aralığı', () => {
    const edits = [sanitizeMediaEdit({ items: [{ kind: 'yazi', text: 'merhaba' }, { kind: 'cikartma', type: 'etiket', label: '#kötü' }, { kind: 'cikartma', type: 'emoji', label: '🔥' }] }), null];
    expect(mediaEditTexts(edits)).toEqual(['merhaba', '#kötü']);
    expect(playRange({ trimStart: 3, trimEnd: 10 }, 20)).toEqual({ start: 3, end: 10 });
    expect(playRange(null, 20)).toEqual({ start: 0, end: 20 });
  });
});
