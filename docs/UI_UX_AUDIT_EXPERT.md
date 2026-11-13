# BÁO CÁO KIỂM TOÁN TOÀN DIỆN & KẾ HOẠCH NÂNG CẤP UI/UX CHUYÊN SÂU
**Dự án:** Tiệm Hoa Kẽm Nhung Handmade (`shopHoa`)  
**Tiêu chuẩn thiết kế:** Chuẩn thương mại điện tử cao cấp Flower Chimp & Potico  
**Tài liệu dành cho:** Phản biện đồ án, đánh giá chéo giữa các AI và nghiệm thu kỹ thuật  

---

## 1. TỔNG QUAN HIỆN TRẠNG & PHÂN TÍCH 2 LỖI TRỌNG YẾU TỪ ẢNH CHỤP

Sau khi quét toàn bộ mã nguồn HTML, CSS và JavaScript trên các trang (`index.html`, `detail.html`, `orders.html`, `admin.html`) và đo đạc thực tế bằng Playwright Browser Engine, hệ thống xác nhận **hai lỗi trực quan nghiêm trọng mà bạn đã chụp ảnh** cùng **hàng loạt bất cập UI/UX tiềm ẩn** đang ảnh hưởng trực tiếp đến trải nghiệm mua hàng và tỷ lệ chuyển đổi.

```
+---------------------------------------------------------------------------------------------------+
| SƠ ĐỒ ĐỐI CHIẾU LỖI TRỰC QUAN TỪ ẢNH CHỤP                                                        |
+---------------------------------------------------------------------------------------------------+
| ẢNH 1: HEADER BỊ BÓP NGHẸT                                                                         |
| [Tiệm Hoa]  [Tìm kiế Q]  (Xin chào, Quản Trị Viên) [Quản Trị] [Đơn Hàng] [Quản Trị] [Đăng xuất] [Giỏ] |
|                ▲ 105px!            ▲ Dàn ngang 5 nút bấm 4 màu chọi nhau = Rộng 759px!             |
+---------------------------------------------------------------------------------------------------+
| ẢNH 2: GẠCH GIÁ ẢO TRÙNG LẶP                                                                      |
|  ~~400.000 đ~~ 400.000 đ      ~~320.000 đ~~ 320.000 đ      ~~520.000 đ~~ 520.000 đ               |
|         ▲                               ▲                               ▲                         |
|  Lỗi logic: Giá gốc = Giá bán nhưng vẫn gạch ngang, tạo cảm giác gian lận giá hoặc website bị lỗi!|
+---------------------------------------------------------------------------------------------------+
```

---

## 2. BẢNG TỔNG HỢP KIỂM TOÁN TẤT CẢ CÁC ĐIỂM YẾU UI/UX

