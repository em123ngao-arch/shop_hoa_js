# BỘ QUY TẮC PHÁT TRIỂN DỰ ÁN SHOP HOA (JAVASCRIPT THUẦN & ES6+)
> **Áp dụng bắt buộc cho toàn bộ AI Coding Assistants (Antigravity, Claude Code, Gemini, v.v.)**
> **Nguồn gốc:** Căn cứ theo tài liệu `ĐỀ TÀI CUỐI KHÓA MÔN JAVASCRIPT.pdf` và yêu cầu đề tài `shopHoa`.

---

## ⛔ 1. ĐIỀU KHOẢN VETO - CẤM TUYỆT ĐỐI (KHÔNG ĐƯỢC VI PHẠM)

1. **KHÔNG dùng bất kỳ Framework/Library JS nào:**
   - ❌ **CẤM:** React, Vue, Angular, Svelte, Alpine.js, Solid.js,...
   - ❌ **CẤM:** jQuery, Bootstrap JavaScript, Tailwind CSS (trừ khi CSS thuần), các thư viện UI JS.
   - ❌ **CẤM:** Các thư viện quản lý trạng thái hoặc CRUD có sẵn (Redux, Zustand, Pinia, Lodash, Axios trừ khi dev server có cấu hình riêng).
2. **KHÔNG dùng template hoàn chỉnh của người khác:**
   - Phải tự xây dựng giao diện và logic bằng HTML5, CSS3 và JS thuần.
3. **KHÔNG viết code phức tạp, khó hiểu ("Over-engineering"):**
   - Không dùng kỹ thuật khó hiểu (currying phức tạp, metaprogramming, regex ma thuật không comment).
   - Code phải tường minh, có chú thích tiếng Việt ở các hàm quan trọng để **sinh viên hiểu 100% mã nguồn và tự tin bảo vệ, giải thích, sửa code trực tiếp trước giảng viên**.
4. **KHÔNG tạo thành phần "chết":**
   - ❌ Không có link chết (`href="#"` không xử lý).
   - ❌ Không có nút bấm không có chức năng.
   - ❌ Không dùng `alert("OK")` sơ sài để thay thế validation hoặc thông báo thực tế.
   - ❌ Không để dữ liệu giả không tương tác được.

---

## 🎯 2. CÔNG NGHỆ BẮT BUỘC & CẤU TRÚC KỸ THUẬT

