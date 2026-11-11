# 🗺️ LỘ TRÌNH 10 BUỔI HỌC LÀM CHỦ TOÀN BỘ CODEBASE DỰ ÁN SHOPHOA
> **Mục tiêu:** Giúp học viên nắm chắc 100% bản chất từng dòng code, tự tin sửa code và đạt 100/100 điểm khi vấn đáp bảo vệ đồ án trước giảng viên.

---

## 📊 BẢNG THEO DÕI TIẾN ĐỘ HỌC TẬP

| Buổi | Tên Bài Học & Chủ Đề Trọng Tâm | Files Mã Nguồn Liên Quan | Trạng Thái |
| :---: | :--- | :--- | :---: |
| **Buổi 0** | **Bóc trần nền tảng dự án:** Terminal, json-server, REST API, Axios importmap, LocalStorage vs DB | [`package.json`](file:///d:/shopHoa/souce_shopHoa/package.json), [`server.js`](file:///d:/shopHoa/souce_shopHoa/server.js), [`js/api.js`](file:///d:/shopHoa/souce_shopHoa/js/api.js), [`db.json`](file:///d:/shopHoa/souce_shopHoa/db.json) | ✅ **HOÀN THÀNH** |
| **Buổi 1** | **Trang chủ & Đổ dữ liệu hoa:** Slider Banners tự động, ES6 `.map()`, Template Literals, DOM rendering | [`index.html`](file:///d:/shopHoa/souce_shopHoa/index.html), [`js/main.js`](file:///d:/shopHoa/souce_shopHoa/js/main.js), [`js/utils.js`](file:///d:/shopHoa/souce_shopHoa/js/utils.js) | ⏳ **ĐANG HỌC** |
| **Buổi 2** | **Bộ lọc & Sắp xếp:** `.filter()` danh mục, tìm kiếm realtime `input`, `.sort()` immutability với Spread | [`js/main.js`](file:///d:/shopHoa/souce_shopHoa/js/main.js) | ⚪ Chưa học |
| **Buổi 3** | **Trang Chi Tiết Sản Phẩm:** URL Query params `?id=`, `URLSearchParams`, xử lý NotFound, bộ đếm số lượng | [`detail.html`](file:///d:/shopHoa/souce_shopHoa/detail.html), [`js/detail.js`](file:///d:/shopHoa/souce_shopHoa/js/detail.js) | ⚪ Chưa học |
| **Buổi 4** | **Universal Cart Drawer:** Thêm/sửa/xóa giỏ, đồng bộ `localStorage`, tính tổng tiền bằng `.reduce()`, Voucher | [`js/cart-drawer.js`](file:///d:/shopHoa/souce_shopHoa/js/cart-drawer.js), [`js/storage.js`](file:///d:/shopHoa/souce_shopHoa/js/storage.js) | ⚪ Chưa học |
| **Buổi 5** | **Đặt Hàng & SePay VietQR:** POST đơn hàng, URL sinh mã QR VietQR, tra cứu đơn [`orders.html`](file:///d:/shopHoa/souce_shopHoa/orders.html), Stepper tiến trình | [`orders.html`](file:///d:/shopHoa/souce_shopHoa/orders.html), [`js/orders.js`](file:///d:/shopHoa/souce_shopHoa/js/orders.js) | ⚪ Chưa học |
| **Buổi 6** | **Admin Dashboard & KPI:** Chuyển tab Single Page, tính tổng doanh thu/đơn hàng bằng `.reduce()`, lọc ngày Date | [`admin.html`](file:///d:/shopHoa/souce_shopHoa/admin.html), [`js/admin.js`](file:///d:/shopHoa/souce_shopHoa/js/admin.js) | ⚪ Chưa học |
| **Buổi 7** | **Nghiệp Vụ CRUD Sản Phẩm:** POST, PUT/PATCH, DELETE, xử lý upload ảnh thành chuỗi Base64 `FileReader` | [`admin.html`](file:///d:/shopHoa/souce_shopHoa/admin.html), [`js/admin.js`](file:///d:/shopHoa/souce_shopHoa/js/admin.js) | ⚪ Chưa học |
| **Buổi 8** | **Thuật Toán Phân Trang & Duyệt Đơn:** Công thức `.slice(start, end)`, `Math.ceil()`, chuyển trạng thái đơn hàng | [`js/admin.js`](file:///d:/shopHoa/souce_shopHoa/js/admin.js) | ⚪ Chưa học |
| **Buổi 9** | **Xử Lý File & AI Chatbot:** Đọc Excel với SheetJS (`XLSX`), xuất PDF hóa đơn, trợ lý "Em Ly" Gemini + Local RAG | [`js/excel-pdf.js`](file:///d:/shopHoa/souce_shopHoa/js/excel-pdf.js), [`js/chatbot.js`](file:///d:/shopHoa/souce_shopHoa/js/chatbot.js) | ⚪ Chưa học |
| **Buổi 10** | **Mock Defense Tổng Duyệt 100/100:** Giả lập hội đồng chấm thi, soi code ngẫu nhiên và thử thách sửa code trực tiếp | Toàn bộ dự án | ⚪ Chưa học |

---

## 🎯 CẤU TRÚC 4 BƯỚC CHO MỖI BUỔI HỌC
1. **Bước 1: Bản đồ luồng dữ liệu (Data Flow):** Dữ liệu đi từ đâu, qua file nào, ra thẻ HTML nào.
2. **Bước 2: Mổ xẻ từng dòng code then chốt:** Giải thích cặn kẽ bản chất và lý do chọn cú pháp.
3. **Bước 3: Thử thách phản xạ (Live Challenge):** Tự trả lời hoặc sửa 1 đoạn code thực chiến.
4. **Bước 4: Bộ câu hỏi & Văn mẫu vấn đáp giáo viên:** Tuyệt chiêu trả lời tự tin, chuẩn Rubric.