| Mã lỗi | Vị trí / Tệp tin | Mô tả hiện trạng & Bất cập | Đo đạc thực tế / Hậu quả | Mức độ |
| :--- | :--- | :--- | :--- | :---: |
| **UX-01** | `js/utils.js`<br>`css/style.css` | **Header chật chội & bóp nghẹt ô tìm kiếm (Ảnh 1):** Khi đăng nhập, vùng `#headerAuthArea` render 5 nút ngang (Tên, Huy hiệu, Nút Đơn Hàng, Nút Quản Trị, Nút Đăng xuất). `.search-box` không có `min-width` nên bị co rút. | Chiều rộng search box chỉ còn **105px**, placeholder bị cắt thành `"Tìm kiế Q"`. Cụm nút chiếm **759px**. | 🔴 **Nghiêm trọng** |
| **UX-02** | `js/main.js`<br>`js/detail.js` | **Lỗi gạch ngang giá bán ảo trùng lặp (Ảnh 2):** Khi `originalPrice === price` (không giảm giá), code chỉ kiểm tra truthy `product.originalPrice ?` nên vẫn render `<span class="was-price">`. | Mọi thẻ sản phẩm đều hiển thị `~~400.000 đ~~ 400.000 đ`. Khách hàng hoài nghi về tính trung thực của cửa hàng. | 🔴 **Nghiêm trọng** |
| **UX-03** | `css/responsive.css`<br>`js/utils.js` | **Tràn viền màn hình Mobile khi đăng nhập:** Cụm `.user-logged-box` rộng 460px không có CSS thu gọn trên màn hình nhỏ, làm toàn bộ giao diện Mobile bị bung ngang. | `scrollWidth` = **598px** trên viewport Mobile **375px** (tràn ngang **223px**). Xuất hiện thanh cuộn ngang xấu xí. | 🔴 **Nghiêm trọng** |
| **UX-04** | `css/orders.css`<br>`orders.html` | **Trang Đơn Hàng bung viền tới 791px trên Mobile:** Thanh tiến trình nghệ nhân `.floral-stepper-track` (4 bước x 90px) cùng lề thẻ vượt quá khung hình điện thoại; thiếu media query. | `scrollWidth` = **791px** trên viewport Mobile **375px** (tràn ngang **416px**). | 🔴 **Nghiêm trọng** |
| **UX-05** | `css/responsive.css`<br>`css/chatbot.css` | **Xung đột nút Chatbot và Thanh Mua Hàng Sticky:** Trong `responsive.css` dùng sai selector (`.chatbot-toggler` / `#chatbotToggleBtn`) thay vì `.chat-launcher-btn`. | Nút chatbot nổi không được đẩy lên, đè trực tiếp lên nút "Mua Ngay" của `#stickyBuyBar` trên Mobile. | 🟠 **Khá cao** |
| **UX-06** | `detail.html`<br>`js/detail.js` | **Bất đồng bộ Header trên trang chi tiết:** Header trang chi tiết chỉ có nút "Quay lại" và Giỏ hàng, thiếu hoàn toàn ô Tìm kiếm và khu vực Đăng nhập/Tài khoản. | Khách xem hoa không biết mình đang đăng nhập ai, không thể tra cứu đơn hoặc tìm mẫu hoa khác nếu không bấm back. | 🟠 **Khá cao** |
| **UX-07** | `css/responsive.css`<br>`css/style.css` | **Thanh danh mục vỡ thành 3-4 dòng trên Mobile:** `.category-list` dùng `flex-wrap: wrap` khiến 6 nút danh mục chiếm trọn nửa màn hình đầu tiên trên điện thoại. | Chiếm mất 180px không gian quý giá, đẩy danh sách sản phẩm xuống dưới tầm mắt người dùng. | 🟡 **Trung bình** |
| **UX-08** | `index.html`<br>`css/style.css` | **Trạng thái tải trang chủ lạc hậu:** Trang chủ vẫn dùng `<div id="loading">Đang nạp các mẫu hoa...</div>` đơn điệu, gây giật giao diện (CLS) khi nạp dữ liệu từ API. | Không đồng bộ với Skeleton Shimmer 2 cột hiện đại đã làm ở trang chi tiết sản phẩm. | 🟡 **Trung bình** |
| **UX-09** | Toàn bộ các trang HTML | **Mâu thuẫn thông điệp chính sách trên Top Bar:** `index.html` ghi "Đơn từ 350k", `orders.html` ghi "Đơn từ 500k", `detail.html` chỉ ghi chung chung. | Khách hàng bối rối về ngưỡng miễn phí vận chuyển thực tế của tiệm. | 🟡 **Trung bình** |
| **UX-10** | `js/cart-drawer.js` | **Trạng thái Giỏ hàng trống thiếu nút Kêu gọi hành động (CTA):** Khi giỏ trống, chỉ hiện icon và câu chữ tĩnh, không có nút bấm dẫn hướng quay lại xem hoa. | Giảm tỷ lệ giữ chân khách hàng (User Retention) khi lỡ xóa sạch giỏ hàng. | 🟢 **Nhẹ** |

---

