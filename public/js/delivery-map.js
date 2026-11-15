import { getDeliveryAreaCoordinates } from './delivery-areas.js?v=20261115_area_rates_v2';

let mapConfigPromise = null;
let leafletLibraryPromise = null;

/**
 * Nạp thư viện Leaflet nội bộ (CSS + JS) từ public/vendor/leaflet/
 * Hoàn toàn miễn phí, độc lập mạng ngoài, zero CDN, tối ưu hiệu năng.
 */
function loadLeafletLibrary() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletLibraryPromise) return leafletLibraryPromise;

  leafletLibraryPromise = new Promise((resolve, reject) => {
    // 1. Đảm bảo Leaflet CSS được thêm vào head
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './vendor/leaflet/leaflet.css';
      document.head.append(link);
    }

    // 2. Nạp file leaflet.js nội bộ
    const script = document.createElement('script');
    script.src = './vendor/leaflet/leaflet.js';
    script.async = true;
    script.onload = () => {
      if (window.L) {
        // Cấu hình đường dẫn asset nội bộ cho icon Leaflet
        window.L.Icon.Default.imagePath = './vendor/leaflet/images/';
        resolve(window.L);
      } else {
        reject(new Error('Không thể khởi tạo thư viện bản đồ Leaflet.'));
      }
    };
    script.onerror = () => {
      leafletLibraryPromise = null;
      reject(new Error('Lỗi nạp thư viện bản đồ nội bộ. Hãy kiểm tra lại thư mục public/vendor/leaflet/.'));
    };
    document.head.append(script);
  });

  return leafletLibraryPromise;
}

/** Lấy cấu hình tọa độ tiệm từ backend để làm tâm bản đồ mặc định. */
async function getDeliveryMapConfig() {
  if (!mapConfigPromise) {
    mapConfigPromise = fetch('/api/delivery/map-config', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        const config = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(config.error?.message || 'Không tải được cấu hình bản đồ.');
        return config;
      })
      .catch(error => {
        mapConfigPromise = null;
        throw error;
      });
  }
  return mapConfigPromise;
}

/**
 * Tạo bản đồ giao hàng tương tác (Leaflet + ESRI World Street Map / CartoDB Voyager).
 * Cho phép khách hàng click hoặc kéo ghim vị trí nhận hoa chính xác.
 * 100% Free, zero billing, không phụ thuộc API key ngoài.
 *
 * @param {HTMLElement} element - Phần tử DOM chứa bản đồ.
 * @param {{initialPin?:{latitude:number,longitude:number}|null,onChange?:(pin:Object|null)=>void,onError?:(message:string)=>void}} options
 * @returns {Promise<{getPin:Function,setPin:Function,clearPin:Function,flyToArea:Function,locateUser:Function,invalidateSize:Function,remove:Function}>}
 */
