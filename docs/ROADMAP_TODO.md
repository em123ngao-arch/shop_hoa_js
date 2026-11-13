# 📋 SHOPHOA ROADMAP & DAILY TODO LIST
> **Sổ tay theo dõi tiến độ dự án Tiệm Hoa Kẽm Nhung:** Cập nhật theo kiến trúc Hexagonal + Express + Prisma + MySQL 8.0.

---

## 🎯 1. VIỆC ƯU TIÊN SỐ 1 ĐANG THỰC HIỆN (4 TASK CỐT LÕI CHO ĐỒ ÁN)

- [ ] **Task 1: Chống ghi đè tồn kho (Race Condition & Full Overwrite)**
  - [ ] Khi cập nhật giá hoặc thông tin mẫu hoa, không gửi kèm trường `stock` cũ trong object `...p`.
  - [ ] Nút điều chỉnh kho `+/-` trên Admin chuyển sang cơ chế delta/nhập-xuất hoặc kiểm tra phiên bản thay vì gửi số tuyệt đối từ client.
  - [ ] Holiday Booster ("Kích hoạt lễ"): chuyển sang gọi endpoint cập nhật giá hàng loạt an toàn hoặc chỉ PUT `{ originalPrice, price }` thay vì clone toàn bộ object sản phẩm cũ.

- [ ] **Task 2: Công tắc "Ngừng kinh doanh" (`is_active`) thay cho Xóa cứng**
  - [ ] Thêm công tắc bật/tắt trạng thái kinh doanh (`is_active`) trên Form sửa mẫu hoa và trực tiếp trên bảng sản phẩm Admin.
  - [ ] Chặn nút Xóa cứng đối với các sản phẩm đã có đơn hàng (`order_items`) để tránh lỗi 500 vi phạm khóa ngoại MySQL.
  - [ ] Cập nhật bảng Admin để xem được cả sản phẩm đang kinh doanh và sản phẩm đã ngừng kinh doanh (có filter lọc).

- [ ] **Task 3: Sửa logic duyệt Hoàn tiền một phần (Partial Refund)**
  - [ ] Sửa `PrismaRefundRepository.js`: Phân biệt hoàn tiền toàn phần (`amount >= total_amount`) và hoàn một phần (`amount < total_amount`).
  - [ ] Hoàn một phần (VD: đền bù 50.000đ do hoa dập cành): chỉ đổi `payment_status = 'partially_refunded'`, **KHÔNG** chuyển trạng thái đơn sang `cancelled` và **KHÔNG** hoàn kho sản phẩm.
  - [ ] Chỉ hủy đơn và hoàn kho khi là hoàn tiền toàn phần do hủy đơn.

- [ ] **Task 4: Bổ sung ô nhập "Giá vốn sản phẩm" (`cost_price`)**
  - [ ] Thêm trường `Giá Vốn Sản Phẩm (₫)` vào Modal thêm/sửa sản phẩm trên `admin.html` và `admin.js`.
  - [ ] Bổ sung cột Giá vốn vào file mẫu Excel import.
  - [ ] Báo cáo lợi nhuận trong `business-rules.js` ưu tiên dùng `cost_price` thật của từng mẫu hoa, loại bỏ số liệu giả định 65%.

---

## 🚀 2. CÁC TÍNH NĂNG VÀ NỀN TẢNG ĐÃ HOÀN THÀNH TỐT (COMPLETED)

- [x] **Hạ tầng Clean / Hexagonal Architecture:** Express + Prisma ORM + MySQL 8.0, di chuyển toàn bộ giao diện tĩnh vào `public/`.
- [x] **Xác thực & Phân quyền 3 Role (RBAC):** `customer`, `staff`, `admin` với JWT RFC 7519, Bcrypt 10 rounds, Token Versioning thu hồi phiên, bảo vệ admin cuối cùng.
- [x] **State Machine Vòng Đời Đơn Hàng:** Chặt chẽ, khóa không duyệt/giao đơn SePay khi chưa nhận thanh toán ngân hàng.
- [x] **Giao dịch ACID Trừ Kho & Hoàn Kho:** Nguyên tử, chống bán âm khi nhiều khách mua cùng lúc; hoàn kho tự động khi hủy đơn `pending`.
- [x] **Universal Checkout & VietQR SePay:** Đặt hoa tách Người mua vs Người nhận, khung giờ giao, thiệp chúc mừng viết tay, phụ kiện hoa, auto-polling VietQR 3.5s.
- [x] **Hệ Thống Phân Cấp Voucher 3 Tầng:** Toàn shop, danh mục, mẫu hoa; chống gian lận F12 với tính toán phía server.
- [x] **Quy Trình Hoàn Tiền 2 Cấp (Maker-Checker):** Thu ngân staff lập phiếu `pending_approval`, chỉ admin duyệt `approved`/từ chối `rejected`.
- [x] **Hệ Thống Đánh Giá Có Xác Thực:** Huy hiệu `✓ Đã mua`, tải ảnh review, staff/admin phản hồi, ẩn/hiện review.

---

## 📅 3. LỘ TRÌNH MỞ RỘNG TIẾP THEO (BACKLOG NGÀNH HOA)

- [ ] **`FLOWER-01` Chọn Ngày Giao Hoa (Delivery Date):** Thêm trường ngày giao hẹn trước vào form checkout và schema đơn hàng; hỗ trợ đặt trước ngày lễ (14/2, 8/3, 20/10).
- [ ] **`FLOWER-02` Tùy Chọn Người Gửi Ẩn Danh:** Checkbox "Giao hoa bí mật" để không in tên người gửi lên thiệp/phiếu giao cho người nhận.
- [ ] **`FLOWER-03` Tách Phiếu Giao Quà Khỏi Hóa Đơn:** Phiếu shipper cầm trao tay người nhận ẩn hoàn toàn giá tiền sản phẩm.
- [ ] **`FLOWER-04` Đính Kèm Ảnh Hoa Thực Tế Trước Khi Giao:** Nhân viên cắm hoa tải ảnh hoa thành phẩm thật lên đơn hàng cho khách xem trước.
- [ ] **`FLOWER-05` Đồng Bộ Ma Trận Quyền API vs UI:** Rà soát lại `server.js` để giới hạn các API catalog/banner/voucher chỉ dành riêng cho Admin nếu UI đã ẩn khỏi Staff.