* **Ngôn ngữ & Nền tảng:**
  - **HTML5:** Cấu trúc ngữ nghĩa (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`).
  - **CSS3:** CSS thuần, Responsive (Flexbox, CSS Grid, Media Queries, CSS Variables).
  - **JavaScript:** JavaScript thuần (Vanilla JS) + **ES6+ bắt buộc**.
* **Môi trường chạy:**
  - Trình duyệt chuẩn (Chrome, Edge, Firefox).
  - Dev server: Vite (Vanilla JS) hoặc Live Server; dữ liệu mock qua `json-server` hoặc `localStorage`.

---

## 🗄️ 3. MÔ HÌNH DỮ LIỆU & QUẢN LÝ LƯU TRỮ (`localStorage`)

### 3.1. Đối tượng Sản phẩm (`Product` - Hoa)
```javascript
{
  id: 1, // hoặc "sp_1"
  name: "Bó Hoa Kẽm Nhung Tulip Pastel",
  price: 250000,          // Giá bán (VND)
  originalPrice: 300000,  // Giá gốc (để hiển thị giảm giá nếu có)
  category: "kem-nhung",  // Mã danh mục
  categoryName: "Hoa Kẽm Nhung",
  image: "images/tulip-pastel.jpg",
  description: "Hoa tulip handmade làm từ kẽm nhung cao cấp, bền đẹp theo thời gian...",
  quantity: 25,           // Số lượng tồn kho
  soldCount: 12,          // Số lượng đã bán (dùng thống kê)
  featured: true,         // Sản phẩm nổi bật trang chủ
  createdAt: "2026-10-01"
}
```

### 3.2. Đối tượng Đơn hàng (`Order`)
```javascript
{
  id: "DH_1728374829",
  customerName: "Nguyễn Thị Mai",
  phone: "0901234567",
  email: "mai.nguyen@gmail.com",
  address: "Số 12 đường Hoa Hồng, P.1, Q.1, TP.HCM",
  note: "Giao hoa trước 10h sáng",
  items: [
    { productId: 1, name: "Bó Hoa Kẽm Nhung Tulip Pastel", price: 250000, quantity: 2, image: "..." }
  ],
  totalAmount: 500000,
  status: "pending", // pending | confirmed | completed | cancelled
  createdAt: "2026-10-08T10:15:00.000Z"
}
```

### 3.3. Quy định bắt buộc về `localStorage` (Mục 11 Đề bài)
1. **Keys chuẩn:**
   - `SHOP_HOA_PRODUCTS`: Danh sách sản phẩm hoa.
   - `SHOP_HOA_CART`: Giỏ hàng hiện tại.
   - `SHOP_HOA_ORDERS`: Danh sách đơn hàng đã đặt.
   - `SHOP_HOA_CATEGORIES`: Danh mục hoa.
2. **Khởi tạo dữ liệu mẫu (Seed Data):**
   - Nếu `localStorage` chưa có `SHOP_HOA_PRODUCTS`, hệ thống phải **tự động nạp tối thiểu 15–20 sản phẩm hoa mẫu** đa dạng danh mục (Hoa bó, Hoa giỏ, Hoa kẽm nhung, Hoa cưới, Hoa để bàn) kèm ảnh, giá và mô tả thực tế.
3. **Đồng bộ liên tục:** Mọi hành vi Thêm, Sửa, Xóa (CRUD), Thêm vào giỏ, Thay đổi số lượng giỏ hàng, Tạo đơn hàng phải được ghi đè/cập nhật ngay vào `localStorage`. Dữ liệu phải tồn tại nguyên vẹn sau khi F5/reload hoặc đóng mở lại tab.

---

## 📂 4. TỔ CHỨC CẤU TRÚC THƯ MỤC CHUẨN (MODULAR ES6)

Cấu trúc file chia rõ ràng theo từng module nghiệp vụ, không gộp tất cả vào 1 file JS duy nhất:

```text
d:/shopHoa/
├── index.html              # Trang chủ: Banner, danh mục, sản phẩm nổi bật, sản phẩm mới (ít nhất 15 SP)
├── products.html           # Trang danh sách: Tìm kiếm, lọc theo danh mục/giá, sắp xếp, hiển thị lưới hoa
├── detail.html             # Trang chi tiết: Đọc param ?id=..., hiển thị chi tiết, chọn số lượng, thêm giỏ
├── cart.html               # Trang giỏ hàng: Bảng giỏ hàng, tăng/giảm SL, xóa món, tổng tiền, form đặt hàng
├── admin.html              # Trang quản trị: Dashboard thống kê + Bảng CRUD hoa + Quản lý đơn hàng
├── css/
│   ├── reset.css           # Reset CSS cơ bản
│   ├── style.css           # Palette màu pastel, typography, header, footer, toast, buttons, card hoa
│   ├── responsive.css      # CSS Media queries cho Desktop, Tablet, Mobile
│   └── admin.css           # Giao diện trang quản trị, form modal CRUD, bảng thống kê
├── js/
│   ├── storage.js          # Module quản lý đọc/ghi localStorage, khởi tạo Seed Data 15+ hoa
│   ├── utils.js            # Format tiền tệ VND, toast thông báo, modal confirm, hàm hỗ trợ
│   ├── validation.js       # Module validate form: rỗng, regex email, regex sđt Việt Nam, giá/SL dương
│   ├── main.js             # Logic xử lý cho index.html
│   ├── products.js         # Logic xử lý cho products.html (Tìm kiếm, Lọc, Sắp xếp)
│   ├── detail.js           # Logic xử lý cho detail.html (URLSearchParams, hiển thị chi tiết)
│   ├── cart.js             # Logic xử lý cho cart.html (Thao tác giỏ hàng, tính tổng tiền, đặt hàng)
│   └── admin.js            # Logic xử lý cho admin.html (CRUD hoa, thống kê với reduce)
└── images/                 # Ảnh hoa thực tế theo danh mục
```

---

## ⚡ 5. BẮT BUỘC SỬ DỤNG CÁC TÍNH NĂNG ES6+ VÀ ARRAY METHODS

Để đạt điểm tối đa (100/100) theo barem của giảng viên, code JS phải thể hiện rõ:

### 5.1. Cú pháp ES6+
- `const` và `let` (Tuyệt đối không dùng `var`).
- `Arrow Function` (`() => {}`).
- `Template Literals` (`` `${...}` ``) khi render thẻ HTML động.
- `Destructuring` (`const { id, name, price } = product;`).
- `Spread Operator` (`[...items]`, `{ ...product }`).
- `Default Parameter` (`function formatCurrency(amount = 0) { ... }`).
- `ES6 Modules` (`export` / `import`).

### 5.2. Các Array Methods bắt buộc áp dụng đúng ngữ cảnh
1. **`map()`**: Dùng khi chuyển đổi danh sách dữ liệu sang chuỗi HTML để gán vào `innerHTML`.
2. **`filter()`**: Dùng khi tìm kiếm theo tên, lọc hoa theo danh mục, lọc theo khoảng giá, hoặc lọc đơn hàng theo trạng thái.
3. **`find()`**: Dùng khi tìm 1 sản phẩm theo `id` (trang chi tiết, thêm giỏ hàng).
4. **`findIndex()`**: Dùng khi cần xác định vị trí của sản phẩm trong giỏ hàng để cập nhật số lượng hoặc xóa món.
5. **`reduce()`**: Dùng khi tính tổng tiền giỏ hàng, tổng doanh thu đơn hàng, tổng số lượng sản phẩm bán chạy trong Dashboard Admin.
6. **`sort()`**: Dùng khi sắp xếp hoa (giá tăng dần, giá giảm dần, tên A→Z, tên Z→A, mới nhất). *Lưu ý: Luôn clone mảng trước khi sort: `[...list].sort(...)`*.
7. **`some()` / `every()`**: Dùng khi kiểm tra điều kiện validation (vd: kiểm tra form có trường nào rỗng, kiểm tra giỏ hàng có sản phẩm hết hàng không).
8. **`forEach()`**: Dùng khi duyệt mảng để gán sự kiện cho các nút bấm (`document.querySelectorAll(...)`).

---

## 🖥️ 6. THAO TÁC DOM & EVENT BẮT BUỘC

1. **Thao tác DOM:**
   - Dùng `document.querySelector` và `document.querySelectorAll`.
   - Tạo nội dung động, cập nhật class qua `classList.add()`, `classList.remove()`, `classList.toggle()`.
   - Hiển thị/ẩn modal, form, spinner.
   - Không được hardcode dữ liệu cố định trong file HTML; toàn bộ danh sách phải render bằng JS.
2. **Xử lý sự kiện (Event Handling):**
   - `click`: Chọn danh mục, thêm giỏ hàng, xóa, xem chi tiết, đổi tab.
   - `submit`: Bắt sự kiện form với `e.preventDefault()`.
   - `input` / `change`: Tìm kiếm thời gian thực (realtime search), lọc giá, đổi số lượng.
   - **Kỹ thuật Event Delegation:** Gán sự kiện lên container cha cho các element được render động (như các nút bấm trong bảng giỏ hàng hoặc danh sách hoa) để tránh mất sự kiện khi re-render.

---

## 📋 7. FORM & VALIDATION CHẶN LỖI (MỤC 10 ĐỀ BÀI)

1. **Các trường phải validate:**
   - Họ tên: Không rỗng, tối thiểu 2 ký tự.
   - Email: Định dạng chuẩn RFC (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`).
   - Số điện thoại: Chuẩn SĐT Việt Nam 10 chữ số (`/^(0[3|5|7|8|9])[0-9]{8}$/`).
   - Địa chỉ giao hàng: Không rỗng.
   - Giá sản phẩm / Số lượng: Phải là số dương (> 0).