## 3. PHÂN TÍCH NGUYÊN NHÂN GỐC RỄ & ĐỀ XUẤT GIẢI PHÁP CHI TIẾT

### 3.1. KHẮC PHỤC TRIỆT ĐỂ LỖI HEADER & SEARCH BOX (UX-01 & UX-03)
* **Nguyên nhân gốc rễ trong code:**
  - Trong `js/utils.js`: `renderHeaderAuth()` đổ trực tiếp 5 thẻ con vào một hàng (`user-greeting`, `badge-admin`, `btnMyOrdersHeader`, `admin-quick-btn`, `btnLogoutHeader`). Cụm này chiếm tới 759px trên desktop và 460px trên mobile.
  - Trong `css/style.css`: `.search-box` chỉ có `flex: 1; max-width: 480px;`, không hề có `min-width`. Khi cụm tài khoản phình to, Flexbox tự động ép ô search xuống còn 105px.
* **Giải pháp chuẩn hóa TMĐT:**
  1. Thay thế toàn bộ cụm nút dàn ngang bằng **Viên thuốc Tài Khoản (User Avatar Capsule)** với Dropdown Menu tương tác thông minh:
     - Hiển thị gọn gàng: `[ 👤 Quản Trị Viên ▾ ]` (hoặc `[ 👤 Tên Khách Hàng ▾ ]`), chiều rộng cố định thanh lịch chỉ ~170px.
     - Khi bấm hoặc rê chuột, xổ ra menu thả xuống (`.user-dropdown-menu`) gồm:
       - Header tóm tắt: Avatar tròn + Tên người dùng + Email + Huy hiệu quyền (Admin / Kế toán / Khách hàng).
       - Mục 1: `📦 Đơn hàng của tôi` (chuyển sang `orders.html`).
       - Mục 2: `⚙ Quản trị hệ thống` / `📊 Kế toán & Hóa đơn` (chỉ hiện khi là Admin/Staff).
       - Đường kẻ phân cách vi tế.
       - Mục 3: `🚪 Đăng xuất tài khoản` (nhấn nhá đỏ nhẹ khi hover).
  2. Bổ sung `min-width: 260px; flex: 1 1 320px;` cho `.search-box`. Ô tìm kiếm sẽ luôn giữ được diện tích tối thiểu để hiển thị trọn vẹn placeholder và icon.
  3. Trên Mobile (< 768px): Tách Header thành 2 tầng rõ ràng:
     - Tầng 1: Logo (trái) + Nút User Dropdown thu nhỏ & Nút Giỏ Hàng (phải).
     - Tầng 2: Thanh tìm kiếm chiếm 100% chiều ngang (`order: 3; width: 100%;`).

---

### 3.2. KHẮC PHỤC TRIỆT ĐỂ LỖI GẠCH NGANG GIÁ ẢO TRÙNG LẶP (UX-02)
* **Nguyên nhân gốc rễ trong code:**
  - Trong `js/main.js` dòng 197 và `js/detail.js` dòng 149 & 510: Code chỉ kiểm tra `product.originalPrice ?`. Do trong `db.json` các sản phẩm không sale có `originalPrice: 400000, price: 400000`, hệ thống coi là truthy và in thẻ `was-price`.
* **Giải pháp chuẩn hóa:**
  - Sửa điều kiện hiển thị thành phép so sánh số học chặt chẽ:
    ```javascript
    ${(product.originalPrice && Number(product.originalPrice) > Number(product.price)) 
      ? `<span class="was-price">${formatPrice(product.originalPrice)}</span>` 
      : ''}
    ```
  - Chỉ khi sản phẩm **thực sự giảm giá** (`originalPrice > price`), giá cũ mới được gạch ngang và hiển thị cạnh giá bán mới. Khi không giảm giá, chỉ hiển thị duy nhất giá bán chính xác!

---

