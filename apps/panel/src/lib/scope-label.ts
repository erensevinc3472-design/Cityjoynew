import type { RegionScope } from '@cityjoy/shared';

import { locationRepository as repo } from './locations';
import { t } from './t';

export function scopeLabel(scope: RegionScope, neighbourhoodName?: string): string {
  if (scope.level === 'ulke') return t('scope.ulke');
  const province = repo.getProvince(scope.provinceCode)?.name ?? scope.provinceCode;
  if (scope.level === 'il') return province;
  const district = repo.getDistrict(scope.districtId)?.name ?? scope.districtId;
  if (scope.level === 'ilce') return `${province} › ${district}`;
  return `${province} › ${district} › ${neighbourhoodName ?? '…'}`;
}
