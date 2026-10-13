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

## 🗄️ DATA STORAGE & PERSISTENCE (`localStorage`)
- **Storage Keys:**
  - `SHOP_HOA_PRODUCTS`: Array of products (minimum 15-20 seed products on first load).
  - `SHOP_HOA_CART`: Array of current cart items.
  - `SHOP_HOA_ORDERS`: Array of placed orders.
  - `SHOP_HOA_CATEGORIES`: Array of flower categories.
- **Persistence Rule:**
  - Any CRUD action, cart change, or order placement must sync immediately to `localStorage`.
  - Data must persist across page reloads and browser restarts.

## 📂 DIRECTORY STRUCTURE (ALL CODE RESIDES INSIDE `souce_shopHoa/`)
```text
d:/shopHoa/
├── order_shopHoa/                 # Bảng tính giá cost Excel
└── souce_shopHoa/                 # ⭐ TOÀN BỘ CODE DỰ ÁN NẰM TRONG THƯ MỤC NÀY
    ├── index.html                 # Trang chủ: Hero, categories, 15+ mẫu hoa nổi bật
    ├── detail.html                # Trang chi tiết hoa: Param ?id=..., ảnh lớn, số lượng, thêm giỏ
    ├── cart.html                  # Trang giỏ hàng: Bảng sản phẩm, tăng/giảm SL, xóa, tổng tiền
    ├── admin.html                 # Trang quản trị: Dashboard thống kê (reduce) + Product CRUD
    ├── db.json                    # Mock database cho json-server
    ├── css/
    │   ├── reset.css              # Reset CSS
    │   ├── variables.css          # Design Tokens (màu sắc Flower Chimp, font chữ, shadow)
    │   ├── style.css              # Theme colors, typography, buttons, card hoa, toast
    │   ├── detail.css             # Giao diện riêng trang chi tiết hoa
    │   └── responsive.css         # Desktop, tablet, mobile layouts
    ├── js/
    │   ├── api.js                 # Axios API client gọi json-server (http://localhost:3000)
    │   ├── storage.js             # localStorage manager & seed data initializer
    │   ├── utils.js               # Currency formatter (VND), toast alerts, modal confirm
    │   ├── validation.js          # Form validation logic (empty, regex email, regex phone VN)
    │   ├── main.js                # index.html logic (Search, filter, render 15+ hoa)
    │   ├── detail.js              # detail.html logic (URLSearchParams, nạp chi tiết hoa)
    │   ├── cart.js                # cart.html logic (cart CRUD, order creation)
    │   └── admin.js               # admin.html logic (product CRUD, stats calculation)
    └── images/                    # Chứa ảnh các mẫu hoa (350.png, 500k.png,...)
```

## 🎨 FRONTEND STYLING & ZERO-AI-VIBE RULES (STRICT SPECIFICATION)
AI must strictly follow [FRONTEND_RULES.md](file:///d:/shopHoa/FRONTEND_RULES.md):
- **Reference Model:** Inspired by [Flower Chimp](https://www.flowerchimp.my/collections/birthday-flower-delivery).
- **NO AI VIBE COLORS:** Strictly FORBIDDEN neon purple (`#8a2be2`, `#7c3aed`), glowing cyan, rainbow/purple-pink gradients, developer-style dark mode.
- **PALETTE:** White (`#FFFFFF`), soft background (`#F9FAFB`), emerald green (`#108474`), dark charcoal text (`#181318`), rose accent (`#D9536F`), sale price red (`#D92D20`), star gold (`#FF9900`), border (`#E8E8E8`).
- **NO AI EMOJIS:** Strictly FORBIDDEN cheap emojis (🚀, 🔥, 💥, 🤖, ✨, 💡, 🤩, 🎉). Use clean, subtle SVG line icons for search, bag/cart, heart, delivery truck.
- **TYPOGRAPHY:** Headings use elegant Serif (`Merriweather` / `Playfair Display`), body text uses clean Sans-serif (`Lato` / `Plus Jakarta Sans`).
- **CARD LAYOUT:** Clean 4-column desktop, 2-column mobile. Product card with 4:5 image, subtle hover zoom, discount badge, 5-star rating, was_price strike-through, Add to Cart button.

## 🛡️ CODE DEFENSE & COMMENTS
- All core functions must include Vietnamese docstrings/comments explaining params, return types, and the ES6 array method used.
- Code should be clean, readable, and structured so the student can explain every line when asked by the examiner.

