import { ValidationError } from '../domain/errors/DomainErrors.js';
import { validateDeliveryArea } from './DeliveryZoneRules.js';

/** Điểm xuất phát mặc định dùng để mở bản đồ; không dùng tính phí hoặc tính tuyến. */
export const SHOP_COORDINATES = Object.freeze({
  address: '14 Trịnh Đình Thảo, Hòa Thạnh, Tân Phú, Thành phố Hồ Chí Minh, Việt Nam',
  lat: Number(process.env.DELIVERY_STORE_LAT ?? 10.7744),
  lng: Number(process.env.DELIVERY_STORE_LNG ?? 106.63412)
});

const MAX_ADDRESS_LENGTH = 255;

/** Dịch vụ báo phí theo phường; tuyệt đối không gọi API định tuyến. */
export class DeliveryService {
  constructor({
    originLat = SHOP_COORDINATES.lat,
    originLng = SHOP_COORDINATES.lng,
    mapsApiKey = process.env.GOOGLE_MAPS_API_KEY || ''
  } = {}) {
    const latitude = Number(originLat);
    const longitude = Number(originLng);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new TypeError('Tọa độ tâm bản đồ DELIVERY_STORE_LAT/LNG không hợp lệ');
    }
    this.mapCenter = { latitude, longitude };
    this.mapsApiKey = String(mapsApiKey || '').trim();
  }

  /** Trả cấu hình hiển thị bản đồ giao hàng; hỗ trợ cả Leaflet và Google Maps. */
  getMapConfig() {
    return {
      center: { ...this.mapCenter },
      origin: { ...this.mapCenter },
      label: 'Tiệm hoa ShopHoa (14 Trịnh Đình Thảo)',
      googleMapsApiKey: this.mapsApiKey
    };
  }

  /**
   * Tra phí cố định từ phường. Tọa độ nếu có chỉ được lưu để người giao mở bản đồ;
   * chúng không tham gia quyết định vùng, phí hoặc khả năng phục vụ.
   * @param {{address?:string,addressDetails?:string,area:string,latitude?:number,longitude?:number}} input
   * @returns {Promise<Object>} Phí do bảng phường phía server xác định.
   */
  async quote({ address = '', addressDetails = '', area = '', latitude, longitude } = {}) {
    const cleanAddress = String(address || '').trim();
    const cleanDetails = String(addressDetails || '').trim();
    const cleanArea = String(area || '').trim();
    if (cleanAddress.length > MAX_ADDRESS_LENGTH || cleanDetails.length > MAX_ADDRESS_LENGTH) {
      throw new ValidationError('Địa chỉ hoặc chỉ dẫn quá dài; vui lòng rút gọn dưới 255 ký tự');
    }

    const rate = validateDeliveryArea(cleanArea);
    const hasLatitude = latitude !== undefined && latitude !== null && String(latitude).trim() !== '';
    const hasLongitude = longitude !== undefined && longitude !== null && String(longitude).trim() !== '';
    if (hasLatitude !== hasLongitude) throw new ValidationError('Tọa độ ghim chưa đầy đủ');

    let pin = null;
    if (hasLatitude && hasLongitude) {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        throw new ValidationError('Vị trí ghim trên Google Maps không hợp lệ');
      }
      pin = { latitude: lat, longitude: lng };
    }

    return {
      serviceable: true,
      requiresShopConfirmation: false,
      manualQuoteRequired: false,
      area: cleanArea,
      zoneId: rate.id,
      zoneName: rate.name,
      fee: rate.fee,
      latitude: pin?.latitude ?? null,
      longitude: pin?.longitude ?? null,
      pinProvided: Boolean(pin),
      distanceMeters: null,
      snappedOffsetMeters: null,
      provider: 'preconfigured-area-rate-v1',
      rateVersion: 'delivery-area-rate-v1-2026-11',
      quotedAt: new Date()
    };
  }

  /** Không dùng dịch vụ gợi ý/geocoding ngoài; khách tự nhập địa chỉ và ghim trên bản đồ. */
  async suggest() {
    return [];
  }
}
