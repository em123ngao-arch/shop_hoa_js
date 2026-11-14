import { DELIVERY_AREAS } from '../../public/js/delivery-areas.js';
import { ValidationError } from '../domain/errors/DomainErrors.js';

/**
 * Bảng phí thử nghiệm theo phường, không tính tuyến hay khoảng cách để ra giá.
 * Mức 0/35.000/50.000đ là cấu hình pilot; chủ shop cần rà lại phường và chi phí
 * chuyến thực tế trước khi công khai bán hàng.
 */
export const DELIVERY_ZONE_CONFIG = Object.freeze({
  near: Object.freeze({ id: 'near', name: 'Khu vực gần tiệm', fee: 0, maxPinDistanceKm: 4.5 }),
  local: Object.freeze({ id: 'local', name: 'Khu vực lân cận', fee: 35000, maxPinDistanceKm: 10 }),
  extended: Object.freeze({ id: 'extended', name: 'Khu vực xa', fee: 50000, maxPinDistanceKm: 12 })
});

/** Phường hiện hành nằm trong khu vực Tân Phú lân cận tiệm; giá cố định theo phường. */
const LOCAL_AREAS = new Set([
  'Phường Tân Sơn Nhì',
  'Phường Phú Thọ Hòa',
  'Phường Phú Thạnh',
  'Phường Tây Thạnh'
]);

/**
 * Xác định vùng giao từ phường khách chọn.
 * @param {string} area - Tên phường hiện hành.
 * @returns {{id:string,name:string,fee:number,maxPinDistanceKm:number}}
 */
export function getDeliveryZone(area) {
  const cleanArea = String(area || '').trim();
  if (!DELIVERY_AREAS.includes(cleanArea)) {
    throw new ValidationError('Phường giao hàng không có trong danh sách khu vực đang phục vụ');
  }

  if (cleanArea === 'Phường Tân Phú') return DELIVERY_ZONE_CONFIG.near;
  if (LOCAL_AREAS.has(cleanArea)) return DELIVERY_ZONE_CONFIG.local;
  return DELIVERY_ZONE_CONFIG.extended;
}

