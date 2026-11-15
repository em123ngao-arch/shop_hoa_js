let mapConfigPromise = null;

/** Nạp tọa độ tiệm từ server để không phải lặp cấu hình ở trình duyệt. */
async function getDeliveryMapConfig() {
  if (!mapConfigPromise) {
    mapConfigPromise = fetch('/api/delivery/map-config', { credentials: 'same-origin' })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !Number.isFinite(Number(data.origin?.latitude)) || !Number.isFinite(Number(data.origin?.longitude))) {
          throw new Error(data.error?.message || 'Không tải được vị trí cửa hàng cho bản đồ giao hàng.');
        }
        return data;
      })
      .catch(error => {
        mapConfigPromise = null;
        throw error;
      });
  }
  return mapConfigPromise;
}

/**
 * Tạo bản đồ ghim giao hàng. Khách bấm bản đồ hoặc kéo ghim để đặt điểm nhận.
 * @param {HTMLElement} element - Phần tử chứa Leaflet map.
 * @param {{initialPin?:{latitude:number,longitude:number}|null,onChange?:(pin:Object|null)=>void,onError?:(message:string)=>void}} options
 * @returns {Promise<{getPin:Function,setPin:Function,clearPin:Function,invalidateSize:Function,remove:Function}>}
 */
export async function createDeliveryPinMap(element, { initialPin = null, onChange = () => {}, onError = () => {} } = {}) {
  if (!element) throw new Error('Thiếu vùng hiển thị bản đồ giao hàng.');
  if (!window.L) throw new Error('Thư viện bản đồ chưa tải xong. Hãy tải lại trang.');

  const config = await getDeliveryMapConfig();
  const L = window.L;
  const origin = [Number(config.origin.latitude), Number(config.origin.longitude)];
  const map = L.map(element, { scrollWheelZoom: false }).setView(origin, 14);
  const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    minZoom: 5,
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
  }).addTo(map);

  tileLayer.on('tileerror', () => {
    onError('Nền bản đồ đang tải chậm hoặc không khả dụng. Vui lòng thử lại sau; ghim không thay thế địa chỉ chữ.');
  });

  L.circleMarker(origin, {
    radius: 8,
    color: '#ffffff',
    weight: 2,
    fillColor: '#108474',
    fillOpacity: 1
  }).addTo(map).bindTooltip(config.label || 'Tiệm hoa');

  let marker = null;
  let pin = null;

  const publishPin = () => {
    if (!marker) {
      pin = null;
      onChange(null);
      return;
    }
    const point = marker.getLatLng();
    pin = { latitude: Number(point.lat.toFixed(7)), longitude: Number(point.lng.toFixed(7)) };
    onChange({ ...pin });
  };

  const setPin = (latitude, longitude, notify = true) => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new Error('Tọa độ ghim không hợp lệ.');
    }
    if (marker) marker.setLatLng([lat, lng]);
    else {
      marker = L.marker([lat, lng], { draggable: true, title: 'Kéo để chỉnh vị trí nhận hàng' }).addTo(map);
      marker.bindTooltip('Vị trí nhận hoa', { direction: 'top' });
      marker.on('dragend', publishPin);
    }
    map.panTo([lat, lng]);
    if (notify) publishPin();
  };

  const clearPin = (notify = true) => {
    if (marker) map.removeLayer(marker);
    marker = null;
    pin = null;
    if (notify) onChange(null);
  };

  map.on('click', event => setPin(event.latlng.lat, event.latlng.lng));

  if (initialPin && Number.isFinite(Number(initialPin.latitude)) && Number.isFinite(Number(initialPin.longitude))) {
    setPin(initialPin.latitude, initialPin.longitude, false);
  }

  return {
    getPin: () => pin ? { ...pin } : null,
    setPin,
    clearPin,
    invalidateSize: () => map.invalidateSize({ pan: false }),
    remove: () => map.remove()
  };
}
