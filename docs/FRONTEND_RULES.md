# QUY CHUẨN THIẾT KẾ FRONTEND (STYLE GUIDE & DESIGN SPECIFICATION)
> **Dự án:** Shop Hoa Kẽm Nhung & Hoa Tươi Handmade (`shopHoa`)  
> **Nguyên mẫu tham chiếu:** [Flower Chimp](https://www.flowerchimp.my/collections/birthday-flower-delivery)  
> **Mục đích:** Xóa bỏ hoàn toàn "chất AI" (AI vibe / generic AI template), đảm bảo giao diện mang đẳng cấp thương mại điện tử hoa cao cấp, tinh tế, trang nhã.

---

## ⛔ 1. BẢNG DANH SÁCH CẤM TUYỆT ĐỐI (STRICTLY FORBIDDEN)

| Thành phần | ❌ CẤM TUYỆT ĐỐI KHÔNG ĐƯỢC DÙNG | Lý do cấm |
| :--- | :--- | :--- |
| **Màu sắc** | CẤM màu tím neon (`#8a2be2`, `#7c3aed`), xanh cyan dạ quang, gradient cầu vồng tím-hồng-xanh, dark mode u tối kiểu lập trình viên. | Màu đặc trưng của template AI tự sinh, nhìn giả tạo, không phù hợp ngành hoa cao cấp. |
| **Hiệu ứng** | CẤM hiệu ứng phát sáng đèn neon (box-shadow glow sặc sỡ), hiệu ứng kính mờ (glassmorphism) mờ ảo lạm dụng. | Làm rối mắt người dùng, che lấp vẻ đẹp tự nhiên của hoa. |
| **Emoji** | CẤM lạm dụng emoji rẻ tiền: 🚀, 🔥, 💥, 🤖, ✨, 💡, 🤩, 🎉, 💯 trong tiêu đề, nút bấm hay mô tả. | Tạo cảm giác web đồ chơi sinh viên rẻ tiền, thiếu tính chuyên nghiệp thương mại. |
| **Nút bấm** | CẤM nút bấm gradient lòe loẹt, bo tròn quá khổ dạng viên kẹo (pill button bóng nhẫy). | Làm mất tính sang trọng của thương hiệu hoa cao cấp. |
| **Thẻ Card** | CẤM viền đen dày, đổ bóng đen sì (`0 10px 30px #000`), hiệu ứng nghiêng 3D (tilt effect). | Tạo cảm giác nặng nề, thô kệch. |

---

## 🎨 2. HỆ THỐNG MÀU SẮC CHUẨN FLOWER CHIMP (COLOR PALETTE)

Toàn bộ màu sắc phải sử dụng biến CSS được định nghĩa trong `css/variables.css`:

```css
:root {
  /* --- 1. MÀU NỀN & BỀ MẶT (Clean & Elegant) --- */
  --bg-page: #FFFFFF;              /* Trắng tinh khiết làm nổi bật ảnh hoa */
  --bg-surface: #F9FAFB;           /* Xám khói siêu nhạt cho section phụ */
  --bg-cream: #FDFBF7;             /* Kem ấm nhẹ cho khối nổi bật / banner */
  --border-light: #E8E8E8;         /* Viền mảnh thanh lịch (chuẩn Flower Chimp) */
  --border-subtle: #F0F2F5;        /* Viền phân cách rất nhẹ */

  /* --- 2. MÀU VĂN BẢN (Typography) --- */
  --text-main: #181318;            /* Đen than chì cao cấp (không dùng #000000 thuần) */
  --text-secondary: #454346;       /* Xám tro đậm cho phụ đề, nhãn */
  --text-muted: #7B7B7B;           /* Xám mềm cho mô tả phụ, số đánh giá */
  --text-was-price: #A1A0A0;       /* Xám nhạt gạch ngang giá cũ (chuẩn was_price) */

  /* --- 3. MÀU ĐIỂM NHẤN THƯƠNG HIỆU (Brand Accents) --- */
  --color-primary: #108474;        /* Xanh ngọc lục bảo Flower Chimp (cuống hoa, lá, sang trọng) */
  --color-primary-dark: #0A6054;   /* Xanh đậm khi hover */
  --color-accent-rose: #D9536F;     /* Hồng đất tinh tế cho dịp lễ / tình yêu */
  --color-sale-price: #D92D20;      /* Đỏ mận thanh nhã cho giá tiền khuyến mãi */
  --color-star: #FF9900;           /* Vàng hổ phách ấm áp cho đánh giá sao */

  /* --- 4. TRẠNG THÁI & BADGES --- */
  --badge-sale-bg: #FEE4E2;        /* Nền đỏ hồng nhạt */
  --badge-sale-text: #B42318;      /* Chữ đỏ đậm */
  --badge-handmade-bg: #ECFDF3;    /* Nền xanh lá nhạt */
  --badge-handmade-text: #027A48;  /* Chữ xanh lá đậm */
  --badge-bestseller-bg: #FEF0C7;  /* Nền vàng nhạt */
  --badge-bestseller-text: #B54708;/* Chữ cam nâu */

  /* --- 5. ĐỔ BÓNG & BO GÓC (Subtle & Soft) --- */
  --radius-sm: 4px;                /* Bo nhẹ góc ảnh, badge */
  --radius-md: 8px;                /* Bo nhẹ card sản phẩm */
  --radius-btn: 6px;               /* Bo nút bấm thanh lịch */
  --shadow-card: 0 2px 10px rgba(0, 0, 0, 0.05); /* Đổ bóng cực nhẹ, tự nhiên */
  --shadow-hover: 0 8px 24px rgba(0, 0, 0, 0.08);/* Nổi nhẹ khi hover */
}
```

---

## 🔤 3. QUY ĐỊNH TYPOGRAPHY (FONT CHỮ)

Lấy cảm hứng trực tiếp từ phong cách Flower Chimp (kết hợp Serif cổ điển và Sans-serif hiện đại):
1. **Tiêu đề chính (Headings `h1`, `h2`, `h3`):**
   - Font: `'Merriweather', 'Playfair Display', Georgia, serif`.
   - Đặc điểm: Sang trọng, mềm mại, thanh lịch, tạo cảm giác tiệm hoa nghệ thuật thủ công.
2. **Nội dung, nút bấm, bảng giá (Body, Nav, Button, Price):**
   - Font: `'Lato', 'Plus Jakarta Sans', system-ui, sans-serif`.
   - Đặc điểm: Rõ ràng, dễ đọc trên mọi màn hình, tỉ lệ phân cách chữ `letter-spacing: 0` hoặc nhẹ `0.3px`.

---

## 🌸 4. QUY ĐỊNH BIỂU TƯỢNG (ICONS) & EMOJI

### 4.1. Quy tắc về Emoji
* **Tuyệt đối không dùng emoji bừa bãi** trong văn bản, tiêu đề hay nút bấm.
* Chỉ cho phép dùng đúng 2 vị trí mang tính tự nhiên nếu cần:
  - Logo tiệm hoa: biểu tượng hoa nhỏ tinh tế `🌸` hoặc icon SVG cành hoa.
  - Đánh giá sao: dùng ký tự sao thuần `★` hoặc SVG star màu `#FF9900`.

### 4.2. Quy tắc về Icons (Chỉ dùng SVG Line Icons mảnh thanh lịch)
Tất cả biểu tượng điều hướng phải dùng SVG trực tiếp, nét vẽ mảnh (`stroke-width: 1.5` đến `2`):
- **Kính lúp tìm kiếm:** SVG search thanh mảnh.
- **Giỏ hàng:** SVG shopping bag / cart tối giản, có badge số lượng tròn nhỏ màu `#108474` hoặc `#D9536F`.
- **Nút quay lại / mũi tên:** SVG chevron `←` / `→` mảnh.
- **Xe giao hàng (Delivery):** SVG delivery truck cho cam kết giao nhanh.
- **Bảo hành / Đổi trả:** SVG shield-check tinh tế.

---

## 📐 5. QUY CHUẨN BỐ CỤC & LAYOUT (PAGE STRUCTURE)

```text
┌────────────────────────────────────────────────────────┐
│ 1. TOP ANNOUNCEMENT BAR (Nền #181318 hoặc #108474)     │
│    "Giao nhanh trong ngày | Miễn phí thiệp chúc mừng" │
├────────────────────────────────────────────────────────┤
│ 2. MAIN HEADER (Nền trắng, border-bottom: #E8E8E8)     │
│    [ Logo Tiệm Hoa ]   [ Ô Tìm Kiếm ]   [ User / Cart ]│
├────────────────────────────────────────────────────────┤
│ 3. NAVIGATION & CATEGORY BAR                           │
│    Tất cả | Hoa Kẽm Nhung | Bó Hoa | Giỏ Hoa | Cưới    │
├────────────────────────────────────────────────────────┤
│ 4. HERO BANNER (Tone ấm, ảnh hoa thực tế, chữ serif)   │
├────────────────────────────────────────────────────────┤
│ 5. TOOLBAR (Bộ lọc giá / Sắp xếp A-Z / Đếm số lượng SP)│
├────────────────────────────────────────────────────────┤
│ 6. PRODUCT GRID (4 cột Desktop, 2 cột Mobile)          │
│    ┌───────────────┐ ┌───────────────┐ ┌──────────────┐│
│    │ Ảnh hoa (4:5) │ │ Ảnh hoa (4:5) │ │ Ảnh hoa      ││
│    │ [Badge -15%]  │ │ [Badge Hot]   │ │              ││
│    │ Tên hoa       │ │ Tên hoa       │ │              ││
│    │ ★★★★★ (48)    │ │ ★★★★★ (12)    │ │              ││
│    │ 250.000 đ     │ │ 350.000 đ     │ │              ││
│    │ [+ Thêm giỏ]  │ │ [+ Thêm giỏ]  │ │              ││
│    └───────────────┘ └───────────────┘ └──────────────┘│
├────────────────────────────────────────────────────────┤
│ 7. TRUST BADGES (4 cam kết: Giao hỏa tốc, Thủ công,...)│
├────────────────────────────────────────────────────────┤
│ 8. FOOTER (Tone xám than chì #181318, chữ trắng xám)  │
└────────────────────────────────────────────────────────┘
```

### 5.1. Thẻ Sản Phẩm (Product Card) Chuẩn
* Tỉ lệ khung ảnh: Vuông `1:1` hoặc `4:5`, tràn viền trên, bo góc trên `8px`.
* Ảnh có hiệu ứng: `transition: transform 0.4s ease;` khi hover phóng to nhẹ `scale(1.04)`, không giật lag.
* Badge nằm góc trên bên trái ảnh: Bo góc nhỏ `4px`, padding `3px 8px`, font-size `11px`, chữ in hoa nhẹ.
* Tên sản phẩm: Chữ hoa thường rõ ràng, tối đa 2 dòng (dùng `line-clamp: 2`).
* Hàng giá:
  - Giá bán: In đậm, cỡ chữ `16px - 18px`, màu đỏ mận `--color-sale-price`.
  - Giá gốc: Cỡ `13px`, gạch ngang, màu xám nhạt `--text-was-price`.
* Nút bấm:
  - Nút `+ Thêm vào giỏ`: Nền đen than `#181318` hoặc viền xanh `#108474`, hover đổi màu mượt mà.

### 5.2. Trang Chi Tiết (Product Detail Layout)
* Bố cục 2 cột rõ ràng trên Desktop:
  - **Cột trái (60%):** Khung ảnh lớn sắc nét, có viền mỏng `#E8E8E8`, bên dưới có thể có thumbnail nhỏ.
  - **Cột phải (40%):** Tên hoa lớn (font Serif), đánh giá sao, giá bán to nổi bật, badge tình trạng "Còn hàng", mô tả chất liệu kẽm nhung, bộ tăng/giảm số lượng `[-] [1] [+]`, nút lớn `THÊM VÀO GIỎ HÀNG` và nút `MUA NGAY`.
* Khối cam kết dưới nút mua: 3 dòng icon nhỏ (Giao hoa trong ngày, Đổi trả nếu dập nát, Tặng thiệp viết tay).

---

## 📱 6. QUY ĐỊNH RESPONSIVE (BREAKPOINTS)

* **Mobile (< 768px):**
  - Lưới sản phẩm: **Bắt buộc 2 cột** đều đặn, không để 1 cột quá to làm cuộn trang mỏi tay.
  - Menu: Ẩn thanh ngang, dùng nút Hamburger hoặc thanh trượt ngang category pills.
  - Header: Thu gọn thanh tìm kiếm dạng icon hoặc hiển thị thanh search gọn gàng.
* **Tablet (768px - 1024px):** Lưới sản phẩm 3 cột.
* **Desktop (> 1024px):** Lưới sản phẩm 4 cột, độ rộng tối đa trang `max-width: 1240px` căn giữa.

---

## 🛡️ 7. ĐIỀU KHOẢN KIỂM SOÁT AI BẮT BUỘC (MANDATORY AI AUDIT)

Mỗi khi AI sinh mã HTML/CSS/JS:
1. **Kiểm tra mã màu:** Có mã màu nào nằm ngoài bảng quy định trên không? *(Nếu có: Thay ngay bằng mã trong bảng)*.
2. **Kiểm tra emoji:** Có emoji lạ kiểu 🚀 🔥 🤖 không? *(Nếu có: Xóa ngay lập tức)*.
3. **Kiểm tra font:** Tiêu đề đã dùng font Serif thanh lịch chưa? Nội dung đã dùng font Sans-serif dễ đọc chưa?
4. **Kiểm tra layout:** Card hoa đã có đủ giá gốc, giá bán, nút xem chi tiết và thêm giỏ hàng chưa?
