# 📘 PROJECT HANDOVER & CONTEXT TRANSFER
## TÀI LIỆU CHUYỂN GIAO BỐI CẢNH DỰ ÁN CHO AI KẾ TIẾP
> **Dành cho bất kỳ AI nào tiếp quản:** Đọc kỹ tài liệu này trước khi hỗ trợ lập trình viên (User). File này tóm tắt toàn bộ lịch sử tương tác, kiến trúc dự án, các quyết định kỹ thuật đã chốt và lộ trình đang thực hiện.

---

## 🎯 1. TỔNG QUAN DỰ ÁN & MỤC TIÊU CỐT LÕI

* **Tên dự án:** Website Bán Hoa Nghệ Thuật Kẽm Nhung Handmade (`shopHoa`).
* **Bối cảnh:** Đồ án tốt nghiệp / Bài tập lớn cuối khóa môn **JavaScript Nâng Cao (ES6+)**.
* **Mục tiêu tối thượng:** Đạt **100/100 điểm** trên thang đo Rubric; Học viên tự tay bảo vệ, giải thích từng dòng code và sửa code trực tiếp trước mặt Giảng viên phản biện.
* **Quy chuẩn công nghệ (BẮT BUỘC):**
  * **Chỉ dùng:** HTML5, CSS3 (Vanilla), Vanilla JavaScript (ES6+).
  * **CẤM TUYỆT ĐỐI:** Không dùng React, Vue, Angular, jQuery, Tailwind CSS, Bootstrap JS, hoặc các thư viện UI bên ngoài.
  * **API Client:** Sử dụng `axios` thông qua thẻ `<script type="importmap">` chuẩn ES Modules trên trình duyệt.
  * **Backend & Cơ sở dữ liệu:** Mock REST API bằng `json-server` (chạy tại `http://localhost:3000` với file `db.json`).
  * **Lưu trữ phiên & Dữ liệu:** Dual-tier (Đồng bộ giữa `json-server` và `localStorage`).

---

## 👥 2. HỆ THỐNG PHÂN VAI DOANH NGHIỆP (ROLE-PLAY WORKFLOW)

Dự án được vận hành theo mô hình team phát triển phần mềm mô phỏng:
1. **👨‍💻 User (Junior Frontend Developer):** Học viên, người trực tiếp gõ code, gõ lệnh Git để rèn phản xạ và hiểu sâu bản chất.
2. **🧙‍♂️ Anh Vũ (Tech Lead / Git Master):** Khó tính, tận tâm. Soi xét từng commit, kiểm tra `.gitignore`, review Pull Request, giải thích câu hỏi "Tại sao làm thế này mà không làm thế kia?", nhắc nhở khi User gõ sai cú pháp hoặc vi phạm quy tắc Git.
3. **🧑‍💻 Hùng (Junior Dev Teammate):** Đồng đội làm song song các tính năng phụ (Banner, Footer, Filter), tạo tiền đề cho các bài học xử lý Merge Conflict thực tế trên nhánh `develop`.
4. **📋 Chị Linh (Product Owner / Lead QA):** Phân chia Sprint, giao Ticket (User Stories) chuẩn Agile/Scrum kèm Acceptance Criteria (AC), kiểm thử UAT trên nhánh `staging`.

### 🌳 Quy chuẩn Git 3 Tầng Nhánh:
```text
main (Production Release v1.0.0)
  └── staging (Pre-production / Chị Linh nghiệm thu UAT)
        └── develop (Nhánh tích hợp chung của team)
              ├── feature/SHOP-<ID>-<ten-task> (Nhánh tính năng làm việc)
              └── hotfix/SHOP-<ID>-<ten-loi> (Sửa lỗi khẩn cấp)
```
* **Quy tắc vàng:** CẤM commit trực tiếp lên `main`, `staging`, hoặc `develop`. Mọi task phải checkout từ `develop`.

---

## 🕒 3. LỊCH SỬ TƯƠNG TÁC & CÁC CHỨC NĂNG ĐÃ THỰC HIỆN

### 3.1. Sprint 1: Khởi Tạo Dự Án (ĐÃ HOÀN THÀNH ✅)
* Thiết lập `.gitignore` chặn `node_modules/`, `*.log`, `Thumbs.db`.
* Dựng cây nhánh chuẩn: `main`, `staging`, `develop`.

### 3.2. Tính Năng Xác Thực (Authentication):

#### A. Đăng ký tài khoản (`register.html` & `js/register.js` - ĐÃ CHẠY TỐT ✅):
* Cấu trúc: Lấy dữ liệu Form $\rightarrow$ Validate client-side $\rightarrow$ `api.get('/users?email=...')` kiểm tra trùng $\rightarrow$ `api.post('/users', newUser)` lưu vào `db.json` $\rightarrow$ Điều hướng sang `login.html`.

#### B. Đăng nhập tài khoản (`login.html` & `js/login.js` - ĐANG THỰC HIỆN ⏳):
* **Bản chất logic đã chốt:**
  * Bắt form `#loginForm` & `event.preventDefault()` (chặn reload trang).
  * Lấy `#email.value.trim()` và `#password.value`.
  * Guard Clause kiểm tra rỗng: `if (!email || !password)`.
  * Gọi API tra cứu: `await api.get('/users', { params: { email, password } })`.
  * Kiểm tra kết quả: `if (users.length === 0)` báo sai tài khoản/mật khẩu.
  * Nếu thành công: `localStorage.setItem('user', JSON.stringify(user))` và `window.location.href = "index.html"`.
* **Trạng thái:** Học viên đang tự tay gõ vào `js/login.js`. Đã hướng dẫn 3 điểm lưu ý cú pháp (thiếu `.value`, `.trim()` trên thẻ thay vì trên value, và cần gọi hàm `login()` trong sự kiện submit).

