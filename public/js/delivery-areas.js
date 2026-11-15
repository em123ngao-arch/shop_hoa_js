/**
 * Danh sách phường hiện hành trong phạm vi cửa hàng có thể nhận giao.
 * TP.HCM được chọn cố định ở checkout; khách chọn phường rồi nhập số nhà và tên đường.
 * Nhóm hiển thị mức phí cấu hình theo phường; backend vẫn là nguồn tính phí cuối cùng.
 */
export const DELIVERY_AREA_GROUPS = Object.freeze([
  {
    label: 'Tiệm và phường lân cận (Tân Phú: miễn phí; 4 phường còn lại: 35.000₫)',
    areas: Object.freeze([
      'Phường Tân Phú',
      'Phường Tân Sơn Nhì',
      'Phường Phú Thọ Hòa',
      'Phường Phú Thạnh',
      'Phường Tây Thạnh'
    ])
  },
  {
    label: 'Các phường khác tại TP.HCM — 50.000₫',
    areas: Object.freeze([
      'Phường Tân Bình',
      'Phường Tân Sơn',
      'Phường Tân Sơn Hòa',
      'Phường Tân Sơn Nhất',
      'Phường Tân Hòa',
      'Phường Bảy Hiền',
      'Phường Bình Tân',
      'Phường Bình Hưng Hòa',
      'Phường Bình Trị Đông',
      'Phường An Lạc',
      'Phường Tân Tạo',
      'Phường Gò Vấp',
      'Phường Hạnh Thông',
      'Phường An Nhơn',
      'Phường An Hội Đông',
      'Phường Thông Tây Hội',
      'Phường An Hội Tây',
      'Phường Phú Nhuận',
      'Phường Cầu Kiệu',
      'Phường Đức Nhuận',
      'Phường Gia Định',
      'Phường Bình Thạnh',
      'Phường Bình Lợi Trung',
      'Phường Thạnh Mỹ Tây',
      'Phường Bình Quới'
    ])
  },
  {
    label: 'Các phường còn lại tại TP.HCM — 50.000₫',
    areas: Object.freeze([
      'Phường Sài Gòn',
      'Phường Tân Định',
      'Phường Bến Thành',
      'Phường Cầu Ông Lãnh',
      'Phường Bàn Cờ',
      'Phường Xuân Hòa',
      'Phường Nhiêu Lộc',
      'Phường Khánh Hội',
      'Phường Vĩnh Hội',
      'Phường Xóm Chiếu',
      'Phường Chợ Quán',
      'Phường An Đông',
      'Phường Chợ Lớn',
      'Phường Bình Tây',
      'Phường Bình Tiên',
      'Phường Bình Phú',
      'Phường Phú Lâm',
      'Phường Tân Thuận',
      'Phường Phú Thuận',
      'Phường Tân Mỹ',
      'Phường Tân Hưng',
      'Phường Chánh Hưng',
      'Phường Phú Định',
      'Phường Bình Đông',
      'Phường Diên Hồng',
      'Phường Vườn Lài',
      'Phường Hòa Hưng',
      'Phường Minh Phụng',
      'Phường Bình Thới',
      'Phường Hòa Bình',
      'Phường Phú Thọ',
      'Phường Đông Hưng Thuận',
      'Phường Trung Mỹ Tây',
      'Phường Tân Thới Hiệp',
      'Phường Thới An',
      'Phường An Phú Đông',
      'Phường Thủ Đức',
      'Phường An Khánh',
      'Phường Bình Trưng',
      'Phường Phước Long',
      'Phường Cát Lái',
      'Phường Hiệp Bình',
      'Phường Tam Bình',
      'Phường Linh Xuân',
      'Phường Tăng Nhơn Phú',
      'Phường Long Bình',
      'Phường Long Phước',
      'Phường Long Trường'
    ])
  }
]);

/** Danh sách phẳng dùng cho các form đổi địa chỉ và đối chiếu phía máy chủ. */
export const DELIVERY_AREAS = Object.freeze(DELIVERY_AREA_GROUPS.flatMap(group => [...group.areas]));