2. **Quy tắc hiển thị lỗi:**
   - Hiển thị thông báo lỗi bằng chữ đỏ nhỏ ngay dưới input bị lỗi (inline error).
   - Đổi border của input sang màu đỏ (`border-color: #e74c3c`).
   - Xóa thông báo lỗi ngay khi người dùng bắt đầu nhập lại (`input` event).

---

## 📊 8. TRANG ADMIN & DASHBOARD THỐNG KÊ (MỤC 13 ĐỀ BÀI)

Trang `admin.html` bắt buộc phải có:
1. **Thống kê tổng quan (Cards):**
   - **Tổng số lượng sản phẩm:** Tính từ mảng `products.length`.
   - **Tổng đơn hàng:** Tính từ mảng `orders.length`.
   - **Tổng doanh thu:** Tính bằng `orders.reduce((sum, order) => sum + order.totalAmount, 0)`.
   - **Sản phẩm bán chạy nhất:** Tìm sản phẩm có `soldCount` cao nhất bằng JS.
2. **Quản lý CRUD Sản Phẩm:**
   - **Thêm sản phẩm mới:** Form modal nhập tên, giá, danh mục, ảnh, mô tả, số lượng.
   - **Xem danh sách sản phẩm:** Bảng hiển thị thông tin, ảnh thumbnail, giá, danh mục.
   - **Sửa sản phẩm:** Bấm nút "Sửa" nạp dữ liệu vào form, lưu lại cập nhật `localStorage`.
   - **Xóa sản phẩm:** Bắt buộc có popup xác nhận ("Bạn có chắc chắn muốn xóa hoa này không?").
