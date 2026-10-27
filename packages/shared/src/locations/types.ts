export interface Province {
  /** Plaka kodu, iki haneli metin ("01" ... "81"). */
  code: string;
  name: string;
  slug: string;
}

export interface District {
  /** "<il kodu>-<ilçe adı>", örn. "16-nilufer". */
  id: string;
  provinceCode: string;
  name: string;
}

export type NeighbourhoodKind = 'mahalle' | 'koy' | 'diger';

export interface Neighbourhood {
  /** "<ilçe id>-<mahalle adı>", örn. "16-nilufer-ataevler". */
  id: string;
  name: string;
  kind: NeighbourhoodKind;
  postalCode: string;
}

/** Kullanıcının seçtiği konum. Kayıtta zorunlu değildir; Benim Şehrim il ve ilçe ister. */
export interface UserLocation {
  provinceCode: string;
  districtId?: string;
  neighbourhoodId?: string;
}
