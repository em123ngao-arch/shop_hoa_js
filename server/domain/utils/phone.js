/**
 * phone.js - Tien ich chuan hoa so dien thoai Viet Nam dung chung cho Domain & Adapters
 * Pure JavaScript, 0 dependencies
 */

/**
 * Chuan hoa SĐT Viet Nam ve dinh dang bat dau bang '0' (ho tro +84, 84, khoang trang, dau gach)
 * @param {string} raw
 * @returns {string}
 */
export function normalizeVnPhone(raw) {
  let phone = String(raw || '').replace(/[\s().-]/g, '');
  if (!phone) return '';
  if (phone.startsWith('+84')) {
    phone = '0' + phone.slice(3);
  } else if (phone.startsWith('84') && (phone.length === 10 || phone.length === 11)) {
    phone = '0' + phone.slice(2);
  }
  if (!phone.startsWith('0') && (phone.length === 9 || phone.length === 10)) {
    phone = '0' + phone;
  }
  return phone;
}

