# 📋 SHOPHOA ROADMAP & DAILY TODO LIST
> **Sổ tay theo dõi tiến độ dự án Tiệm Hoa Kẽm Nhung:** Bất kỳ AI hoặc lập trình viên nào khi bắt đầu phiên làm việc mới đều phải mở file này để biết công việc đang ở đâu.

---

## 🎯 1. VIỆC HÔM NAY ĐANG LÀM (IN PROGRESS - TODAY)

### Task: Hoàn Thiện Luồng Đăng Nhập & Đồng Bộ Trạng Thái Người Dùng
- [ ] **Bước 1: Hoàn thành code [js/login.js](file:///d:/shopHoa/souce_shopHoa/js/login.js)**
  - [ ] Sửa sự kiện `submit`: gọi hàm `login()` sau khi `event.preventDefault()`.
  - [ ] Lấy `.value.trim()` của `#email` và `.value` của `#password`.
  - [ ] Kiểm tra rỗng: `if (!email || !password)`.
  - [ ] Gọi API kiểm tra: `await api.get('/users', { params: { email, password } })`.
  - [ ] Kiểm tra kết quả: nếu `users.length === 0` thì báo lỗi.
  - [ ] Lưu phiên đăng nhập: `localStorage.setItem('user', JSON.stringify(user))`.
  - [ ] Thông báo thành công và chuyển hướng về `index.html`.
- [ ] **Bước 2: Kiểm thử thực tế trên trình duyệt**
  - [ ] Bật `npm run server` (json-server cổng 3000) và `npm run dev` (Vite cổng 5173).
  - [ ] Đăng nhập với tài khoản vừa tạo (Ví dụ: `lethuvan198181@gmail.com` / `123456`).
  - [ ] Kiểm tra tab `Network` (thấy request `/users` màu xanh 200 OK).
  - [ ] Kiểm tra tab `Application` $\rightarrow$ `Local storage` (thấy key `user`).
- [ ] **Bước 3: Hiển thị tên người dùng lên Header trang chủ ([js/main.js](file:///d:/shopHoa/souce_shopHoa/js/main.js))**
  - [ ] Đọc `localStorage.getItem('user')`.
  - [ ] Nếu đã đăng nhập: Ẩn nút "Đăng nhập / Đăng ký", thay bằng `Xin chào, [Tên]` kèm nút "Đăng xuất".
  - [ ] Khi bấm "Đăng xuất": Xóa key `user` trong `localStorage` và tải lại trang.

---

## 🚀 2. CÁC TÍNH NĂNG ĐÃ HOÀN THÀNH (COMPLETED)

- [x] **Hạ tầng dự án:** Git Flow 3 nhánh (`main`, `staging`, `develop`), cấu hình `.gitignore`, chuẩn ES6 Modules + Axios importmap.
- [x] **Backend Mock API:** `json-server` cổng 3000 kết hợp `db.json` đầy đủ 7 bảng dữ liệu.
- [x] **`SHOP-05` Banners Đa Chủ Đề:** Slider trượt 2s mượt mà, loại bỏ thanh cam kết theo yêu cầu, 4 màu nền rực rỡ riêng biệt (Tết 2027 đỏ vàng, Mặc định xanh ngọc, Flash Sale cam cháy, Valentine hồng phấn).
- [x] **`SHOP-06` Sản Phẩm Mới & Bán Chạy:** 2 section độc lập, sắp xếp `soldCount` và `id`, layout không viền chuẩn Flower Chimp.
- [x] **`SHOP-07` Flash Deals & Side Cart Drawer:** Đếm ngược giờ vàng, thẻ voucher răng cưa, giỏ hàng trượt Side Drawer realtime, popup sinh nhật.
- [x] **`SHOP-08` Admin Dashboard:** [admin.html](file:///d:/shopHoa/souce_shopHoa/admin.html) quản trị 5 tab (KPI doanh thu, Sản phẩm, Banners, Vouchers, Đơn hàng) + 1-Click Holiday Booster.
- [x] **`SHOP-09` AI Florist ChatBot:** Trợ lý "Em Ly" chế độ kép Gemini Flash API + Local RAG gợi ý mẫu hoa trực quan.
- [x] **Xác thực Đăng ký:** [register.html](file:///d:/shopHoa/souce_shopHoa/register.html) & [js/register.js](file:///d:/shopHoa/souce_shopHoa/js/register.js) kiểm tra form, chống trùng email và lưu vào `db.json`.

---

## 📅 3. LỘ TRÌNH TIẾP THEO (NEXT BACKLOG)

- [ ] **`SHOP-10` Phân quyền Admin / Customer:**
  - [ ] Kiểm tra tài khoản đăng nhập: Nếu là Admin (hoặc email quản trị) thì mới cho vào trang `admin.html`.
  - [ ] Người dùng thông thường vào `admin.html` sẽ bị đá về `index.html` hoặc trang đăng nhập.
- [ ] **`SHOP-11` Đặt Hàng & Lưu Lịch Sử Đơn Hàng:**
  - [ ] Khách hàng đăng nhập khi thanh toán sẽ gắn `userId` vào đơn hàng trong bảng `orders`.
  - [ ] Trang xem lịch sử đơn hàng cá nhân của khách hàng.
- [ ] **Chuẩn bị bảo vệ đồ án:**
  - [ ] Tổng hợp bộ câu hỏi vấn đáp lý thuyết hay gặp (Event Loop, Promise/async-await, LocalStorage vs Cookie, DOM traversal).
  - [ ] Rà soát toàn bộ code theo Rubric 100/100 điểm.