3. **Quản lý Đơn Hàng:**
   - Xem danh sách đơn đặt từ khách hàng, xem chi tiết các món trong đơn, cập nhật trạng thái đơn (Chờ xử lý → Đã xác nhận → Đã giao).

---

## ✨ 9. TÍNH HOÀN CHỈNH & TRẢI NGHIỆM NGƯỜI DÙNG (MỤC 17 ĐỀ BÀI)

1. **Toast Notification:**
   - Có popup thông báo góc phải màn hình khi thực hiện thành công (vd: "Đã thêm vào giỏ hàng thành công!", "Đặt hàng thành công!", "Đã cập nhật sản phẩm!").
2. **Hộp thoại xác nhận (Confirm Dialog/Modal):**
   - Áp dụng trước khi xóa sản phẩm hoặc xóa sạch giỏ hàng.
3. **Xử lý trạng thái rỗng (Empty State):**
   - Tìm kiếm không ra kết quả: Hiển thị minh họa "Không tìm thấy sản phẩm hoa phù hợp với từ khóa".
   - Giỏ hàng rỗng: Hiển thị icon giỏ hàng trống + dòng chữ "Giỏ hàng của bạn đang trống" + nút "Mua sắm ngay".
4. **Không có lỗi Console:**
   - Mọi trang khi mở F12 Console không được có bất kỳ lỗi đỏ nào (`Uncaught TypeError`, `404 Not Found`,...).

---

## 🛡️ 10. QUY TRÌNH LÀM VIỆC CỦA AI (AI WORKFLOW DISCIPLINE)

Mỗi khi AI thực hiện một yêu cầu lập trình:
1. **Kiểm tra ranh giới (Boundary Check):** Đảm bảo giải pháp KHÔNG dùng React, Vue, jQuery hay thư viện bên ngoài.
2. **Sử dụng đúng ES6+:** Sử dụng đúng `map`, `filter`, `find`, `reduce`, `Template Literals`, `Arrow Function`.
3. **Viết mã đầy đủ (No Lazy Code):** Không viết tắt, không bỏ lửng kiểu `// tự viết tiếp...`.
4. **Bình luận tiếng Việt (Explanatory Comments):** Viết chú thích rõ ràng ở các hàm nghiệp vụ chính để sinh viên đọc hiểu và trả lời câu hỏi vấn đáp của giảng viên:
   - *Ví dụ: "Hàm tính tổng doanh thu sử dụng phương thức reduce() của mảng orders..."*
5. **Hướng dẫn bảo vệ đồ án:** Sau khi hoàn thành chức năng, AI tóm tắt ngắn:
   - File nào đã thay đổi.
   - Cơ chế hoạt động chính.
   - Câu hỏi giảng viên có thể hỏi và câu trả lời gợi ý.
