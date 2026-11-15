import { ValidationError } from '../domain/errors/DomainErrors.js';
import { getDeliveryZone } from './DeliveryZoneRules.js';

/** Điểm xuất phát cấu hình hiện tại; cần kiểm tra lại ghim thực tế trước khi mở bán. */
export const SHOP_COORDINATES = Object.freeze({
  address: '14 Trịnh Đình Thảo, Phường Tân Phú, Thành phố Hồ Chí Minh, Việt Nam',
  lat: Number(process.env.DELIVERY_STORE_LAT ?? 10.7744),
  lng: Number(process.env.DELIVERY_STORE_LNG ?? 106.63412)
});

const MAX_PIN_DISTANCE_METERS = 15000;
const MAX_ADDRESS_LENGTH = 255;

/** Khoảng cách đường chim bay chỉ dùng kiểm tra phạm vi ghim, tuyệt đối không dùng tính tiền ship. */
export function calculateStraightLineDistanceMeters(origin, destination) {
  const toRadians = degrees => degrees * (Math.PI / 180);
  const earthRadiusMeters = 6371000;
  const latDelta = toRadians(destination.latitude - origin.latitude);
  const lngDelta = toRadians(destination.longitude - origin.longitude);
  const originLat = toRadians(origin.latitude);
  const destinationLat = toRadians(destination.latitude);
  const haversine = Math.sin(latDelta / 2) ** 2
    + Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(lngDelta / 2) ** 2;
  return Math.round(2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine)));
}

/** @deprecated Chỉ giữ tương thích mã cũ; báo giá hiện hành dùng phí cố định từ getDeliveryZone(). */
export function getDeliveryFee(distanceMeters) {
  const d = Number(distanceMeters);
  if (!Number.isFinite(d) || d < 0) return null;
  if (d <= 3000) return 0;
  if (d <= 10000) return 25000;
  if (d <= 20000) return 40000;
  return null;
}

/** Dịch vụ phí giao cố định theo phường; không gọi Google/OSRM hay tự ước lượng tuyến xe. */
export class DeliveryService {
  constructor({ originLat = SHOP_COORDINATES.lat, originLng = SHOP_COORDINATES.lng } = {}) {
    const latitude = Number(originLat);
    const longitude = Number(originLng);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new TypeError('Cấu hình tọa độ cửa hàng DELIVERY_STORE_LAT/LNG không hợp lệ');
    }
    this.origin = { latitude, longitude };
  }

  /** Trả điểm tiệm công khai để bản đồ checkout tập trung đúng vị trí xuất phát. */
  getMapConfig() {
    return { origin: { ...this.origin }, label: 'Tiệm hoa' };
  }

  /**
   * Tính phí từ bảng vùng server; ghim bản đồ chỉ kiểm tra phạm vi và hỗ trợ tìm địa chỉ.
   * @param {{address?:string,addressDetails?:string,area:string,latitude?:number,longitude?:number}} input
   * @returns {Promise<Object>} Mức phí cố định, vùng, và cảnh báo phạm vi ghim nếu có.
   */
  async quote({ address = '', addressDetails = '', area = '', latitude, longitude } = {}) {
    const cleanAddress = String(address || '').trim();
    const cleanDetails = String(addressDetails || '').trim();
    const cleanArea = String(area || '').trim();
    if (cleanAddress.length > MAX_ADDRESS_LENGTH || cleanDetails.length > MAX_ADDRESS_LENGTH) {
      throw new ValidationError('Địa chỉ hoặc chỉ dẫn quá dài; vui lòng rút gọn dưới 255 ký tự');
    }
    if (cleanAddress && `${cleanAddress}, ${cleanDetails}, ${cleanArea}, TP.HCM`.length > MAX_ADDRESS_LENGTH) {
      throw new ValidationError('Địa chỉ giao hàng quá dài; vui lòng rút gọn thông tin');
    }

    const zone = getDeliveryZone(cleanArea);
    const hasLatitude = latitude !== undefined && latitude !== null && String(latitude).trim() !== '';
    const hasLongitude = longitude !== undefined && longitude !== null && String(longitude).trim() !== '';
    if (hasLatitude !== hasLongitude) throw new ValidationError('Ghim bản đồ chưa có đủ tọa độ');

    let pinDistanceMeters = null;
    let requiresShopConfirmation = false;
    if (hasLatitude && hasLongitude) {
      const pin = { latitude: Number(latitude), longitude: Number(longitude) };
      if (!Number.isFinite(pin.latitude) || pin.latitude < -90 || pin.latitude > 90
        || !Number.isFinite(pin.longitude) || pin.longitude < -180 || pin.longitude > 180) {
        throw new ValidationError('Vị trí ghim trên bản đồ không hợp lệ');
      }
      pinDistanceMeters = calculateStraightLineDistanceMeters(this.origin, pin);
      if (pinDistanceMeters > MAX_PIN_DISTANCE_METERS) {
        return {
          serviceable: false,
          reason: 'outside_delivery_radius',
          message: 'Vị trí ghim đang ngoài phạm vi tự giao của tiệm; vui lòng liên hệ shop.',
          zoneId: zone.id,
          zoneName: zone.name,
          fee: null,
          latitude: pin.latitude,
          longitude: pin.longitude,
          pinDistanceMeters,
          pinDistanceKm: Number((pinDistanceMeters / 1000).toFixed(1)),
          requiresShopConfirmation: true,
          provider: 'configured-zone',
          simulated: false,
          quotedAt: new Date()
        };
      }

      // Các ghim sát biên vùng có thể có tuyến xe dài; yêu cầu shop rà thủ công trước khi nhận.
      requiresShopConfirmation = pinDistanceMeters > zone.maxPinDistanceKm * 1000;
    }

    return {
      serviceable: true,
      zoneId: zone.id,
      zoneName: zone.name,
      area: cleanArea,
      fee: zone.fee,
      latitude: hasLatitude ? Number(latitude) : null,
      longitude: hasLongitude ? Number(longitude) : null,
      pinDistanceMeters,
      pinDistanceKm: pinDistanceMeters === null ? null : Number((pinDistanceMeters / 1000).toFixed(1)),
      pinProvided: pinDistanceMeters !== null,
      requiresShopConfirmation,
      message: requiresShopConfirmation
        ? 'Ghim nằm xa so với vùng phí đã chọn; shop cần xác nhận trước khi nhận đơn.'
        : '',
      provider: 'configured-zone',
      simulated: false,
      placeId: '',
      quotedAt: new Date()
    };
  }

  /** Giữ tương thích endpoint cũ; chưa có dịch vụ gợi ý địa chỉ hay geocoding. */
  async suggest() {
    return [];
  }
}

