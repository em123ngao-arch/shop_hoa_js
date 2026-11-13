# AGENTS.md - Workspace Instructions for shopHoa Project

## Project Identity & Context
- **Project Name:** Website Bán Hoa / Hoa Kẽm Nhung Handmade (`shopHoa`)
- **Evaluation Criteria:** Final Project Rubric for JavaScript Course (Đề tài cuối khóa môn JavaScript)
- **Primary Goal:** 100/100 points on the evaluation rubric, strictly following Vanilla JavaScript and ES6+ standards.

## ⛔ VETO RULES (STRICTLY FORBIDDEN)
1. **NO UI Frameworks / External JS Libraries:**
   - Do NOT use React, Vue, Angular, Svelte, Alpine.js, Solid.js, jQuery, or Bootstrap JavaScript.
   - Do NOT use external CRUD/state management libraries (Redux, Zustand, Pinia).
   - ONLY use **HTML5**, **CSS3 (Vanilla)**, and **JavaScript (Vanilla JS & ES6+)**.
2. **NO Third-party Template Takeovers:**
   - Write clean, understandable code that the student can defend and modify live in front of the instructor.
3. **NO Dead Links or Dummy Buttons:**
   - No `href="#"` without handlers.
   - No non-functional buttons.
   - Every action must give feedback (Toast notification or modal confirmation).
4. **NO Crude Alert Placeholders:**
   - Do not use `alert("OK")` for validation or success. Implement clean inline error messages and modern Toast alerts in Vanilla JS.

## ⚡ MANDATORY ES6+ FEATURES (Grading Requirement)
The following ES6+ features MUST be actively used and clearly visible in the codebase:
- `const` & `let` (NEVER `var`)
- Arrow Functions (`() => {}`)
- Template Literals (`` `${...}` ``) for dynamic HTML rendering
- Destructuring (`const { id, name, price } = product;`)
- Spread Operator (`[...items]`, `{ ...object }`)
- Default Parameters (`function calcTotal(items = []) { ... }`)
- ES6 Modules (`import` / `export`)
- **Array Methods:**
  - `map()`: Converting product/cart/order lists to HTML markup.
  - `filter()`: Realtime search by keyword, category filter, price range filter.
  - `find()`: Finding single product by ID for details or cart update.
  - `findIndex()`: Locating cart items for increment/decrement/deletion.
  - `reduce()`: Calculating total cart price, total revenue, best-selling item in Admin Dashboard.
  - `sort()`: Sorting by price (asc/desc), name (A-Z/Z-A), newest. Must clone before sorting (`[...list].sort(...)`).
  - `some()` / `every()`: Form validation checks and stock condition checks.
  - `forEach()`: DOM node list traversal and event binding.

## 🗄️ DATA STORAGE & PERSISTENCE (MySQL 8.0 / Prisma + `localStorage` Client UI)
- **Server Database (Source of Truth):** Dữ liệu danh mục (`categories`), sản phẩm (`products`), phụ kiện (`addons`), đơn hàng (`orders`, `order_items`, `order_item_addons`), hoàn tiền (`refund_requests`), thanh toán (`payment_transactions`), đánh giá (`reviews`, `review_helpful_votes`, `review_comments`), tài khoản (`users`, `password_reset_tokens`), yêu thích (`wishlist`), và thông báo (`notifications`) được lưu trữ đồng bộ trên **MySQL 8.0** thông qua **Prisma ORM**.
- **Client `localStorage` Keys (Chỉ phục vụ giỏ hàng & trạng thái UI cục bộ):**
  - `SHOP_HOA_CART`: Giỏ hàng hiện tại của trình duyệt.
  - `SHOP_HOA_DRAFT_TOKENS` / `SHOP_HOA_RECENT_ORDER_IDS` / `SHOP_HOA_VIEWED_VOUCHERS` / `SHOP_HOA_WISHLIST_GUEST` / `SHOP_HOA_CUSTOMER`: Dữ liệu phiên UI hỗ trợ khách vãng lai & đồng bộ tức thời khi tải lại trang.

## 📂 DIRECTORY & ARCHITECTURAL STRUCTURE (FULLSTACK JAVASCRIPT)
All project code resides strictly inside `souce_shopHoa/`. The system applies **Clean / Hexagonal Architecture** in Node.js for backend, seamlessly communicating with the Vanilla JS ES6+ Frontend served from `public/` via a unified RESTful API contract (`/api/...`).

