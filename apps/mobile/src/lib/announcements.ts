import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isAnnouncementLive, isForLocation, isNotice, sortForFeed, type Announcement, type UserLocation } from '@cityjoy/shared';

import { locationRepository as repo } from './locations';
import { announcementRepository } from './services';

/** İl başına son okuma; ana sayfa ve liste aynı sonucu paylaşır, 5 dakikada bir tazelenir (maliyet ilkesi). */
const cache = new Map<string, { at: number; list: Announcement[] }>();
const TTL = 5 * 60 * 1000;

/** Kullanıcının konumuna yönelik yayındaki duyurular: il geneli, kendi ilçesi, kendi mahallesi; acil en üstte. */
export function useAnnouncements(location: UserLocation | null, which: 'duyurular' | 'haberler' | 'hepsi' = 'duyurular') {
  const provinceCode = location?.provinceCode;
  const [all, setAll] = useState<Announcement[] | null>(() => (provinceCode ? (cache.get(provinceCode)?.list ?? null) : []));
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (force = false) => {
      if (!provinceCode) return setAll([]);
      const hit = cache.get(provinceCode);
      if (hit && !force && Date.now() - hit.at < TTL) return setAll(hit.list);
      setFailed(false);
      try {
        const list = await announcementRepository.listLive(provinceCode);
        cache.set(provinceCode, { at: Date.now(), list });
        setAll(list);
      } catch {
        setFailed(true);
        setAll((x) => x ?? []);
      }
    },
    [provinceCode],
  );

  useEffect(() => {
    load();
  }, [load]);

  const now = new Date();
  // Kurum haberleri duyuru listelerinde görünmez, Haberler sayfasında görünür; Keşfet ikisini de alır.
  const kindOk = (a: Announcement) => which === 'hepsi' || (which === 'haberler') === !isNotice(a);
  const list = all && location ? sortForFeed(all.filter((a) => kindOk(a) && isAnnouncementLive(a, now) && isForLocation(a, location))) : all;
  return { list, failed, reload: () => load(true) };
}

/** Önbellekteki duyuru (ayrıntı ekranı listeden gelince yeniden okumaz). */
export function cachedAnnouncement(id: string): Announcement | undefined {
  for (const { list } of cache.values()) {
    const a = list.find((x) => x.id === id);
    if (a) return a;
  }
  return undefined;
}

/** Duyurunun hedef mahallesinin adı (mahalle dosyası il başına bir kez indirilir). */
export function useNeighbourhoodName(a: Pick<Announcement, 'region'> | null | undefined): string | undefined {
  const [name, setName] = useState<string>();
  const districtId = a?.region.districtId;
  const neighbourhoodId = a?.region.neighbourhoodId;
  useEffect(() => {
    if (!districtId || !neighbourhoodId) return;
    repo
      .getNeighbourhoods(districtId)
      .then((l) => setName(l.find((n) => n.id === neighbourhoodId)?.name))
      .catch(() => {});
  }, [districtId, neighbourhoodId]);
  return neighbourhoodId ? name : undefined;
}

/** Yayınlayanın adı: kurum adı; muhtarlıkta mahalle adı, il yöneticisinde il adı. */
export function useAuthorLabel(a: Pick<Announcement, 'author' | 'region'> | null | undefined): string {
  const { t } = useTranslation();
  const neighbourhood = useNeighbourhoodName(a);
  if (!a) return '';
  if (a.author.type === 'kurum') return a.author.name;
  if (a.author.role === 'muhtar') return t('announcements.muhtarOf', { place: neighbourhood ?? '' });
  return t('announcements.cityjoyOf', { place: repo.getProvince(a.region.provinceCode)?.name ?? '' });
}