---

## 📌 HƯỚNG DẪN AI ĐỌC TIẾN ĐỘ HÀNG NGÀY:
> **Xem chi tiết các việc cần làm hôm nay và lộ trình tiếp theo tại file:** [docs/ROADMAP_TODO.md](file:///d:/shopHoa/souce_shopHoa/docs/ROADMAP_TODO.md). Mỗi khi hoàn thành một task, hãy cập nhật trạng thái `[x]` vào file đó.

---

## 🚀 4. KẾ HOẠCH SPRINT 2 (ĐÃ CHỐT QUA GRILL-ME & PLAN)

> **Quyết định kiến trúc Database:** Tiếp tục dùng `json-server` mở rộng file `db.json`, **chưa dùng MySQL/MongoDB** vì `json-server` đã là File-based DB đầy đủ REST API, giúp User tập trung 100% học logic Frontend + Admin Dashboard mà không bị phân tâm bởi cấu hình Backend.

### Danh Sách 5 Ticket Sprint 2:

| Mã Ticket | Tên Tính Năng | Trọng Tâm Kỹ Thuật | Trạng Thái |
| :--- | :--- | :--- | :--- |
| **`SHOP-05`** | **Bảng Banners & Dynamic Slider** | Thêm bảng `banners` vào `db.json`; viết hàm `fetchBanners()`; render Slider tự trượt mỗi 4s trên `index.html`. | **ĐÃ HOÀN THÀNH** ✅ |
| **`SHOP-06`** | **Sản Phẩm Mới & Bán Chạy** | 2 Section riêng: "Bán chạy nhất" (sort `soldCount` desc) và "Mới nhất" (sort ID desc). Layout Flower Chimp không viền. | **ĐÃ HOÀN THÀNH** ✅ |
| **`SHOP-07`** | **Flash Deals & Side Cart Drawer** | Flash sale lọc 10%-35% + đếm ngược; Thẻ Voucher cắt răng cưa; Side Cart Drawer trượt mượt mà tính tiền realtime; Popup sinh nhật. | **ĐÃ HOÀN THÀNH** ✅ |
| **`SHOP-08`** | **Trang Admin Dashboard (`admin.html`)** | Trang quản trị 5 Tab: KPI thống kê (`reduce`), CRUD Mẫu hoa + Kéo thả ảnh (Drag & Drop), CRUD Banner + Kích hoạt chủ đề, CRUD Voucher, Quản lý Đơn hàng. Bộ tính giá 2 chiều (2-Way Smart Calculator), định dạng VND hint, và Thanh kích hoạt Siêu Sale Ngày Lễ (1-Click Holiday Booster: Valentine, 8/3, Tết, Flash Sale). | **ĐÃ HOÀN THÀNH** ✅ |
| **`SHOP-09`** | **AI Florist ChatBot + RAG** | Trợ lý tư vấn "Em Ly" (Chế độ kép: Gemini 1.5 Flash API + Smart Local RAG Fallback). Bảng giới thiệu năng lực hỗ trợ, 4 nút câu hỏi nhanh, thẻ sản phẩm tương tác (Mini Cards) có nút Xem chi tiết & Thêm giỏ hàng, lưu phiên qua `sessionStorage`. | **ĐÃ HOÀN THÀNH** ✅ |

---

## 🎨 5. QUY CHUẨN GIAO DIỆN & STYLE (ZERO-AI-VIBE)
Bất kỳ AI nào code giao diện đều phải tuân thủ nghiêm ngặt file `docs/FRONTEND_RULES.md`:
* **Hình mẫu thẩm mỹ:** Lấy cảm hứng từ thương hiệu hoa cao cấp **Flower Chimp**.
* **Bảng màu:** 
  * Nền chính: Trắng tinh khiết `#FFFFFF` và Surface mềm mại `#F9FAFB`.
  * Màu chủ đạo (Primary): Xanh ngọc lục bảo Emerald `#108474`.
  * Điểm nhấn (Accent): Hồng cánh sen thanh lịch `#D9536F`.
  * Chữ: Than chì đậm `#181318`.
  * Viền: Xám nhạt `#E8E8E8`.
* **CẤM TUYỆT ĐỐI:** Màu tím dạ quang neon (`#8a2be2`, `#7c3aed`), dải màu gradient lòe loẹt, Dark Mode kiểu lập trình viên, và các emoji rẻ tiền (🚀, 🔥, 💥, 🤖, ✨). Dùng SVG line icon tinh tế.
* **Typography:** Tiêu đề dùng font Serif trang trọng (`Merriweather` / `Playfair Display`), nội dung dùng Sans-serif hiện đại (`Plus Jakarta Sans` / `Lato`).

---

## 📌 6. NGUYÊN TẮC LÀM VIỆC DÀNH CHO AI KẾ TIẾP (STRICT GUIDELINES)

1. **KHÔNG VIBE CODING Ồ ẠT:** Tuyệt đối không sinh ra một đống file phức tạp cùng lúc mà không giải thích. Phải chia nhỏ làm từng task một.
2. **DẠY HỌC & GIẢI THÍCH BẢN CHẤT:** Khi viết code, luôn giải thích "Tại sao dòng này viết thế này mà không viết thế kia". Gom các dòng liên quan thành từng Cụm logic rồi giải thích bên dưới để User dễ theo dõi.
3. **KHÔNG CODE THAY TOÀN BỘ:** Để User tự tay gõ các lệnh Git và các hàm logic quan trọng nhằm tạo phản xạ để bảo vệ đồ án.
4. **LUÔN KIỂM TRA ĐẦU RA:** Mỗi khi xong 1 task, phải có kịch bản test cụ thể (Acceptance Criteria) để nghiệm thu trước khi chuyển sang task kế tiếp.
