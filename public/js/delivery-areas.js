/**
 * Danh mục phường hiện hành để checkout lọc theo khu vực quen thuộc.
 * Tên quận cũ chỉ là nhãn tìm kiếm; đơn lưu tên phường hiện hành.
 * Phí là mức cố định theo phường, không phụ thuộc ghim hay tuyến đường.
 */
export const DELIVERY_AREA_GROUPS = Object.freeze([
  { label: 'Quận Tân Phú (tên cũ)', areas: Object.freeze([
    'Phường Tân Phú', 'Phường Tân Sơn Nhì', 'Phường Phú Thọ Hòa', 'Phường Phú Thạnh', 'Phường Tây Thạnh'
  ]) },
  { label: 'Quận Tân Bình (tên cũ)', areas: Object.freeze([
    'Phường Tân Bình', 'Phường Tân Sơn', 'Phường Tân Sơn Hòa', 'Phường Tân Sơn Nhất', 'Phường Tân Hòa', 'Phường Bảy Hiền'
  ]) },
  { label: 'Quận Bình Tân (tên cũ)', areas: Object.freeze([
    'Phường Bình Tân', 'Phường Bình Hưng Hòa', 'Phường Bình Trị Đông', 'Phường An Lạc', 'Phường Tân Tạo'
  ]) },
  { label: 'Quận Gò Vấp (tên cũ)', areas: Object.freeze([
    'Phường Gò Vấp', 'Phường Hạnh Thông', 'Phường An Nhơn', 'Phường An Hội Đông', 'Phường Thông Tây Hội', 'Phường An Hội Tây'
  ]) },
  { label: 'Quận Phú Nhuận (tên cũ)', areas: Object.freeze([
    'Phường Phú Nhuận', 'Phường Cầu Kiệu', 'Phường Đức Nhuận'
  ]) },
  { label: 'Quận Bình Thạnh (tên cũ)', areas: Object.freeze([
    'Phường Gia Định', 'Phường Bình Thạnh', 'Phường Bình Lợi Trung', 'Phường Thạnh Mỹ Tây', 'Phường Bình Quới'
  ]) },
  { label: 'Quận 1 (tên cũ)', areas: Object.freeze([
    'Phường Sài Gòn', 'Phường Tân Định', 'Phường Bến Thành', 'Phường Cầu Ông Lãnh'
  ]) },
  { label: 'Quận 3 (tên cũ)', areas: Object.freeze([
    'Phường Bàn Cờ', 'Phường Xuân Hòa', 'Phường Nhiêu Lộc'
  ]) },
  { label: 'Quận 4 (tên cũ)', areas: Object.freeze([
    'Phường Khánh Hội', 'Phường Vĩnh Hội', 'Phường Xóm Chiếu'
  ]) },
  { label: 'Quận 5 (tên cũ)', areas: Object.freeze([
    'Phường Chợ Quán', 'Phường An Đông'
  ]) },
  { label: 'Quận 6 (tên cũ)', areas: Object.freeze([
    'Phường Chợ Lớn', 'Phường Bình Tây', 'Phường Bình Tiên', 'Phường Bình Phú', 'Phường Phú Lâm'
  ]) },
  { label: 'Quận 7 (tên cũ)', areas: Object.freeze([
    'Phường Tân Thuận', 'Phường Phú Thuận', 'Phường Tân Mỹ', 'Phường Tân Hưng'
  ]) },
  { label: 'Quận 8 (tên cũ)', areas: Object.freeze([
    'Phường Chánh Hưng', 'Phường Phú Định', 'Phường Bình Đông'
  ]) },
  { label: 'Quận 10 (tên cũ)', areas: Object.freeze([
    'Phường Diên Hồng', 'Phường Vườn Lài', 'Phường Hòa Hưng'
  ]) },
  { label: 'Quận 11 (tên cũ)', areas: Object.freeze([
    'Phường Minh Phụng', 'Phường Bình Thới', 'Phường Hòa Bình', 'Phường Phú Thọ'
  ]) },
  { label: 'Quận 12 (tên cũ)', areas: Object.freeze([
    'Phường Đông Hưng Thuận', 'Phường Trung Mỹ Tây', 'Phường Tân Thới Hiệp', 'Phường Thới An', 'Phường An Phú Đông'
  ]) },
  { label: 'Quận 2 (tên cũ, TP Thủ Đức)', areas: Object.freeze([
    'Phường An Khánh', 'Phường Bình Trưng', 'Phường Cát Lái'
  ]) },
  { label: 'Quận 9 (tên cũ, TP Thủ Đức)', areas: Object.freeze([
    'Phường Phước Long', 'Phường Tăng Nhơn Phú', 'Phường Long Bình', 'Phường Long Phước', 'Phường Long Trường'
  ]) },
  { label: 'Quận Thủ Đức (tên cũ)', areas: Object.freeze([
    'Phường Thủ Đức', 'Phường Hiệp Bình', 'Phường Tam Bình', 'Phường Linh Xuân'
  ]) }
].map(group => Object.freeze(group)));