```text
d:/shopHoa/
├── order_shopHoa/                 # Bảng tính giá cost Excel
└── souce_shopHoa/                 # ⭐ TOÀN BỘ CODE DỰ ÁN NẰM TRONG THƯ MỤC NÀY
    ├── server.js                  # Entry point máy chủ Node.js (cổng 4000, phục vụ static từ public/)
    ├── prisma/                    # Prisma schema & migrations cho MySQL 8.0
    ├── public/                    # 🌐 Static Frontend được Express phục vụ công khai
    │   ├── index.html             # Trang chủ: Hero, categories, 17+ mẫu hoa nổi bật, modal checkout
    │   ├── detail.html            # Trang chi tiết hoa: ?id=..., gallery có điều kiện, đánh giá nhiều tầng
    │   ├── orders.html            # Trang đơn hàng cá nhân, tra cứu khách vãng lai, hóa đơn PDF, avatar
    │   ├── admin.html             # Quản trị: Dashboard KPI, Sản phẩm, Đơn hàng, Hoàn tiền, Thống kê Ngày/Tháng/Năm
    │   ├── login.html, register.html, forgot-password.html, reset-password.html
    │   │
    │   ├── css/                   # Vanilla CSS giao diện người dùng (Flower Chimp palette)
    │   │   ├── reset.css, variables.css, style.css, detail.css, orders.css, admin.css, auth.css, chatbot.css, responsive.css
    │   │
    │   ├── vendor/                # Thư viện đóng gói nội bộ (zero CDN runtime dependency)
    │   │   ├── axios.esm.js, exceljs.min.js, jspdf.umd.min.js, jspdf.plugin.autotable.min.js
    │   │   └── fonts/             # NotoSans-Regular.ttf, NotoSans-Bold.ttf + OFL-LICENSE.txt (tiếng Việt PDF)
    │   │
    │   └── js/                    # Frontend Vanilla JS ES6+
    │       ├── api.js             # Axios API Client tiền tố /api + HttpOnly Cookie Auth
    │       ├── storage.js         # API fetcher thuần túy + localStorage cho giỏ hàng/trạng thái UI
    │       ├── utils.js           # Canvas compressor (WebP), currency formatter (VND), toast
    │       ├── business-rules.js  # Pure ES6+ rules: lọc ID, voucher, GMV/Doanh thu Ngày-Tháng-Quý-Năm, hoàn tiền
    │       ├── excel-pdf.js       # Xuất/nhập ExcelJS (.xlsx/.csv) & xuất hóa đơn/báo cáo PDF tiếng Việt (Noto Sans)
    │       ├── auth-flow.js, login.js, register.js, forgot-password.js, reset-password.js
    │       ├── cart-drawer.js     # Ngăn kéo giỏ hàng (CRUD giỏ, tăng/giảm SL, xóa, đồng bộ localStorage)
    │       ├── checkout.js        # Quy trình đặt hàng COD / VietQR SePay, voucher drawer, polling thanh toán
    │       ├── main.js            # index.html logic (Search, filter, render hoa, wishlist)
    │       ├── detail.js          # detail.html logic (URLSearchParams, reviews, star picker, bình luận)
    │       ├── orders.js          # orders.html logic (avatar upload canvas, tracking, hủy đơn, xuất PDF)
    │       ├── admin.js           # admin.html logic (Dashboard, Product CRUD, Orders, Refunds Maker-Checker, Thống kê)
    │       ├── bottom-nav.js      # Thanh điều hướng mobile
    │       └── chatbot.js         # Chatbot Em Ly tư vấn qua proxy /api/chat
    │
    └── server/                    # 💎 BACKEND HEXAGONAL ARCHITECTURE (NODE.JS + ES MODULES)
        ├── domain/                # [Lõi doanh nghiệp - Pure JS]
        │   ├── errors/DomainErrors.js
        │   ├── models/            # User.js
        │   ├── state-machines/    # OrderStatus.js (canTransitionTo bất biến)
        │   └── utils/             # phone.js (chuẩn hóa SĐT VN)
        ├── ports/                 # [Hợp đồng giao tiếp - Ports]
        │   ├── in/                # AuthUseCase.js
        │   └── out/               # OrderRepositoryPort.js, UserRepositoryPort.js, PasswordResetRepositoryPort.js, EmailSenderPort.js, PasswordHasherPort.js, TokenPort.js
        ├── application/           # [Nghiệp vụ ứng dụng - Services]
        │   ├── AuthService.js     # Đăng nhập, băm BCrypt, JWT HttpOnly cookie, reset password token SHA-256
        │   ├── OrderService.js    # Định giá server (Single Source of Truth), ACID trừ kho, sinh notification
        │   ├── PaymentService.js  # Đối soát SePay webhook, idempotency, late payment handling
        │   ├── RefundService.js   # Quy trình hoàn tiền 2 cấp Maker-Checker (Thu ngân tạo -> Admin duyệt/từ chối)
        │   └── OrderExpiryService.js # Job tự động hủy đơn SePay quá hạn & hoàn kho/voucher
        ├── adapters/              # [Bộ tiếp hợp công nghệ - Adapters]
        │   ├── in/web/            # Controllers: AuthController, AdminUserController, CatalogController, OrderController, PaymentController, RefundController, ReviewController, NotificationController, UserController, WishlistController + middlewares/
        │   └── out/               # Persistence (Prisma*Repository), Email (SmtpEmailAdapter), Security (BcryptHasherAdapter, JwtTokenAdapter)
        └── infrastructure/        # [Hạ tầng & Cấu hình]
            ├── config/            # container.js (IoC Container), env.js
            └── db/prisma.js       # Prisma ORM Client (MySQL 8.0)
```

