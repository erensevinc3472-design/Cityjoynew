import { provinceCodeFromPlaceName } from '../listings/listings';
import { normalizeName } from '../organizations/municipalities';
import { sameNeighbourhoodName } from '../organizations/profiles';

/**
 * Konum rozeti (PROJE.md 5.5 madde 5: "isteyen konumunu doğrulayıp rozet alabilir"). Telefonun konumu bir kez alınır,
 * adresi telefonun içinde çözülür (ücretsiz) ve kayıtlı konumla karşılaştırılır: il ve ilçe tutarsa "ilçe", telefon
 * mahalle adını da verip o da tutarsa "mahalle". Koordinat saklanmaz; herkese yalnızca rozet görünür (mahalle adı değil).
 * Mahalle değişince rozet düşer. Sahte konumla aşılabilir: tek başına güvence değildir.
 */
export type LocationBadge = 'mahalle' | 'ilce';
export const LOCATION_BADGES: readonly LocationBadge[] = ['mahalle', 'ilce'];

/** Kişinin kendi kaydındaki (gizli) doğrulama: hangi mahalle için, hangi düzeyde, ne zaman. */
export interface LocationCheck {
  neighbourhoodId: string;
  level: LocationBadge;
  at: string;
}

/** Telefonun adres çözümlemesinden gelen alanlar (expo-location: il region, ilçe subregion, mahalle district). */
export interface ResolvedPlace {
  region?: string | null;
  subregion?: string | null;
  city?: string | null;
  district?: string | null;
  name?: string | null;
}

const stripDistrict = (s: string) => normalizeName(s).replace(/ (ilcesi|merkez)$/, '').trim();

export function locationBadgeFor(
  place: ResolvedPlace,
  registered: { provinceCode: string; districtName: string; neighbourhoodName?: string },
  provinces: readonly { code: string; name: string }[],
): LocationBadge | null {
  const province = provinceCodeFromPlaceName(place.region, provinces) ?? provinceCodeFromPlaceName(place.subregion, provinces);
  if (province !== registered.provinceCode) return null;
  const want = stripDistrict(registered.districtName);
  const districtOk = [place.subregion, place.city, place.district].some((x) => !!x && stripDistrict(x) === want);
  if (!districtOk) return null;
  const hood = registered.neighbourhoodName;
  const hoodOk = !!hood && [place.district, place.name].some((x) => !!x && sameNeighbourhoodName(x, hood));
  return hoodOk ? 'mahalle' : 'ilce';
}