### 3.3. KHẮC PHỤC TRÀN VIỀN MOBILE TRANG ĐƠN HÀNG (UX-04)
* **Nguyên nhân gốc rễ trong code:**
  - Trong `css/orders.css`: `.floral-stepper-track` bố trí 4 bước uốn hoa nằm ngang, mỗi bước có `.floral-step-node` rộng `90px` cố định. Tổng chiều rộng tối thiểu là $4 \times 90px = 360px$, cộng thêm padding $24px \times 2 = 48px$ của `.order-craft-card`, tổng cộng là **408px** $\rightarrow$ vượt quá bề ngang 375px của iPhone!
* **Giải pháp chuẩn hóa:**
  - Thêm media query Mobile trong `css/orders.css` và `css/responsive.css`:
    ```css
    @media (max-width: 767px) {
      .order-craft-card { padding: 16px 12px; }
      .floral-step-node { width: 70px; }
      .floral-step-title { font-size: 10.5px; }
      .floral-step-circle { width: 30px; height: 30px; }
      .orders-sidebar-card { padding: 16px; }
    }
    ```

---

### 3.4. KHẮC PHỤC XUNG ĐỘT NÚT CHATBOT & MOBILE STICKY BUY BAR (UX-05)
* **Nguyên nhân gốc rễ trong code:**
  - Trong `css/chatbot.css`, class của nút chat là `.chat-launcher-btn`. Trong `css/responsive.css` dòng 338 lại viết nhầm thành `.chatbot-toggler` / `#chatbotToggleBtn`.
* **Giải pháp chuẩn hóa:**
  - Sửa selector thành `body.has-sticky-bar .chat-launcher-btn, body.sticky-bar-active .chat-launcher-btn { bottom: 82px !important; }`. Nút chat sẽ tự động nhấc lên cao khi thanh Mua Ngay xuất hiện.

---

### 3.5. NÂNG CẤP THANH DANH MỤC MOBILE DẠNG VUỐT NGANG (UX-07)
* Chuyển `.category-list` trên Mobile thành thanh trượt ngang mượt mà (`flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none;`), tiết kiệm 140px chiều cao màn hình.

---

### 3.6. BỔ SUNG SKELETON LOADING GRID CHO TRANG CHỦ (UX-08)
* Thay dòng text `#loading` đơn điệu ở `index.html` bằng Lưới Khung Xương Shimmer 4 thẻ đồng bộ nhịp nhàng với trang chi tiết.

---

### 3.7. ĐỒNG BỘ HEADER VÀ THÔNG ĐIỆP CHÍNH SÁCH TOP BAR (UX-06 & UX-09)
* Thêm ô tìm kiếm và `#headerAuthArea` vào `detail.html`, đồng bộ thông điệp Top Bar giao nhanh từ 350k trên cả 3 trang.

---

## 4. DANH SÁCH TỆP TIN CẦN CẬP NHẬT KHI THỰC THI

1. `js/utils.js`: Viết lại `renderHeaderAuth()` thành User Dropdown Capsule.
2. `css/style.css`: Khóa `min-width: 260px;` cho `.search-box`, thêm CSS cho User Dropdown Menu và Skeleton Grid trang chủ.
3. `js/main.js`: Sửa điều kiện `Number(originalPrice) > Number(price)` dòng 197; cập nhật render Skeleton lúc nạp dữ liệu.
4. `js/detail.js`: Sửa điều kiện `Number(originalPrice) > Number(price)` dòng 149 & 510; gọi `renderHeaderAuth()`.
5. `detail.html`: Bổ sung search box và `#headerAuthArea` vào Header; đồng bộ Top Bar.
6. `orders.html`: Đồng bộ Top Bar 350k.
7. `css/orders.css`: Bổ sung responsive media query cho Stepper và Cards trên Mobile.
8. `css/responsive.css`: Thêm thanh vuốt ngang cho `.category-list`; sửa selector nút Chatbot thành `.chat-launcher-btn`.
9. `js/cart-drawer.js`: Thêm nút CTA "Khám phá các mẫu hoa" trong trạng thái giỏ trống.
