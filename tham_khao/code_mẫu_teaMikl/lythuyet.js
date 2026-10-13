/**
 * Localstorage trong javascript:
 * - localStorage.setItem(key, value): Lưu trữ dữ liệu vào localStorage.
 * - localStorage.getItem(key): Lấy dữ liệu từ localStorage.
 * - localStorage.removeItem(key): Xóa dữ liệu khỏi localStorage.
 * - localStorage.clear(): Xóa tất cả dữ liệu trong localStorage.
 * Localstorage là gì?
 * là một web API của trình duyệt cho phép javascript lưu trữ dữ liệu dạng key-value trên trình duyệt.
 * Đặc điểm:
 * Dữ liệu được lưu trữ dưới dạng key-value.
 * values luôn ở dạng String
 * ĐÓng trình duyệt không xóa dữ liệu.
 * Dữ liệu chỉ tồn tại trên trình duyệt tương ứng với nguồn (origin) của nó.
 * Không nên lưu mật khẩu hoặc thông tin nhạy cảm.
 * Dữ liệu được lưu trữ trên trình duyệt và tồn tại ngay cả khi đóng trình duyệt.
 * Dung lượng lưu trữ lớn hơn cookie (khoảng 5MB).
 * Chỉ có thể truy cập từ cùng một nguồn (same-origin).
 * Có thể sử dụng JSON để lưu trữ các đối tượng phức tạp.
 * JSON.stringify() để chuyển đối tượng thành chuỗi trước khi lưu.
 * JSON.parse() để chuyển chuỗi thành đối tượng khi lấy dữ liệu.
 * cú phap:
 * localStorage.setItem(key,JSON.stringify(value))
 * localStorage.getItem(key) => JSON.parse(localStorage.getItem(key))
 */