import { getDeliveryAreaRate } from '../../public/js/delivery-areas.js';
import { ValidationError } from '../domain/errors/DomainErrors.js';

/** Kiểm tra phường giao hàng và trả mức phí cố định đã cấu hình cho phường đó. */
export function validateDeliveryArea(area) {
  const cleanArea = String(area || '').trim();
  const rate = getDeliveryAreaRate(cleanArea);
  if (!rate) throw new ValidationError('Phường giao hàng không có trong danh sách khu vực đang phục vụ');
  return { id: rate.zoneId, name: rate.zoneName, area: cleanArea, fee: rate.fee };
}