export async function createDeliveryPinMap(element, { initialPin = null, onChange = () => {}, onError = () => {} } = {}) {
  if (!element) throw new Error('Thiếu vùng hiển thị bản đồ giao hàng.');

  const showMapStatus = message => {
    const status = document.createElement('div');
    status.className = 'delivery-map-status';
    status.setAttribute('role', 'status');
    status.textContent = message;
    element.replaceChildren(status);
  };

  showMapStatus('Đang tải bản đồ định vị giao hoa…');

  let L;
  let config;
  try {
    [L, config] = await Promise.all([
      loadLeafletLibrary(),
      getDeliveryMapConfig()
    ]);
  } catch (error) {
    showMapStatus(error.message || 'Không tải được bản đồ.');
    onError(error.message || 'Không tải được bản đồ.');
    throw error;
  }

  const defaultLat = Number(config.center?.latitude || config.origin?.latitude || 10.7744);
  const defaultLng = Number(config.center?.longitude || config.origin?.longitude || 106.63412);
  const origin = [defaultLat, defaultLng];

  element.replaceChildren();

  // Khởi tạo bản đồ Leaflet
  const map = L.map(element, {
    scrollWheelZoom: false,
    zoomControl: true,
    attributionControl: true
  }).setView(origin, 15);

  // Lớp bản đồ nền ESRI World Street Map:
  // - 100% Miễn phí, không cần bất kỳ API key / billing / thẻ tín dụng
  // - CDN Akamai toàn cầu cực nhanh tại Việt Nam, triệt tiêu 100% lỗi DNS hay ERR_NAME_NOT_RESOLVED
  // - Giao diện đường sá sạch đẹp, chuẩn quốc tế, KHÔNG có rác chữ "Khu phố 1, 2, 3..." gây rối mắt
  const esriTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    minZoom: 5,
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.esri.com" target="_blank" rel="noopener noreferrer">Esri</a> &mdash; World Street Map'
  }).addTo(map);

  // Dự phòng trường hợp mạng khách chặn server ArcGIS: chuyển sang CartoDB Voyager
  esriTileLayer.on('tileerror', () => {
    if (!map.hasLayer(fallbackCartoLayer)) {
      fallbackCartoLayer.addTo(map);
    }
  });

  const fallbackCartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    minZoom: 5,
    maxZoom: 19,
    attribution: '&copy; CartoDB Voyager'
  });

  // Điểm đánh dấu Tiệm Hoa (Store origin marker)
  L.circleMarker(origin, {
    radius: 7,
    color: '#ffffff',
    weight: 2,
    fillColor: '#108474',
    fillOpacity: 1
  }).addTo(map).bindTooltip(config.label || 'Tiệm hoa ShopHoa (14 Trịnh Đình Thảo)', {
    direction: 'top',
    permanent: false
  });

  // Custom SVG Flower Pin Marker cao cấp (Tone xanh lục bảo Flower Chimp + điểm nhấn đỏ hồng)
  const flowerPinIcon = L.divIcon({
    className: 'delivery-flower-pin-marker',
    html: `
      <div class="pin-marker-wrapper">
        <div class="pin-marker-icon">
          <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#108474"/>
            <circle cx="14" cy="14" r="6" fill="#FFFFFF"/>
            <circle cx="14" cy="14" r="3" fill="#D9536F"/>
          </svg>
        </div>
        <div class="pin-marker-pulse"></div>
      </div>
    `,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    tooltipAnchor: [0, -36]
  });

  let marker = null;
  let pin = null;

  /** Công bố tọa độ ghim để form checkout và đơn hàng lưu dữ liệu. */
  const publishPin = () => {
    if (!marker) {
      pin = null;
      onChange(null);
      return;
    }
    const point = marker.getLatLng();
    pin = {
      latitude: Number(point.lat.toFixed(7)),
      longitude: Number(point.lng.toFixed(7))
    };
    onChange({ ...pin });
  };

  /** Đặt hoặc kéo ghim; cập nhật tọa độ chính xác. */
  const setPin = (latitude, longitude, notify = true) => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new Error('Tọa độ ghim không hợp lệ.');
    }

    if (marker) {
      marker.setLatLng([lat, lng]);
    } else {
      marker = L.marker([lat, lng], {
        icon: flowerPinIcon,
        draggable: true,
        title: 'Kéo ghim để chỉnh vị trí cổng/nhà nhận hoa'
      }).addTo(map);
      marker.bindTooltip('Vị trí nhận hoa (Kéo để chỉnh)', { direction: 'top', offset: [0, -32] });
      marker.on('dragend', publishPin);
    }

    map.panTo([lat, lng]);
    pin = { latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)) };
    if (notify) onChange({ ...pin });
  };

  /** Xóa ghim */
  const clearPin = (notify = true) => {
    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }
    pin = null;
    if (notify) onChange(null);
  };

  /**
   * Tự động bay mượt mà đến trung tâm phường đã chọn và cắm ghim
   * Giải quyết triệt để vấn đề "bất tiện tìm vị trí": Khách chỉ cần chọn phường là bản đồ tự lướt tới ngay!
   */
  const flyToArea = (areaName, autoPin = true) => {
    const coords = getDeliveryAreaCoordinates(areaName);
    if (!coords) return false;
    map.flyTo([coords.lat, coords.lng], 16, { animate: true, duration: 1 });
    if (autoPin) {
      setPin(coords.lat, coords.lng, true);
    }
    return true;
  };

  /**
   * Định vị GPS 1 chạm lấy vị trí hiện tại của thiết bị
   * Giúp khách hàng đặt hoa về nhà không cần tìm kiếm hay kéo bản đồ
   */
  const locateUser = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const err = new Error('Trình duyệt của bạn không hỗ trợ định vị GPS.');
        onError(err.message);
        reject(err);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        position => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          map.flyTo([lat, lng], 17, { animate: true, duration: 1.2 });
          setPin(lat, lng, true);
          resolve({ latitude: lat, longitude: lng });
        },
        error => {
          let message = 'Không thể lấy vị trí hiện tại.';
          if (error.code === error.PERMISSION_DENIED) {
            message = 'Bạn chưa cho phép quyền vị trí. Vui lòng bật GPS trên trình duyệt.';
          } else if (error.code === error.TIMEOUT) {
            message = 'Quá thời gian lấy vị trí GPS. Vui lòng thử lại.';
          }
          onError(message);
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  // Nút điều khiển GPS 1 chạm nổi (Floating GPS Control) góc phải bản đồ
  const GpsControl = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function() {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-gps');
      const btn = L.DomUtil.create('a', 'leaflet-control-gps-btn', container);
      btn.href = '#';
      btn.title = 'Định vị GPS vị trí của tôi (1 chạm)';
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', 'Định vị GPS hiện tại');
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#108474" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <circle cx="12" cy="12" r="8"/>
          <line x1="12" y1="2" x2="12" y2="4"/>
          <line x1="12" y1="20" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="4" y2="12"/>
          <line x1="20" y1="12" x2="22" y2="12"/>
        </svg>
      `;
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(btn, 'click', async (e) => {
        L.DomEvent.preventDefault(e);
        btn.classList.add('loading');
        try {
          await locateUser();
        } catch (_) {
          // onError đã được gọi trong locateUser
        } finally {
          btn.classList.remove('loading');
        }
      });
      return container;
    }
  });
  new GpsControl().addTo(map);

  // Lắng nghe sự kiện click trên bản đồ
  map.on('click', event => {
    if (event.latlng) {
      setPin(event.latlng.lat, event.latlng.lng);
    }
  });

  // Khôi phục ghim ban đầu nếu có
  if (initialPin && Number.isFinite(Number(initialPin.latitude)) && Number.isFinite(Number(initialPin.longitude))) {
    setPin(initialPin.latitude, initialPin.longitude, false);
  }

  // Tự động căn chỉnh kích thước bản đồ khi modal mở
  requestAnimationFrame(() => {
    map.invalidateSize({ pan: false });
  });

  return {
    getPin: () => (pin ? { ...pin } : null),
    setPin,
    clearPin,
    flyToArea,
    locateUser,
    invalidateSize: () => map.invalidateSize({ pan: false }),
    remove: () => {
      map.remove();
      element.replaceChildren();
    }
  };
}
