import { describe, expect, it } from 'vitest';

import { orgModulesFor } from '../permissions/grants';
import { validateEvent } from '../events/events';
import { sortAdoptions, validateAdoption, type Adoption, type AdoptionInput } from './adoption';

const base: AdoptionInput = {
  name: 'Pamuk', species: 'kopek', age: '2 yaşında', sex: 'disi', vaccinated: true, neutered: false, urgent: false,
  about: 'Sevimli ve enerjik.', region: { provinceCode: '16' }, phone: '0224 000 00 00',
};

describe('hayvan sahiplendirme', () => {
  it('denetim: ad, yaş, hakkında ve en az bir geçerli iletişim', () => {
    expect(validateAdoption(base)).toEqual([]);
    expect(validateAdoption({ ...base, phone: undefined })).toEqual(['contact']);
    expect(validateAdoption({ ...base, phone: undefined, email: 'yanlis' })).toEqual(['contact']);
    expect(validateAdoption({ ...base, phone: undefined, email: 'pati@ornek.org' })).toEqual([]);
    expect(validateAdoption({ ...base, name: '', age: '', about: 'kısa' })).toEqual(['name', 'age', 'about']);
  });

  it('acil olanlar önce, sonra en yeni', () => {
    const a = (id: string, urgent: boolean, createdAt: string) => ({ ...base, id, urgent, createdAt, updatedAt: '', org: { id: 'o', name: 'o' }, status: 'yayinda' }) as Adoption;
    expect(sortAdoptions([a('eski', false, '2026-11-01'), a('yeni', false, '2026-11-05'), a('acil', true, '2026-10-01')]).map((x) => x.id)).toEqual(['acil', 'yeni', 'eski']);
  });

  it('dernek yalnızca sahiplendirme alır; sahiplendirme belediyelerde var, kurumda yok', () => {
    expect(orgModulesFor('dernek')).toEqual(['sahiplendirme']);
    expect(orgModulesFor('ilce-belediyesi')).toContain('sahiplendirme');
    expect(orgModulesFor('kurum')).not.toContain('sahiplendirme');
  });

  it('gönüllülük etkinliği ücretli olamaz', () => {
    const ev = {
      title: 'Park temizliği', description: 'Merkez Park çevre temizliği, eldiven bizden.', category: 'gonulluluk', startsAt: '2026-12-01T09:00:00Z',
      endsAt: '2026-12-01T12:00:00Z', venueName: 'Merkez Park', region: { provinceCode: '16' }, free: false, priceNote: '50 TL',
    } as const;
    expect(validateEvent(ev as never, { level: 'il', provinceCode: '16' }, new Date('2026-11-05T00:00:00Z'))).toContain('price');
  });
});