/** Danh sách phường phẳng dùng để kiểm tra dữ liệu đơn ở backend. */
export const DELIVERY_AREAS = Object.freeze(DELIVERY_AREA_GROUPS.flatMap(group => [...group.areas]));

const NEARBY_35K_AREAS = new Set([
  'Phường Tân Sơn Nhì', 'Phường Phú Thọ Hòa', 'Phường Phú Thạnh', 'Phường Tây Thạnh'
]);

/**
 * Bảng giá khởi điểm theo phường, là nguồn tra cứu chung cho frontend và backend.
 * 0₫ tại phường Tân Phú; 35.000₫ ở bốn phường lân cận; 50.000₫ ở các phường còn lại.
 */
export const DELIVERY_AREA_RATES = Object.freeze(Object.fromEntries(
  DELIVERY_AREAS.map(area => {
    if (area === 'Phường Tân Phú') return [area, Object.freeze({ zoneId: 'tan-phu-core', zoneName: 'Khu vực Tân Phú', fee: 0 })];
    if (NEARBY_35K_AREAS.has(area)) return [area, Object.freeze({ zoneId: 'nearby', zoneName: 'Khu vực lân cận', fee: 35000 })];
    return [area, Object.freeze({ zoneId: 'hcm-served', zoneName: 'Các phường TP.HCM đang phục vụ', fee: 50000 })];
  })
));

/** Tra mức phí cố định từ phường; trả null nếu phường chưa có trong danh sách phục vụ. */
export function getDeliveryAreaRate(area = '') {
  return DELIVERY_AREA_RATES[String(area || '').trim()] || null;
}

/**
 * Tọa độ trung tâm của các phường TP.HCM để bản đồ tự động bay (flyTo) đến ngay khu vực khách chọn.
 * Giúp khách không phải tự kéo bản đồ qua lại giữa các quận, UI/UX mượt mà tức thì.
 */
