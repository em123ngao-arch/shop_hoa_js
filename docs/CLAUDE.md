# CLAUDE.md - Rules for shopHoa Project (Vanilla JS & ES6+)

Guidance for AI coding agents working in this repository.

## Project Summary
- Project: Website Bán Hoa / Hoa Kẽm Nhung Handmade (`shopHoa`)
- Evaluation: Final Project for JavaScript Course (Đề tài cuối khóa môn JavaScript)
- Goal: Meet all requirements of the official PDF prompt and score 100/100 points.

## ⛔ Strictly Forbidden (VETO)
- DO NOT use React, Vue, Angular, Svelte, jQuery, Bootstrap JavaScript, or any JS UI library.
- DO NOT use external CRUD, state management, or UI notification libraries (e.g., SweetAlert2, Redux, Lodash).
- ONLY use **HTML5**, **CSS3 (Vanilla)**, and **JavaScript (Vanilla JS & ES6+)**.
- DO NOT create non-functional buttons, dead links (`href="#"`), or crude `alert("OK")` dialogs.

## ⚡ Mandatory ES6+ Standards
- Variables: Always use `const` and `let` (never `var`).
- Syntax: Arrow Functions, Template Literals, Destructuring, Spread Operator, Default Parameters, Modules (`import`/`export`).
- Array Methods:
  - `map()`: Converting arrays to HTML markup for `innerHTML`.
  - `filter()`: Realtime search, category filtering, price filtering.
  - `find()`: Product lookup by ID for detail page and cart.
  - `findIndex()`: Item index tracking in cart.
  - `reduce()`: Cart total calculation and Admin Dashboard revenue metrics.
  - `sort()`: Sorting products by price, name, date (`[...items].sort(...)`).
  - `some()` / `every()`: Form and stock validation.
  - `forEach()`: DOM node iteration and event binding.

## 🗄️ Storage & Seed Data (`localStorage`)
- Storage Keys: `SHOP_HOA_PRODUCTS`, `SHOP_HOA_CART`, `SHOP_HOA_ORDERS`, `SHOP_HOA_CATEGORIES`.
- Seed Data: If `SHOP_HOA_PRODUCTS` is empty, auto-populate at least 15-20 rich flower products with names, prices, categories, images, and descriptions.
- Persistence: All CRUD and cart operations must persist across page reloads and browser restarts.

## 🎨 Frontend Styling & Zero-AI-Vibe Rules
- MUST strictly follow [FRONTEND_RULES.md](file:///d:/shopHoa/souce_shopHoa/docs/FRONTEND_RULES.md) (inspired by Flower Chimp).
- FORBIDDEN: Neon purple (`#8a2be2`, `#7c3aed`), glowing cyan, rainbow/purple-pink gradients, developer dark mode.
- FORBIDDEN: Cheap emojis (🚀, 🔥, 💥, 🤖, ✨, 💡, 🤩, 🎉). Use clean SVG line icons for search, bag, heart, truck.
- PALETTE: Clean white `#FFFFFF`, light surface `#F9FAFB`, emerald green `#108474`, dark charcoal text `#181318`, rose accent `#D9536F`, sale price red `#D92D20`, star gold `#FF9900`, border `#E8E8E8`.
- TYPOGRAPHY: Headings use Serif (`Merriweather` / `Playfair Display`), body text uses Sans-serif (`Lato` / `Plus Jakarta Sans`).

## 📂 Architecture & Organization
- Keep code organized into dedicated modules under `js/`: `storage.js`, `utils.js`, `validation.js`, `main.js`, `products.js`, `detail.js`, `cart.js`, `admin.js`.
- Keep CSS organized under `css/`: `reset.css`, `style.css`, `responsive.css`, `admin.css`.
- Separate pages: `index.html`, `products.html`, `detail.html`, `cart.html`, `admin.html`.

## 🛡️ Code Defensibility & Vietnamese Comments
- The student must defend and live-edit this codebase in front of the course instructor.
- Add clear Vietnamese comments to all core functions explaining the algorithm, inputs, outputs, and the ES6 array method used.