## 🔒 BACKEND SECURITY & COMMERCIAL STANDARDS
1. **Password Security:** Bắt buộc dùng `bcryptjs` băm mật khẩu 1 chiều (Salt rounds: 10), tuyệt đối không lưu mật khẩu trần.
2. **Stateless Authentication:** Dùng `jsonwebtoken` (JWT) ký bằng HMAC-SHA256 bí mật từ `.env`, hạn dùng 24h.
3. **Image Sanitization:** Dùng `sharp` giải mã Base64 -> vẽ lại pixel 200×200 WebP (loại bỏ 100% Polyglot/mã độc ẩn) -> lưu ổ cứng -> CSDL chỉ lưu chuỗi URL.
4. **Data Integrity (ACID):** Dùng `prisma.$transaction()` khóa giao dịch trừ kho và tạo đơn, triệt tiêu nguy cơ bán âm kho (Overselling).
5. **IDOR Prevention:** Mọi API xem đơn hàng hoặc đánh dấu đọc thông báo phải đối soát `record.userId === currentTokenUser.id`.

## 🎨 FRONTEND STYLING & ZERO-AI-VIBE RULES (STRICT SPECIFICATION)
AI must strictly follow [FRONTEND_RULES.md](file:///d:/shopHoa/souce_shopHoa/docs/FRONTEND_RULES.md):
- **Reference Model:** Inspired by [Flower Chimp](https://www.flowerchimp.my/collections/birthday-flower-delivery).
- **NO AI VIBE COLORS:** Strictly FORBIDDEN neon purple (`#8a2be2`, `#7c3aed`), glowing cyan, rainbow/purple-pink gradients, developer-style dark mode.
- **PALETTE:** White (`#FFFFFF`), soft background (`#F9FAFB`), emerald green (`#108474`), dark charcoal text (`#181318`), rose accent (`#D9536F`), sale price red (`#D92D20`), star gold (`#FF9900`), border (`#E8E8E8`).
- **NO AI EMOJIS:** Strictly FORBIDDEN cheap emojis (🚀, 🔥, 💥, 🤖, ✨, 💡, 🤩, 🎉). Use clean, subtle SVG line icons for search, bag/cart, heart, delivery truck.
- **TYPOGRAPHY:** Headings use elegant Serif (`Merriweather` / `Playfair Display`), body text uses clean Sans-serif (`Lato` / `Plus Jakarta Sans`).
- **CARD LAYOUT:** Clean 4-column desktop, 2-column mobile. Product card with 4:5 image, subtle hover zoom, discount badge, 5-star rating, was_price strike-through, Add to Cart button.

## 🛡️ CODE DEFENSE & COMMENTS
- All core functions must include Vietnamese docstrings/comments explaining params, return types, and the ES6 array method used.
- Code should be clean, readable, and structured so the student can explain every line when asked by the examiner.

## 📝 NHẬT KÝ HOÀN THIỆN & BẢO MẬT (CHANGELOG)
- **11/11/2026 - Giai đoạn 0 (Khẩn cấp):**
  - **Task 0.1:** Đã gỡ bỏ hoàn toàn `DEFAULT_GEMINI_KEY` và endpoint trực tiếp `generativelanguage.googleapis.com` (`callGeminiAPI`) trong [js/chatbot.js](file:///d:/shopHoa/souce_shopHoa/js/chatbot.js). Chatbot Em Ly chuyển hẳn sang gọi duy nhất qua server proxy `POST /api/chat`, với fallback an toàn `smartLocalRAG` ở client khi request mạng gặp sự cố.
  - **Task 0.2:** Đã kiểm tra lịch sử Git local qua `git log --all -- .env`, xác nhận không thấy file `.env` trong lịch sử Git local hiện có.
- **11/11/2026 - Giai đoạn A (Luồng mua hàng chạy đúng):**
  - **Task A1:** Sửa lệch method HTTP cho SePay Check-Payment (`BUG-01`). Đã đổi route trong [server.js](file:///d:/shopHoa/souce_shopHoa/server.js) từ `app.get` sang `app.post('/api/sepay/check-payment/:orderId', container.optionalAuthMiddleware, container.paymentController.checkPayment)`. Khách hàng gửi số điện thoại trong body `{ phone }`, hỗ trợ cả token JWT người dùng và số điện thoại khách vãng lai. Kiểm thử integration test đạt 100% PASS, loại bỏ hoàn toàn lỗi 404 khi polling thanh toán.
  - **Task A2:** Bỏ `http://localhost:4000` gán cứng (`BUG-04`). Chuyển `API_URL = ''` trong [js/api.js](file:///d:/shopHoa/souce_shopHoa/js/api.js) để Axios tự động dùng relative URL theo origin hiện tại. Thay toàn bộ các lệnh `fetch('http://localhost:4000/...')` trong [js/checkout.js](file:///d:/shopHoa/souce_shopHoa/js/checkout.js) và [js/orders.js](file:///d:/shopHoa/souce_shopHoa/js/orders.js) sang relative path `/api/...`. Toàn bộ thư mục `js/` sạch 100% chuỗi hardcoded localhost.
  - **Task A3:** Thông tin ngân hàng lấy từ server (`BUG-08`). Xóa bỏ hoàn toàn hằng số `SEPAY_CONFIG` gán cứng trong [js/checkout.js](file:///d:/shopHoa/souce_shopHoa/js/checkout.js) và [js/orders.js](file:///d:/shopHoa/souce_shopHoa/js/orders.js), chuyển sang nạp động từ `GET /api/sepay/config`. Phía backend [PaymentController.js](file:///d:/shopHoa/souce_shopHoa/server/adapters/in/web/PaymentController.js) xóa bỏ fallback mặc định cứng, nếu thiếu cấu hình trả về HTTP 503 `PAYMENT_UNAVAILABLE` kèm header `Cache-Control: no-store`. Integration test PASS 100%.
  - **Task A4 & Hexagonal Pricing Engine:** Phụ kiện (add-ons) lưu đúng và tính tiền ở server (`BUG-03`). Tạo 2 model Prisma `addons` và `order_item_addons`, migration và seed idempotent. Chuyển toàn bộ logic tra cứu phụ kiện, kiểm tra sản phẩm active, chống gian lận giá, deduplication phụ kiện `[...new Set(addonIds)]`, phí vận chuyển, và tính toán subtotal/voucher từ repository ra Application Service [server/application/OrderService.js](file:///d:/shopHoa/souce_shopHoa/server/application/OrderService.js) làm nguồn chân lý duy nhất (Single Source of Truth). Xóa bỏ 100% mã tính giá và fallback trùng lặp trong [PrismaOrderRepository.js](file:///d:/shopHoa/souce_shopHoa/server/adapters/out/persistence/PrismaOrderRepository.js); repository kế thừa [server/ports/out/OrderRepositoryPort.js](file:///d:/shopHoa/souce_shopHoa/server/ports/out/OrderRepositoryPort.js), chỉ nhận `verifiedItems` đã kiểm duyệt và thực thi transaction trừ kho nguyên tử `$transaction` cùng lưu bản ghi. Xóa bỏ 100% mẹo ghép chuỗi `-addon-` trên toàn bộ codebase.
  - **Task A5:** Đơn của tôi hiển thị đúng (`BUG-05`). Bỏ lọc ràng buộc `matchEmail && matchPhone` ở [js/orders.js](file:///d:/shopHoa/souce_shopHoa/js/orders.js), tin tưởng danh sách server đã lọc theo `user_id`. Bổ sung ô nhập Số điện thoại (tùy chọn + regex chuẩn VN) vào [register.html](file:///d:/shopHoa/souce_shopHoa/register.html) và [js/register.js](file:///d:/shopHoa/souce_shopHoa/js/register.js). Khách đăng ký không cần nhập SĐT sau khi đặt hàng vẫn xem được đầy đủ đơn của mình.
  - **Task A6 & Refactor Hexagonal Thanh Toán:** Hoàn thiện Port [server/ports/out/OrderRepositoryPort.js](file:///d:/shopHoa/souce_shopHoa/server/ports/out/OrderRepositoryPort.js) và Application Service [server/application/PaymentService.js](file:///d:/shopHoa/souce_shopHoa/server/application/PaymentService.js) (0 Express, 0 Prisma). Tách toàn bộ nghiệp vụ thanh toán ra khỏi [PaymentController.js](file:///d:/shopHoa/souce_shopHoa/server/adapters/in/web/PaymentController.js). Phương thức `recordPayment` bổ sung điều kiện nguyên tử `status: 'pending'` vào `updateMany`. Nếu đơn đã ở trạng thái `cancelled`, hệ thống từ chối cập nhật sang `confirmed`, giữ nguyên tồn kho và ghi log WARN chuyển sang hoàn tiền thủ công. Integration test PASS 100%.
  - **Task A7:** Đơn chờ thanh toán tự hết hạn. Xây dựng Application Service [OrderExpiryService.js](file:///d:/shopHoa/souce_shopHoa/server/application/OrderExpiryService.js) tuân thủ hợp đồng `OrderRepositoryPort`, bổ sung 2 phương thức chuyên biệt trong [PrismaOrderRepository.js](file:///d:/shopHoa/souce_shopHoa/server/adapters/out/persistence/PrismaOrderRepository.js) (`findExpiredPendingSepayOrders`, `cancelExpiredPendingOrder`). Khắc phục triệt để lỗ hổng của `cancelCustomerOrder(id, null)` bằng điều kiện kép nguyên tử `status: 'pending'` và `payment_status: 'pending'`, tuyệt đối không hủy đơn `confirmed` hay `paid`, hoàn kho và voucher tự động. Background job chạy mỗi 5 phút (TTL cấu hình qua `PENDING_PAYMENT_TTL_MINUTES`, mặc định 30 phút).
  - **Task A8:** Dọn dẹp [js/checkout.js](file:///d:/shopHoa/souce_shopHoa/js/checkout.js) (`BUG-10`, `BUG-13`). Nút «Quay lại» từ màn hình VietQR gọi `stopSepayPolling()` kích hoạt `AbortController.abort()` và dọn sạch countdown interval; xóa bỏ biểu thức ternary vô nghĩa `paymentStatus: paymentMethod === 'sepay' ? 'pending' : 'pending'` tại dòng 366.
  - **Task A9:** Kiểm thử đầu cuối E2E bằng Playwright ([scripts/test-phase-a-e2e.js](file:///d:/shopHoa/souce_shopHoa/scripts/test-phase-a-e2e.js)), quản lý vòng đời server, chống race condition và bảo toàn mã thoát:
    1. Kiểm soát vòng đời server: Bổ sung cờ `isDirectRun` trong `server.js` để khi file test import `app` không bị mở listener chính trên cổng 4000 gây rò rỉ cổng / treo tiến trình.
    2. Máy chủ bind `0.0.0.0` và Playwright E2E truy cập thực tế qua IP LAN thật (`http://<LAN_IP>:<port>`), xác nhận 0 network request nào bị hardcode `localhost:4000`. (Lưu ý: Để thiết bị di động thật bên ngoài truy cập, cần mở port 4000 trên Windows Defender Firewall).
    3. Đặt hàng COD qua UI browser, hiển thị mã đơn `#DH...`, đối soát CSDL chính xác.
    4. Đặt hàng kèm 2 phụ kiện (Đèn LED, Thiệp viết tay), xác nhận server tính đúng giá hoa + phụ kiện và lưu đủ snapshot trong `order_item_addons`.
    5. Đặt hàng VietQR SePay, nạp động thông tin ngân hàng từ `/api/sepay/config`, bấm mô phỏng thanh toán, giao diện tự động chuyển sang «Đã thanh toán thành công», lưu vết giao dịch CSDL.
    6. Hủy đơn SePay và giả lập thanh toán vào đơn đã hủy, kiểm tra đơn vẫn giữ `cancelled` và không thể bị sửa thành `paid`.
    7. Chống race condition khi cleanup: Truy vấn `tx.orders.findMany` được đưa vào TRONG `prisma.$transaction`, đọc trạng thái mới nhất ngay trong snapshot transaction trước khi hoàn kho delta.
    8. Bảo toàn mã thoát (Exit code): Khối `finally` bảo toàn `process.exit(testFailed || process.exitCode ? process.exitCode || 1 : 0)`, không bao giờ ghi đè thành công (0) khi assertion thất bại.
  - **Task A10 (Kiểm thử thực chiến & đối soát toàn diện):**
    - Xác nhận đối soát số tiền khớp 100%: Số tiền hiển thị trên mã QR SePay = `total_amount` trong DB = Tổng tiền trên trang Admin.
    - Phụ kiện hiển thị đầy đủ trong bảng quản trị Admin kèm giá tiền snapshot.
    - Toàn bộ Network request khi chạy thật qua IP LAN không còn bất kỳ request nào gọi về `localhost:4000` hay lỗi 404.
  - **Task A11 (Phân tách trạng thái thanh toán & trạng thái đơn hàng):**
    - Tách biệt rõ ràng: Chỉ `paymentStatus === 'paid'` trên đơn SePay mới được coi là đã thanh toán; đơn có `paymentMethod !== 'sepay'` (ví dụ COD) **luôn trả về `paid: false`** qua endpoint `/api/sepay/check-payment/:orderId`, kể cả khi đơn COD đã hoàn tất và shipper đã thu tiền (`payment_status: 'paid'`).
    - Bổ sung test tự động kiểm tra chặt chẽ trường hợp đơn COD đã completed vẫn trả `paid: false` khi gọi kiểm tra SePay.
  - **Task A12 (Xử lý Late Payment & Chuẩn hóa tài chính IFRS 15):**
    - Polling trả về `{ paid: false, cancelled: true }` ngay khi đơn đã `cancelled` để frontend (`checkout.js`, `orders.js`) dừng polling ngay lập tức.
    - Webhook tìm kiếm qua `findSepayOrderByContent(content)` (tìm cả đơn `pending` lẫn `cancelled`).
    - Ghi nhận giao dịch vào `payment_transactions` nhưng bảo toàn `status: 'cancelled'`, `payment_status: 'pending'`, tồn kho không đổi.
    - Idempotency bằng UNIQUE constraint `provider_tx_id`: Bắt lỗi Prisma `P2002` bên ngoài transaction đã rollback, đối soát xác nhận khớp `provider_tx_id` và `order_id` trước khi trả `duplicate: true`.
    - Log cảnh báo `[SePay Warning]` in đúng 1 lần duy nhất khi `result.cancelled && !result.duplicate && result.recorded === true`.
    - Phân tách 3 chỉ số tài chính rạch ròi trên Admin Dashboard theo chuẩn IFRS 15 / Bộ Tài chính: "Doanh thu ghi nhận" (`status === 'completed'`), "Tiền đã thu thực tế" (`paymentStatus === 'paid'`), và "GMV" (`status !== 'cancelled'`). Modal chi tiết đơn hiển thị banner cảnh báo đỏ yêu cầu hoàn tiền thủ công cho đơn đã hủy có giao dịch SePay.
  - **Task A13 (Chuẩn hóa Simulate Payment):**
    - Thêm `container.optionalAuthMiddleware` cho route `POST /api/sepay/simulate-payment/:orderId`.
    - Kiểm tra quyền truy cập IDOR (chủ đơn JWT hoặc SĐT trùng khớp); chặn 403 Forbidden khi sai SĐT, chặn 401 khi không có thông tin xác thực.
    - Chặn trong môi trường Production (`process.env.NODE_ENV === 'production' -> 403 Forbidden`).
    - Nạp động STK và Ngân hàng từ `bankConfig` / biến môi trường thay vì chuỗi gán cứng.
  - **Task A14 (Bộ kiểm thử tự động toàn diện & Hoàn tất Giai đoạn A):**
    - Bổ sung test tự động cho A6, A7 (dùng voucher seed `HOAXUAN20`), A11, A12, A13 trong [test-all-features-http.js](file:///d:/shopHoa/souce_shopHoa/test-all-features-http.js).
    - Chuẩn hóa cleanup CSDL trong cả 2 bộ test thành 1 transaction ACID duy nhất (`prisma.$transaction`), không nuốt lỗi nếu cleanup thất bại.
    - Lưu ý về LAN & DB: Việc kiểm thử mạng qua IP LAN trên máy host xác nhận Express bind đúng `0.0.0.0` và frontend dùng relative URL; việc kết nối thực tế trên điện thoại ngoài đời cần kiểm tra cấu hình firewall/router vật lý. Các bài test có sửa đổi dữ liệu DB nên cần lưu ý chỉ chạy trên môi trường DB phát triển.
  - **11/11/2026 - Gia cố cleanup integration test:** `test-all-features-http.js` theo dõi mọi order test, dọn chúng trong cùng transaction, hoàn kho theo delta của các đơn chưa hủy và giảm lại lượt dùng voucher tương ứng. Không còn gán tồn kho về snapshot đầu bài test hoặc dọn một số order riêng lẻ giữa chừng. Chưa chạy suite vì chưa xác nhận DB được cấu hình là DB test cô lập.
- **12/11/2026 - Giai đoạn C & Giai đoạn D (Dọn kiến trúc + Analytics Ngày/Tháng/Năm + Hoàn tiền 2 cấp):**
  - **C1–C7:** Gỡ bỏ hoàn toàn `json-server`, `vite`, `xlsx@0.18.5`, `db.json`, và các nhánh `localStorage` fallback cũ trong [public/js/storage.js](file:///d:/shopHoa/souce_shopHoa/public/js/storage.js). Gom toàn bộ frontend vào [public/](file:///d:/shopHoa/souce_shopHoa/public/) (`express.static('public')`), sửa `BUG-06` (`minOrder !== undefined`). Đóng gói offline toàn bộ vendor (`axios.esm.js`, `exceljs.min.js`, `jspdf.umd.min.js`, `jspdf.plugin.autotable.min.js`) và bộ font **Noto Sans** Regular/Bold SIL OFL vào `public/vendor/` — khắc phục dứt điểm `BUG-02` (`doc.autoTable is not a function`) và `BUG-11` (PDF tiếng Việt đầy đủ dấu). Ẩn thumbnail khi sản phẩm chỉ có 1 ảnh (`C4`/`BUG-09`), thêm `.toast-warning`/`.toast-info` (`C5`/`BUG-12`), dọn ảnh WebP mồ côi khi cập nhật/xóa sản phẩm và banner (`C7`), cập nhật `AGENTS.md` (`C6`/`BUG-15`).
  - **D1–D5:**
    1. Sửa `PrismaOrderRepository._mapToDTO` bổ sung `paymentTransactions` & `refundRequests`; triển khai phân hệ Hoàn tiền 2 cấp **Maker-Checker** (`refund_requests`, [RefundService.js](file:///d:/shopHoa/souce_shopHoa/server/application/RefundService.js), [RefundController.js](file:///d:/shopHoa/souce_shopHoa/server/adapters/in/web/RefundController.js), `chk_orders_pay_status` cho `'refunded'`): Thu ngân (`staff`) lập phiếu đề nghị hoàn tiền, chỉ Quản trị viên (`admin`) được Duyệt/Từ chối (`staff` tự duyệt bị chặn `403`).
    2. Nâng cấp **Dashboard Tab 1**, **Tab 2** (số bán thực, loại bỏ `0 lượt bán`), **Tab 5 & 5B** (`Cần hoàn tiền` / `Đã hoàn tiền` / `Quản Lý & Duyệt Hoàn Tiền`), và **Tab 6 Thống Kê** tách bạch Ngày / Tháng / Quý / Năm (`day`, `month`, `quarter`, `year`), biểu đồ 3 chuỗi (`GMV`, `Doanh thu thực`, `Lợi nhuận`), **Ma trận từng mặt hàng** (Chưa giao, Đang giao, Đã giao, Đã hủy, Doanh thu phân bổ, Tồn kho), và xuất ExcelJS 3 sheet + PDF Noto Sans theo khoảng ngày/kỳ đã chọn.