export const DELIVERY_AREA_COORDINATES = Object.freeze({
  // Tân Phú
  'Phường Tân Phú': { lat: 10.7744, lng: 106.6341 },
  'Phường Tân Sơn Nhì': { lat: 10.7938, lng: 106.6305 },
  'Phường Phú Thọ Hòa': { lat: 10.7812, lng: 106.6294 },
  'Phường Phú Thạnh': { lat: 10.7785, lng: 106.6258 },
  'Phường Tây Thạnh': { lat: 10.8123, lng: 106.6267 },

  // Tân Bình
  'Phường Tân Bình': { lat: 10.7950, lng: 106.6550 },
  'Phường Tân Sơn': { lat: 10.8150, lng: 106.6500 },
  'Phường Tân Sơn Hòa': { lat: 10.7980, lng: 106.6600 },
  'Phường Tân Sơn Nhất': { lat: 10.8050, lng: 106.6650 },
  'Phường Tân Hòa': { lat: 10.7890, lng: 106.6480 },
  'Phường Bảy Hiền': { lat: 10.7920, lng: 106.6520 },

  // Bình Tân
  'Phường Bình Tân': { lat: 10.7650, lng: 106.6050 },
  'Phường Bình Hưng Hòa': { lat: 10.7980, lng: 106.6020 },
  'Phường Bình Trị Đông': { lat: 10.7620, lng: 106.6080 },
  'Phường An Lạc': { lat: 10.7350, lng: 106.6120 },
  'Phường Tân Tạo': { lat: 10.7480, lng: 106.5820 },

  // Gò Vấp
  'Phường Gò Vấp': { lat: 10.8380, lng: 106.6670 },
  'Phường Hạnh Thông': { lat: 10.8320, lng: 106.6620 },
  'Phường An Nhơn': { lat: 10.8450, lng: 106.6820 },
  'Phường An Hội Đông': { lat: 10.8520, lng: 106.6710 },
  'Phường Thông Tây Hội': { lat: 10.8360, lng: 106.6580 },
  'Phường An Hội Tây': { lat: 10.8490, lng: 106.6590 },

  // Phú Nhuận
  'Phường Phú Nhuận': { lat: 10.7990, lng: 106.6800 },
  'Phường Cầu Kiệu': { lat: 10.7920, lng: 106.6840 },
  'Phường Đức Nhuận': { lat: 10.8030, lng: 106.6750 },

  // Bình Thạnh
  'Phường Gia Định': { lat: 10.8020, lng: 106.6950 },
  'Phường Bình Thạnh': { lat: 10.8080, lng: 106.7020 },
  'Phường Bình Lợi Trung': { lat: 10.8250, lng: 106.7050 },
  'Phường Thạnh Mỹ Tây': { lat: 10.8150, lng: 106.7120 },
  'Phường Bình Quới': { lat: 10.8290, lng: 106.7350 },

  // Quận 1
  'Phường Sài Gòn': { lat: 10.7760, lng: 106.7010 },
  'Phường Tân Định': { lat: 10.7910, lng: 106.6910 },
  'Phường Bến Thành': { lat: 10.7720, lng: 106.6980 },
  'Phường Cầu Ông Lãnh': { lat: 10.7630, lng: 106.6990 },

  // Quận 3
  'Phường Bàn Cờ': { lat: 10.7710, lng: 106.6820 },
  'Phường Xuân Hòa': { lat: 10.7820, lng: 106.6880 },
  'Phường Nhiêu Lộc': { lat: 10.7890, lng: 106.6790 },

  // Quận 4
  'Phường Khánh Hội': { lat: 10.7600, lng: 106.7050 },
  'Phường Vĩnh Hội': { lat: 10.7580, lng: 106.7110 },
  'Phường Xóm Chiếu': { lat: 10.7640, lng: 106.7120 },

  // Quận 5
  'Phường Chợ Quán': { lat: 10.7540, lng: 106.6750 },
  'Phường An Đông': { lat: 10.7560, lng: 106.6660 },

  // Quận 6
  'Phường Chợ Lớn': { lat: 10.7490, lng: 106.6550 },
  'Phường Bình Tây': { lat: 10.7480, lng: 106.6490 },
  'Phường Bình Tiên': { lat: 10.7460, lng: 106.6430 },
  'Phường Bình Phú': { lat: 10.7420, lng: 106.6340 },
  'Phường Phú Lâm': { lat: 10.7510, lng: 106.6310 },

  // Quận 7
  'Phường Tân Thuận': { lat: 10.7480, lng: 106.7350 },
  'Phường Phú Thuận': { lat: 10.7280, lng: 106.7420 },
  'Phường Tân Mỹ': { lat: 10.7320, lng: 106.7210 },
  'Phường Tân Hưng': { lat: 10.7450, lng: 106.7020 },

  // Quận 8
  'Phường Chánh Hưng': { lat: 10.7440, lng: 106.6780 },
  'Phường Phú Định': { lat: 10.7280, lng: 106.6480 },
  'Phường Bình Đông': { lat: 10.7390, lng: 106.6590 },

  // Quận 10
  'Phường Diên Hồng': { lat: 10.7710, lng: 106.6680 },
  'Phường Vườn Lài': { lat: 10.7660, lng: 106.6710 },
  'Phường Hòa Hưng': { lat: 10.7780, lng: 106.6720 },

  // Quận 11
  'Phường Minh Phụng': { lat: 10.7610, lng: 106.6480 },
  'Phường Bình Thới': { lat: 10.7670, lng: 106.6510 },
  'Phường Hòa Bình': { lat: 10.7720, lng: 106.6430 },
  'Phường Phú Thọ': { lat: 10.7650, lng: 106.6580 },

  // Quận 12
  'Phường Đông Hưng Thuận': { lat: 10.8450, lng: 106.6280 },
  'Phường Trung Mỹ Tây': { lat: 10.8580, lng: 106.6150 },
  'Phường Tân Thới Hiệp': { lat: 10.8650, lng: 106.6380 },
  'Phường Thới An': { lat: 10.8750, lng: 106.6520 },
  'Phường An Phú Đông': { lat: 10.8680, lng: 106.6850 },

  // TP Thủ Đức
  'Phường An Khánh': { lat: 10.7880, lng: 106.7320 },
  'Phường Bình Trưng': { lat: 10.7850, lng: 106.7620 },
  'Phường Cát Lái': { lat: 10.7650, lng: 106.7850 },
  'Phường Phước Long': { lat: 10.8250, lng: 106.7750 },
  'Phường Tăng Nhơn Phú': { lat: 10.8420, lng: 106.7850 },
  'Phường Long Bình': { lat: 10.8650, lng: 106.8420 },
  'Phường Long Phước': { lat: 10.8250, lng: 106.8550 },
  'Phường Long Trường': { lat: 10.8050, lng: 106.8250 },
  'Phường Thủ Đức': { lat: 10.8520, lng: 106.7580 },
  'Phường Hiệp Bình': { lat: 10.8450, lng: 106.7250 },
  'Phường Tam Bình': { lat: 10.8680, lng: 106.7380 },
  'Phường Linh Xuân': { lat: 10.8850, lng: 106.7780 }
});

export function getDeliveryAreaCoordinates(area = '') {
  return DELIVERY_AREA_COORDINATES[String(area || '').trim()] || null;
}
