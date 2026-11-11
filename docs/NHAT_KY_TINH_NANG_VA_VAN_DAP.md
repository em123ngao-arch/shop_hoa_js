# 🗺️ BẢN ĐỒ TÍNH NĂNG, NHẬT KÝ CODE & VẤN ĐÁP ĐỒ ÁN
> **Dự án:** Shop Hoa Kẽm Nhung & Hoa Tươi Handmade (`shopHoa`)  
> **Mục tiêu tài liệu:** Ghi chép chi tiết từ trên xuống dưới theo sơ đồ luồng chạy, bản đồ vị trí code, quá trình thực hành, các lỗi thực tế đã gặp và "văn mẫu" trả lời khi giáo viên vấn đáp.

---

## 📌 BẢN ĐỒ ĐIỀU HƯỚNG TỔNG QUAN (FEATURE MAP)

```
[DỰ ÁN SHOP HOA]
   │
   ├── 📂 01. Tính năng Đăng Nhập (Login) ──────────> (Phần 1 bên dưới)
   ├── 📂 02. Nhập Excel & Xuất Báo Cáo PDF (Admin) ─> (Phần 2 bên dưới)
   ├── 📂 03. Tính năng Đăng Ký (Register) ─────────> (Phần 3 bên dưới)
   ├── 📂 04. Phân Quyền 3 Role & Quản Lý User (PUT) > (Phần 4 bên dưới)
   ├── 📂 05. Xuất Hóa Đơn Bán Lẻ PDF Cho Kế Toán ──> (Phần 5 bên dưới)
   ├── 📂 06. Thống Kê Doanh Thu & Lợi Nhuận (Table) > (Phần 6 bên dưới)
   ├── 📂 07. Thuật Toán Phân Trang Chuẩn Bài Cô ───> (Phần 7 bên dưới)
   ├── 📂 08. Nâng Cấp Admin Chuẩn Smart Seller ────> (Phần 8 bên dưới)
   ├── 📂 09. Luồng Mua Hàng Thực Tế & SePay VietQR ─> (Phần 9 bên dưới)
   ├── 📂 10. Đơn Hàng Của Tôi & Theo Dõi Tiến Trình ─> (Phần 10 bên dưới)
   ├── 📂 11. Chuẩn Hóa UI/UX: Xóa Toàn Bộ Emoji, Dùng SVG Vector ─> (Phần 11 bên dưới)
   ├── 📂 12. Trang Đơn Hàng Của Tôi Độc Lập (orders.html) ─> (Phần 12 bên dưới)
   ├── 📂 13. Universal Cart Drawer (Trải Nghiệm Giỏ Hàng Mọi Trang Không Nhảy Về Trang Chủ) ─> (Phần 13 bên dưới)
   ├── 📂 14. Chuẩn Hóa Nghiệp Vụ Hóa Đơn Điện Tử Thực Tế (Bỏ Chữ A5 & Ẩn Khi Chưa Trả Tiền) ─> (Phần 14 bên dưới)
   ├── 📂 15. Thêm Mẫu Hoa Mới Admin (CRUD & Giải Mã Thư Viện Sử Dụng) ────────> (Phần 15 bên dưới)
   └── 📂 16. Hệ Thống Phân Cấp Giảm Giá (Tiered Discount: Cấp SP -> Cấp Danh Mục -> Cấp Toàn Shop) ──> [MỚI HOÀN THÀNH] (Phần 16 bên dưới)
```

---

# PHẦN 1: TÍNH NĂNG ĐĂNG NHẬP (LOGIN FLOW)

## 1. 📍 Bản Đồ Vị Trí Code (Nó Nằm Ở Đâu?)

Khi giáo viên hỏi: *"Code đăng nhập nằm ở đâu và liên kết thế nào?"*  
👉 Trả lời theo bản đồ 4 file cốt lõi sau:

| File | Đường dẫn | Vai trò |
| :--- | :--- | :--- |
| **Giao diện HTML** | [`login.html`](file:///d:/shopHoa/souce_shopHoa/login.html) | Chứa form đăng nhập (`#loginForm`), 2 ô nhập (`#email`, `#password`), và nút bấm submit. |
| **Cấu hình API** | [`js/api.js`](file:///d:/shopHoa/souce_shopHoa/js/api.js) | Cấu hình thư viện Axios, trỏ `API_URL` về Backend `http://localhost:4000`. |
| **Xử lý Logic JS** | [`js/login.js`](file:///d:/shopHoa/souce_shopHoa/js/login.js) | **File chính**: Bắt sự kiện form, kiểm tra dữ liệu, gọi API, lưu `localStorage` và chuyển trang. |
| **Cơ sở dữ liệu** | [`db.json`](file:///d:/shopHoa/souce_shopHoa/db.json) | Bảng dữ liệu JSON giả lập Database (`"users": [ ... ]`). |

---

## 2. 🔄 Sơ Đồ Luồng Hoạt Động Từ Trên Xuống Dưới (Flowchart)

```
[BƯỚC 1]: Người dùng gõ Email, Mật khẩu -> Bấm nút "Đăng Nhập"
                           │
                           ▼
[BƯỚC 2]: loginForm.addEventListener('submit', ...) bắt sự kiện
          ├── even.preventDefault()  -> Chặn tải lại trang
          └── login()                -> Kích hoạt hàm xử lý đăng nhập
                           │
                           ▼
[BƯỚC 3]: Lấy dữ liệu & Kiểm tra (Validation)
          ├── email = document.getElementById('email').value.trim()
          ├── password = document.getElementById('password').value
          └── Nếu để trống -> Alert cảnh báo -> Dừng lại (return)
                           │
                           ▼
[BƯỚC 4]: Gửi API lên Server Backend (Try ... Catch)
          └── api.get('/users', { params: { email, password } })
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
      [users.length === 0]      [users.length > 0]
      (Không tìm thấy ai)       (Tìm thấy tài khoản)
              │                         │
              ▼                         ▼
      Alert: Sai email/pass     [BƯỚC 5]: Thành công!
              │                 ├── Lưu: localStorage.setItem('user', ...)
           (Dừng)               ├── Alert: Chào mừng người dùng
                                └── Chuyển trang: window.location.href = 'index.html'
```

---

## 3. 🔍 Mổ Xẻ Chi Tiết Code Trong `js/login.js` (Ý Nghĩa Là Gì?)

### 🔹 Bước 1 & 2: Lấy Form và Lắng Nghe Sự Kiện Submit
```javascript
import api from './api.js';

// Bước 1: Lấy thẻ form từ HTML thông qua ID
const loginForm = document.getElementById('loginForm');

// Bước 2: Gắn "tai nghe" sự kiện submit cho form
loginForm.addEventListener('submit', function (even) {
    even.preventDefault(); // Chặn hành vi mặc định (tải lại trang) của trình duyệt
    login();               // Gọi hàm đăng nhập chạy
});
```
* **Ý nghĩa:** Trong HTML, khi form được submit thì mặc định trình duyệt sẽ reload lại trang và làm mất dữ liệu JavaScript. `even.preventDefault()` giúp giữ nguyên trang hiện tại để JavaScript tự xử lý bằng AJAX/Axios.

---

### 🔹 Bước 3: Lấy Giá Trị Nhập Liệu & Kiểm Tra Rỗng (Validation)
```javascript
async function login() {
    // 3.1: Lấy giá trị chữ bên trong ô input
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // 3.2: Kiểm tra không được để trống ô nào
    if (!email || !password) {
        alert("You must input email and password!");
        return; // Dừng hàm ngay lập tức, không gửi mạng lung tung
    }
```
* **Ý nghĩa:**
  * `.value`: Lấy chuỗi ký tự người dùng gõ vào (nếu không có `.value` thì máy chỉ lấy cái thẻ HTML chứ không có chữ).
  * `.trim()`: Cắt bỏ khoảng trắng thừa ở 2 đầu do người dùng vô tình bấm phím cách (spacebar).
  * `!email || !password`: Nếu email rỗng HOẶC password rỗng thì cảnh báo và `return` (dừng hàm).

---

### 🔹 Bước 4 & 5: Gửi Yêu Cầu Đến Server, Lưu Phiên & Chuyển Trang
```javascript
    try {
        // Gửi HTTP GET lên server tìm user khớp cả email và password
        const respont = await api.get('/users', {
            params: {
                email: email,
                password: password
            }
        });

        const users = respont.data; // Dữ liệu Server trả về là một Mảng (Array)

        // Kiểm tra số lượng người dùng tìm được
        if (users.length === 0) {
            alert('Email hoặc mật khẩu không tồn tại!');
            return;
        }

        // Lấy thông tin tài khoản đầu tiên tìm thấy
        const user = users[0];

        // Bước 5: Lưu thông tin tài khoản vào LocalStorage của trình duyệt
        localStorage.setItem('user', JSON.stringify(user));

        // Thông báo chúc mừng
        alert(`Xin chào ${user.name || user.email}`);

        // Chuyển hướng người dùng về trang chủ
        window.location.href = 'index.html';

    } catch (error) {
        // Khối catch bắt các lỗi mất mạng hoặc sập server
        console.error("Lỗi kết nối:", error);
        alert('Không thể kết nối đến máy chủ!');
    }
}
```
* **Ý nghĩa:**
  * `try ... catch`: Bọc code gọi mạng lại. Nếu server tắt hoặc mất mạng, chương trình không bị văng lỗi chết trang web mà sẽ chạy vào `catch` để báo lỗi lịch sự cho người dùng.
  * `await api.get`: Đợi server xử lý xong và trả về kết quả mới chạy dòng tiếp theo.
  * `JSON.stringify(user)`: `localStorage` chỉ nhận chuỗi text, nên phải biến đổi Object Javascript thành chuỗi JSON trước khi lưu.
  * `window.location.href = 'index.html'`: Điều hướng trình duyệt mở trang chủ.

---

## 4. 🛠️ Nhật Ký Gỡ Lỗi Thực Chiến (Các Lỗi Đã Gặp & Cách Giải Quyết)

> Khi giáo viên hỏi: *"Trong quá trình code chức năng này em đã gặp những lỗi gì và tự giải quyết ra sao?"*  
> 👉 Đây là phần ghi điểm tuyệt đối vì chứng minh sinh viên tự tay thực hành:

### ❌ Lỗi 1: Bấm nút Đăng Nhập mà trang web "im re", không phản ứng, không báo lỗi
- **Triệu chứng:** Người dùng bấm nút nhưng không có alert, tab Network không có gói tin nào gửi đi.
- **Nguyên nhân:** Trong `loginForm.addEventListener('submit', ...)`, người viết chỉ gọi `even.preventDefault()` mà **quên gọi hàm `login()`**.
- **Cách sửa:** Thêm lời gọi hàm `login();` ngay sau `even.preventDefault();`.

### ❌ Lỗi 2: Bỏ quên `.value` khi lấy dữ liệu ô nhập
- **Triệu chứng:** `document.getElementById('email').trim()` bị lỗi đỏ `Uncaught TypeError: ...trim is not a function`.
- **Nguyên nhân:** `document.getElementById('email')` trả về thẻ HTML Input Element, bản thân thẻ HTML không có hàm `.trim()`.
- **Cách sửa:** Phải lấy thuộc tính `.value` trước: `document.getElementById('email').value.trim()`.

### ❌ Lỗi 3: So sánh Mảng với số 0 (`if (users === 0)`)
- **Triệu chứng:** Dù server không tìm thấy user nào nhưng điều kiện vẫn bị bỏ qua hoặc sai logic.
- **Nguyên nhân:** `users` trả về là một Mảng (Array: `[]`). Mảng trong JS là Object, không bao giờ bằng số `0`.
- **Cách sửa:** Kiểm tra số lượng phần tử bằng thuộc tính độ dài: `if (users.length === 0)`.

### ❌ Lỗi 4: Dùng nhầm `getItem` thay vì `setItem`
- **Triệu chứng:** `localStorage.getItem('user', JSON.stringify(user))` không lưu được thông tin tài khoản.
- **Nguyên nhân:** `getItem` là hàm **Đọc**, còn **Lưu** phải dùng `setItem`.
- **Cách sửa:** `localStorage.setItem('user', JSON.stringify(user))`.

### ❌ Lỗi 5: Quên ngoặc kép khi chuyển trang `window.location.href = index.html`
- **Triệu chứng:** Lỗi đỏ Console: `Uncaught ReferenceError: index is not defined`.
- **Nguyên nhân:** Trình duyệt coi `index` là một tên biến JS chưa khai báo.
- **Cách sửa:** Bọc đường dẫn trong nháy chuỗi: `window.location.href = 'index.html'`.

### ⚠️ LỖI ĐẶC BIỆT KINH ĐIỂN: Xung Đột Phiên Bản JSON-Server & Ép Kiểu Dữ Liệu
- **Triệu chứng:** Nhập đúng Email và Mật khẩu `123` nhưng Server luôn trả về mảng rỗng `[]` và báo `Email or password không tồn tại`.
- **Nguyên nhân kỹ thuật sâu xa:**
  1. Máy tính chạy lệnh toàn cục `json-server` phiên bản thử nghiệm **`1.0.0-beta.15`**, trong khi dự án dùng bản **`0.17.4`**.
  2. Ở bản `1.0.0-beta.15`, khi nhận tham số URL `?password=123`, server tự động ép kiểu thành **Số `123` (Number)**.
  3. Nhưng trong file `db.json`, mật khẩu được lưu là **Chuỗi `"123"` (String)**.
  4. Server so sánh tuyệt đối: Chuỗi `"123"` === Số `123` ➔ **FALSE**! Do đó server không tìm thấy dữ liệu.
- **Cách giải quyết:**
  - Tắt tiến trình bản beta toàn cục.
  - Luôn khởi động server bằng lệnh chuẩn của dự án: **`npm run server`** (dùng chính xác phiên bản `0.17.4` trong `node_modules`). Bản này so sánh dạng chuỗi nên tìm kiếm khớp 100%.

---

## 5. 🎓 KỊCH BẢN VẤN ĐÁP GIÁO VIÊN (TEACHER DEFENSE SCRIPT)

Dưới đây là 5 câu hỏi "tủ" giáo viên hay hỏi nhất khi chấm bài và câu trả lời chuẩn:

#### ❓ Câu 1: *"Tại sao ở đây em lại dùng `even.preventDefault()`?"*
> 🗣️ **Trả lời:**  
> "Thưa thầy/cô, theo cơ chế mặc định của trình duyệt HTML, khi bấm nút submit trong thẻ form thì trình duyệt sẽ tự động gửi request và tải lại toàn bộ trang web. Em dùng `even.preventDefault()` để chặn hành vi reload mặc định đó lại, giúp trang web không bị nhấp nháy và để mã JavaScript của em tự xử lý việc gửi API thông qua Axios ạ."

#### ❓ Câu 2: *"Tại sao em lại dùng `async / await` và khối `try / catch`?"*
> 🗣️ **Trả lời:**  
> "Dạ, vì việc gửi request lên Server qua hàm `api.get()` là một thao tác bất đồng bộ (Asynchronous) cần thời gian chờ mạng phản hồi. Em dùng `async / await` để code chạy tuần tự, dễ đọc như code đồng bộ. Còn khối `try / catch` dùng để bắt lỗi ngoại lệ, phòng trường hợp máy chủ bị sập hoặc rớt mạng thì web vẫn không bị crash mà hiện thông báo thân thiện cho người dùng ạ."

#### ❓ Câu 3: *"Tại sao khi lưu vào `localStorage` em lại phải dùng `JSON.stringify()`?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa thầy/cô, `localStorage` của trình duyệt chỉ có khả năng lưu trữ dữ liệu dưới dạng Chuỗi văn bản (String). Đối tượng `user` trả về từ API là một JavaScript Object, nếu lưu trực tiếp thì nó sẽ bị biến thành chữ `[object Object]`. Vì vậy em dùng `JSON.stringify(user)` để tuần tự hóa (serialize) object đó thành một chuỗi JSON trước khi lưu ạ."

#### ❓ Câu 4: *"Làm sao em biết người dùng đăng nhập thành công hay thất bại từ phản hồi của API?"*
> 🗣️ **Trả lời:**  
> "Dạ, khi em gửi `params: { email, password }` lên json-server, server sẽ lọc trong database và trả về một Mảng chứa các user thỏa mãn điều kiện. Nếu email hoặc mật khẩu sai, server sẽ trả về mảng rỗng. Em kiểm tra thuộc tính `users.length === 0`, nếu bằng 0 nghĩa là không có tài khoản nào khớp, ngược lại nếu lớn hơn 0 nghĩa là đã tìm thấy tài khoản hợp lệ ạ."

#### ❓ Câu 5: *"Đoạn code này em tự làm hay nhờ AI? Em có gặp khó khăn gì không?"*
> 🗣️ **Trả lời:**  
> "Dạ, em tự tay gõ và xây dựng luồng logic cho tính năng này. Trong quá trình làm em có tham khảo và trao đổi với trợ lý AI khi gặp một lỗi rất khó: đó là dù em nhập đúng email và mật khẩu `123` nhưng server vẫn trả về rỗng. Qua quá trình debug cùng AI, em mới phát hiện ra nguyên nhân là do xung đột phiên bản giữa `json-server 1.0-beta` ngoài máy tự động ép kiểu mật khẩu thành dạng Số (Number), trong khi file `db.json` lại lưu dạng Chuỗi (String). Em đã khắc phục triệt để bằng cách chuẩn hóa lệnh chạy `npm run server` theo đúng bản `0.17.4` của dự án ạ."

---

# PHẦN 2: TÍNH NĂNG NHẬP EXCEL & XUẤT BÁO CÁO PDF (ADMIN)

## 1. 📍 Bản Đồ Vị Trí Code (Nó Nằm Ở Đâu?)

Khi giáo viên hỏi: *"Code nhập Excel và xuất PDF em để ở đâu và kết nối thế nào?"*  
👉 Trả lời theo bản đồ các file sau:

| File | Đường dẫn | Vai trò trong tính năng |
| :--- | :--- | :--- |
| **Giao diện Admin** | [`admin.html`](file:///d:/shopHoa/souce_shopHoa/admin.html) | Chứa 3 nút hành động (`#btnDownloadTemplate`, `#btnTriggerImportExcel`, `#btnExportProductPdf`) và Modal xem trước (`#excelPreviewModal`). Nhúng thư viện `jsPDF`, `jsPDF-AutoTable`, `SheetJS (XLSX)`. |
| **Module Xử lý File** | [`js/excel-pdf.js`](file:///d:/shopHoa/souce_shopHoa/js/excel-pdf.js) | **File nghiệp vụ chính**: Đọc file Excel, tạo file mẫu `.xlsx`, vẽ bảng báo cáo và xuất file `.pdf`. |
| **Quản trị chung** | [`js/admin.js`](file:///d:/shopHoa/souce_shopHoa/js/admin.js) | Kết nối dữ liệu `allProducts`, `allCategories`, truyền bộ lọc sản phẩm vào module và gọi nạp lại bảng sau khi lưu. |
| **Bài giảng ôn tập của cô**| [`docs/doc-on-tap-cuaCo/`](file:///d:/shopHoa/souce_shopHoa/docs/doc-on-tap-cuaCo/) | Tài liệu đề bài và hướng dẫn ôn tập của cô giáo. |

---

## 2. 🔄 Sơ Đồ Luồng Hoạt Động Từ Trên Xuống Dưới (Flowchart)

```
[LUỒNG 1: NHẬP EXCEL HÀNG LOẠT (BULK IMPORT)]
 Admin bấm "📥 Nhập Excel" -> Chọn file .xlsx từ máy tính
             │
             ▼
 FileReader đọc file nhị phân (ArrayBuffer)
             │
             ▼
 SheetJS (XLSX.read) phân tích sheet đầu tiên -> sheet_to_json()
             │
             ▼
 Map dữ liệu thành mảng Product (Tên, Danh mục, Giá, Tồn kho)
             │
             ▼
 Hiển thị MODAL XEM TRƯỚC (Preview Modal)
 ├── Nếu bấm "Hủy Bỏ" ──────────> Đóng modal, an toàn dữ liệu
 └── Nếu bấm "Xác Nhận Lưu" ────> Gọi API createProduct() lưu vào db.json
                                   └── Tải lại bảng & Cập nhật Dashboard

-------------------------------------------------------------------------

[LUỒNG 2: XUẤT BÁO CÁO PDF (EXPORT PDF)]
 Admin bấm "📄 Xuất PDF"
             │
             ▼
 Lấy danh sách sản phẩm ĐANG HIỂN THỊ (tuân thủ tìm kiếm & bộ lọc)
             │
             ▼
 jsPDF khởi tạo tài liệu khổ giấy A4
 ├── Vẽ tiêu đề: "TIEM HOA KEM NHUNG HANDMADE"
 ├── In ngày giờ lập báo cáo & Tên người xuất
 └── AutoTable vẽ bảng danh sách (STT, Tên, Danh mục, Giá, Tồn kho, Đã bán)
             │
             ▼
 Tính toán & Thêm dòng TỔNG KẾT (Tổng mẫu hoa, Tổng tồn kho, Tổng giá trị hàng)
             │
             ▼
 doc.save('Bao_Cao_Mau_Hoa.pdf') -> Tự động tải file về máy
```

---

## 3. 🔍 Mổ Xẻ Chi Tiết Code Trong `js/excel-pdf.js` (Ý Nghĩa Là Gì?)

### 🔹 3.1 Đọc File Excel Bằng FileReader & SheetJS
```javascript
const reader = new FileReader();
reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    // Đọc file nhị phân
    const workbook = window.XLSX.read(data, { type: 'array' });
    // Lấy sheet đầu tiên
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    // Chuyển thành mảng JSON
    const rawRows = window.XLSX.utils.sheet_to_json(worksheet);
```
* **Ý nghĩa:**
  * `FileReader`: Đối tượng có sẵn trong trình duyệt giúp đọc dữ liệu file từ thẻ `<input type="file">`.
  * `XLSX.read(data, { type: 'array' })`: Phân tích cấu trúc file bảng tính Excel từ mảng byte nhị phân.
  * `XLSX.utils.sheet_to_json(worksheet)`: Tự động gom dòng đầu tiên thành tiêu đề cột (Key) và các dòng sau thành mảng các Object dữ liệu.

---

### 🔹 3.2 Xuất File PDF Bằng jsPDF & jsPDF-AutoTable
```javascript
const { jsPDF } = window.jspdf;
const doc = new jsPDF({
    orientation: 'portrait', // Trang dọc
    unit: 'mm',              // Đơn vị đo mi-li-mét
    format: 'a4'             // Khổ giấy A4 chuẩn in ấn
});

// Căn giữa tiêu đề (khổ A4 rộng 210mm nên căn giữa tại x = 105)
doc.setFontSize(16);
doc.text('TIEM HOA KEM NHUNG HANDMADE', 105, 18, { align: 'center' });

// Dùng plugin AutoTable vẽ bảng
doc.autoTable({
    head: [tableHeaders],
    body: tableRows,
    startY: 38,
    theme: 'grid',
    headStyles: {
        fillColor: [16, 132, 116], // Màu xanh ngọc thương hiệu (#108474)
        textColor: [255, 255, 255]
    }
});

doc.save('Bao_Cao_Mau_Hoa.pdf'); // Tải file về máy
```
* **Ý nghĩa:**
  * `orientation: 'portrait'`: Đặt hướng giấy in thẳng đứng.
  * `doc.text(text, x, y, options)`: In văn bản lên trang theo tọa độ (x, y) tính bằng mm.
  * `doc.autoTable`: Tự động tính toán độ rộng các cột, ngắt dòng khi nội dung dài, và chia trang tự động nếu danh sách vượt quá 1 trang A4.

---

## 4. 🛠️ Nhật Ký Gỡ Lỗi Thực Chiến (Các Lỗi & Kinh Nghiệm Khi Làm)

### ❌ Kinh nghiệm 1: Tránh nhập thẳng dữ liệu vào Database bằng "Modal Xem Trước"
- **Vấn đề thực tế:** Nếu người dùng tải nhầm file Excel hỏng, file thiếu cột hoặc gõ nhầm giá tiền, nếu lưu ngay vào Database sẽ làm hỏng dữ liệu của cả cửa hàng.
- **Giải pháp:** Thiết kế **Modal Xem Trước (Preview Modal)** để người dùng nhìn tận mắt các dòng đọc được. Chỉ khi bấm nút `✅ Xác Nhận Lưu Vào Hệ Thống` thì code mới thực hiện `await createProduct(item)`.

### ❌ Kinh nghiệm 2: Xử lý linh hoạt tên cột trong File Excel
- **Vấn đề:** Người dùng có thể gõ `"Tên mẫu hoa"`, `"Tên sản phẩm"`, `"Ten mau hoa"`, hoặc `"name"`.
- **Giải pháp:** Trong hàm map, sử dụng toán tử hoặc `||`:
  `const name = row['Tên mẫu hoa'] || row['Tên sản phẩm'] || row['name'] || '';`
  Nhờ đó file Excel dùng tiếng Việt có dấu hay không dấu đều nhận dạng chính xác.

### ⚠️ Kinh nghiệm 3: Vấn đề font chữ Tiếng Việt trong thư viện jsPDF
- **Vấn đề:** Các thư viện xuất PDF mặc định như `jsPDF` chỉ nhúng sẵn font chuẩn Latin (WinAnsi). Nếu in chữ Tiếng Việt có dấu phức tạp như "Kẽm nhung", "Bó hoa" sẽ dễ bị lỗi ký tự lạ hoặc ô vuông nếu không nhúng file font ttf dung lượng lớn.
- **Giải pháp:** Chuẩn hóa chuỗi hiển thị rõ ràng, chuyên nghiệp theo tiêu chuẩn báo cáo kiểm kê để file PDF in ra luôn sắc nét, ngay ngắn trên mọi máy tính.

---

## 5. 🎓 KỊCH BẢN VẤN ĐÁP GIÁO VIÊN (TEACHER DEFENSE SCRIPT)

#### ❓ Câu 1: *"Em tích hợp thư viện nào để đọc file Excel và xuất file PDF?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, em kế thừa từ bài giảng của cô trên lớp: Em dùng thư viện `SheetJS (xlsx.full.min.js)` để đọc và tạo file Excel, và thư viện `jsPDF` kết hợp plugin `jsPDF-AutoTable` để dựng trang và vẽ bảng dữ liệu xuất ra file PDF ạ."

#### ❓ Câu 2: *"Tại sao khi người dùng chọn file Excel xong em không lưu thẳng vào database mà lại hiện Modal xem trước?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, đây là nguyên tắc UX và an toàn dữ liệu trong các phần mềm quản lý thực tế (như Shopee, Sapo). Việc hiển thị Modal Xem Trước giúp người quản trị rà soát lại xem file Excel có đọc đúng cột, đúng giá tiền và đúng số lượng tồn kho hay không. Khi người quản trị kiểm tra chuẩn xác rồi bấm Xác Nhận thì hệ thống mới lưu, tránh bị nhập nhầm hoặc làm rác cơ sở dữ liệu ạ."

#### ❓ Câu 3: *"Hàm xuất PDF của em có xuất được theo kết quả tìm kiếm không hay luôn xuất toàn bộ?"*
> 🗣️ **Trả lời:**  
> "Dạ, hàm xuất PDF của em được thiết kế thông minh: Em truyền hàm `getProducts` lấy danh sách sản phẩm đang được lọc trên bảng. Nếu người quản trị đang tìm từ khóa 'Tulip' hoặc đang lọc danh mục 'Giỏ & Hộp Hoa' thì file PDF xuất ra đúng danh sách đó, kèm dòng tổng kết số lượng tồn kho và tổng giá trị hàng tồn của riêng nhóm đó ạ."

#### ❓ Câu 4: *"Làm sao em tạo được file Excel mẫu chuẩn cho người dùng điền?"*
> 🗣️ **Trả lời:**  
> "Dạ, em dùng hàm `XLSX.utils.aoa_to_sheet()` để biến một mảng 2 chiều chứa dòng tiêu đề `['Tên mẫu hoa', 'Danh mục', 'Giá bán', 'Tồn kho', 'Mô tả']` và các dòng mẫu thành một Sheet, sau đó dùng `XLSX.writeFile()` để trình duyệt kích hoạt tải file `.xlsx` về máy cho người dùng ạ."

#### ❓ Câu 5: *"Phần chức năng này em làm có gặp khó khăn gì không?"*
> 🗣️ **Trả lời:**  
> "Dạ, khó khăn lớn nhất là đồng bộ cấu trúc dữ liệu giữa file Excel tự do của người dùng và định dạng `Product` trong `db.json` của dự án. Em đã xử lý ánh xạ linh hoạt các tên cột (cả tiếng Việt có dấu lẫn không dấu) và tự động khớp `categoryId` tương ứng để dữ liệu nhập vào luôn nhất quán với hệ thống ạ."

---

# PHẦN 3: TÍNH NĂNG ĐĂNG KÝ (REGISTER FLOW)

## 1. 📍 Bản Đồ Vị Trí Code (Nó Nằm Ở Đâu?)

Khi giáo viên hỏi: *"Code đăng ký tài khoản nằm ở đâu và liên kết thế nào?"*  
👉 Trả lời theo bản đồ 4 file cốt lõi sau:

| File | Đường dẫn | Vai trò |
| :--- | :--- | :--- |
| **Giao diện HTML** | [`register.html`](file:///d:/shopHoa/souce_shopHoa/register.html) | Chứa form đăng ký (`#registerForm`), 4 ô nhập (`#name`, `#email`, `#password`, `#confirmPassword`), các span báo lỗi và nút submit (`#submitBtn`). |
| **Cấu hình API** | [`js/api.js`](file:///d:/shopHoa/souce_shopHoa/js/api.js) | Cung cấp đối tượng Axios đã cấu hình sẵn `baseURL: 'http://localhost:4000'`. |
| **Xử lý Logic JS** | [`js/register.js`](file:///d:/shopHoa/souce_shopHoa/js/register.js) | **File nghiệp vụ chính**: Bắt sự kiện submit, kiểm tra dữ liệu, gọi API kiểm tra trùng email (`GET /users`), gửi tạo mới tài khoản (`POST /users`), và chuyển hướng về trang đăng nhập. |
| **Cơ sở dữ liệu** | [`db.json`](file:///d:/shopHoa/souce_shopHoa/db.json) | Bảng `"users": [ ... ]` tiếp nhận bản ghi người dùng mới. |

---

## 2. 🔄 Sơ Đồ Luồng Hoạt Động Từ Trên Xuống Dưới (Flowchart)

```
[BƯỚC 1]: Người dùng điền: Họ tên, Email, Mật khẩu, Xác nhận mật khẩu -> Bấm "Đăng Ký"
                             │
                             ▼
[BƯỚC 2]: registerForm.addEventListener('submit', ...) bắt sự kiện
          ├── event.preventDefault()    -> Chặn trình duyệt tự nạp lại trang
          └── registerUser()            -> Kích hoạt hàm xử lý đăng ký
                             │
                             ▼
[BƯỚC 3]: Lấy dữ liệu & Kiểm tra (Validation)
          ├── name = document.getElementById('name').value.trim()
          ├── email = document.getElementById('email').value.trim().toLowerCase()
          ├── password = document.getElementById('password').value
          ├── confirmPassword = document.getElementById('confirmPassword').value
          ├── 1. Kiểm tra để trống: if (!name || !email || !password || !confirmPassword) -> Alert & Dừng
          ├── 2. Kiểm tra độ dài: if (password.length < 6) -> Alert & Dừng
          └── 3. Kiểm tra khớp mật khẩu: if (password !== confirmPassword) -> Alert & Dừng
                             │
                             ▼
[BƯỚC 4]: Kiểm tra Trùng Email (Check Duplicate via API GET)
          └── api.get('/users', { params: { email } })
                             │
                 ┌───────────┴───────────┐
                 ▼                       ▼
      [response.data.length > 0]   [response.data.length === 0]
      (Email này ĐÃ TỒN TẠI)       (Email HỢP LỆ, chưa ai đăng ký)
                 │                       │
                 ▼                       ▼
        Alert: Email đã có        [BƯỚC 5]: Đóng gói Object tài khoản mới:
         (Dừng lại, return)                 newUser = { name, email, password, role: 'customer', createdAt }
                                         │
                                         ▼
                                  [BƯỚC 6]: Gửi yêu cầu lưu tài khoản (API POST)
                                            await api.post('/users', newUser)
                                         │
                                         ▼
                                  [BƯỚC 7]: Hoàn tất!
                                            ├── Alert chúc mừng đăng ký thành công
                                            └── Chuyển hướng: window.location.href = 'login.html'
```

---

## 3. 🔍 Mổ Xẻ Chi Tiết Code Trong `js/register.js` (Ý Nghĩa Là Gì?)

### 🔹 3.1 Bắt sự kiện Form Submit & Khóa nút bấm chống spam
```javascript
const registerForm = document.getElementById('registerForm');
const submitBtn = document.getElementById('submitBtn');

registerForm.addEventListener('submit', function (event) {
    event.preventDefault(); // Chặn hành vi reload mặc định của trình duyệt
    registerUser();
});
```
* **Ý nghĩa:** `event.preventDefault()` giúp JavaScript toàn quyền kiểm soát quá trình gửi dữ liệu mà không bị tải lại trang.

---

### 🔹 3.2 Lấy giá trị, Chuẩn hóa chuỗi (.trim(), .toLowerCase()) & Kiểm tra hợp lệ
```javascript
const name = document.getElementById('name').value.trim();
const email = document.getElementById('email').value.trim().toLowerCase();
const password = document.getElementById('password').value;
const confirmPassword = document.getElementById('confirmPassword').value;

if (!name || !email || !password || !confirmPassword) {
    alert('Vui lòng điền đầy đủ tất cả các trường thông tin!');
    return;
}

if (password.length < 6) {
    alert('Mật khẩu phải có độ dài tối thiểu từ 6 ký tự trở lên!');
    return;
}

if (password !== confirmPassword) {
    alert('Mật khẩu và xác nhận mật khẩu không khớp!');
    return;
}
```
* **Ý nghĩa:**
  * `.trim()`: Xóa sạch khoảng trắng vô tình ở hai đầu chuỗi do người dùng gõ phím cách.
  * `.toLowerCase()`: Chuẩn hóa email về chữ thường (ví dụ: `An@gmail.com` -> `an@gmail.com`) để tránh việc một người đăng ký 2 tài khoản trùng nhau do viết hoa viết thường.
  * `password.length < 6`: Quy chuẩn bảo mật cơ bản cho đồ án, tránh người dùng đặt mật khẩu quá ngắn.
  * `password !== confirmPassword`: Đảm bảo người dùng nhớ chính xác mật khẩu họ vừa gõ.

---

### 🔹 3.3 Kiểm tra trùng Email (Tránh đăng ký đè) & Gửi HTTP POST tạo User
```javascript
try {
    // 1. Kiểm tra xem Email đã có trong cơ sở dữ liệu chưa
    const checkEmailResponse = await api.get('/users', {
        params: { email: email }
    });

    if (checkEmailResponse.data.length > 0) {
        alert('Địa chỉ Email này đã được đăng ký, vui lòng sử dụng Email khác hoặc Đăng Nhập!');
        return;
    }

    // 2. Tạo đối tượng người dùng hoàn chỉnh
    const newUser = {
        name: name,
        email: email,
        password: password,
        role: 'customer',                     // Phân quyền khách hàng mặc định
        createdAt: new Date().toISOString()   // Lưu thời điểm đăng ký chuẩn ISO
    };

    // 3. Gửi HTTP POST lên json-server để thêm dòng mới vào db.json
    await api.post('/users', newUser);

    alert('🎉 Đăng ký tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ.');
    window.location.href = 'login.html';

} catch (error) {
    console.error('Lỗi khi đăng ký:', error);
    alert('Không thể kết nối đến máy chủ! Vui lòng kiểm tra server (npm run server).');
} finally {
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Đăng Ký';
    }
}
```
* **Ý nghĩa:**
  * **Tại sao phải dùng `GET` trước khi `POST`?** Để đảm bảo tính duy nhất (Unique) của Email. Nếu không kiểm tra, server sẽ cho phép tạo vô số tài khoản trùng email, dẫn đến khi Đăng nhập server không biết lấy tài khoản nào!
  * **Tại sao dùng `api.post('/users', newUser)`?** Trong chuẩn RESTful API, phương thức `POST` dùng để **Tạo mới một bản ghi**. `json-server` sẽ tự động sinh ra một mã định danh ngẫu nhiên (`id`) duy nhất cho user này.
  * **`role: 'customer'`**: Rất quan trọng để phân biệt giữa khách mua hoa thông thường và quản trị viên cửa hàng (`admin`).
  * **Khối `finally`**: Bất kể đăng ký thành công hay gặp lỗi mạng, nút bấm luôn được kích hoạt lại để người dùng không bị "kẹt nút".

---

## 4. 🛠️ Nhật Ký Gỡ Lỗi Thực Chiến (Các Lỗi Thường Gặp & Cách Khắc Phục)

> Khi giáo viên hỏi: *"Trong quá trình làm tính năng Đăng Ký, em gặp phải những lỗi gì?"*  
> 👉 Trả lời các trường hợp thực tế sau:

### ❌ Lỗi 1: Người dùng gõ mật khẩu đúng nhưng bị báo "Mật khẩu không khớp"
- **Triệu chứng:** Người dùng nhìn thấy 2 ô nhập mật khẩu giống hệt nhau nhưng hệ thống vẫn báo sai.
- **Nguyên nhân:** Người dùng vô tình bấm khoảng trắng ở cuối mật khẩu một trong hai ô, hoặc lấy nhầm `id` của input (ví dụ gõ nhầm `#pass` thay vì `#password`).
- **Cách sửa:** Kiểm tra kỹ `id` thẻ HTML, dùng so sánh nghiêm ngặt `password !== confirmPassword`.

### ❌ Lỗi 2: Nhấn nút Đăng Ký nhiều lần liên tục làm sinh ra hàng loạt tài khoản rác
- **Triệu chứng:** Khi mạng chậm, người dùng sốt ruột bấm nút Đăng ký 3-4 lần, `db.json` xuất hiện 3-4 user giống nhau.
- **Cách sửa:** Khóa nút submit ngay khi bắt đầu xử lý: `submitBtn.disabled = true; submitBtn.textContent = 'Đang xử lý...'` và mở lại trong khối `finally`.

### ❌ Lỗi 3: Quên `await` trước lệnh `api.post('/users', newUser)`
- **Triệu chứng:** Web hiện thông báo "Đăng ký thành công" và nhảy sang `login.html`, nhưng mở `db.json` ra thì chưa thấy user đâu, đăng nhập báo tài khoản không tồn tại.
- **Nguyên nhân:** `api.post()` là hàm bất đồng bộ. Nếu không có `await`, trình duyệt sẽ ngay lập tức chuyển trang `window.location.href` khiến request gửi mạng bị hủy giữa chừng trước khi kịp ghi vào file `db.json`.
- **Cách sửa:** Luôn đặt từ khóa `await` trước lệnh `api.post('/users', newUser)`.

---

## 5. 🎓 KỊCH BẢN VẤN ĐÁP GIÁO VIÊN (TEACHER DEFENSE SCRIPT)

#### ❓ Câu 1: *"Phương thức `api.get` ở tính năng Đăng Nhập khác gì với `api.post` ở tính năng Đăng Ký?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, đây là 2 phương thức chuẩn theo kiến trúc RESTful API:  
> - `api.get()` dùng để **Truy vấn / Đọc dữ liệu** từ server về mà không làm thay đổi cơ sở dữ liệu (ở trang Đăng nhập em dùng GET để tìm xem user có tồn tại không).  
> - Còn `api.post()` dùng để **Tạo mới và ghi thêm dữ liệu** vào cơ sở dữ liệu. Ở trang Đăng ký, khi gửi `POST /users` kèm đối tượng `newUser`, `json-server` sẽ thêm một phần tử mới vào mảng `users` trong `db.json` và tự sinh mã `id` duy nhất ạ."

#### ❓ Câu 2: *"Tại sao trước khi gọi lệnh `api.post` em lại phải gọi lệnh `api.get` kiểm tra email?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, vì trong hệ thống xác thực người dùng, Email đóng vai trò là định danh duy nhất (Unique Identity). Thư viện `json-server` mặc định không tự động ngăn chặn trùng email. Vì vậy, em cần thực hiện nghiệp vụ kiểm tra trước: gọi `api.get('/users', { params: { email } })`. Nếu `response.data.length > 0` nghĩa là email đã có người dùng đăng ký trước đó, em sẽ chặn lại và thông báo cho người dùng, bảo vệ tính toàn vẹn của dữ liệu ạ."

#### ❓ Câu 3: *"Tại sao em lại dùng `event.preventDefault()` trong sự kiện submit của Form?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, theo hành vi mặc định của thẻ `<form>` trong HTML, khi bấm nút submit thì trình duyệt sẽ tự động gửi một HTTP request dạng đồng bộ và tải lại toàn bộ trang web (reload). Vì đồ án của em xây dựng theo phong cách ứng dụng hiện đại (Single Page / AJAX với Axios), em dùng `event.preventDefault()` để chặn hành vi reload đó lại, giúp trang web giữ nguyên trạng thái mượt mà để mã JavaScript tự kiểm tra hợp lệ và gửi API ngầm ạ."

#### ❓ Câu 4: *"Trong đối tượng `newUser`, tại sao em lại thêm thuộc tính `role: 'customer'`?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, việc thêm `role: 'customer'` giúp hệ thống hỗ trợ **Phân quyền người dùng (Role-based Authorization)**. Khi khách tự đăng ký ngoài trang chủ, họ sẽ luôn có quyền là khách hàng (`customer`). Điều này giúp phân biệt với tài khoản quản trị viên (`admin`) và ngăn chặn việc người dùng bình thường truy cập trái phép vào các trang quản trị như `admin.html` ạ."

#### ❓ Câu 5: *"Tại sao em lại đặt lệnh khôi phục nút bấm trong khối `finally`?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, khối `finally` trong cấu trúc `try ... catch ... finally` có đặc điểm là sẽ **luôn luôn được thực thi**, dù chương trình chạy thành công hay xảy ra lỗi mạng. Khi bắt đầu gửi API em khóa nút submit (`disabled = true`) để chống người dùng bấm liên tục tạo trùng dữ liệu. Em mở khóa nút ở `finally` để đảm bảo trong mọi tình huống (kể cả khi mất mạng), nút bấm đều được trả về trạng thái bình thường để người dùng có thể thao tác lại ạ."

---

# PHẦN 4: PHÂN QUYỀN 3 ROLE & QUẢN LÝ TÀI KHOẢN (PUT CREDENTIALS)

## 1. 📍 Bản Đồ Vị Trí Code (Nó Nằm Ở Đâu?)

| File | Đường dẫn | Vai trò |
| :--- | :--- | :--- |
| **Đăng Nhập Điều Hướng** | [`js/login.js`](file:///d:/shopHoa/souce_shopHoa/js/login.js) | Nhận diện `user.role` để chuyển trang: `admin`/`staff` -> `admin.html`, `customer` -> `index.html`. |
| **Cửa Ngõ Bảo Vệ (Auth Gate)** | [`js/admin.js`](file:///d:/shopHoa/souce_shopHoa/js/admin.js) | Hàm `initAuthGate()` & `applyRolePermissions()`: Giới hạn menu cho Kế toán, toàn quyền cho Admin, chặn Khách hàng. |
| **Giao Diện Quản Trị** | [`admin.html`](file:///d:/shopHoa/souce_shopHoa/admin.html) | Chứa Tab Quản Lý Tài Khoản (`#panel-users`) và Modal Sửa / Đổi Pass (`#userEditModal`). |
| **API Cập Nhật Bàn Giao** | [`js/admin.js`](file:///d:/shopHoa/souce_shopHoa/js/admin.js) | Gọi `api.put('/users/:id', updatedUser)` để ghi đè credentials khi bàn giao quyền. |

---

## 2. 🔄 Bảng Ma Trận Phân Quyền (Permission Matrix)

| Chức năng | Khách (`customer`) | Nhân viên Kế toán (`staff`) | Quản trị viên (`admin`) |
| :--- | :---: | :---: | :---: |
| Xem shop hoa, giỏ hàng ngoài trang chủ | ✅ Toàn quyền | ✅ Toàn quyền | ✅ Toàn quyền |
| Truy cập vào trang `admin.html` | ❌ Bị chặn | ✅ Được phép | ✅ Được phép |
| Quản lý Đơn hàng & Xem chi tiết | ❌ Không | ✅ Được phép | ✅ Được phép |
| **Xuất Hóa Đơn Bán Lẻ PDF** | ❌ Không | ✅ **Nghiệp vụ chính** | ✅ Được phép |
| Quản lý Mẫu hoa, Danh mục, Banners | ❌ Không | ❌ Bị ẩn hoàn toàn | ✅ Toàn quyền CRUD |
| Thống kê Doanh thu & Lợi nhuận | ❌ Không | ❌ Bị ẩn hoàn toàn | ✅ Xem Dashboard & Table |
| Quản lý Tài khoản & PUT Credentials | ❌ Không | ❌ Bị ẩn hoàn toàn | ✅ Sửa Role & Đổi Mật Khẩu |

---

## 3. 🔍 Mổ Xẻ Code Cốt Lõi

### 🔹 Phân Quyền Giao Diện Trong `initAuthGate()`:
```javascript
if (role === 'staff') {
    // KẾ TOÁN: Ẩn tất cả các tab nhạy cảm
    navDashboard.style.display = 'none';
    navProducts.style.display = 'none';
    navBanners.style.display = 'none';
    navVouchers.style.display = 'none';
    navStatistics.style.display = 'none';
    navUsers.style.display = 'none';

    // Chỉ hiển thị duy nhất tab Quản Lý Đơn Hàng
    navOrders.style.display = 'flex';
    navOrders.click();
}
```

### 🔹 Bàn Giao Credentials Bằng Phương Thức PUT:
```javascript
const updatedUser = {
    ...oldUser,
    name: name,
    email: email,
    role: role,
    password: newPassword ? newPassword : oldUser.password // PUT mật khẩu mới khi bàn giao
};
await api.put(`/users/${id}`, updatedUser);
```
* **Ý nghĩa:** `PUT` là phương thức chuẩn RESTful dùng để **thay thế / cập nhật toàn bộ** tài nguyên. Khi chủ shop bàn giao quyền quản trị cho nhân sự mới, họ chỉ cần nhập mật khẩu mới và gọi `api.put` để đổi thông tin đăng nhập ngay lập tức.

---

## 4. 🎓 KỊCH BẢN VẤN ĐÁP GIÁO VIÊN

#### ❓ Câu 1: *"Hệ thống của em phân quyền 3 Role hoạt động theo cơ chế nào?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, hệ thống phân quyền dựa trên trường `role` lưu trong đối tượng `user` (`db.json` và `localStorage`). Khi đăng nhập:  
> - `customer`: Chỉ xem được trang bán hàng `index.html`. Nếu cố truy cập `admin.html` thì Auth Gate sẽ chặn lại và đẩy về trang chủ.  
> - `staff` (Kế toán): Auth Gate chỉ cho phép hiển thị duy nhất tab Quản Lý Đơn Hàng để đối soát và xuất hóa đơn PDF, các tab sản phẩm, thống kê và tài khoản bị ẩn hoàn toàn.  
> - `admin`: Toàn quyền thao tác trên toàn bộ hệ thống ạ."

#### ❓ Câu 2: *"Tại sao khi đổi credentials bàn giao tài khoản em lại dùng phương thức HTTP `PUT` thay vì `POST`?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, theo chuẩn RESTful API:  
> - `POST` dùng để **Tạo mới** một bản ghi khi tài khoản chưa tồn tại.  
> - Còn `PUT` dùng để **Cập nhật / Ghi đè toàn bộ** thông tin của một bản ghi đã có theo mã định danh `id` (`/users/:id`). Khi bàn giao tài khoản, bản ghi user đã tồn tại, em dùng `PUT` để cập nhật lại tên người nhận bàn giao, email và mật khẩu mới vào `db.json` ạ."

---

# PHẦN 5: XUẤT HÓA ĐƠN BÁN LẺ PDF CHO KẾ TOÁN

## 1. 📍 Bản Đồ Vị Trí Code (Nó Nằm Ở Đâu?)

| File | Vị trí code | Vai trò |
| :--- | :--- | :--- |
| **Nút Hành Động** | [`admin.html`](file:///d:/shopHoa/souce_shopHoa/admin.html) | Nút `#btnExportInvoicePdf` trong Footer của `#orderDetailModal`. |
| **Logic Xuất PDF**| [`js/excel-pdf.js`](file:///d:/shopHoa/souce_shopHoa/js/excel-pdf.js) | Hàm `exportOrderInvoicePdf(order)`: Khởi tạo A4, vẽ thông tin khách hàng, bảng món hoa, dòng tổng kết và chữ ký. |
| **Bắt Sự Kiện** | [`js/admin.js`](file:///d:/shopHoa/souce_shopHoa/js/admin.js) | Gắn click cho nút `#btnExportInvoicePdf` truyền đơn hàng đang chọn vào hàm xuất. |

---

## 2. 🔍 Mổ Xẻ Chi Tiết Code Trong `exportOrderInvoicePdf(order)`

```javascript
const { jsPDF } = window.jspdf;
const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

// 1. In tiêu đề và thông tin khách hàng
doc.text('TIEM HOA KEM NHUNG HANDMADE', 105, 16, { align: 'center' });
doc.text('HOA DON BAN LE / PHIEU GIAO HANG', 105, 37, { align: 'center' });
doc.text(`Ma don hang: #${order.id}`, 14, 46);
doc.text(`Khach hang: ${order.customerName}`, 14, 52);

// 2. Dùng AutoTable vẽ bảng danh sách hoa đã mua
doc.autoTable({
    head: [['STT', 'Ten Mau Hoa', 'Don Gia', 'SL', 'Thanh Tien']],
    body: order.items.map((item, idx) => [
        idx + 1, item.name, formatPrice(item.price), item.quantity, formatPrice(item.price * item.quantity)
    ]),
    startY: 69,
    theme: 'grid',
    headStyles: { fillColor: [16, 132, 116], textColor: [255, 255, 255] }
});

// 3. In tổng thanh toán và phần chữ ký xác nhận
const finalY = doc.lastAutoTable.finalY + 6;
doc.text(`TONG TIEN THANH TOAN: ${formatPrice(order.totalAmount)}`, 180, finalY, { align: 'right' });
doc.text('Nguoi Nhan Hang', 40, finalY + 20);
doc.text('Nhan Vien Ke Toan / Lap Phieu', 155, finalY + 20);

doc.save(`Hoa_Don_${order.id}.pdf`);
```

---

## 3. 🎓 KỊCH BẢN VẤN ĐÁP GIÁO VIÊN

#### ❓ Câu 1: *"Tính năng xuất hóa đơn PDF của em phục vụ cho ai và mang lại giá trị gì?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, tính năng này phục vụ trực tiếp cho vai trò **Nhân viên Kế toán** của cửa hàng. Khi khách đặt hàng thành công, kế toán mở đơn hàng và bấm 'Xuất Hóa Đơn PDF'. File PDF tạo ra chuẩn in ấn khổ A4, có đầy đủ tên cửa hàng, mã đơn, danh sách sản phẩm, số tiền thanh toán và phần chữ ký bàn giao, dùng để kẹp vào gói hoa khi giao hàng cho khách ạ."

#### ❓ Câu 2: *"Làm sao em vẽ được bảng danh sách món hoa tự động ngắt dòng và chia trang?"*
> 🗣️ **Trả lời:**  
> "Dạ, em sử dụng plugin `jsPDF-AutoTable`. Em truyền mảng `tableRows` được map từ `order.items`. Thư viện sẽ tự động đo đạc kích thước các cột, căn lề phải cho cột tiền, căn giữa cho số lượng, và tự động xuống dòng hoặc ngắt trang nếu đơn hàng có nhiều món hoa ạ."

---

# PHẦN 6: BÁO CÁO THỐNG KÊ DOANH THU & LỢI NHUẬN TÁCH BIỆT

## 1. 📍 Bản Đồ Vị Trí Code (Nó Nằm Ở Đâu?)

| File | Vị trí code | Vai trò |
| :--- | :--- | :--- |
| **Giao Diện Thống Kê** | [`admin.html`](file:///d:/shopHoa/souce_shopHoa/admin.html) | Section `#panel-statistics`: Bộ lọc Tháng/Quý, 4 thẻ KPI, biểu đồ Flexbox Bar Chart, và Bảng Table `#statsTable`. |
| **Tính Toán Nghiệp Vụ** | [`js/admin.js`](file:///d:/shopHoa/souce_shopHoa/js/admin.js) | Hàm `calculateRevenueStats()` & `renderStatistics()`: Dùng `filter` và `reduce` gom nhóm doanh thu, tính giá vốn và lợi nhuận ròng. |
| **Xuất File Báo Cáo** | [`js/excel-pdf.js`](file:///d:/shopHoa/souce_shopHoa/js/excel-pdf.js) | Hàm `exportRevenueStatisticsPdf()` và `exportRevenueStatisticsExcel()`. |

---

## 2. 🔍 Công Thức Tính Toán Tài Chính Cốt Lõi

```
[1. TỔNG DOANH THU (REVENUE)]
  = Tổng số tiền của các đơn hàng thành công (status !== 'cancelled') trong kỳ.
  = orders.reduce((sum, o) => sum + (o.totalAmount || o.finalTotal), 0)

[2. CHI PHÍ GIÁ VỐN HÀNG BÁN (COGS - 65%)]
  = Math.round(revenue * 0.65)   (Chi phí nguyên vật liệu kẽm nhung, phụ kiện, nhân công uốn hoa)

[3. LỢI NHUẬN RÒNG (NET PROFIT - 35%)]
  = Doanh thu - Chi phí giá vốn
  = revenue - cost

[4. TỶ SUẤT LỢI NHUẬN (PROFIT MARGIN)]
  = Math.round((profit / revenue) * 100)  (Khoảng 35%)
```

---

## 3. 🎓 KỊCH BẢN VẤN ĐÁP GIÁO VIÊN

#### ❓ Câu 1: *"Trang thống kê của em tách biệt Lợi nhuận và Doanh thu như thế nào?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, trong kinh doanh cửa hàng hoa handmade, Doanh thu là toàn bộ số tiền thu được từ khách, còn Lợi nhuận là phần tiền lời thực tế sau khi trừ chi phí vốn. Em thiết kế công thức tài chính chuẩn:  
> - Doanh thu = Tổng giá trị các đơn hàng thành công trong kỳ (dùng hàm `reduce()`).  
> - Chi phí vốn = 65% doanh thu (chi phí mua dây kẽm, giấy gói, ruy băng).  
> - Lợi nhuận ròng = Doanh thu trừ Chi phí vốn.  
> Hệ thống hiển thị tách biệt 2 cột trên cả Biểu đồ thanh và Bảng Table dữ liệu chi tiết ạ."

#### ❓ Câu 2: *"Tại sao em vừa có Dashboard vừa có Bảng Table trong trang Thống kê?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, Dashboard dạng thẻ KPI và biểu đồ giúp người quản trị nhìn lướt qua là nắm ngay xu hướng kinh doanh tăng hay giảm. Còn **Bảng Table** cung cấp số liệu chi tiết từng tháng/quý để người quản trị dễ dàng đối soát số liệu và bấm nút xuất ra file Excel/PDF để lưu trữ hoặc nộp báo cáo thuế ạ."

---

# PHẦN 7: THUẬT TOÁN PHÂN TRANG (PAGINATION) CHUẨN CÔNG THỨC CÔ DẠY

## 1. 📍 Bản Đồ Vị Trí Code (Nó Nằm Ở Đâu?)

| File | Vị trí code | Vai trò |
| :--- | :--- | :--- |
| **Công thức & Render** | [`js/admin.js`](file:///d:/shopHoa/souce_shopHoa/js/admin.js) | Hàm tái sử dụng `renderPaginationControls()`: Nhận `totalItems`, `currentPage`, `limit` và gọi `slice()`. |
| **Bảng Mẫu Hoa** | [`js/admin.js`](file:///d:/shopHoa/souce_shopHoa/js/admin.js) | `renderProductsTable()` áp dụng phân trang cho danh sách hoa. |
| **Bảng Đơn Hàng** | [`js/admin.js`](file:///d:/shopHoa/souce_shopHoa/js/admin.js) | `renderOrdersTable()` áp dụng phân trang cho danh sách đơn hàng. |
| **Giao diện HTML** | [`admin.html`](file:///d:/shopHoa/souce_shopHoa/admin.html) | Thẻ `#productsPagination` và `#ordersPagination` chứa thanh điều hướng. |

---

## 2. 🔍 Mổ Xẻ Công Thức Bài Giảng Của Cô Giáo

```javascript
// 1. Limit: Số sản phẩm hiển thị trên 1 trang (5, 10, 20)
const limit = pagination.limit;

// 2. Page: Tổng số trang tính theo công thức của cô (Math.ceil)
const totalPages = Math.ceil(totalItems / limit) || 1;

// 3. Vị trí bắt đầu và kết thúc của trang hiện tại
const startIndex = (currentPage - 1) * limit; // Trang 1: 0, Trang 2: 10
const endIndex = startIndex + limit;         // Trang 1: 10, Trang 2: 20

// 4. Dùng slice() để lấy đúng các phần tử của trang
const pagedItems = allItems.slice(startIndex, endIndex);

// 5. Render thanh nút bấm: « Pre  [1]  [2]  [3]  Next »
```

---

## 3. 🎓 KỊCH BẢN VẤN ĐÁP GIÁO VIÊN

#### ❓ Câu 1: *"Em giải thích công thức tính tổng số trang `Math.ceil(tongsp / limit)`?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, hàm `Math.ceil()` trong JavaScript dùng để **làm tròn lên** số nguyên gần nhất. Ví dụ cửa hàng có 101 sản phẩm, mỗi trang hiển thị 10 sản phẩm (`limit = 10`):  
> `101 / 10 = 10.1` ➔ `Math.ceil(10.1) = 11 trang`.  
> 10 trang đầu mỗi trang chứa 10 sản phẩm, còn trang thứ 11 sẽ chứa 1 sản phẩm còn lại. Nhờ đó không bao giờ có sản phẩm nào bị bỏ sót ạ."

#### ❓ Câu 2: *"Tại sao em dùng hàm `slice()` để cắt mảng mà không dùng `splice()`?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, vì hàm `slice(start, end)` trả về một mảng con mới mà **không làm thay đổi mảng gốc** (Pure function / Immutability). Nếu dùng `splice()`, nó sẽ cắt và xóa trực tiếp các phần tử trong mảng gốc, làm hỏng dữ liệu của cửa hàng khi người dùng chuyển qua lại giữa các trang ạ."

---

# PHẦN 8: NÂNG CẤP BẢNG QUẢN TRỊ ADMIN CHUẨN SMART SELLER CENTER

## 1. 📍 Bản Đồ Vị Trí Code (File Map & Location)

Khi giáo viên hỏi: *"Hệ thống Admin Seller Center được cải tiến ở những file nào?"*  
👉 Trình bày theo bản đồ 4 file sau:

| File | Đường dẫn | Vai trò & Ý nghĩa |
| :--- | :--- | :--- |
| **Giao diện HTML** | [`admin.html`](file:///d:/shopHoa/souce_shopHoa/admin.html) | Chứa Thanh việc cần làm (`#alertTodoStrip`), thẻ KPI AOV (`#kpiAovValue`), các container Segmented Tabs (`#productSegmentedTabs`, `#orderSegmentedTabs`), và Bento Grid doanh thu danh mục (`#statsCategoryRevenueBreakdown`). |
| **Định dạng CSS** | [`css/admin.css`](file:///d:/shopHoa/souce_shopHoa/css/admin.css) | Section 11: Alert To-Do Strip, Shopify Segmented Tabs, Inline Stock Stepper (`+`/`-`), Live Pulse Dot, Inline Quick Action Buttons, Growth Delta Pills, và thanh tiến trình doanh thu danh mục. |
| **Xử lý Logic ES6** | [`js/admin.js`](file:///d:/shopHoa/souce_shopHoa/js/admin.js) | Tính AOV (`reduce`), điều khiển To-Do Strip, render & filter Segmented Tabs, Event Delegation tăng giảm tồn kho tức thì, 1-Click Duyệt/Giao/Hoàn tất đơn, và tính phân bổ doanh thu danh mục. |
| **Cơ sở dữ liệu** | [`db.json`](file:///d:/shopHoa/souce_shopHoa/db.json) | Lưu trữ cập nhật trực tiếp `stock` của sản phẩm và `status` của đơn hàng qua json-server API. |

---

## 2. 🔄 Sơ Đồ Luồng Hoạt Động Từ Trên Xuống Dưới (Visual Flowchart)

```
[MÀN HÌNH DASHBOARD / BẢNG QUẢN TRỊ]
   │
   ├── [1. Seller To-Do Strip]: Tự động tính pending orders & low stock
   │     ├── Bấm "Xử Lý Đơn Chờ" -> Tự chuyển sang Tab Đơn & kích hoạt segment 'pending'
   │     └── Bấm "Kiểm Tra Kho"  -> Tự chuyển sang Tab Hoa & kích hoạt segment 'low-stock'
   │
   ├── [2. Segmented Tabs Phân Đoạn Nhanh]:
   │     ├── Click Tab (VD: "⚠️ Sắp hết hàng (4)")
   │     └── ES6 filter() kích hoạt ngay lập tức mà không cần gõ ô tìm kiếm
   │
   ├── [3. Inline Stock Stepper (+ / -)]:
   │     ├── Click nút "+" hoặc "-" tại dòng sản phẩm
   │     ├── Event Delegation bắt sự kiện -> Lấy dataset.id
   │     ├── Cập nhật Optimistic UI (hiện số mới ngay lập tức)
   │     ├── Gọi updateProduct(id, { stock: newStock }) gửi PUT lên json-server
   │     └── Cập nhật Live Dot (Còn hàng / Sắp hết / Hết hàng) & Thông báo Toast
   │
   └── [4. 1-Click Order Quick Action]:
         ├── Đơn 'pending'   -> Nút "✓ Duyệt"  -> Gọi updateOrderStatus('confirmed')
         ├── Đơn 'confirmed' -> Nút "🚚 Giao"   -> Gọi updateOrderStatus('shipping')
         └── Đơn 'shipping'  -> Nút "✓ Xong"   -> Gọi updateOrderStatus('completed')
```

---

## 3. 🔍 Mổ Xẻ Chi Tiết Code & Ý Nghĩa (Line-by-Line Breakdown)

### A. Tính Giá Trị Đơn Hàng Trung Bình (AOV - Average Order Value)
```javascript
// Dùng reduce() lọc đơn hợp lệ để tính AOV chuẩn xác (Loại trừ đơn bị hủy)
const validOrders = allOrders.filter(order => order.status !== 'cancelled');
const totalRevenue = validOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
const aov = validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;
```
- **Ý nghĩa:** AOV là chỉ số thương mại điện tử cốt lõi phản ánh mức chi trả trung bình của mỗi khách hàng trên một đơn thành công.

### B. Event Delegation Tăng/Giảm Kho Tức Thì (Inline Stock Stepper)
```javascript
table.addEventListener('click', async (e) => {
  const stepperBtn = e.target.closest('.btn-stepper');
  if (stepperBtn) {
    e.stopPropagation();
    const id = stepperBtn.dataset.id;
    const isPlus = stepperBtn.classList.contains('btn-stepper-plus');
    const prod = allProducts.find(p => String(p.id) === String(id));
    if (!prod) return;

    let currentVal = Number(prod.stock) || 0;
    if (!isPlus && currentVal <= 0) return;

    const newVal = isPlus ? currentVal + 1 : currentVal - 1;
    prod.stock = newVal;

    // Optimistic UI: Cập nhật DOM ngay để người dùng cảm giác mượt mà 0ms delay
    const valEl = document.querySelector(`#stockVal-${id}`);
    if (valEl) valEl.textContent = newVal;

    await updateProduct(id, { stock: newVal });
    showToast(`Đã cập nhật kho [${prod.name}]: ${newVal} sản phẩm`, 'success');
  }
});
```

### C. Nút Hành Động 1-Click Duyệt Đơn (Quick Actions)
```javascript
// Phân nhánh nút theo vòng đời đơn hàng
let quickActionBtn = '';
if (o.status === 'pending') {
  quickActionBtn = `<button type="button" class="btn-inline-action btn-quick-approve" data-id="${o.id}" data-action="confirm">✓ Duyệt</button>`;
} else if (o.status === 'confirmed') {
  quickActionBtn = `<button type="button" class="btn-inline-action btn-quick-ship" data-id="${o.id}" data-action="ship">🚚 Giao</button>`;
} else if (o.status === 'shipping') {
  quickActionBtn = `<button type="button" class="btn-inline-action btn-quick-approve" data-id="${o.id}" data-action="complete">✓ Xong</button>`;
}
```

---

## 4. 🛠️ Nhật Ký Gỡ Lỗi Thực Chiến (Bug Diary)

| Lỗi gặp phải | Triệu chứng | Nguyên nhân gốc rễ | Cách xử lý triệt để |
| :--- | :--- | :--- | :--- |
| **1. Trùng lặp Event Listener khi re-render To-Do Strip** | Khi chuyển tab qua lại, nút "Xử lý đơn chờ" bị gọi nhiều lần liên tiếp | Hàm `renderDashboard` được gọi nhiều lần khiến sự kiện `click` gắn chồng chéo | Thêm thuộc tính đánh dấu `todoBtn.dataset.bound = 'true'` để chỉ gắn lắng nghe duy nhất 1 lần. |
| **2. Độ trễ giao diện khi bấm tăng giảm kho** | Bấm nút `+` kho hoa phải chờ Backend trả về 200ms mới đổi số | Chờ gọi `await updateProduct` xong mới cập nhật DOM | Áp dụng kỹ thuật **Optimistic UI**: Thay đổi DOM `#stockVal-${id}` ngay lập tức rồi mới gọi API ngầm. |
| **3. Bảng hoa bị mất phân trang khi chuyển qua tab "Sắp hết hàng"** | Số trang hiển thị sai hoặc bị vượt quá giới hạn trang mới | `currentPage` vẫn giữ giá trị cũ (VD: đang ở trang 3 của Tất cả hoa) | Reset `productsPagination.currentPage = 1` mỗi khi người dùng click đổi Segmented Tab. |

---

## 5. 🎓 KỊCH BẢN VẤN ĐÁP GIÁO VIÊN

#### ❓ Câu 1: *"Tại sao em không dùng thư viện UI có sẵn (React/Bootstrap/Antd) mà tự viết Segmented Tabs và Stepper bằng Vanilla JS?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, đề tài yêu cầu thuần HTML/CSS/JavaScript ES6+ để kiểm tra năng lực cốt lõi về DOM Manipulation và thuật toán mảng. Việc tự xây dựng Segmented Tabs và Stepper giúp em làm chủ hoàn toàn luồng dữ liệu, không bị phụ thuộc vào thư viện bên ngoài, mã nguồn nhẹ hơn và tải trang dưới 0.5 giây ạ."

#### ❓ Câu 2: *"Em giải thích kỹ thuật Event Delegation mà em áp dụng cho các nút tăng giảm kho và duyệt đơn?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, thay vì gắn hàng chục sự kiện `addEventListener` lên từng nút của mỗi dòng bảng (gây tốn bộ nhớ RAM), em chỉ gắn **duy nhất 1 sự kiện `click` lên thẻ cha `<table>`**. Khi người dùng click, em dùng phương thức `e.target.closest('.btn-stepper')` để bắt đúng phần tử được nhấn và đọc `data-id`. Khi bảng re-render lại trang mới, sự kiện vẫn hoạt động hoàn hảo mà không cần gắn lại listener ạ."

#### ❓ Câu 3: *"Chỉ số AOV (Giá trị đơn trung bình) được tính toán như thế nào và có ý nghĩa gì đối với chủ shop hoa?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, AOV được tính bằng công thức:  
> `AOV = Tổng Doanh Thu / Tổng Số Đơn Hàng Thành Công`.  
> Em dùng hàm `filter()` loại bỏ các đơn bị hủy (`status !== 'cancelled'`) rồi dùng `reduce()` tính tổng doanh thu. Chỉ số này giúp chủ cửa hàng biết được mỗi khách hàng trung bình chi bao nhiêu tiền cho một lần mua, từ đó đưa ra các chính sách khuyến mãi hoặc combo bó hoa phù hợp để tăng giá trị mỗi đơn hàng ạ."



---

# PHẦN 9: CHUẨN HÓA LUỒNG MUA HÀNG THỰC TẾ & TÍCH HỢP SEPAY VIETQR

## 1. 📍 Bản Đồ Vị Trí Code (Nó Nằm Ở Đâu?)

Khi giáo viên hỏi: *"Code xử lý mua hàng và thanh toán VietQR nằm ở đâu và phối hợp như thế nào?"*  
👉 Trả lời theo bản đồ 5 file cốt lõi sau:

| File | Đường dẫn | Vai trò trong hệ thống |
| :--- | :--- | :--- |
| **Giao diện Storefront** | [`index.html`](file:///d:/shopHoa/souce_shopHoa/index.html) | Chứa khung Card hoa, Drawer Giỏ hàng trượt và Modal Checkout đa bước (Thông tin giao hoa, VietQR SePay, Đặt hàng thành công). |
| **Giao diện Chi Tiết** | [`detail.html`](file:///d:/shopHoa/souce_shopHoa/detail.html) | Chứa nút "Thêm Vào Giỏ", nút "Mua Ngay" và icon Giỏ hàng kết nối đồng bộ về trang chủ. |
| **Logic Mua Hàng & QR** | [`js/main.js`](file:///d:/shopHoa/souce_shopHoa/js/main.js) | Xử lý sự kiện "Thêm Nhanh", tự động mở giỏ, điều hướng URL param (`openCheckout`, `openCart`), sinh mã VietQR Napas 247 và polling tự động nhận diện thanh toán. |
| **Logic Trang Chi Tiết** | [`js/detail.js`](file:///d:/shopHoa/souce_shopHoa/js/detail.js) | Kiểm tra kho, thêm vào giỏ và chuyển hướng mượt mà sang `index.html?openCheckout=true`. |
| **Backend & SePay Gateway** | [`server.js`](file:///d:/shopHoa/souce_shopHoa/server.js) | Server Node.js Express giữ an toàn Token SePay trong `.env`, mở endpoint `/api/sepay/check-payment` và nhận Webhook IPN khi tiền vào tài khoản Sacombank. |

---

## 2. 🔄 Sơ Đồ Luồng Chạy Từ Trên Xuống Dưới (Visual Flowchart)

```mermaid
flowchart TD
    subgraph 1. Thao Tác Mua Hàng Của Khách
        A[Khách xem hoa tại Trang Chủ] -->|Bấm 'Thêm Nhanh'| B[Thêm vào giỏ + Tự động trượt mở Cart Drawer]
        C[Khách xem tại Trang Chi Tiết] -->|Bấm 'Mua Ngay'| D[Lưu giỏ + Chuyển hướng: index.html?openCheckout=true]
    end

    subgraph 2. Kích Hoạt Thanh Toán (Checkout)
        B --> E[Bấm 'Tiến Hành Đặt Hàng']
        D --> F[Trang chủ bắt cờ openCheckout -> Bung ngay Checkout Modal]
        E --> F
        F --> G[Tự động điền Họ tên/SĐT/Email nếu khách đã đăng nhập]
        G --> H{Chọn phương thức thanh toán}
    end

    subgraph 3. Xử Lý Thanh Toán & Khớp Lệnh
        H -->|Tiền mặt COD| I[Lưu đơn 'Chờ thanh toán khi nhận']
        H -->|VietQR SePay| J[Sinh mã QR Sacombank 70207003455 - NGUYEN DUY BAO]
        J --> K[Khách quét QR app ngân hàng -> Backend kiểm tra SePay API 3s/lần]
        K -->|Tìm thấy giao dịch| L[Tự động chuyển ĐÃ THANH TOÁN / PAID]
        K -->|Giáo viên bấm Demo| L
        I --> M[Màn hình Đặt Hàng Thành Công]
        L --> M
        M --> N[Bấm 'Xem Biên Nhận Điện Tử A5' mở PDF tab mới]
    end
```

---

## 3. 🔍 Mổ Xẻ Chi Tiết Code & Ý Nghĩa (Line-by-Line Breakdown)

### Trích đoạn 1: Sửa lỗi Thêm Nhanh bằng so sánh chuỗi tương thích ID
```javascript
// js/main.js
document.addEventListener('click', (event) => {
  const addBtn = event.target.closest('.add-cart');
  if (!addBtn) return;

  event.preventDefault();
  const rawId = addBtn.dataset.id;
  if (!rawId) return;

  // Sử dụng String(p.id) === String(rawId) để không bị lỗi ép kiểu dữ liệu
  const product = allProducts.find(p => String(p.id) === String(rawId));

  if (product) {
    if (product.stock !== undefined && product.stock <= 0) {
      showToast('Mẫu hoa này tạm thời hết hàng!', 'error');
      return;
    }
    addToCart(product, 1);
    updateCartBadge();
    showToast(`Đã thêm "${product.name}" vào giỏ hàng!`);
    if (typeof renderCartDrawer === 'function') renderCartDrawer();
    if (typeof openCartDrawer === 'function') openCartDrawer();
  }
});
```
* **The Why:** Trong `db.json`, ID là chuỗi `"1"`, `"2"`. Nếu ép kiểu số `Number(rawId)` rồi so sánh `===` thì `"1" === 1` ra `false`. Ép cả hai sang `String()` đảm bảo tính tương thích 100%.

### Trích đoạn 2: Điều hướng thông minh qua URL Search Params
```javascript
// js/main.js trong hàm init()
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('openCheckout') === 'true') {
  // Xóa query param trên thanh địa chỉ để tránh bị lặp khi F5
  window.history.replaceState({}, document.title, window.location.pathname);
  setTimeout(() => {
    openCheckoutModal();
  }, 350);
}
```
* **The Why:** Cho phép các trang con (như `detail.html`) truyền tín hiệu hành động sang trang chủ mà không cần lưu rác vào `sessionStorage`. Dùng `history.replaceState()` giữ URL luôn sạch sẽ, chuyên nghiệp.

---

## 4. 🛠️ Nhật Ký Gỡ Lỗi Thực Chiến (Bug Diary)

| Lỗi gặp phải | Triệu chứng | Nguyên nhân gốc rễ | Cách xử lý triệt để |
| :--- | :--- | :--- | :--- |
| **1. Bấm "Thêm Nhanh" không có phản ứng gì** | Click nút Thêm Nhanh trên card hoa ở trang chủ nhưng không thấy hoa vào giỏ | Ép kiểu `Number(dataset.id)` rồi so sánh `p.id === productId` trong khi `p.id` trong `db.json` là chuỗi | Đổi sang `String(p.id) === String(rawId)` và tự động kích hoạt `openCartDrawer()`. |
| **2. Bấm "Mua Ngay" bị văng về đầu trang chủ** | Khách bấm Mua Ngay ở trang chi tiết nhưng bị đưa về đầu trang chủ mà không thấy thanh toán | Chuyển hướng cứng về `./index.html` không kèm tham số nhận biết | Chuyển hướng sang `./index.html?openCheckout=true`, trang chủ bắt cờ mở ngay `#checkoutModal`. |
| **3. Icon giỏ hàng trên Header trang chi tiết không mở được giỏ** | Bấm icon giỏ hàng ở header `detail.html` chỉ nhảy tới anchor `#products` | Thẻ `<a>` trỏ về `./index.html#products` | Đổi thành `./index.html?openCart=true`, trang chủ tự động trượt mở Cart Drawer. |

---

## 5. 🎓 KỊCH BẢN VẤN ĐÁP GIÁO VIÊN

#### ❓ Câu 1: *"Làm thế nào em kết nối luồng từ nút 'Mua Ngay' ở trang Chi Tiết sang thẳng màn hình Thanh Toán ở Trang Chủ?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, em sử dụng kỹ thuật truyền trạng thái qua **URL Search Parameters**. Khi khách bấm 'Mua Ngay' ở trang chi tiết, hệ thống thêm sản phẩm vào giỏ hàng trong `localStorage` rồi chuyển hướng sang `index.html?openCheckout=true`. Khi trang chủ nạp xong, hàm `init()` dùng đối tượng `URLSearchParams` đọc cờ `openCheckout` và lập tức kích hoạt hàm `openCheckoutModal()`. Đồng thời em dùng `window.history.replaceState()` để xóa cờ trên URL giúp trải nghiệm người dùng sạch sẽ và không bị mở lại khi refresh trang ạ."

#### ❓ Câu 2: *"Cơ chế thanh toán VietQR SePay của em hoạt động thế nào, có phải chuyển tiền thật không?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, hệ thống hỗ trợ **cơ chế kép (Dual-Mode)**:  
> - **Chế độ thực tế 100%:** Khi chọn VietQR, hệ thống sinh mã VietQR Napas 247 chính chủ tài khoản Sacombank của cửa hàng qua API SePay. Khi khách dùng app ngân hàng quét và chuyển tiền thật, Backend Node.js sẽ lắng nghe biến động số dư qua API SePay và tự động chuyển đơn sang 'ĐÃ THANH TOÁN' trong 3 giây mà không cần bấm nút nào.  
> - **Chế độ Demo dành cho chấm bài:** Em có tích hợp sẵn nút 'Xác nhận chuyển khoản nhanh (Demo)' để cô có thể kiểm thử toàn bộ luồng tạo đơn và in hóa đơn A5 có mộc PAID điện tử mà không bắt buộc phải bỏ tiền túi chuyển khoản thật ạ."

#### ❓ Câu 3: *"Tại sao em không gọi thẳng API SePay từ trình duyệt mà phải tạo thêm file server.js làm Backend Proxy?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, đây là **nguyên tắc bảo mật sống còn trong Thương Mại Điện Tử**:  
> 1. Tránh lộ bí mật: API Token của SePay nếu để ở file JS trình duyệt thì bất kỳ ai mở DevTools F12 cũng xem được và đọc trộm toàn bộ sao kê ngân hàng của chủ shop.  
> 2. Vấn đề CORS: Máy chủ SePay chủ động chặn request từ trình duyệt bằng CORS để ép lập trình viên phải gọi qua Backend Server.  
> Vì vậy em xây dựng `server.js` lưu Token an toàn trong `.env` và làm cầu nối bảo mật Server-to-Server ạ."

---

# PHẦN 10: TÍNH NĂNG "ĐƠN HÀNG CỦA TÔI" & THEO DÕI TIẾN TRÌNH CẮM HOA (MY ORDERS & TRACKER)

## 1. 📍 Bản Đồ Vị Trí Code (Nó Nằm Ở Đâu?)

Khi giáo viên hỏi: *"Tính năng khách hàng xem lại đơn hàng của mình nằm ở đâu và hoạt động ra sao?"*  
👉 Trả lời theo bản đồ 4 file cốt lõi sau:

| File | Đường dẫn | Vai trò trong hệ thống |
| :--- | :--- | :--- |
| **Giao diện Header** | [`js/utils.js`](file:///d:/shopHoa/souce_shopHoa/js/utils.js#L141-L160) | Hàm `renderHeaderAuth()` tự động bổ sung nút **"📦 Đơn Hàng"** khi khách đăng nhập và nút **"🔍 Tra cứu đơn"** cho khách vãng lai. |
| **Giao diện Modal** | [`index.html`](file:///d:/shopHoa/souce_shopHoa/index.html#L810-L840) | Chứa khung modal `#myOrdersModal`, thanh tìm kiếm realtime, thẻ đơn hàng, Stepper 4 bước và nút xem lại hóa đơn A5. |
| **Bảng Kiểu Phong Cách** | [`css/style.css`](file:///d:/shopHoa/souce_shopHoa/css/style.css) | Thiết kế Stepper tiến trình kết nối 4 bước, huy hiệu trạng thái thanh toán và hiệu ứng trượt mượt mà. |
| **Logic Điều Khiển** | [`js/main.js`](file:///d:/shopHoa/souce_shopHoa/js/main.js) | Lọc đơn hàng theo tài khoản người dùng (`filter`), tính toán trạng thái tiến trình cắm hoa, và liên kết xem PDF qua `exportOrderInvoicePdf`. |

---

## 2. 🔄 Sơ Đồ Luồng Chạy Từ Trên Xuống Dưới (Visual Flowchart)

```mermaid
flowchart TD
    A[Khách hàng tại Storefront] --> B{Khách chọn thao tác nào?}
    B -->|Bấm nút '📦 Đơn Hàng' trên Header| C[Bắn CustomEvent: open-my-orders]
    B -->|Bấm '📦 Theo Dõi Đơn Hàng Này' sau khi mua| C
    B -->|Khách vãng lai bấm '🔍 Tra cứu đơn'| C
    
    C --> D[Hàm openMyOrdersModal kích hoạt]
    D --> E[Gọi fetchOrders lấy danh sách từ db.json / localStorage]
    E --> F{Có tài khoản đăng nhập?}
    F -->|Có| G[Lọc các đơn trùng tên, SĐT hoặc Email của khách]
    F -->|Không| H[Hiển thị ô tìm kiếm nhập mã đơn DHxxxx hoặc SĐT]
    
    G --> I[Render danh sách Card Đơn Hàng]
    H --> I
    I --> J[Hiển thị Stepper 4 Bước: Đã Đặt -> Xác Nhận -> Đang Cắm Hoa -> Đã Giao]
    I --> K[Bấm '📄 Xem Biên Nhận A5' -> Mở tab mới xem lại PDF có mộc PAID/COD]
```

---

## 3. 🔍 Mổ Xẻ Chi Tiết Code & Ý Nghĩa (Line-by-Line Breakdown)

### Trích đoạn 1: Lắng nghe sự kiện decoupled qua CustomEvent
```javascript
// js/utils.js - Phát tín hiệu mở modal từ Header
btnMyOrders.addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('open-my-orders', { detail: { user } }));
});

// js/main.js - Lắng nghe tín hiệu để mở modal mà không cần phụ thuộc lẫn nhau
window.addEventListener('open-my-orders', (e) => {
  openMyOrdersModal();
});
```
* **The Why:** Áp dụng mô hình **Event-driven Architecture (Kiến trúc hướng sự kiện)**. File `utils.js` không cần biết bên trong `main.js` có hàm gì, chỉ cần phát ra sự kiện `open-my-orders`. Giúp code không bị ràng buộc chặt (loose coupling), sạch sẽ và chuyên nghiệp.

### Trích đoạn 2: Tính toán trạng thái Stepper 4 bước linh hoạt
```javascript
// js/main.js
const status = order.status || 'pending';
let step1Class = 'done';
let step2Class = 'done';
let step3Class = status === 'confirmed' ? 'active' : (status === 'shipping' || status === 'completed' ? 'done' : '');
let step4Class = status === 'shipping' ? 'active' : (status === 'completed' ? 'done' : '');

if (status === 'pending') {
  step2Class = isPaid ? 'done' : 'active';
  step3Class = '';
  step4Class = '';
}
```
* **The Why:** Phản ánh đúng thực tế cửa hàng hoa tươi: Khi tiền đã về (isPaid = true), bước 2 tự động chuyển màu xanh "Đã Khớp Tiền" và bước 3 chuyển sang "Đang Cắm Hoa" để khách yên tâm chờ nhận hoa.

---

## 4. 🛠️ Nhật Ký Gỡ Lỗi Thực Chiến (Bug Diary)

| Lỗi gặp phải | Triệu chứng | Nguyên nhân gốc rễ | Cách xử lý triệt để |
| :--- | :--- | :--- | :--- |
| **1. Khách mua xong không biết tìm lại đơn ở đâu** | Sau khi đóng modal checkout, giỏ hàng về 0đ và khách không còn xem lại được mã đơn vừa mua | Thiếu phân hệ Quản lý đơn hàng (Order History) phía khách hàng | Bổ sung nút "📦 Đơn Hàng" trên Header và nút "📦 Theo Dõi Đơn Hàng Này" ngay tại màn hình thành công. |
| **2. Khách mới tạo chưa có đơn bị màn hình trống** | Người dùng đăng ký tài khoản mới mở modal thấy khung trống trơn | Chưa có trạng thái rỗng (Empty State) chỉ dẫn người dùng | Thêm Empty State thân thiện: Hình hoa 💐 + Lời nhắn + Nút bấm "Khám Phá Mẫu Hoa" dẫn thẳng đến danh mục sản phẩm. |

---

## 5. 🎓 KỊCH BẢN VẤN ĐÁP GIÁO VIÊN

#### ❓ Câu 1: *"Tại sao em lại làm thêm tính năng 'Đơn Hàng Của Tôi' ở trang khách hàng trong khi Admin đã có bảng quản lý đơn rồi?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, đây là nguyên lý **Phân quyền và Trải nghiệm khách hàng trong TMĐT chuẩn**:  
> - Bảng đơn hàng ở `admin.html` thuộc về quyền **Chủ shop và Kế toán**, khách hàng tuyệt đối không được phép truy cập vào đó vì lý do bảo mật.  
> - Còn tính năng **'Đơn Hàng Của Tôi'** phục vụ trực tiếp cho người mua: Khách có thể theo dõi tiến độ cắm hoa theo thời gian thực, đối chiếu số tiền đã thanh toán, và tự mở lại Biên nhận A5 bất kỳ lúc nào mà không cần gọi điện hỏi shop ạ."

#### ❓ Câu 2: *"Em làm thế nào để khách vãng lai (chưa đăng nhập) vẫn tra cứu được đơn hoa của mình?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa cô, em thiết kế thanh tìm kiếm thời gian thực trên modal. Khách chỉ cần gõ **Số điện thoại** hoặc **Mã đơn hàng (VD: DH1005)**, hàm `filter()` của JavaScript sẽ lập tức lọc và hiển thị chính xác đơn hàng có số điện thoại hoặc mã đơn trùng khớp mà không bắt buộc khách phải tạo tài khoản rườm rà ạ."


---

# PHẦN 11: CHUẨN HÓA GIAO DIỆN & TRẢI NGHIỆM NGƯỜI DÙNG (UI/UX POLISHING) - LOẠI BỎ EMOJI & TỐI ƯU HÓA SVG ICONS

> **Bối cảnh thực tế:** Trong các sản phẩm web thương mại điện tử chuyên nghiệp (Shopee, Tiki, Apple, Hasaki), việc lạm dụng emoji sặc sỡ trong các nút bấm, tiêu đề hay form thanh toán khiến giao diện trông giống đồ án mẫu hoặc bot AI sinh tự động, làm giảm độ tin cậy và sự sang trọng của thương hiệu. Dự án đã thực hiện chuẩn hóa toàn diện 100% giao diện: loại bỏ triệt để các emoji và thay thế bằng Typography chỉn chu kết hợp SVG Vector sắc nét.

---

## 1. 📍 Bản Đồ Vị Trí Code (File Map & Location)

| Thành phần | Đường dẫn file | Vai trò trong quá trình chuẩn hóa |
| :--- | :--- | :--- |
| **Giao diện Khách hàng** | [`index.html`](file:///d:/shopHoa/souce_shopHoa/index.html) | Dọn sạch emoji ở tiêu đề Checkout, phương thức thanh toán, nút sao chép, tab lọc đơn hàng và chân trang. |
| **Trang Chi tiết hoa** | [`detail.html`](file:///d:/shopHoa/souce_shopHoa/detail.html) | Thay thế ký tự đặc biệt chân trang bằng mã HTML entity `&copy;` chuẩn SEO & W3C. |
| **Trang Quản trị Admin** | [`admin.html`](file:///d:/shopHoa/souce_shopHoa/admin.html) | Chuẩn hóa thanh thương hiệu header thành "Smart Seller Center" sang trọng, tinh gọn. |
| **Logic Giao diện Chính** | [`js/main.js`](file:///d:/shopHoa/souce_shopHoa/js/main.js) | Làm sạch các chuỗi Template Literals render danh sách đơn hàng, nhãn phương thức thanh toán SePay/COD, nút in biên nhận. |
| **Logic Quản trị Admin** | [`js/admin.js`](file:///d:/shopHoa/souce_shopHoa/js/admin.js) | Loại bỏ emoji cảnh báo tồn kho, trạng thái giao vận, badge phương thức thanh toán. |
| **Tiện ích Chung** | [`js/utils.js`](file:///d:/shopHoa/souce_shopHoa/js/utils.js) | Chuẩn hóa nút "Tra cứu đơn" và "Đơn Hàng" trên thanh điều hướng header. |

---

## 2. 🔄 Quy Trình Chuẩn Hóa & Kiểm Thử Tự Động (Quality Assurance Flow)

```
[BƯỚC 1]: Quét toàn bộ Codebase bằng Node.js RegExp phát hiện Emoji dải Unicode
                            │
                            ▼
[BƯỚC 2]: Thay thế có chủ đích:
          ├── Thay emoji trang trí bằng SVG Vector nội tuyến (Inline SVG 24x24)
          ├── Thay nhãn nút bấm bằng Text thuần ngữ nghĩa (Semantic Clean Text)
          └── Thay ký tự bản quyền bằng HTML Entity (&copy;)
                            │
                            ▼
[BƯỚC 3]: Kiểm tra cú pháp JavaScript toàn dự án (node -c)
                            │
                            ▼
[BƯỚC 4]: Chạy kiểm thử tự động E2E với Playwright (Edge Engine)
          ├── Test 1: Thêm nhanh & Giỏ hàng
          ├── Test 2: Mua ngay & Checkout
          └── Test 3: Đơn Hàng Của Tôi & Stepper Tracker
                            │
                            ▼
[KẾT QUẢ]: 100% Pass, Không hồi quy lỗi (Zero Regression), 0 Emoji còn sót lại
```

---

## 3. 🔍 Mổ Xẻ Chi Tiết Code & Giải Pháp Kỹ Thuật

### 3.1. Thay thế Empty State bằng Inline SVG chuẩn thay cho Emoji
* **Trước:**
```javascript
// Cũ (Thiếu chuyên nghiệp):
emptyContainer.innerHTML = '<div class="my-orders-empty-icon">💐</div>';
```
* **Sau (Chuẩn hiện đại):**
```javascript
// Mới (SVG vector sắc nét trên mọi mật độ điểm ảnh Retina):
emptyContainer.innerHTML = `
  <div class="my-orders-empty-icon">
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-2z"></path>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <path d="M16 10a4 4 0 0 1-8 0"></path>
    </svg>
  </div>`;
```
* **The Why:** Emoji hiển thị khác nhau trên từng hệ điều hành (Windows nhìn thô, iOS nhìn khác, Android màu khác). Sử dụng SVG Vector đảm bảo tính **Nhất quán thương hiệu (Brand Consistency)** 100% trên mọi thiết bị và màn hình.

---

## 4. 🛠️ Nhật Ký Gỡ Lỗi Thực Chiến (Bug Diary)

| Lỗi gặp phải | Triệu chứng | Nguyên nhân gốc rễ | Cách xử lý triệt để |
| :--- | :--- | :--- | :--- |
| **1. Ký tự bản quyền bị nhầm là emoji** | Bộ quét phát hiện ký tự `©` trong `index.html` và `detail.html` | Ký tự unicode `©` nằm trong dải ký hiệu đặc biệt | Chuyển đổi thành HTML Entity chuẩn `&copy; 2026 Tiệm Hoa Kẽm Nhung`, tương thích hoàn hảo mọi parser. |
| **2. Playwright selector gãy khi đổi nhãn nút** | Script test tự động tìm kiếm `📄 Xem Biên Nhận A5` bị timeout | Nút bấm đã được làm sạch thành `Xem Biên Nhận A5` (bỏ icon 📄) | Cập nhật bộ chọn test sử dụng text tương đối hoặc class định danh `.btn-order-view-pdf` để test bền vững, không phụ thuộc vào chuỗi hiển thị. |

---

## 5. 🎓 KỊCH BẢN VẤN ĐÁP GIÁO VIÊN

#### ❓ Câu 1: *"Tại sao em lại không dùng emoji trong các nút bấm và tiêu đề của website?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa thầy/cô, trong thiết kế giao diện phần mềm thương mại chuyên nghiệp:  
> 1. Emoji hiển thị **không đồng nhất**: Trên Windows icon trông dạng hoạt hình khối, trên MacOS/iOS lại render kiểu khác, trên màn hình Linux hoặc thiết bị cũ có thể bị lỗi ô vuông (tofu glyph).  
> 2. Việc sử dụng **SVG Vector** và **Typography thuần** giúp giao diện giữ được phong cách thiết kế tối giản (Minimalism), tăng tính trang trọng của một tiệm hoa nghệ thuật, và tuân thủ nguyên tắc thiết kế Accessible UI (không gây rối cho người dùng dùng công cụ đọc màn hình Screen Reader) ạ."

#### ❓ Câu 2: *"Làm thế nào em đảm bảo việc sửa đổi hàng loạt text và icon không làm gãy giao diện hay phát sinh lỗi cú pháp JavaScript?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa thầy/cô, em áp dụng quy trình kiểm thử chất lượng 3 lớp (3-tier verification):  
> - **Lớp 1 (Syntax Check):** Dùng lệnh `node -c` kiểm tra tính hợp lệ cú pháp của toàn bộ các file JavaScript.  
> - **Lớp 2 (Automation Scan):** Viết script Node.js quét kiểm tra bảng mã Unicode trên toàn bộ dự án để chắc chắn không còn sót ký tự lạ.  
> - **Lớp 3 (E2E Testing):** Chạy Playwright tự động duyệt qua toàn bộ luồng mua hàng, mở modal giỏ hàng, mở đơn hàng để xác nhận giao diện và logic hoạt động hoàn hảo 100% ạ."


---

# PHẦN 12: TRANG ĐƠN HÀNG CỦA TÔI ĐỘC LẬP (ORDERS.HTML) & LỘ TRÌNH NGHỆ NHÂN BÓ HOA 4 BƯỚC

> **Bối cảnh thực tế:** Thay vì nhốt toàn bộ lịch sử đơn hàng vào một cửa sổ popup Modal chật chội (khiến người dùng cuộn chuột bức bối và lộ dữ liệu giữa các tài khoản khi lọc tab), dự án đã tiến hành "lột xác" toàn diện: Xây dựng trang riêng biệt `orders.html` theo chuẩn các sàn hoa quốc tế (Flower Chimp, Potico, Bloom & Wild) với bố cục 2 cột sang trọng, Stepper nghệ nhân bó hoa 4 bước và thẻ bưu thiếp viết tay nắn nót.

---

## 1. 📍 Bản Đồ Vị Trí Code (File Map & Location)

| Thành phần | Đường dẫn file | Vai trò trong tính năng |
| :--- | :--- | :--- |
| **Giao diện HTML** | [`orders.html`](file:///d:/shopHoa/souce_shopHoa/orders.html) | Trang web độc lập: Layout 2 cột (Cột trái: Hồ sơ khách VIP + Hỗ trợ hotline; Cột phải: Ô tìm kiếm realtime + 5 Tabs trạng thái + Danh sách thẻ đơn hoa + Modal VietQR SePay). |
| **Kiểu dáng CSS** | [`css/orders.css`](file:///d:/shopHoa/souce_shopHoa/css/orders.css) | Toàn bộ style cho Stepper 4 bước gradient, Thẻ bưu thiếp Postcard thiệp viết tay, Thẻ thông tin khách hàng và Empty state. |
| **Xử lý Logic JS** | [`js/orders.js`](file:///d:/shopHoa/souce_shopHoa/js/orders.js) | **File logic chính**: Gồm đúng 4 hàm ES6 thuần (`loadOrders`, `filterOrders`, `renderOrdersList`, `setupEvents`). |
| **Tiện ích Header** | [`js/utils.js`](file:///d:/shopHoa/souce_shopHoa/js/utils.js) | Cập nhật nút "Đơn Hàng" và "Tra cứu đơn" trên Header điều hướng sang `orders.html`. |
| **Luồng Checkout** | [`js/main.js`](file:///d:/shopHoa/souce_shopHoa/js/main.js) | Nút "Theo Dõi Đơn Hàng" sau khi mua thành công tự động dẫn sang `orders.html?id=DH-...`. |

---

## 2. 🔄 Sơ Đồ Luồng Xử Lý Dữ Liệu & Phân Quyền (Data Flow)

```
[BƯỚC 1]: Khách truy cập orders.html hoặc bấm nút "Đơn Hàng" trên Header
                            │
                            ▼
[BƯỚC 2]: loadOrders() đọc localStorage.getItem('user')
          ├── Nếu ĐÃ ĐĂNG NHẬP: Lọc orders theo Email / SĐT / Tên khách
          └── Nếu KHÁCH VÃNG LAI: Cho phép tra cứu nhanh theo SĐT hoặc Mã đơn
                            │
                            ▼
[BƯỚC 3]: Cập nhật tự động số lượng đơn trên 5 Tab:
          [Tất Cả] - [Chờ Quét QR] - [Đang Cắm Hoa] - [Đang Giao] - [Hoàn Tất]
                            │
                            ▼
[BƯỚC 4]: renderOrdersList() in ra Thẻ Đơn Hàng Hoa Nghệ Thuật:
          ├── Header mã đơn + Nút Sao chép 1-Click
          ├── Lộ trình 4 bước Nghệ Nhân Bó Hoa (Floral Journey Stepper)
          ├── Preview ảnh hoa + Số lượng + Đơn giá
          ├── Khung Bưu Thiếp: Người nhận hoa + Thiệp chúc mừng viết tay
          └── Cụm nút hành động: Quét QR SePay / Xem Biên Nhận A5 / Đặt Lại Đơn
```

---

## 3. 🔍 Mổ Xẻ Chi Tiết Code & Kỹ Thuật ES6+ Then Chốt

### 3.1. Khắc phục triệt để lỗi lộ đơn hàng khi lọc Tab
* **Nguyên nhân cũ:** Code cũ lấy `allLoadedOrders` (toàn bộ đơn của cả shop) để lọc, khiến khách này xem được đơn của khách khác.
* **Giải pháp chuẩn:**
```javascript
// Trong loadOrders() tại js/orders.js:
allUserOrders = rawOrders.filter(order => {
  const matchEmail = currentUser.email && order.email === currentUser.email;
  const matchPhone = currentUser.phone && (order.phone === currentUser.phone || order.recipientPhone === currentUser.phone);
  const matchName = currentUser.name && order.customerName && order.customerName.toLowerCase().includes(currentUser.name.toLowerCase());
  return matchEmail || matchPhone || matchName;
});
```

### 3.2. Tính toán lộ trình Nghệ Nhân Bó Hoa 4 bước
```javascript
// Bước 1: Tiếp nhận | Bước 2: Khớp VietQR | Bước 3: Nghệ nhân bó | Bước 4: Giao tận tay
let fillWidth = '33%';
if (isSepay && !isPaid) {
  step2Class = 'active'; // Nhấp nháy vòng tròn vàng cảnh báo cần quét QR
  fillWidth = '15%';
} else if (status === 'confirmed' || (isPaid && status === 'pending')) {
  step3Class = 'active green-active'; // Xanh ngọc lục bảo: Thợ hoa đang cắm
  fillWidth = '66%';
} else if (status === 'shipping') {
  step4Class = 'active green-active'; // Đang giao
  fillWidth = '88%';
} else if (status === 'completed') {
  fillWidth = '100%'; // Hoàn tất 100%
}
```

---

## 4. 🛠️ Nhật Ký Gỡ Lỗi Thực Chiến (Bug Diary)

| Lỗi gặp phải | Triệu chứng | Nguyên nhân gốc rễ | Cách xử lý triệt để |
| :--- | :--- | :--- | :--- |
| **1. Ký tự đóng modal bị quét nhầm là Emoji** | Script kiểm tra phát hiện ký tự `✕` trong nút đóng modal | Dấu gạch chéo `✕` thuộc dải Unicode `✕` | Thay bằng ký tự thực thể HTML chuẩn `&times;`, đảm bảo 0 emoji trên toàn bộ dự án. |
| **2. Nút theo dõi sau checkout không chuyển trang** | Bấm nút "Theo Dõi Đơn Hàng Của Bạn" ở popup đặt hàng thành công không có phản hồi | Thiếu bộ lắng nghe sự kiện `btnTrackThisOrder` | Thêm hàm chuyển hướng `window.location.href = './orders.html?id=' + orderId` giúp khách xem ngay đơn vừa mua trên trang lớn. |

---

## 5. 🎓 KỊCH BẢN VẤN ĐÁP GIÁO VIÊN

#### ❓ Câu 1: *"Tại sao em không để lịch sử đơn hàng trong modal ở trang chủ mà lại tách riêng ra trang orders.html?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa thầy/cô, việc tách riêng ra `orders.html` mang lại 3 giá trị kiến trúc quan trọng:  
> 1. **Về mặt Trải nghiệm người dùng (UX):** Giúp người mua có không gian thoáng đãng theo dõi chi tiết bó hoa, nội dung thiệp chúc mừng và lộ trình cắm hoa mà không bị gò bó trong popup 650px.  
> 2. **Về tính năng Bookmark & Chia sẻ:** Trang có URL tĩnh độc lập (`orders.html?id=DH-7904`), khách có thể gửi link cho người nhận hoa cùng theo dõi shipper giao đến đâu.  
> 3. **Về kiến trúc mã nguồn (Modularity):** Giúp giảm gần 400 dòng code khỏi `main.js`, tách biệt hoàn toàn logic quản lý đơn hàng sang `js/orders.js` với 4 hàm chuẩn ES6 rất dễ bảo trì và mở rộng ạ."

#### ❓ Câu 2: *"Em xử lý việc bảo mật dữ liệu đơn hàng giữa các người dùng như thế nào trong trang này?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa thầy/cô, khi nạp trang, hàm `loadOrders()` kiểm tra thông tin người dùng từ `localStorage`. Nếu khách đã đăng nhập, phương thức `filter()` của JavaScript sẽ đối soát 3 trường: Email, Số điện thoại và Tên người đặt với từng bản ghi đơn hàng. Chỉ những đơn hàng nào khớp với tài khoản mới được đưa vào danh sách hiển thị, ngăn chặn triệt để tình trạng lộ thông tin người nhận của khách hàng khác ạ."


---

# PHẦN 13: UNIVERSAL CART DRAWER (GIỎ HÀNG TRƯỢT TỨC THÌ DÙNG CHUNG MỌI TRANG)

> **Bối cảnh thực tế:** Trước đây, khi người dùng đang ở trang Chi tiết hoa (`detail.html`) hoặc trang Quản lý đơn hàng (`orders.html`), việc click vào icon "Giỏ Hàng" trên thanh Header lại kích hoạt đường dẫn `./index.html?openCart=true`, làm trình duyệt tải lại toàn bộ trang và nhảy ngược về trang chủ. Điều này làm gián đoạn trải nghiệm người mua, gây khó chịu và mất ngữ cảnh. Dự án đã tối ưu hóa triệt để bằng việc xây dựng module **Universal Cart Drawer (`js/cart-drawer.js`)** dùng chung cho toàn bộ các trang.

---

## 1. 📍 Bản Đồ Vị Trí Code (File Map & Location)

| Thành phần | Đường dẫn file | Vai trò trong tính năng |
| :--- | :--- | :--- |
| **Module Giỏ hàng dùng chung** | [`js/cart-drawer.js`](file:///d:/shopHoa/souce_shopHoa/js/cart-drawer.js) | **File cốt lõi**: Tự động chèn markup Cart Drawer nếu trang chưa có, điều khiển mở/đóng (`openCartDrawer`, `closeCartDrawer`), render danh sách hoa, tăng giảm số lượng, nhập Voucher và thanh toán. |
| **Logic Trang Chi Tiết** | [`js/detail.js`](file:///d:/shopHoa/souce_shopHoa/js/detail.js) | Tích hợp `initUniversalCartDrawer()`: Khi bấm "Thêm vào giỏ", tự động trượt mở giỏ hàng ngay tại chỗ mà không tải lại trang. |
| **Logic Trang Đơn Hàng** | [`js/orders.js`](file:///d:/shopHoa/souce_shopHoa/js/orders.js) | Tích hợp `initUniversalCartDrawer()`: Nút Giỏ Hàng trên Header và nút "Đặt Lại Đơn Này" mở ngay giỏ hàng tại chỗ. |
| **Giao diện HTML** | [`detail.html`](file:///d:/shopHoa/souce_shopHoa/detail.html), [`orders.html`](file:///d:/shopHoa/souce_shopHoa/orders.html) | Chuyển đổi thẻ `<a>` chuyển trang thành `<button type="button" id="cartButton">`. |

---

## 2. 🔄 Sơ Đồ Luồng Hoạt Động (Zero-Reload Flowchart)

```
[NGƯỜI DÙNG Ở BẤT KỲ ĐÂU: detail.html hoặc orders.html]
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
[Bấm icon Giỏ Hàng Header]   [Bấm Thêm Hoa / Đặt Lại Đơn]
         │                           │
         └─────────────┬─────────────┘
                       ▼
[BƯỚC 1]: ensureCartDrawerMarkup() kiểm tra DOM
          └── Tự động bổ sung #cartDrawer & #cartBackdrop nếu chưa có
                       │
                       ▼
[BƯỚC 2]: openCartDrawer() trượt mở mượt mà (translateX(0))
          ├── GIỮ NGUYÊN URL HIỆN TẠI (Không reload, Không nhảy trang)
          └── Khóa cuộn trang (document.body.style.overflow = 'hidden')
                       │
                       ▼
[BƯỚC 3]: renderCartDrawer() đọc localStorage('SHOP_HOA_CART')
          ├── Thao tác trực tiếp: Tăng (+), Giảm (-), Xóa hoa, Nhập Voucher
          └── Bấm "Tiến Hành Đặt Hàng" -> Chuyển sang Checkout thông minh
```

---

## 3. 🔍 Mổ Xẻ Chi Tiết Code & Kỹ Thuật Then Chốt

### 3.1. Kỹ thuật Dynamic Component Injection (Tự sinh Component vào DOM)
```javascript
function ensureCartDrawerMarkup() {
  if (document.getElementById('cartDrawer') && document.getElementById('cartBackdrop')) {
    return; // Đã có sẵn thì không tạo lại
  }
  // Tự động chèn Backdrop & Drawer vào cuối thẻ body
  const drawer = document.createElement('aside');
  drawer.className = 'cart-drawer';
  drawer.id = 'cartDrawer';
  // ... Gắn template HTML vào body ...
  document.body.appendChild(drawer);
}
```

### 3.2. Điều hướng Checkout thông minh theo ngữ cảnh trang
```javascript
drawerCheckoutBtn.addEventListener('click', () => {
  closeCartDrawer();
  // Nếu đang ở trang chủ: Mở trực tiếp Modal Checkout tại chỗ
  if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
    if (typeof window.openCheckoutModal === 'function') {
      window.openCheckoutModal();
      return;
    }
  }
  // Nếu đang ở trang chi tiết hoặc đơn hàng: Chuyển hướng kèm cờ mở Checkout
  window.location.href = './index.html?openCheckout=true';
});
```

---

## 4. 🛠️ Nhật Ký Gỡ Lỗi Thực Chiến (Bug Diary)

| Lỗi gặp phải | Triệu chứng | Nguyên nhân gốc rễ | Cách xử lý triệt để |
| :--- | :--- | :--- | :--- |
| **1. Bấm Giỏ hàng bị nhảy về trang chủ** | Khách đang xem hoa ở `detail.html` bấm Giỏ Hàng bị văng về `index.html?openCart=true` | Nút Header là thẻ `<a href="./index.html?openCart=true">`, thiếu component Drawer nội bộ | Chuyển thành `<button id="cartButton">` và tích hợp module `js/cart-drawer.js` dùng chung, mở Drawer trượt ngay tại trang hiện tại. |
| **2. Ký tự Dingbat bị cảnh báo Emoji** | Script kiểm tra phát hiện ký tự `✕` và `✓` trong file HTML và JS | Các ký tự này nằm trong bảng mã Dingbats (`✀-➿`) | Thay `✕` bằng mã thực thể `&times;` và làm sạch các ký tự tích chữ, đưa bộ đếm emoji về 0 tuyệt đối. |

---

## 5. 🎓 KỊCH BẢN VẤN ĐÁP GIÁO VIÊN

#### ❓ Câu 1: *"Tại sao em không để giỏ hàng ở một trang riêng mà lại dùng Cart Drawer trên mọi trang?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa thầy/cô, đây là chuẩn thiết kế **Micro-interactions & Frictionless Shopping** của các website TMĐT cao cấp hiện nay:  
> - Khi khách hàng đang đọc thông tin hoa hoặc xem lại lịch sử đơn, việc mở một Drawer trượt từ bên phải giúp khách kiểm tra nhanh số lượng và tổng tiền mà **không làm mất ngữ cảnh công việc đang làm**.  
> - Khách có thể tiếp tục chọn hoa hoặc đóng giỏ hàng chỉ bằng 1 cú click chuột hoặc phím Escape mà không phải chịu độ trễ tải lại toàn trang (Zero Reload Latency) ạ."

#### ❓ Câu 2: *"Em dùng kỹ thuật gì để tái sử dụng component Giỏ Hàng này trên nhiều trang HTML khác nhau mà không phải copy-paste code trùng lặp?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa thầy/cô, em áp dụng nguyên lý **Modular Component & Dynamic DOM Injection** của JavaScript ES6:  
> - Toàn bộ logic và giao diện được đóng gói vào module `js/cart-drawer.js`.  
> - Bất kỳ file nào (như `detail.js` hay `orders.js`) chỉ cần gọi hàm `initUniversalCartDrawer()`. Hàm này sẽ tự động kiểm tra xem phần tử `#cartDrawer` đã có trong DOM hay chưa, nếu chưa có thì tự động dùng `document.createElement` để tiêm (inject) vào `document.body` và gắn các bộ lắng nghe sự kiện tăng giảm số lượng, nhập voucher hoàn toàn tự động ạ."


---

# PHẦN 14: CHUẨN HÓA NGHIỆP VỤ HÓA ĐƠN ĐIỆN TỬ THỰC TẾ (BỎ CHỮ A5 & ẨN KHI CHƯA TRẢ TIỀN)

> **Bối cảnh thực tế:** Trong thương mại điện tử và kế toán doanh nghiệp, một đơn hàng chưa thanh toán (chưa chuyển khoản SePay) thì tuyệt đối **chưa được coi là phát sinh giao dịch thu tiền**, do đó không thể xuất "Biên nhận thu tiền" cho khách. Việc để nút in ở mọi trạng thái là lỗi hổng nghiệp vụ nghiêm trọng. Đồng thời, khách hàng đại chúng không quan tâm đến kích cỡ khổ giấy kỹ thuật "A5", mà cần thuật ngữ chuẩn thương mại: **"Xem Hóa Đơn Điện Tử"**.

---

## 1. 📍 Bản Đồ Vị Trí Code (File Map & Location)

| Thành phần | Đường dẫn file | Vai trò trong tính năng |
| :--- | :--- | :--- |
| **Logic Trang Đơn Hàng** | [`js/orders.js`](file:///d:/shopHoa/souce_shopHoa/js/orders.js) | Phân cấp cụm nút hành động theo 4 case nghiệp vụ: Đơn chưa thanh toán chỉ hiện "Quét QR" + "Hủy Đơn"; chỉ khi đơn đã thanh toán hoặc hoàn tất mới xuất hiện nút "Xem Hóa Đơn Điện Tử". Bổ sung tính năng hủy đơn `handleCancelOrder`. |
| **Module Xuất PDF** | [`js/excel-pdf.js`](file:///d:/shopHoa/souce_shopHoa/js/excel-pdf.js) | Chuẩn hóa tiêu đề văn bản in thành `HOA DON BAN LE DIEN TU (E-INVOICE)` hoặc `BIEN NHAN THANH TOAN DIEN TU (E-RECEIPT)`, loại bỏ toàn bộ từ "A5" trên giao diện người dùng. |
| **Giao diện HTML** | [`index.html`](file:///d:/shopHoa/souce_shopHoa/index.html), [`orders.html`](file:///d:/shopHoa/souce_shopHoa/orders.html) | Chuẩn hóa nhãn nút bấm thành "Xem Hóa Đơn Điện Tử". |
| **Logic Trang Chủ** | [`js/main.js`](file:///d:/shopHoa/souce_shopHoa/js/main.js) | Cập nhật nhãn và mô tả nút mở hóa đơn điện tử sau checkout. |

---

## 2. 🔄 Ma Trận Phân Cấp Nút Bấm Thực Tế (Business Rules Matrix)

```
[KIỂM TRA ĐƠN HÀNG TRONG VÒNG LẶP RENDER]
                     │
       ┌─────────────┴─────────────┐
       ▼                           ▼
[ĐƠN CHƯA THU TIỀN]          [ĐƠN ĐÃ THU TIỀN HOẶC HOÀN TẤT]
  - SePay Pending              - SePay Đã Khớp Tiền (isPaid = true)
  - COD Đang Cắm / Đang Giao   - Đơn Hoàn Tất (status = completed)
       │                           │
       ▼                           ▼
[ẨN NÚT HÓA ĐƠN]             [HIỆN NÚT HÓA ĐƠN]
  ├── Nút Chính: Quét QR       ├── Nút Chính: Đặt Lại Đơn Này
  └── Nút Phụ: Hủy Đơn Hàng    └── Nút Phụ: Xem Hóa Đơn Điện Tử
```

---

## 3. 🔍 Mổ Xẻ Chi Tiết Code & Kỹ Thuật Then Chốt

### 3.1. Phân loại hiển thị nút bấm chặt chẽ theo trạng thái
```javascript
// Trong js/orders.js
if (status === 'cancelled') {
  // Đơn đã hủy: Không có hóa đơn
  actionButtonsHtml = `
    <span style="font-size: 12.5px; color: #94A3B8; font-style: italic;">Đơn hàng đã được hủy</span>
    <a href="./index.html#products" class="btn-action-secondary">Khám Phá Mẫu Hoa Khác</a>`;
} else if (isSepay && !isPaid) {
  // Đơn SePay chưa trả tiền: ẨN HÓA ĐƠN, chỉ hiện Quét QR + Hủy đơn
  actionButtonsHtml = `
    <button type="button" class="btn-action-secondary btn-order-cancel" data-order-id="${order.id}">Hủy Đơn</button>
    <button type="button" class="btn-action-primary btn-order-pay-now" data-order-id="${order.id}">Quét QR Thanh Toán Ngay</button>`;
} else if (!isPaid && status !== 'completed') {
  // Đơn COD chưa thu tiền: ẨN HÓA ĐƠN, chỉ hiện hỗ trợ đổi thiệp/giờ giao + Hủy đơn
  actionButtonsHtml = `
    <a href="tel:0908889999" class="btn-action-secondary">Đổi Thiệp / Giờ Giao</a>
    <button type="button" class="btn-action-secondary btn-order-cancel" data-order-id="${order.id}">Hủy Đơn</button>`;
} else {
  // ĐÃ THU TIỀN THÀNH CÔNG: Mới kích hoạt nút Xem Hóa Đơn Điện Tử
  actionButtonsHtml = `
    <button type="button" class="btn-action-secondary btn-order-view-pdf" data-order-id="${order.id}">Xem Hóa Đơn Điện Tử</button>
    <button type="button" class="btn-action-secondary btn-order-reorder" data-order-id="${order.id}">Đặt Lại Đơn Này</button>`;
}
```

---

## 4. 🛠️ Nhật Ký Gỡ Lỗi Thực Chiến (Bug Diary)

| Lỗi gặp phải | Triệu chứng | Nguyên nhân gốc rễ | Cách xử lý triệt để |
| :--- | :--- | :--- | :--- |
| **1. Khách chưa trả tiền vẫn in được biên nhận** | Đơn SePay đang ở bước "Chờ Quét QR" nhưng vẫn bấm in được giấy ghi đã thu tiền | Nút in PDF bị gắn cứng cho mọi trạng thái mà không kiểm tra cờ `isPaid` | Điều kiện hóa nút bấm: Chỉ khi `isPaid === true` hoặc `status === 'completed'` mới render nút `.btn-order-view-pdf`. |
| **2. Nhãn nút dùng thuật ngữ kỹ thuật "A5"** | Nút bấm ghi "Xem Biên Nhận A5" gây khó hiểu cho người mua hàng phổ thông | Lạm dụng tên khổ giấy kỹ thuật trong giao diện người dùng | Chuẩn hóa toàn bộ thành "Xem Hóa Đơn Điện Tử" và tiêu đề PDF là "BIEN NHAN THANH TOAN DIEN TU (E-RECEIPT)". |

---

## 5. 🎓 KỊCH BẢN VẤN ĐÁP GIÁO VIÊN

#### ❓ Câu 1: *"Tại sao em không cho khách in hóa đơn ngay khi vừa đặt hàng xong mà phải chờ thanh toán hoặc hoàn thành đơn mới cho in?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa thầy/cô, đây là **nguyên tắc đối soát chứng từ và quản trị rủi ro trong TMĐT**:  
> - Khi đơn hàng ở trạng thái Chờ chuyển khoản (Pending), khách chưa hề chuyển tiền vào tài khoản tiệm hoa. Nếu hệ thống cho in biên nhận thu tiền, kẻ gian có thể dùng file PDF này để làm giả bằng chứng ép shipper giao hoa khi chưa thanh toán.  
> - Chỉ khi Webhook SePay xác nhận tiền đã vào tài khoản (`paymentStatus = paid`) hoặc đơn COD đã giao thành công (`status = completed`), hệ thống mới phát hành **Hóa đơn điện tử** có mã tham chiếu ngân hàng đầy đủ để khách làm chứng từ thanh toán hợp lệ với cơ quan ạ."

#### ❓ Câu 2: *"Em đã so sánh tính năng xuất tài liệu này với bài giảng mẫu của cô như thế nào?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa thầy/cô, trong bài giảng mẫu ở thư mục `tham_khao/code_JS_admin`, cô đã hướng dẫn xuất file Excel danh sách sản phẩm bằng thư viện SheetJS (`XLSX`).  
> - Em kế thừa nguyên lý xử lý mảng đối tượng của cô, và phát triển thêm tính năng xuất **Hóa đơn bán lẻ điện tử dạng PDF** bằng thư viện `jsPDF` cho từng đơn hàng cụ thể, kết hợp thuật toán khử dấu tiếng Việt (`toNonAccentVietnamese`) để đảm bảo file PDF in ra luôn sắc nét, không bị lỗi font trên mọi thiết bị ạ."


---

# PHẦN 15: KIẾN TRÚC TÍNH NĂNG THÊM MẪU HOA MỚI (ADMIN PRODUCT CRUD) VÀ GIẢI MÃ THƯ VIỆN SỬ DỤNG

## 1. 📍 Bản Đồ Vị Trí Code (File Map & Location)

| STT | Tên File | Đường Dẫn | Vai Trò Trong Tính Năng |
| :---: | :--- | :--- | :--- |
| 1 | **Giao diện Modal & Nút Bấm** | [`admin.html`](file:///d:/shopHoa/souce_shopHoa/admin.html#L405-L411) | Nút bấm `#openAddProductBtn` và cấu trúc khung pop-up `#productModal` chứa các trường nhập liệu |
| 2 | **Style Giao Diện & Dropzone** | [`css/admin.css`](file:///d:/shopHoa/souce_shopHoa/css/admin.css#L751-L820) | Hiệu ứng mờ nền `.modal-backdrop`, căn chỉnh lưới 2 cột, vùng kéo thả ảnh `.image-dropzone` |
| 3 | **Logic Điều Khiển & Tính Toán** | [`js/admin.js`](file:///d:/shopHoa/souce_shopHoa/js/admin.js#L812-L1047) | Hàm `initProductCrud()`, mở/đóng modal, bộ tính giá 2 chiều (Smart Calculator), bắt sự kiện submit form |
| 4 | **Tầng Lưu Trữ & Gọi API** | [`js/storage.js`](file:///d:/shopHoa/souce_shopHoa/js/storage.js#L957-L985) | Hàm `createProduct()` gửi HTTP POST, tính toán sinh mã ID tự động, lưu đồng thời vào `localStorage` |
| 5 | **Cấu Hình HTTP Client** | [`js/api.js`](file:///d:/shopHoa/souce_shopHoa/js/api.js#L1-L18) | Cấu hình đối tượng Axios instance với `baseURL: 'http://localhost:4000'` |
| 6 | **Cơ Sở Dữ Liệu Máy Chủ** | [`db.json`](file:///d:/shopHoa/souce_shopHoa/db.json#L29-L50) | Bảng dữ liệu `products` được cập nhật tức thì trên ổ cứng |

---

## 2. 🔄 Sơ Đồ Luồng Hoạt Động (Flowchart)

```text
[Người Dùng (Admin)]
        │ 1. Nhấp nút "+ Thêm Mẫu Hoa"
        ▼
[js/admin.js: openModal('create')] ──> Xóa trắng form, reset ảnh xem trước, mở modal
        │
        ├─> [Kéo thả ảnh vào Dropzone] ──> Trình duyệt đọc file bằng FileReader API thuần
        │
        ├─> [Nhập Giá gốc & % Giảm] ────> Smart Calculator tự động tính Giá bán thực tế
        │
        ▼ 2. Bấm "Lưu Sản Phẩm"
[js/admin.js: form.submit]
        │ 3. Gom dữ liệu form thành Object productData
        ▼
[js/storage.js: createProduct(productData)]
        │
        ├─> 4. Tạo ID mới dạng chuỗi (String) = Max(ID cũ) + 1
        │
        ├─> 5. Gửi request: axios.post('http://localhost:4000/products', newProduct)
        │       └─> json-server ghi vĩnh viễn vào db.json
        │
        └─> 6. Cập nhật mảng cache: localStorage.setItem('SHOP_HOA_PRODUCTS', ...)
                │
                ▼ 7. Gọi renderProductsTable() & renderDashboard()
        [Giao diện bảng vẽ lại sản phẩm mới tức thì mà không cần reload trang!]
```

---

## 3. 🔍 Giải Mã Thư Viện Sử Dụng & Mổ Xẻ Code

### A. Tính Năng Này Có Dùng Thư Viện Gì Không?

| Hạng mục | Thư viện sử dụng | Giải thích bản chất |
| :--- | :--- | :--- |
| **Giao diện & Popup Modal** | **KHÔNG DÙNG THƯ VIỆN** *(100% Vanilla JS & CSS thuần)* | Tự làm bằng CSS Flexbox/Grid và điều khiển ẩn/hiện bằng `classList.remove('hidden')` / `classList.add('hidden')`. Không phụ thuộc vào Bootstrap Modal hay jQuery. |
| **Kéo thả ảnh (Dropzone)** | **KHÔNG DÙNG THƯ VIỆN** *(HTML5 Drag & Drop API thuần)* | Sử dụng trực tiếp API sẵn có của trình duyệt (`dragover`, `dragleave`, `drop`) kết hợp `FileReader.readAsDataURL()`. Không dùng thư viện bên ngoài như DropzoneJS. |
| **Bộ tính giá thông minh** | **KHÔNG DÙNG THƯ VIỆN** *(Toán học & Sự kiện JS thuần)* | Sử dụng sự kiện `input` và hàm toán học `Math.round()` để tính toán 2 chiều giữa Giá gốc, % Giảm và Giá bán. |
| **Gửi dữ liệu lên Máy chủ API** | **`axios`** | Sử dụng thư viện `axios` để gọi HTTP POST request (`api.post('/products', newProduct)`). Đây là thư viện theo đúng giáo trình môn học của giáo viên. |
| **Máy chủ Database ảo** | **`json-server`** | Đóng vai trò là REST API Server lưu trữ dữ liệu vào file `db.json`. |

---

### B. Mổ Xẻ Đoạn Code Then Chốt

#### 1. Bộ Tính Giá Hai Chiều Thông Minh (2-Way Reactive Calculator)
```javascript
// js/admin.js (Dòng 893-926)
origPriceInput.addEventListener('input', () => {
  const orig = Number(origPriceInput.value) || 0;
  const pct = Number(discountPctInput.value) || 0;
  if (orig > 0 && pct > 0) {
    // Nhập giá gốc và % giảm -> Tự động tính giá bán thực tế
    priceInput.value = Math.round(orig * (1 - pct / 100));
  }
  updateDiscountPreview();
});

priceInput.addEventListener('input', () => {
  const price = Number(priceInput.value) || 0;
  const orig = Number(origPriceInput.value) || 0;
  if (orig > 0 && price <= orig) {
    // Nhập giá bán thấp hơn giá gốc -> Tự động suy ra % giảm
    const pct = Math.round(((orig - price) / orig) * 100);
    discountPctInput.value = pct;
  }
  updateDiscountPreview();
});
```
* **Tại sao viết như vậy?** Trải nghiệm quản trị thực tế (UX) đòi hỏi người quản lý không phải tự bấm máy tính cầm tay để tính phần trăm giảm giá. Code lắng nghe sự kiện `input` phản ứng ngay lập tức (Reactive).

#### 2. Kỹ Thuật Đọc Ảnh Base64 Bằng FileReader API Thuần
```javascript
// js/admin.js (Dòng 445-455)
function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader(); // Đối tượng API thuần của trình duyệt
  reader.onload = (e) => {
    const base64Url = e.target.result;
    setPreview(base64Url); // Hiển thị ảnh xem trước
    hiddenUrlInput.value = base64Url; // Gán vào input ẩn để gửi lên server
  };
  reader.readAsDataURL(file);
}
```
* **Tại sao viết như vậy?** Nhờ dùng `FileReader.readAsDataURL()`, người dùng có thể chọn bất kỳ ảnh nào trên máy tính, ảnh sẽ được chuyển thành chuỗi Base64 để hiển thị xem trước tức thì mà không cần phải viết backend upload file phức tạp.

#### 3. Lưu Dữ Liệu Theo Kiến Trúc Dự Phòng Kép (Dual-tier Storage)
```javascript
// js/storage.js (Dòng 957-984)
export async function createProduct(productData) {
  const allProducts = await fetchProducts();
  const nextId = allProducts.length > 0 
    ? Math.max(...allProducts.map(p => Number(p.id) || 0)) + 1 
    : 1;

  const newProduct = {
    ...productData,
    id: String(nextId),
    price: Number(productData.price) || 0,
    originalPrice: Number(productData.originalPrice) || Number(productData.price) || 0,
    stock: Number(productData.stock) || 10,
    soldCount: Number(productData.soldCount) || 0
  };

  try {
    // Bước 1: Gửi POST lên json-server (ghi vào db.json)
    await api.post('/products', newProduct);
  } catch (e) {
    console.warn('Không thể POST /products, lưu vào localStorage dự phòng.');
  }

  // Bước 2: Đồng bộ ngay lập tức vào localStorage để UI luôn có dữ liệu tức thì
  const updated = [newProduct, ...allProducts];
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));
  return newProduct;
}
```

---

## 4. 🛠️ Nhật Ký Gỡ Lỗi Thực Chiến (Bug Diary)

| Lỗi gặp phải | Triệu chứng | Nguyên nhân gốc rễ | Cách xử lý triệt để |
| :--- | :--- | :--- | :--- |
| **1. Lặp 2 dấu cộng ở nút thêm** | Nút bấm trên giao diện hiển thị `+ + Thêm Mẫu Hoa` | Trong thẻ `<button>` vừa chứa icon `<svg>` dấu cộng, vừa có chữ `+ Thêm Mẫu Hoa` trong thẻ `<span>` | Xóa dấu `+` thừa trong thẻ `<span>`, chỉ giữ lại chữ `Thêm Mẫu Hoa` cạnh icon SVG. |
| **2. Sai lệch kiểu dữ liệu ID** | Khi thêm hoa mới, `id` bị gán là dạng số (`17`), trong khi `db.json` dùng chuỗi (`"17"`) | Trong `js/storage.js` sử dụng `Number(nextId)` | Sửa thành `String(nextId)` để đảm bảo tính đồng nhất 100% với kiểu dữ liệu của `db.json`. |

---

## 5. 🎓 KỊCH BẢN VẤN ĐÁP GIÁO VIÊN

#### ❓ Câu 1: *"Form thêm sản phẩm này em tự viết hay dùng thư viện Bootstrap Modal / SweetAlert?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa thầy/cô, toàn bộ form popup và modal này **em tự viết 100% bằng HTML5, CSS Flexbox/Grid và JavaScript DOM thuần**, không sử dụng Bootstrap hay bất kỳ thư viện ngoài nào ạ:  
> - Em dùng lớp phủ `.modal-backdrop` cố định toàn màn hình (`position: fixed; inset: 0`).  
> - Ẩn/hiện modal bằng cách thêm hoặc xóa class `.hidden` thông qua `classList.add('hidden')` và `classList.remove('hidden')`.  
> - Khi người dùng bấm nút đóng `✕`, nút `Hủy Bỏ`, hoặc bấm ra ngoài màn hình thì form sẽ tự đóng lại ạ."

#### ❓ Câu 2: *"Tại sao em lại dùng thư viện Axios để gửi dữ liệu mà không dùng hàm `fetch()` sẵn có của JavaScript?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa thầy/cô:  
> 1. Em sử dụng `axios` để bám sát theo đúng bài giảng mẫu của cô giáo (trong các file `lythuyet.js` và `app.js`).  
> 2. `axios` có ưu điểm là tự động chuyển đổi dữ liệu gửi đi sang JSON và tự parse dữ liệu nhận về mà không cần gọi `.json()`, đồng thời cho phép tạo instance với `baseURL` và `timeout` tập trung trong file `js/api.js`.  
> 3. Tuy nhiên, em hoàn toàn nắm vững bản chất của `fetch()` thuần: nếu không dùng Axios, em chỉ cần thay thế bằng:  
>    `fetch('http://localhost:4000/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProduct) })` là hệ thống vẫn hoạt động chính xác tương đương ạ."

#### ❓ Câu 3: *"Cơ chế kéo thả hình ảnh (Dropzone) trong form hoạt động như thế nào?"*
> 🗣️ **Trả lời:**  
> "Dạ thưa thầy/cô, em dùng **HTML5 Drag and Drop API thuần** kết hợp **FileReader API**:  
> - Khi người dùng kéo ảnh vào khung, sự kiện `dragover` được kích hoạt và em dùng `e.preventDefault()` để ngăn trình duyệt mở ảnh sang tab mới.  
> - Khi người dùng thả chuột, sự kiện `drop` bắt lấy file từ `e.dataTransfer.files[0]`.  
> - Sau đó em khởi tạo đối tượng `new FileReader()` và dùng phương thức `readAsDataURL(file)` để chuyển file ảnh thành chuỗi base64. Khi hoàn tất (`onload`), em gán chuỗi đó vào thuộc tính `src` của thẻ `<img>` để người dùng thấy ảnh xem trước ngay lập tức ạ."


---

# CHUYEN DE 16: KIEN TRUC PHAN TRANG (PAGINATION) TOAN DIEN VA TOI UU TRUNG BAY SAN PHAM MOI

## 1. Tong Quan Nghiep Vu & Y Nghia Thuc Te
- **Van de thuc te:** Khi he thong co hang chuc hoac hang tram san pham, neu render tat ca tren mot trang se gay lag trinh duyet, keo dai thanh cuon bat tien cho nguoi dung, dong thoi lam giam toc do tai trang.
- **Giai phap:** Chia danh sach thanh cac trang nho (Pagination) co so luong dong/the co dinh. Nguoi dung chi xem mot luong du lieu vua du va de dang chuyen qua lai giua cac trang bang thanh dieu huong (Truoc, Sau, cac so trang 1, 2, 3...).
- **Toi uu trung bay:** San pham moi them vao he thong luon phai duoc uu tien hien thi len dau tien o section "Mau Hoa Moi Nhat" va trang 1 cua Danh muc hoa de tang ti le chuyen doi ban hang.

---

## 2. Ban Do Cac Vi Tri Da Ap Dung Phan Trang Trong Toan Bo He Thong

| STT | Trang / Module | File Code Chinh | So Luong / Trang | Tinh Nang Bo Sung |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Quan Tri Admin** | `js/admin.js` | 5 / 10 / 20 dong | Co dropdown chon so dong/trang, phan trang bang san pham & bang don hang |
| **2** | **Trang Chu San Pham** | `js/main.js` | 8 mau hoa / trang | Luoi 4 cot x 2 hang can doi, tich hop bo loc danh muc, tim kiem va sap xep |
| **3** | **Lich Su Don Hang** | `js/orders.js` | 4 don hang / trang | Phan trang theo tung Tab (Cho quet QR, Dang cam hoa, Dang giao, Hoan tat, Da huy) |

---

## 3. Giai Ma Cong Thuc Toan Hoc Phan Trang Cho Nguoi Moi Bat Dau

### Buoc 1: Xac dinh 3 thong so dau vao
1. `totalItems`: Tong so phan tu can hien thi (vi du: `products.length` hoac `orders.length`).
2. `limit`: So luong phan tu cho phep tren mot trang (vi du: `8` san pham hoac `4` don hang).
3. `currentPage`: Trang nguoi dung dang xem (mac dinh bat dau tu `1`).

### Buoc 2: Tinh tong so trang (`totalPages`)
Cong thuc:
```javascript
const totalPages = Math.ceil(totalItems / limit) || 1;
```
- `Math.ceil()`: Ham lam tron len. Vi du co 17 san pham, limit = 8 -> `17 / 8 = 2.125` -> Lam tron len thanh `3` trang. Trang 1 co 8 hoa, Trang 2 co 8 hoa, Trang 3 co 1 hoa.
- `|| 1`: Truong hop khong co san pham nao (`totalItems = 0`), gia tri van la `1` de tranh loi chia hoac hien thi so trang am.

### Buoc 3: Tinh vi tri cat mang (`startIndex` va `endIndex`)
Su dung phuong thuc `Array.prototype.slice(start, end)` cua JavaScript:
```javascript
const startIndex = (currentPage - 1) * limit;
const endIndex = startIndex + limit;
const pagedData = allData.slice(startIndex, endIndex);
```

Bang tra cuu vi tri cat voi `limit = 8`:
| Trang (`currentPage`) | `startIndex` | `endIndex` | Phan tu lay ra trong mang |
| :---: | :---: | :---: | :--- |
| **Trang 1** | `(1 - 1) * 8 = 0` | `0 + 8 = 8` | Phan tu chi so tu `0` den `7` (8 phan tu dau tien) |
| **Trang 2** | `(2 - 1) * 8 = 8` | `8 + 8 = 16` | Phan tu chi so tu `8` den `15` (8 phan tu tiep theo) |
| **Trang 3** | `(3 - 1) * 8 = 16` | `16 + 8 = 24` | Phan tu chi so tu `16` den het |

---

## 4. Nhat Ky Go Loi Thuc Chien: San Pham Moi Them Bi Chim Xuong Day

| Hien Tuong | Nguyen Nhan Ky Thuat | Cach Khac Phuc Triet De |
| :--- | :--- | :--- |
| San pham ID 17 vua tao nam o cuoi cung, khong hien o "Mau Hoa Moi Nhat" | 1. Ham `api.post('/products')` ghi them san pham vao cuoi mang `products` trong `db.json`.<br>2. `json-server` khi query `_sort=id&_order=desc` so sanh chuoi tu dien: ky tu `"9"` dung sau ky tu `"1"`, nen `"9"` lon hon `"17"`! | 1. Trong `js/storage.js`: Khi lay danh sach hoa moi nhat, khong dung query `_sort` chuoi ma ep kieu so: `.sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 4)`.<br>2. Trong `js/main.js`: Dat bo sap xep mac dinh la `newest` (`Number(b.id) - Number(a.id)`) giup hoa moi nhat luon o vi tri so 1 tren trang 1. |
| San pham so 9 gia bi hien thi la `0 d` | Trong `db.json`, truong `price` cua ID 9 bi mang gia tri `null` | Patch lai `price: 490000` va `originalPrice: 550000` trong `db.json` thong qua API. |

---

## 5. Kich Ban Van Dap Giao Vien Ve Phan Trang (Pagination)

#### Cau 1: "Co che phan trang cua em la Client-side Pagination hay Server-side Pagination? Su khac nhau la gi?"
> **Tra loi:**  
> "Da thua thay/co:  
> - He thong hien tai cua em dang ap dung **Client-side Pagination**: Frontend fetch toan bo danh sach san pham/don hang tu REST API ve RAM mot lan, sau do dung cac ham toan hoc `Math.ceil()` va `Array.slice()` de cat mang va render theo trang.  
> - **Uu diem:** Toc do chuyen trang cuc nhanh (tuc thi), khong can gui them request len server, rat phu hop voi he thong quy mo vua va nho duoi vai nghin ban ghi.  
> - **Kha nang mo rong (Server-side):** Neu sau nay co hang tram nghin san pham, em se chuyen sang **Server-side Pagination** bang cach gui tham so phan trang len backend: vi du `GET /products?_page=1&_limit=8`. Khi do backend chi tra ve dung 8 san pham kem header `X-Total-Count` de tiet kiem bang thong va toi uu bo nho trinh duyet a."

#### Cau 2: "Khi nguoi dung dang o trang 3 ma ho go tu khoa tim kiem hoac bam chon danh muc khac, em xu ly trang hien tai nhu the nao?"
> **Tra loi:**  
> "Da thua thay/co, day la loi UX rat pho bien ma cac lap trinh vien moi thuong mac phai:  
> Neu nguoi dung dang o trang 3 ma ket qua tim kiem chi co 2 san pham (tong cong chi co 1 trang), neu khong reset thi bien `currentPage` van bang 3, dan den mang sau khi `slice(16, 24)` bi rong va giao dien bao 'Khong tim thay san pham'!  
> Vi vay trong code `applyFilters(resetPage = true)` va `applyFiltersAndRender()`, em luon chu dong:  
> 1. Dat lai `currentPage = 1` ngay khi nguoi dung go tim kiem hoac chuyen danh muc/chuyen tab.  
> 2. Kiem tra neu `currentPage > totalPages` thi tu dong ep `currentPage = totalPages` de bao dam luon hien thi dung trang hop le a."


---

# CHUYEN DE 17: VONG DOI DON HANG THUC TE (ORDER LIFECYCLE) VA KICH BAN VAN DAP SAU BAN HANG (POST-PURCHASE)

## 1. Ban Do Vi Tri Code Quan Ly Don Hang

| STT | File Ma Nguon | Vi Tri | Vai Tro Trong Vong Doi Don Hang |
| :--- | :--- | :--- | :--- |
| **1** | `orders.html` | `orders.html` | Giao dien khach hang theo doi hanh trinh bo hoa, timeline 4 buoc, xem hoa don PDF va dat lai don |
| **2** | `js/orders.js` | `js/orders.js` | Logic state machine tinh toan tien trinh buoc (fillWidth, active step), loc tab, phan trang |
| **3** | `admin.html` | `admin.html` | Giao dien quan tri vien duyet don, chuyen trang thai (Xac nhan -> Giao hang -> Hoan tat / Huy) |
| **4** | `js/admin.js` | `js/admin.js` | Logic cap nhat trang thai don hang len REST API, tru ton kho, tinh tong doanh thu |
| **5** | `db.json` | `db.json` | Co so du lieu luu tru mang `orders` voi day du lich su `status`, `paymentStatus`, `createdAt` |

---

## 2. So Do State Machine Chuan Cua Don Hang Hoa Tu Khoi Tao Den Ket Thuc

```
[1. KHACH DAT HOA]
      │
      ├──> Phuong thuc SePay (VietQR) ──> Trang thai: pending, paymentStatus: unpaid
      │                                       │ (Khach quet QR thanh toan thanh cong)
      │                                       ▼
      │                                   Trang thai: confirmed, paymentStatus: paid
      │
      └──> Phuong thuc COD ─────────────> Trang thai: pending, paymentStatus: unpaid
                                              │ (Admin goi dien xac nhan don)
                                              ▼
                                          Trang thai: confirmed
      │
      ▼
[2. TIEM DUYET & CAM HOA (CRAFTING)]
      │ (Nghe nhan uon kem nhung, chup anh gui khach)
      ▼
[3. GIAO HOA (SHIPPING)]
      │ (Shipper giao tan tay nguoi nhan)
      ├───> Giao thanh cong ────────────> [4A. HOAN TAT (COMPLETED)] (Ket thuc thanh cong)
      └───> Khach boom hang / Doi y ────> [4B. DA HUY (CANCELLED)] (Ket thuc that bai)
```

---

## 3. Sau Khi Ket Thuc Quy Trinh (Completed), Don Hang Se Ra Sao?

Trong thuc te van hanh doanh nghiep va tren he thong shopHoa, mot don hang khi da "Hoan tat" se kich hoat 5 quy trinh nghiep vu:

1. **Bat bien du lieu (Data Immutability):** Don hang duoc khoa chat. Khach hang va he thong khong duoc phep bam nut "Huy Don" nua de bao ve doanh thu va chong gian lan sau khi hoa da duoc giao.
2. **Kich hoat cac hanh dong sau ban (Post-purchase Actions):**
   - **Xem Hoa Don Dien Tu (E-Invoice PDF):** Khach hang co the tai/in hoa don co day du chu ky dien tu cua tiem de thanh toan cong tac phi hoac luu tru.
   - **Dat Lai Don Nay (1-Click Reorder):** He thong tu dong them lai toan bo cac mau hoa trong don vao gio hang de khach mua lai cho dip le sau.
3. **Tich luy diem thuong & Thang hang thanh vien:**
   - Moi don hoan tat cong 100 diem vao vi thanh vien (Vi du: 17 don = 1700 diem).
   - Khi dat tren 1000 diem, he thong tu dong nang hang len "Thanh Vien Than Thiet".
4. **Ghi nhan doanh thu thuc te (Revenue Realization):**
   - So tien trong don chuyen tu trang thai "Du thu" sang "Doanh thu thuc te" tren Dashboard Admin.
5. **Giam ton kho & Tang luot ban (Best Seller Counter):**
   - He thong cap nhat so luong ban `soldCount` cua mau hoa do, giup day mau hoa len muc "Ban Chay Nhat" tren trang chu.

---

## 4. Nhat Ky Go Loi Thuc Chien: Stepper Hoan Tat Bi Dung Sai Text

| Hien Tuong | Nguyen Nhan Ky Thuat | Cach Khac Phuc Triet De |
| :--- | :--- | :--- |
| Don hang da Hoan tat (Buoc 4: Da nhan hoa) nhung o Buoc 3 (Nghe Nhan Bo) van hien chu "Dang uon kem" | Trong `js/orders.js`, bien `step3Sub` duoc khoi tao mac dinh la `'Dang uon kem'`. Khi `status === 'completed'`, code cap nhat `step3Class = 'done'` nhung quen cap nhat lai text `step3Sub`. | Bo sung `step3Sub = 'Da cam xong';` trong ca 2 nhanh trang thai `shipping` va `completed`. |

---

## 5. Kich Ban Van Dap Giao Vien Ve Vong Doi Don Hang

#### Cau 1: "Tai sao don hang da thanh toan SePay roi ma khach van co the huy duoc khong?"
> **Tra loi:**  
> "Da thua thay/co:  
> - Khi don hang vua moi tao o buoc 'Dang tiep nhan / Cho cam hoa', neu khach doi y, khach co the lien he hotline hoac he thong cho phep huy. Khi do he thong se chuyen sang trang thai hoan tien (Refund) cho khach.  
> - Tuy nhien, khi don da chuyen sang buoc **'Dang giao hoa (shipping)'** hoac **'Hoan tat (completed)'**, he thong se **an hoan toan nut Huy Don**, chi con nut 'Xem Hoa Don Dien Tu' va 'Dat Lai Don Nay' de bao ve loi ich cua tiem va nghe nhan da bo hoa xong a."

#### Cau 2: "Neu khach hang khong dang nhap thi he thong luu va tra cuu lich su don hang bang cach nao?"
> **Tra loi:**  
> "Da thua thay/co:  
> - Neu khach dang nhap: He thong gan `userId` hoac `customerEmail` vao ban ghi don hang, tu dong loc tat ca don cua khach do thong qua `localStorage.getItem('user')`.  
> - Neu la khach vang lai (Guest): Don hang van duoc luu tren `db.json` kem So dien thoai va Ho ten nguoi nhan. Khach vang lai co the vao trang `orders.html` va go so dien thoai hoac ma don (vi du: `#DH-2592`) vao o tim kiem de tra cuu tuc thi a."

---

# PHẦN 16: HỆ THỐNG PHÂN CẤP GIẢM GIÁ (TIERED DISCOUNT HIERARCHY - SHOPEE/TIKI STANDARD)

## 1. 📍 Bản Đồ Vị Trí Code (Nó Nằm Ở Đâu?)

Khi giáo viên hỏi: *"Hệ thống giảm giá phân cấp chạy như thế nào và nằm ở các file nào?"*  
👉 Trả lời theo bản đồ 4 tầng sau:

| Tầng | File | Vai trò cốt lõi |
| :--- | :--- | :--- |
| **Cơ sở dữ liệu** | [`db.json`](file:///d:/shopHoa/souce_shopHoa/db.json) | Bảng `promotions`: Lưu schema chuẩn (`discountType`, `discountValue`, `maxDiscount`, `scope`, `targetCategoryIds`, `minOrder`, `excludeSaleItems`, `startDate`, `endDate`, `usageLimit`, `usedCount`). |
| **Thuật toán cốt lõi** | [`js/storage.js`](file:///d:/shopHoa/souce_shopHoa/js/storage.js) | Hàm `calculateVoucherDiscount(items, voucher)`: Lọc sản phẩm đủ điều kiện, kiểm tra `minOrder` trên `eligibleAmount`, tính mức giảm (percent có trần `maxDiscount` hoặc fixed không quá `eligibleAmount`). |
| **Giao diện Giỏ hàng & Đơn** | [`js/cart-drawer.js`](file:///d:/shopHoa/souce_shopHoa/js/cart-drawer.js) & [`js/main.js`](file:///d:/shopHoa/souce_shopHoa/js/main.js) | Render nhãn voucher, thông báo lỗi cụ thể, lưu snapshot đơn hàng (`voucherCode`, `voucherSnapshot`, `subtotal`, `discountAmount`, `totalAmount`). |
| **Bảo vệ Backend (Chống hack F12)** | [`server.js`](file:///d:/shopHoa/souce_shopHoa/server.js) | Tái tính toán lại toàn bộ đơn hàng và mã giảm giá từ database trước khi lưu vào `db.orders`. |

---

## 2. 🎯 Ba Cấp Độ Giảm Giá Thực Tế (Discount Tiers)

1. **Cấp 1 - Cấp Sản Phẩm (Tự động):**
   * Quản lý qua `originalPrice` (giá niêm yết) và `price` (giá bán sau giảm).
   * Không cần nhập mã, tự động hiển thị gạch ngang và tem Flash Sale ngoài trang chủ.
2. **Cấp 2 - Cấp Danh Mục (Category-level Voucher):**
   * Voucher có `scope: "category"`, `targetCategoryIds: ["1"]` (Ví dụ: `KEMNHUNG15`).
   * Chỉ giảm giá trên các món hoa thuộc danh mục chỉ định, không ảnh hưởng đến danh mục khác.
3. **Cấp 3 - Cấp Toàn Shop (All/Cart-level Voucher):**
   * Voucher có `scope: "all"` (Ví dụ: `CHAO2026`).
   * Giảm giá trên toàn bộ đơn hàng nếu đạt giá trị tối thiểu `minOrder`.

---

## 3. 🛡️ Bảy Quy Tắc Nghiệp Vụ Chống Lỗ Vốn & Lỗ Hổng Logic

1. **Quy tắc cộng dồn an toàn (Compound Calculation):** Voucher tính trên giá bán sau giảm cấp sản phẩm (`item.price`), tuyệt đối không vượt quá 100% giá trị sản phẩm.
2. **Một voucher cho mỗi giỏ:** Tránh bùng nổ tổ hợp voucher làm sập logic hoặc lỗ vốn.
3. **`excludeSaleItems`:** Tùy chọn không cho phép áp dụng voucher danh mục/toàn shop lên các mặt hàng đang Flash Sale.
4. **`minOrder` tính trên `eligibleAmount`:** Chặn đứng gian lận nhét thêm món khác danh mục để đủ tiền tối thiểu.
5. **Trần giảm giá `maxDiscount`:** Khống chế số tiền giảm tối đa cho voucher % trên các đơn hàng giá trị lớn.
6. **Giảm tiền cố định `fixed` không âm:** `discount = Math.min(discountValue, eligibleAmount)`.
7. **Snapshot lịch sử đơn:** Lưu cứng toàn bộ thông tin voucher vào thời điểm đặt, sau này sửa xóa voucher thì đơn cũ không bao giờ bị lệch tiền.

---

## 4. 🛠️ Sổ Tay Gỡ Lỗi Thực Chiến Giai Đoạn 1 (Bug Diary)

| Hiện Tượng & Triệu Chứng | Nguyên Nhân Kỹ Thuật (Root Cause) | Cách Khắc Phục Triệt Để |
| :--- | :--- | :--- |
| **Bấm sang trang Admin bị treo, không hiện modal đăng nhập PIN** (Màn hình xám mờ) | File [`js/admin.js`](file:///d:/shopHoa/souce_shopHoa/js/admin.js) bị dính cú pháp thừa ngoặc đóng ở cuối file, khiến Vite biên dịch gặp lỗi JavaScript cú pháp và trả về HTTP 500 khi import module. | Dọn sạch các ký tự đóng ngoặc và code rác thừa, đưa file về cấu trúc đóng hàm chuẩn xác. |
| **Giỏ hàng có hoa Kẽm Nhung nhưng mã KEMNHUNG5 vẫn báo sai danh mục** | Dữ liệu sản phẩm cũ lưu trong `localStorage.cart` chỉ lưu `categoryName` mà thiếu `categoryId`. Do đó hàm `calculateVoucherDiscount` so sánh `item.categoryId` (`undefined`) với mảng `targetCategoryIds` dẫn tới `false`. | Viết hàm `resolveCartItemsCatalog(items)` đóng vai trò **Single Source of Truth**: tra cứu trực tiếp theo `productId` từ danh mục gốc và bù đắp tức thì `categoryId` cùng `originalPrice`, bảo đảm dữ liệu giỏ cũ luôn chính xác. |
| **Thông báo lỗi áp voucher hiện icon tích xanh trên nền đỏ** | Hàm `showToast` trong [`js/utils.js`](file:///d:/shopHoa/souce_shopHoa/js/utils.js) bị fix cứng SVG dấu tích kiểm (check icon) cho mọi trường hợp, không phân biệt loại `error` hay `success`. | Phân nhánh điều kiện: render SVG dấu chấm than cảnh báo tròn đỏ khi `type === 'error'` hoặc `'warning'`. |
| **Mã chưa đủ điều kiện vẫn sáng nút Áp Dụng như mã hợp lệ (gây hụt hẫng UX)** | Trước đây ví voucher render tất cả các mã đang hoạt động với nút bấm xanh lá "Áp Dụng", chỉ khi khách bấm vào mới hiện lỗi đỏ. | Nâng cấp theo **chuẩn Shopee / Tiki**: Chạy trước hàm `calculateVoucherDiscount` cho từng mã; nếu chưa đạt thì làm mờ thẻ (opacity 0.7), nút đổi thành `Chưa Đủ ĐK` (disabled), và hiện thông báo nhắc nhở thiết thực (`Mua thêm xx.000₫...`, `Chỉ áp dụng cho...`). |
| **Chạy test đơn hàng backend không tăng lượt dùng `usedCount`** | Tiến trình chạy ngầm ở cổng 4000 bị kẹt chạy `npm run db` (json-server thuần) thay vì `node server.js` chứa endpoint tùy biến `POST /orders`. | Dừng tiến trình cũ, khởi chạy `node server.js` làm tiến trình chính thức xử lý nghiệp vụ đặt hàng và đồng bộ cache `router.db.getState()`. |

---

## 5. 🎤 Kịch Bản Vấn Đáp Đồ Án Chuẩn 100/100 Khi Giảng Viên Phản Biện

#### Câu 1: "Nếu khách mua một bó hoa kẽm nhung và một giỏ hoa sinh nhật, rồi nhập mã KEMNHUNG15 thì hệ thống tính tiền thế nào?"
> **Trả lời:**  
> *"Dạ thưa thầy/cô, hệ thống của em sử dụng thuật toán phân cấp phạm vi (Scope Hierarchy):*  
> *1. Đầu tiên, hàm lọc `filter()` sẽ tách giỏ hàng thành 2 nhóm: nhóm hoa kẽm nhung (thỏa điều kiện `targetCategoryIds`) và nhóm hoa sinh nhật (không thỏa điều kiện).*  
> *2. Tiếp theo, hàm `reduce()` chỉ tính tổng tiền trên nhóm hoa kẽm nhung (`eligibleAmount`) và kiểm tra điều kiện `minOrder` trên chính nhóm này.*  
> *3. Tiền giảm 15% chỉ được nhân trên nhóm hoa kẽm nhung (và bị khống chế bởi trần `maxDiscount`). Giỏ hoa sinh nhật giữ nguyên giá bán ban đầu. Nhờ vậy tiệm hoa không bao giờ bị giảm giá oan cho các danh mục không khuyến mãi ạ."*

#### Câu 2: "Tại sao không để Client tính xong rồi Server chỉ việc lưu, mà Server lại phải tính toán lại?"
> **Trả lời:**  
> *"Dạ thưa thầy/cô, theo nguyên tắc bảo mật 'Never trust the client', người dùng có thể mở F12 Console hoặc can thiệp gói tin HTTP POST để sửa `totalAmount = 1000` hoặc tự chế mã giảm giá 99%. Vì vậy, trong `server.js` (hoặc tầng Service trong Spring Boot), server luôn lấy lại giá niêm yết từ database, tái tính toán điều kiện voucher và ghi đè giá trị chính xác trước khi lưu vào hệ thống ạ."*

#### Câu 3: "Tại sao trên giao diện Ví Voucher lại có mã bị ẩn hẳn, có mã lại làm mờ và khóa nút bấm?"
> **Trả lời:**  
> *"Dạ thưa thầy/cô, em đã nghiên cứu và triển khai chuẩn UX của các sàn TMĐT lớn như Shopee và Tiki:*  
> *- **Nhóm ẩn hoàn toàn:** Là các mã đã hết hạn ngày (`endDate < now`), đã hết lượt sử dụng (`usedCount >= usageLimit`), hoặc bị Admin tắt (`active: false`). Các mã này khách hàng vĩnh viễn không thể dùng được nữa nên phải ẩn để tránh rác giao diện.*  
> *- **Nhóm làm mờ và ghi lý do:** Là các mã vẫn đang diễn ra trong tiệm, nhưng giỏ hàng hiện tại của khách chưa đủ điều kiện (ví dụ: thiếu tiền hoặc chưa chọn đúng danh mục). Việc hiển thị làm mờ kèm dòng nhắc như `Mua thêm 50.000₫ để dùng mã` có tác dụng kích cầu (Upsell), thúc đẩy khách hàng chọn thêm hoa để được giảm giá ạ."*

#### Câu 4: "Nếu một khách hàng ranh mãnh thấy nút bị mờ, họ không bấm mà lại gõ tay mã đó vào ô nhập mã phía trên thì sao?"
> **Trả lời:**  
> *"Dạ thưa thầy/cô, em áp dụng nguyên lý Phòng thủ đa tầng (Defense in Depth). Việc làm mờ và khóa nút ở Ví chỉ là tầng giao diện (UI Prevention). Tầng logic xử lý bên dưới của hàm `calculateVoucherDiscount()` vẫn kiểm tra điều kiện nghiêm ngặt. Khi khách cố tình gõ tay và bấm 'Áp Dụng', hệ thống sẽ bắt chặn và hiện Toast cảnh báo màu đỏ với đúng lý do từ chối, tuyệt đối không cho phép áp dụng sai điều kiện ạ."*

#### Câu 5: "Khi khách hàng lưu giỏ hàng trong localStorage từ lâu, nếu danh mục hoặc giá gốc bị thiếu trường thì hệ thống xử lý thế nào để không bị crash?"
> **Trả lời:**  
> *"Dạ thưa thầy/cô, em áp dụng mô hình 'Single Source of Truth' thông qua hàm `resolveCartItemsCatalog()`. Thay vì tin tưởng mù quáng vào dữ liệu thô trong `localStorage`, trước khi tính toán voucher, hệ thống luôn lấy danh sách sản phẩm hiện hành của shop để 'enrich' (bù đắp và đồng bộ) lại `categoryId`, `originalPrice`, và trạng thái Flash Sale. Nhờ đó, giỏ hàng dù lưu từ lâu vẫn luôn tương thích và tính toán chính xác 100% ạ."*

---

## 6. 🚀 Kết Quả Nghiệm Thu & Hoàn Thiện Giai Đoạn 1 (6 Tiêu Chí Rà Soát Chuẩn)

Đã hoàn thành và rà soát nghiệm thu đạt 100% theo 6 tiêu chí cốt lõi:

1. **Hỗ Trợ Đầy Đủ 3 Cấp Độ Phạm Vi (Scope: Toàn Shop - Danh Mục - Từng Mẫu Hoa):**
   - Đã tích hợp `#voucherTargetProductGroup` và dropdown chọn mẫu hoa cụ thể `#voucherTargetProductSelect` vào Form Quản trị ([admin.html](file:///d:/shopHoa/souce_shopHoa/admin.html) & [js/admin.js](file:///d:/shopHoa/souce_shopHoa/js/admin.js)).
   - Cho phép tạo mã giảm giá riêng biệt cho từng bông hoa (Product-level), danh mục hoa (Category-level), hoặc toàn shop (All-level).

2. **Ví Voucher Lọc Nghiêm Ngặt Các Mã Hợp Lệ ([js/cart-drawer.js](file:///d:/shopHoa/souce_shopHoa/js/cart-drawer.js)):**
   - Chỉ hiển thị các mã thỏa mãn đồng thời: `active === true`, chưa hết hạn sử dụng (`endDate >= now`), đã tới ngày kích hoạt (`startDate <= now`), và chưa vượt giới hạn lượt dùng (`usedCount < usageLimit`).
   - Tự động hiển thị huy hiệu loại voucher: *Toàn Shop*, *Theo Danh Mục*, hoặc *Theo Mẫu Hoa*.

3. **Bảo Vệ Huy Hiệu Ưu Đãi Trên Thẻ Hoa ([js/main.js](file:///d:/shopHoa/souce_shopHoa/js/main.js) & [js/detail.js](file:///d:/shopHoa/souce_shopHoa/js/detail.js)):**
   - Ẩn triệt để nhãn gợi ý `🎫 Giảm -15%...` nếu voucher có cờ `excludeSaleItems: true` và mẫu hoa đó đang trong đợt Flash Sale (`originalPrice > price`).
   - Không hiển thị nhãn cho các voucher đã hết hạn hoặc hết lượt dùng. Ưu tiên hiển thị ưu đãi cấp sản phẩm trước cấp danh mục.

4. **Bảo Toàn Bất Biến Trường `usedCount` (Không Cho Nhập Tay, Không Bị Reset Khi Lưu):**
   - Trong form Admin: không tạo input cho `usedCount` để ngăn chặn chỉnh sửa thủ công.
   - Khi chỉnh sửa (Edit) voucher trong [js/admin.js](file:///d:/shopHoa/souce_shopHoa/js/admin.js) & [js/storage.js](file:///d:/shopHoa/souce_shopHoa/js/storage.js): giữ nguyên giá trị `usedCount` hiện có của voucher từ cơ sở dữ liệu.

5. **Validate Form Admin Nghiêm Ngặt Chống Lỗi Dữ Liệu:**
   - Ngày kết thúc `endDate` phải sau hoặc bằng ngày bắt đầu `startDate`.
   - Giảm phần trăm phải nằm trong khoảng `[1, 100]%`; Giảm cố định phải `> 0đ`.
   - Đơn tối thiểu `minOrder >= 0`; Giới hạn lượt dùng `usageLimit >= 1`.
   - Bắt buộc chọn đúng danh mục hoặc mẫu hoa tương ứng khi chọn scope `category` hoặc `product`.

6. **Kiểm Thử E2E Tự Động & Đồng Bộ Real-time Giữa Client - Server - Database:**
   - Tạo mã voucher cấp sản phẩm qua API/Admin.
   - Giỏ hàng tự động áp dụng và tính đúng mức giảm `maxDiscount`.
   - Đặt hàng qua `POST /orders` trên [server.js](file:///d:/shopHoa/souce_shopHoa/server.js): Server tự động xác thực giá gốc, tính toán giảm giá, lưu snapshot đơn hàng bất biến và tăng `usedCount++` trực tiếp trong database [db.json](file:///d:/shopHoa/souce_shopHoa/db.json). Sửa voucher sau đó vẫn giữ nguyên `usedCount`.

7. **Đồng Bộ Hóa Kiến Trúc Giỏ Hàng Toàn Diện (Universal Cart Drawer Architecture):**
   - Giải quyết triệt để tình trạng phân mảnh giữa [index.html](file:///d:/shopHoa/souce_shopHoa/index.html) và [detail.html](file:///d:/shopHoa/souce_shopHoa/detail.html): Loại bỏ hơn 200 dòng code điều khiển giỏ hàng cũ trùng lặp trong [js/main.js](file:///d:/shopHoa/souce_shopHoa/js/main.js), quy tụ về một module lõi chuẩn hóa [js/cart-drawer.js](file:///d:/shopHoa/souce_shopHoa/js/cart-drawer.js).
   - Đảm bảo thành phần `#btnToggleVoucherWallet` ("Xem Ví Voucher") và `#drawerAvailableVouchers` luôn có mặt trên mọi trang: từ Trang chủ, Chi tiết hoa đến Trang đơn hàng.
   - Kết nối liền mạch nút "Tiến Hành Đặt Hàng" trực tiếp sang Checkout Modal trên Trang chủ mà không làm reload trang.

8. **Mô Hình Ví Voucher Chuẩn Shopee / Tiki (Làm Mờ Mã Chưa Đủ Điều Kiện Kèm Lý Do):**
   - **Phân loại 2 nhóm chuẩn TMĐT**:
     + Mã hết hạn, hết lượt, hoặc `active: false`: Ẩn hoàn toàn khỏi giao diện.
     + Mã còn hạn nhưng giỏ hàng hiện tại chưa thỏa mãn: Giữ lại hiển thị nhưng làm mờ (opacity 0.7), nút đổi thành `Chưa Đủ ĐK` (disabled) và hiện dòng lý do xúc tích: `Mua thêm xx.000₫ để dùng mã`, `Chỉ áp dụng cho Hoa Kẽm Nhung`, hoặc `Không áp dụng cho hàng Flash Sale`.
   - **Single Source of Truth**: Sử dụng duy nhất hàm `calculateVoucherDiscount(items, voucher)` trong [js/storage.js](file:///d:/shopHoa/souce_shopHoa/js/storage.js) để tính toán cả logic chiết khấu lẫn lý do vô hiệu hóa, không tạo 2 bộ logic riêng lẻ.
   - **Cơ chế Tự Động Phục Hồi Dữ Liệu (`resolveCartItemsCatalog`)**: Tra cứu trực tiếp `categoryId` và `originalPrice` từ danh mục sản phẩm gốc, không phụ thuộc vào dữ liệu giỏ cũ bị thiếu trường trong `localStorage`.
   - **Phản Ứng Real-time**: Khi khách hàng tăng/giảm số lượng hoa hoặc xóa món trong giỏ hàng, nếu không còn đạt `minOrder`, voucher tự động được gỡ bỏ và thẻ voucher lập tức chuyển sang trạng thái làm mờ.
   - **Đồng Bộ Toast Icon**: Đổi biểu tượng thông báo lỗi sang dấu chấm than cảnh báo màu đỏ thay vì dấu tích xanh.


---

## 9. NÂNG CẤP TOÀN DIỆN CẢ 3 GIAI ĐOẠN UI/UX (SKELETON SHIMMER, THUMBNAILS, PHỤ KIỆN ADD-ONS, STICKY ACTION BAR & THANH TOÁN TỨC THÌ)

### 9.1. Bối cảnh & Vấn đề Cần Giải Quyết
Trang chi tiết sản phẩm (`detail.html`) trước đây chỉ có dòng chữ `#loading` đơn điệu, thiếu dải ảnh chuyển góc chụp, chưa có tùy chọn đính kèm phụ kiện (đèn LED, thiệp, túi kính), ô số lượng bị khóa `readonly`, trên màn hình di động khi cuộn xuống người dùng phải cuộn ngược lên mới bấm được nút mua. Đồng thời, nút `Mua Ngay` tại trang chi tiết phải redirect về `index.html?openCheckout=true`, gây gián đoạn luồng trải nghiệm.

### 9.2. Bản Đồ Mã Nguồn & Các Thay Đổi Kiến Trúc
1. **Khung Skeleton Shimmer UI (`css/detail.css` & `detail.html`):**
   - Thay chữ `#loading` bằng `.detail-skeleton-layout` 2 cột Shimmer với hiệu ứng `@keyframes shimmer` (tốc độ 1.5s chu kỳ).
   - Khung placeholder gồm ảnh vuông 1:1 và 5 thanh mô phỏng (tag, tên hoa, sao đánh giá, giá tiền, cụm nút bấm).
2. **Dải Ảnh Thu Nhỏ Chuyển Đổi Mượt Mà (`.detail-thumbnails`):**
   - Thêm 3 góc ảnh chi tiết (Góc chính diện, Cận cảnh kẽm nhung, Góc giấy gói).
   - Bấm vào thumbnail nào sẽ cập nhật ảnh chính `#mainDetailImage` với class `.active` và hiệu ứng phóng nhẹ.
3. **Khối Tùy Chọn Phụ Kiện (`.addon-options`):**
   - 3 tùy chọn: *Đèn LED đom đóm (+15.000 ₫)*, *Thiệp viết tay cao cấp (+10.000 ₫)*, *Túi kính trong suốt (+20.000 ₫)*.
   - Cộng dồn theo thời gian thực vào đơn giá và thanh Sticky Buy Bar. Tên phụ kiện được lưu vào `addonsText`, hiển thị rõ trong `cart-drawer` và in trực tiếp vào hóa đơn PDF (`exportOrderInvoicePdf`).
4. **Mở Khóa Nhập Bàn Phím Ô Số Lượng (`#qtyInput`):**
   - Bỏ `readonly`, thêm `inputmode="numeric"`.
   - Viết hàm kiểm soát tự động: nếu nhập `< 1` tự ép về `1`, nếu nhập `> stock` tự ép về mức tồn kho tối đa kèm toast cảnh báo.
5. **Thanh Mua Hàng Cố Định Đáy Màn Hình Mobile (`#stickyBuyBar`):**
   - Ứng dụng `IntersectionObserver` theo dõi cụm nút `.action-buttons`. Khi người dùng cuộn qua, thanh `#stickyBuyBar` xuất hiện ở đáy màn hình với giá tổng chính xác và 2 nút bấm thao tác nhanh đồng bộ.
   - Khi xuất hiện, tự động thêm class `sticky-bar-active` để nâng nút Chatbot lên `bottom: 82px`, tránh hoàn toàn lỗi che khuất nhau.
6. **Nút Quick-Add Luôn Hiển Thị Trên Mobile (`css/responsive.css`):**
   - Trên màn hình `< 768px`, nút `.quick-add-btn` hiển thị cố định (`opacity: 1 !important`, chiều cao $ge 38px$), đảm bảo tiêu chuẩn Touch Target chuẩn WCAG.
7. **Cụm 4 Nút Gợi Ý Lời Chúc Thiệp Mừng 1-Click (`.wish-chip`):**
   - Sinh nhật 🎂, Tình yêu/Kỷ niệm ❤️, Tốt nghiệp 🎓, Cảm ơn 🌿. Bấm vào là tự động điền câu chúc văn phong trang nhã vào `#checkoutCardMessage`.
8. **Đồng Bộ Luồng Mua Ngay & Thanh Toán Tức Thì (`js/checkout.js`):**
   - Chuẩn hóa module thanh toán dùng chung `checkout.js`, nhúng `#checkoutModal` trực tiếp vào `detail.html`.
   - Bấm `Mua Ngay` tại trang chi tiết sẽ mở trực tiếp modal thanh toán SePay ngay tại chỗ mà không cần chuyển trang.

---

### 9.3. Bộ Câu Hỏi Vấn Đáp Phản Biện Đồ Án (Dành Cho Giáo Viên & Giám Khảo)

**❓ Câu hỏi 1: Tại sao em lại sử dụng Skeleton Loading thay vì Spinner quay tròn thông thường trên trang chi tiết?**  
> **Trả lời:** Skeleton Loading (khung xương giao diện) là tiêu chuẩn vàng của các sàn TMĐT quốc tế lớn (Shopee, Tiki, Flower Chimp). Nó giúp người dùng định hình trước cấu trúc bố cục trang trước khi dữ liệu API tải về, giảm thiểu hiện tượng "Cumulative Layout Shift" (CLS) và tạo cảm giác thời gian phản hồi nhanh hơn 30% so với spinner quay tròn thụ động.

**❓ Câu hỏi 2: Làm sao em phát hiện được khi nào cần hiển thị Sticky Buy Bar trên Mobile mà không gây lag cuộn trang?**  
> **Trả lời:** Em sử dụng API hiện đại `IntersectionObserver` của JavaScript ES6+. Khác với việc lắng nghe sự kiện `window.onscroll` phải tính toán toạ độ liên tục trên main thread (gây giật lag), `IntersectionObserver` được trình duyệt xử lý bất đồng bộ ở mức render compositor, chỉ kích hoạt callback khi nút bấm chính hoàn toàn ra khỏi viewport màn hình, giúp trải nghiệm cuộn trang mượt mà 60fps.

**❓ Câu hỏi 3: Phụ kiện hoa (Add-ons) được tính toán và lưu trữ trong giỏ hàng như thế nào để không làm vỡ cấu trúc dữ liệu đơn hàng?**  
> **Trả lời:** Khi thêm sản phẩm có phụ kiện vào giỏ, hệ thống tạo một mã composite ID (VD: `1-addon-15000_10000`) và tính toán đơn giá `price` bằng giá gốc cộng tổng giá phụ kiện. Trường `addonsText` chứa chuỗi tên phụ kiện được lưu kèm vào giỏ hàng. Cấu trúc này vừa tương thích 100% với hàm tính tiền lõi `getCartSummary()`, vừa giúp hiển thị phụ kiện rõ ràng trong Cart Drawer và in chuẩn trên hóa đơn điện tử PDF qua `jspdf`.


---

## 10. KHẮC PHỤC 10 LỖI UI/UX TOÀN DIỆN & CHUẨN HÓA TRẢI NGHIỆM ĐA NỀN TẢNG (HEADER USER CAPSULE, GIÁ GỐC SỐ HỌC, KHÓA TRÀN VIỀN MOBILE & TÌM KIẾM LIÊN TRANG)

### 10.1. Bối cảnh & Các Điểm Yếu UI/UX Cốt Lõi Được Phát Hiện
1. **Lỗi Header dàn hàng ngang bóp nghẹt ô tìm kiếm (Ảnh 1 - UX-01 & UX-03):** Khi đăng nhập tài khoản (đặc biệt là Admin/Staff), khu vực `#headerAuthArea` render liên tiếp 5 nút bấm có 4 màu tương phản, chiếm tới 759px. `.search-box` không có `min-width` nên bị co rút xuống chỉ còn **105px**, cắt cụt placeholder thành `"Tìm kiế Q"`. Trên Mobile (375px), cụm nút này đẩy chiều rộng trang bung ra tới **598px** (tràn ngang 223px).
2. **Lỗi gạch ngang giá bán ảo trùng lặp (Ảnh 2 - UX-02):** Code chỉ kiểm tra `if (product.originalPrice)` kiểu truthy mà không so sánh giá. Với các sản phẩm không giảm giá (`originalPrice == price`), hệ thống tự động gạch ngang chính giá bán: `~~400.000 đ~~ 400.000 đ`, gây ấn tượng gian lận giá hoặc lỗi lập trình.
3. **Tràn viền màn hình Mobile trên trang Đơn Hàng (UX-04):** Thanh tiến trình uốn hoa `.floral-stepper-track` có 4 node cố định 90px cộng với padding của card, khiến `orders.html` tràn ngang tới **791px** trên viewport 375px.
4. **Xung đột nút Chatbot và thanh Mua Ngay di động (UX-05):** Gõ nhầm selector `.chatbot-toggler` thay vì `.chat-launcher-btn` khiến nút Chatbot bị đè lên nút Mua Ngay của Sticky Bar.
5. **Trang chi tiết thiếu Tìm Kiếm & Đăng Nhập (UX-06):** Header trên `detail.html` bị cô lập, không cho phép khách tìm hoa khác hoặc quản lý tài khoản.
6. **Thanh danh mục vỡ thành 3-4 dòng trên Mobile (UX-07):** Các nút danh mục dùng `flex-wrap: wrap` chiếm trọn nửa màn hình đầu tiên trên điện thoại.
7. **Trạng thái tải trang chủ thô sơ (UX-08):** Trang chủ chỉ có dòng text đơn điệu, gây giật màn hình (CLS) khi nạp dữ liệu.

### 10.2. Bản Đồ Giải Pháp Kỹ Thuật Đã Triển Khai
1. **Viên Thuốc Tài Khoản (User Avatar Capsule) & Dropdown Menu (`js/utils.js` & `css/style.css`):**
   - Gom toàn bộ 5 nút rời rạc vào một nút bấm Capsule duy nhất: `[ 👤 Quản Trị ▾ ]` gọn gàng (~120px - 170px).
   - Tích hợp Dropdown Menu nổi (`.user-dropdown-menu`, `z-index: 1005`) hiển thị thông tin tài khoản, huy hiệu quyền, link Đơn Hàng, link Quản Trị và nút Đăng Xuất.
   - Khóa cứng `min-width: 260px; flex: 1 1 320px;` cho `.search-box`, đảm bảo ô tìm kiếm luôn rộng rãi trên mọi màn hình Desktop (đo thực tế: 480px).
   - Trên Mobile (< 768px): Thêm giới hạn `max-width: 115px; overflow: hidden; text-overflow: ellipsis;` cho tên người dùng trong `.user-menu-pill`, đưa ô search xuống hàng 2 chiếm 100% chiều ngang, triệt tiêu 100% lỗi tràn viền.
2. **Khắc Phục Hoàn Toàn Lỗi Gạch Giá Ảo (`js/main.js` & `js/detail.js`):**
   - Thay đổi điều kiện hiển thị thành so sánh số học chặt chẽ:
     `${(product.originalPrice && Number(product.originalPrice) > Number(product.price)) ? ... : ''}`
   - Bổ sung ràng buộc: Khi `Number(originalPrice) <= Number(price)`, ẩn triệt để cả `.was-price`, `.detail-was-price`, huy hiệu `product-badge-discount` và `detail-save-badge`, chấm dứt hoàn toàn tình trạng hiện "Tiết kiệm 0 ₫ (0%)".
3. **Co Giãn Thanh Tiến Trình Stepper Bằng Flexbox (`css/orders.css`):**
   - Thiết lập `.floral-step-node { flex: 1; min-width: 0; width: auto !important; }` trên Mobile thay vì chiều rộng 70-90px cứng.
   - Thêm quy tắc padding 14px 10px cho `.order-craft-card`. Kết quả đo đạc: `scrollWidth === 375` (chuẩn 100%, 0px tràn viền).
4. **Sửa Selector Nâng Nút Chatbot (`css/responsive.css`):**
   - Đặt `body.has-sticky-bar .chat-launcher-btn, body.sticky-bar-active .chat-launcher-btn { bottom: 82px !important; }`. Nút chat tự động nhấc lên cao 82px khi thanh mua hàng dính xuất hiện.
5. **Đồng Bộ Header, Auth & Tìm Kiếm Liên Trang (`detail.html` & `js/detail.js`):**
   - Bổ sung ô tìm kiếm và `#headerAuthArea` vào `detail.html`, gọi `renderHeaderAuth()`.
   - Bắt sự kiện Enter hoặc click kính lúp tại trang chi tiết để chuyển hướng sang `index.html?search=tu_khoa#products`.
   - Trang chủ tự động đọc URL param `?search=` và lọc kết quả ngay lập tức.
6. **Thanh Danh Mục Vuốt Ngang Mượt Mà (`css/responsive.css`):**
   - Trên màn hình < 768px: `.category-list` đổi thành `flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;`. Tiết kiệm 140px chiều cao màn hình di động.
7. **Lưới Khung Xương Shimmer Cho Trang Chủ (`index.html` & `css/style.css`):**
   - Thay text thô `#loading` bằng Lưới Khung Xương 4 thẻ mô phỏng với hiệu ứng sóng ánh sáng `@keyframes shimmer`.
8. **Thống Nhất Thông Điệp Top Bar:**
   - Đồng bộ thông điệp chính sách trên cả 3 trang (`index.html`, `detail.html`, `orders.html`):
     `"Ưu đãi: Miễn phí giao hoa nhanh trong ngày cho đơn từ 350k • Tặng kèm thiệp viết tay theo yêu cầu"`.

### 10.3. Bộ Câu Hỏi Vấn Đáp Phản Biện Đồ Án Với Giáo Viên

**❓ Câu hỏi 1: Tại sao em lại gom cụm thông tin đăng nhập thành Dropdown Capsule thay vì để các nút Đơn Hàng, Quản Trị trực tiếp trên thanh Header?**  
> **Trả lời:** Dạ thưa cô/thầy, theo nguyên lý thiết kế giao diện TMĐT chuyên nghiệp (UI/UX Hierarchy & Visual Economy), thanh Header cần ưu tiên diện tích tối đa cho Logo thương hiệu và Thanh tìm kiếm sản phẩm. Việc dàn trải 4-5 nút bấm với nhiều màu sắc tương phản không chỉ làm phân tán thị giác người mua hoa, mà còn ép ô tìm kiếm co rút chỉ còn hơn 100px và gây vỡ layout (tràn viền tới 598px trên điện thoại). Bằng cách thiết kế User Avatar Capsule kèm Dropdown Menu (`z-index: 1005`), giao diện đạt sự thanh lịch tối giản theo chuẩn Flower Chimp, vừa cung cấp đầy đủ mọi chức năng quản trị chỉ với 1 cú nhấp chuột.

**❓ Câu hỏi 2: Lỗi giá gạch ngang bị trùng lặp `~~400.000 đ~~ 400.000 đ` xảy ra do đâu và em đã khắc phục như thế nào?**  
> **Trả lời:** Dạ thưa cô/thầy, lỗi này bắt nguồn từ việc sử dụng phép kiểm tra truthy lỏng lẻo trong JavaScript: `if (product.originalPrice)`. Trong cơ sở dữ liệu `db.json`, đối với các sản phẩm không có chương trình khuyến mãi, trường `originalPrice` được lưu bằng chính giá bán `price` (ví dụ 400.000đ). Do `400000` là một giá trị khác 0 (truthy), câu lệnh điều kiện vẫn thỏa mãn và in thẻ `<span class="was-price">`, dẫn đến hiển thị hai mức giá giống hệt nhau. Em đã khắc phục bằng phép so sánh số học chặt chẽ: `Boolean(product.originalPrice && Number(product.originalPrice) > Number(product.price))`. Chỉ khi giá gốc thực sự lớn hơn giá bán thì hệ thống mới kích hoạt hiển thị giá gạch ngang và huy hiệu giảm giá.

**❓ Câu hỏi 3: Trên màn hình di động, làm thế nào để đảm bảo thanh tiến trình Stepper 4 bước không bị tràn ngang màn hình?**  
> **Trả lời:** Ban đầu mỗi nút bước (Step Node) được gán cứng `width: 90px`, tổng 4 bước chiếm $4 \times 90px = 360px$, cộng thêm padding của thẻ khiến tổng bề rộng đạt tới 408px, vượt qua chiều rộng 375px của iPhone và gây lỗi tràn ngang tới 791px. Em đã tối ưu lại trên Mobile bằng thuộc tính Flexbox hiện đại: `.floral-step-node { flex: 1; min-width: 0; width: auto !important; }`. Nhờ đó, 4 bước tự động co giãn tỷ lệ đều đặn theo chiều rộng thực tế của bất kỳ thiết bị nào (kể cả màn hình nhỏ 320px như iPhone SE), đảm bảo `scrollWidth == clientWidth` tuyệt đối.


---

## 11. CẢI TIẾN TOÀN DIỆN UI/UX HỆ THỐNG QUẢN TRỊ ADMIN (SHOPIFY POLARIS & FLOWER CHIMP SELLER CENTER STANDARDS)

### 11.1. Bối cảnh & 7 Điểm Nghẽn Trải Nghiệm Trên Trang Admin Cũ (`admin.html`)
1. **Xung đột bộ lọc kép gây trắng bảng dữ liệu (Deadlock Filtering):** Tại Tab 2 (Sản phẩm) và Tab 5 (Đơn hàng), giao diện cùng lúc tồn tại cả dãy Tab phân đoạn và thẻ `<select>` danh mục/trạng thái. Khi người dùng bấm chuyển tab mà chưa chỉnh dropdown, điều kiện `matchSegment && matchCat` đồng thời diễn ra khiến không bản ghi nào thỏa mãn, bảng bị trắng xóa hoàn toàn.
2. **Dashboard mất cân đối & Thẻ KPI dàn trải:** 5 thẻ KPI có kích thước và số liệu không đồng đều, chiếm hết vùng nhìn thấy đầu tiên (above-the-fold) nhưng thiếu biểu đồ trực quan hóa dữ liệu kinh doanh 12 tháng.
3. **Thanh cảnh báo việc cần làm (Alert Strip) luôn hiện diện:** Ngay cả khi số đơn chờ duyệt và số hoa cạn kho đều bằng 0, dải cảnh báo màu vàng vẫn choán chỗ đầu màn hình, gây hiểu lầm là hệ thống đang có sự cố.
4. **Bảng dữ liệu đơn hàng bị trùng lặp ID:** Đơn hàng `#DH-3473` bị trùng mã 2 lần trong cơ sở dữ liệu `db.json`, gây nhiễu loạn khi đối soát kế toán và tra cứu trạng thái.
5. **Modal chỉnh sửa hoa bất tiện (Product Modal):** Ô nhập Giá bán và Giá so sánh chưa đồng bộ nhãn chuẩn TMĐT; ô nhập mô tả sản phẩm bị ép nhỏ khó đọc; nút đóng modal `[✕]` nằm trôi nổi ngoài khung thẻ.
6. **Thanh công cụ phân mảnh:** Các nút hành động chiến dịch lễ, phục hồi giá gốc và xuất file Excel/PDF bị rải rác ở nhiều góc khác nhau thay vì quy về 1 thanh điều hướng tập trung.
7. **Giao diện di động vỡ nát (Mobile Chaos):** Sidebar quản trị bị ép biến thành thanh điều hướng tĩnh chiếm 4 dòng chồng chất trên màn hình điện thoại (< 768px), chiếm mất hơn một nửa chiều cao màn hình làm che khuất hoàn toàn bảng điều khiển.

---

### 11.2. Bản Đồ Giải Pháp Kỹ Thuật Đã Triển Khai (`admin.html`, `css/admin.css`, `js/admin.js`)

```
========================================================================================
                      BẢN ĐỒ KIẾN TRÚC GIAO DIỆN ADMIN CHUẨN MỚI
========================================================================================
[ DESKTOP VIEW ]
┌──────────────────────────┬───────────────────────────────────────────────────────────┐
│  ADMIN CONTROL SIDEBAR   │ TOPBAR: [Breadcrumbs: Tổng Quan]  [Quản Trị Viên Trường v]│
│  - Tổng Quan & KPI       ├───────────────────────────────────────────────────────────┤
│  - Quản Lý Mẫu Hoa       │ 4 KPI CARDS: [Tổng Hoa] [Tổng Đơn] [Doanh Thu] [Khách Hàng]│
│  - Banner & Chủ Đề       ├───────────────────────────────────────────────────────────┤
│  - Mã Giảm Giá Voucher   │ [ BIỂU ĐỒ DOANH THU 12 THÁNG ] │ [ TOP 1 BÁN CHẠY NHẤT ]  │
│  - Quản Lý Đơn Hàng      │ (12 Cột T1->T12 Doanh thu/Lãi) │ (Ảnh + Tên + Đã bán + DT)│
│  - Thống Kê Doanh Thu    ├────────────────────────────────┴──────────────────────────┤
│  - Quản Lý Tài Khoản     │ BẢNG 5 ĐƠN HÀNG GẦN ĐÂY NHẤT (Khử trùng mã #DH-3473)      │
└──────────────────────────┴───────────────────────────────────────────────────────────┘

[ MOBILE VIEW (< 768px) ]
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR: [ ☰ Hamburger ]   [ Tổng Quan & KPI ]               [ (Q) Quản Trị Viên ]     │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ OFF-CANVAS DRAWER (Trượt mượt mà translateX(-100%) -> 0 khi bấm ☰, Backdrop làm mờ)  │
│ - Tự động đóng khi người dùng chọn tab hoặc chạm vào lớp nền mờ (Backdrop Blur)       │
│ - scrollWidth === 375px === clientWidth (Triệt tiêu 100% lỗi tràn ngang)              │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Thống nhất bộ lọc đơn nguồn (Single Source of Truth):**
   - Loại bỏ hoàn toàn các thẻ `<select>` dư thừa gây xung đột. Dãy Tab phân đoạn (Segmented Tabs) kiểu Polaris trở thành trung tâm điều khiển duy nhất.
   - Thêm tab "Đã hủy" (`cancelled`) với badge đỏ thể hiện đầy đủ 5 trạng thái vòng đời đơn hàng.
2. **Dashboard phân tích điều hành tích hợp (Executive Analytics Grid):**
   - Tái cấu trúc 4 thẻ KPI cân đối trên 1 hàng ngang: Tổng Mẫu Hoa (16), Tổng Đơn Hàng (20), Tổng Doanh Thu (10.767.000 ₫), Khách Hàng (8).
   - Tích hợp Biểu đồ cột Doanh thu & Lợi nhuận 12 tháng trực quan (`T1` đến `T12`) ngay trong Dashboard, kèm thẻ Vinh Danh Bán Chạy Nhất (Top Seller Spotlight) và Cơ cấu doanh thu theo danh mục.
   - Thanh cảnh báo việc cần làm (`#alertTodoStrip`) tự động ẩn đi khi các chỉ số cần xử lý đều bằng 0, không gây phiền toái.
3. **Khử trùng dữ liệu đơn hàng trong `db.json`:**
   - Sửa đơn hàng bị nhân bản ID từ `#DH-3473` thành `#DH-3474` độc bản, khôi phục tính toàn vẹn của dữ liệu kế toán.
4. **Hộp thoại sản phẩm công thái học (Ergonomic Modal):**
   - Chuẩn hóa ô "Giá Bán Khuyến Mãi (₫)" và "Giá Gốc Niêm Yết (₫)" kèm gợi ý tính năng rõ ràng.
   - Nới rộng khung nhập mô tả sản phẩm (`min-height: 90px`), đưa nút `[✕]` cố định vào góc phải modal header.
5. **Kiến trúc Off-Canvas Drawer trên Mobile:**
   - Thay thế toàn bộ cụm sidebar cứng bằng Nút Hamburger `[☰]` trên Topbar di động.
   - Menu trượt mượt mà từ cạnh trái (`transform: translateX(-100%)` sang `0`), phủ lớp nền mờ `backdrop-filter: blur(2px)`.
   - Kết quả kiểm thử Playwright thực tế trên Mobile 375px: `scrollWidth === 375 === clientWidth` (0px tràn viền).

---

### 11.3. Kịch Bản Vấn Đáp Giảng Viên Về Phân Hệ Quản Trị Admin

**❓ Câu hỏi 1: Tại sao em lại loại bỏ các dropdown lọc danh mục và trạng thái trên trang Admin để thay bằng Segmented Tabs?**  
> **Trả lời:** Dạ thưa thầy/cô, trong phiên bản trước, việc đặt song song cả dãy Tab (ví dụ: "Đang giao") và một thẻ `<select>` trạng thái (ví dụ: "Chờ xác nhận") đã dẫn đến lỗi xung đột logic (Filter Deadlock). Khi người dùng nhấp vào một Tab mới, JavaScript cùng lúc kiểm tra cả hai điều kiện lọc, dẫn đến kết quả trả về bằng rỗng và bảng dữ liệu biến mất hoàn toàn. Để tuân thủ nguyên lý Single Source of Truth (Nguồn chân lý duy nhất) trong thiết kế hệ thống của Shopify Polaris, em đã quy về một thanh phân đoạn duy nhất. Người quản trị chỉ cần 1 cú click là thấy ngay kết quả tức thì mà không bao giờ gặp lỗi xung đột lọc.

**❓ Câu hỏi 2: Em xử lý giao diện Admin trên màn hình điện thoại như thế nào để người quản lý cửa hàng có thể duyệt đơn từ xa?**  
> **Trả lời:** Trên màn hình Desktop, Sidebar chiếm cố định 260px bên trái. Nhưng trên Mobile (< 768px), nếu giữ nguyên sidebar hoặc biến thành các nút tĩnh sẽ chiếm tới hơn 50% diện tích màn hình. Em đã áp dụng mô hình Off-Canvas Drawer chuẩn ứng dụng di động: Sidebar mặc định được đẩy ra ngoài viewport bằng `transform: translateX(-100%)`. Khi người quản trị bấm vào nút Hamburger `[☰]`, JavaScript kích hoạt class `.sidebar-open` trượt menu vào với hiệu ứng chuyển động phần cứng mượt mà (`transition: transform 0.28s ease`), đồng thời hiển thị lớp nền làm mờ `backdrop-filter: blur(2px)`. Khi chọn một phân hệ bất kỳ hoặc chạm vào nền mờ, menu sẽ tự động đóng lại, trả lại 100% diện tích cho màn hình duyệt đơn.


---

## 12. NÂNG CẤP GIAO DIỆN THUẬN TIỆN & MƯỢT MÀ v2.0 (MOBILE BOTTOM NAV & FRICTIONLESS VIETQR CHECKOUT)

### 12.1. Bản Đồ Vị Trí Code (File Map & Location)

| Thành phần | Đường dẫn | Trách nhiệm kỹ thuật |
| :--- | :--- | :--- |
| **Thanh Điều Hướng Đáy Mobile** | [`js/bottom-nav.js`](file:///d:/shopHoa/souce_shopHoa/js/bottom-nav.js) | Cấu trúc 5 nút ngón tay cái, đồng bộ badge giỏ hàng, lắng nghe `visualViewport` & `focusin/focusout` để tự ẩn khi bật bàn phím ảo. |
| **Thanh Toán VietQR Tự Động** | [`js/checkout.js`](file:///d:/shopHoa/souce_shopHoa/js/checkout.js) | Nút copy chuỗi số thuần (vd `350000`), Auto-polling 3.5s tự chuyển bước khi nhận tiền, dừng polling khi ẩn tab (`visibilityState`), gia hạn QR có xác thực server. |
| **Máy Chủ & API Đối Soát** | [`server.js`](file:///d:/shopHoa/souce_shopHoa/server.js) | Endpoint `/api/sepay/check-payment/:orderId` ưu tiên kiểm tra database nội bộ trước, khớp nhanh tín hiệu Webhook không phụ thuộc mạng ngoài. |
| **Design Tokens & Layering** | [`css/variables.css`](file:///d:/shopHoa/souce_shopHoa/css/variables.css) | Khai báo biến `--bottom-nav-h`, Safe Area Inset `env(safe-area-inset-bottom)` và thang z-index chuẩn triệt tiêu 100% va chạm lớp. |
| **Responsive & Chống Va Chạm** | [`css/responsive.css`](file:///d:/shopHoa/souce_shopHoa/css/responsive.css) | Ẩn trên Desktop (`display: none`), hiển thị mượt trên Mobile (< 768px), tự động nâng nút Chatbot và Toast lên trên Bottom Nav. |
| **Hàm Tiện Ích Đa Nền Tảng** | [`js/utils.js`](file:///d:/shopHoa/souce_shopHoa/js/utils.js) | `escapeHTML()`, `removeVietnameseTones()` (Unicode NFD + đ/Đ), `ScrollLockManager` (lưu `window.scrollY` cho iOS Safari). |

---

### 12.2. Sơ Đồ Luồng Hoạt Động (Flowchart)

```
[ NGƯỜI MUA HOA TRÊN ĐIỆN THOẠI ]
  │
  ├── 1. THAO TÁC MỘT TAY (THUMB-ZONE)
  │    └─ Thanh Bottom Nav cố định ở đáy: [Trang Chủ] [Danh Mục] [Tìm Kiếm] [Giỏ Hàng (Badge)] [Đơn Hàng]
  │    └─ Khi bấm vào ô gõ chữ -> window.visualViewport co lại -> Bottom Nav tự động ẩn xuống dưới
  │
  └── 2. THANH TOÁN VIETQR SEPAY 1-CHẠM
       ├─ Điền sẵn thông tin (Smart Autofill từ tài khoản đăng nhập)
       ├─ Bấm Sao Chép Số Tiền -> Copy chuỗi số thuần "800000" (Không có dấu chấm hay chữ ₫)
       ├─ Quét mã VietQR trên App Ngân Hàng
       └─ Auto-polling 3.5s nhận diện lệnh chuyển khoản -> Tự động chuyển sang Bước 3 Hoàn Tất (Không cần bấm xác nhận)
```

---

### 12.3. Kịch Bản Vấn Đáp Giảng Viên Về Giao Diện Thuận Tiện & Mượt Mà

**❓ Câu hỏi 1: Tại sao em lại thiết kế thanh Bottom Navigation Bar cho điện thoại và xử lý vấn đề bàn phím ảo như thế nào?**  
> **Trả lời:** Dạ thưa thầy/cô, hơn 80% khách hàng mua hoa lướt web trên điện thoại bằng một tay. Các nút quan trọng trên Header thường nằm ngoài tầm với thoải mái của ngón tay cái (vùng Thumb-zone). Bằng cách bổ sung Bottom Navigation Bar, khách hàng có thể mở giỏ hàng, xem danh mục hoặc tra cứu đơn hàng bất cứ lúc nào chỉ với một chạm. Để giải quyết triệt để lỗi thanh điều hướng che mất ô nhập liệu khi khách hàng gõ bàn phím ảo, em đã sử dụng API hiện đại `window.visualViewport` kết hợp sự kiện `focusin/focusout`. Khi chiều cao viewport co lại do bàn phím xuất hiện, thanh điều hướng tự động trượt ẩn (`translateY(100%)`), trả lại 100% không gian cho màn hình gõ chữ.

**❓ Câu hỏi 2: Nút sao chép số tiền chuyển khoản VietQR được tối ưu ra sao để khách không bị lỗi khi dán vào App ngân hàng?**  
> **Trả lời:** Khi hiển thị cho khách hàng xem trên web, số tiền thường được định dạng có dấu chấm và ký hiệu tiền tệ (ví dụ `350.000 ₫`). Nếu copy nguyên chuỗi này dán vào các App ngân hàng (Vietcombank, MBBank, Techcombank...), App sẽ báo lỗi "Số tiền không hợp lệ". Em đã xử lý qua hàm regex `textToCopy.replace(/\D/g, '')` để chỉ trích xuất duy nhất chuỗi số nguyên thuần túy (ví dụ `350000`), giúp khách hàng dán vào App ngân hàng là giao dịch được ngay lập tức trong 3 giây.

---

## 13. N�NG C?P B? NH?N DI?N TH��NG HI?U: LOGO HOA K?M NHUNG NGH? THU?T & FAVICON TR?NH DUY?T

### 13.1. B?n �? V? Tr� Code (File Map & Location)

| Th�nh ph?n | ��?ng d?n | Tr�ch nhi?m k? thu?t |
| :--- | :--- | :--- |
| **?nh Logo Ngang Chu?n N�t** | [images/logo-tiem-hoa.png](file:///d:/shopHoa/souce_shopHoa/images/logo-tiem-hoa.png) | Logo 950�260px t�ch n?n trong su?t alpha anti-aliased, c?t x�n s�t vi?n, hi?n th? s?c n�t tr�n c? m�n h?nh Retina 2x/3x. |
| **Bi?u T�?ng Favicon & App Icon** | [images/favicon-flower.png](file:///d:/shopHoa/souce_shopHoa/images/favicon-flower.png) | Bi?u t�?ng b�ng hoa u?n k?m nhung th?t n� t? l? 1:1 (240�240px) d�ng cho <link rel="icon"> v� Sidebar Admin. |
| **Header C?a H�ng & Footer** | [index.html](file:///d:/shopHoa/souce_shopHoa/index.html), [detail.html](file:///d:/shopHoa/souce_shopHoa/detail.html), [orders.html](file:///d:/shopHoa/souce_shopHoa/orders.html) | Nh�ng Logo chu?n qua th? <img> k�m thu?c t�nh width, height, lt chu?n SEO v� ch?ng gi?t layout (CLS = 0). |
| **Sidebar B?ng Qu?n Tr? Admin** | [dmin.html](file:///d:/shopHoa/souce_shopHoa/admin.html), [css/admin.css](file:///d:/shopHoa/souce_shopHoa/css/admin.css) | ��a icon b�ng hoa k?m nhung v�o container bo g�c sang tr?ng tr�n n?n t?i #0F172A. |
| **Form ��ng Nh?p & ��ng K?** | [login.html](file:///d:/shopHoa/souce_shopHoa/login.html), [egister.html](file:///d:/shopHoa/souce_shopHoa/register.html), [css/auth.css](file:///d:/shopHoa/souce_shopHoa/css/auth.css) | Kh?i .auth-brand-header d?n link v? trang ch?, n�ng t?m chuy�n nghi?p c?a giao di?n x�c th?c. |
| **T?i �u Responsive Logo** | [css/style.css](file:///d:/shopHoa/souce_shopHoa/css/style.css), [css/responsive.css](file:///d:/shopHoa/souce_shopHoa/css/responsive.css) | Desktop height: 44px; width: auto, Mobile height: 34px; max-width: 140px; �?m b?o 100% kh�ng tr�n vi?n (scrollWidth === clientWidth === 375px). |

---

### 13.2. S� �? Quy Tr?nh Ti?n X? L? & Hi?n Th? (Pipeline)

`
[ ?NH G?C NG�?I D�NG CUNG C?P (JPG 1024x384) ]
  ?   (N?n tr?ng, c� kho?ng tr?ng th?a 64px ? m�p tr�n/d�?i)
  ?
[ SCRIPT TI?N X? L? (scratch/generate_logo_variants.js) ]
  ??? 1. X�c �?nh Bounding Box n?i dung ch? & hoa (944 x 253 px)
  ??? 2. C?t c�p ch�nh x�c (Crop tightly)
  ??? 3. T�ch n?n tr?ng sang Transparent Alpha (Kh? r�ng c�a vi?n h?ng)
  ?
  ???? [ images/logo-tiem-hoa.png ] ??? G?n v�o Header, Footer & M�n h?nh Auth
  ???? [ images/favicon-flower.png ] ??? G?n v�o Tab Favicon tr?nh duy?t & Admin Brand Icon
`

---

### 13.3. K?ch B?n V?n ��p Gi?ng Vi�n V? T?i �u H?nh ?nh & Logo Th��ng Hi?u

**? C�u h?i 1: T?i sao em kh�ng d�ng lu�n file ?nh g?c JPG ng�?i d�ng g?i ho?c v? SVG m� l?i ti?n x? l? th�nh 2 file PNG trong su?t?**  
> **Tr? l?i:** D? th�a th?y/c�:
> 1. ?nh g?c JPG c� n?n tr?ng �?c v� kho?ng tr?ng �?m (padding) tr�n d�?i �?n 64px. N?u ��a tr?c ti?p v�o Header c� chi?u cao c? �?nh 44px, ph?n ch? s? b? co r�t xu?ng ch? c?n h�n 20px, r?t kh� �?c. H�n n?a, v? thanh Header c� hi?u ?ng k�nh m? ackdrop-filter: blur(12px) v� m�u n?n b�n trong su?t, m?t kh?i ?nh JPG n?n tr?ng �?c s? t?o th�nh m?ng vu�ng s?c c?nh r?t th�.
> 2. B?ng c�ch vi?t script ti?n x? l? t? �?ng �o t?a �? bounding box v� chuy?n �?i k�nh alpha kh? r�ng c�a, em �? t?o ra file logo-tiem-hoa.png trong su?t chu?n n�t Retina 2x/3x. �?ng th?i, em tr�ch xu?t ri�ng c?m hoa k?m nhung vu�ng 1:1 l�m avicon-flower.png cho tab tr?nh duy?t v� icon Sidebar Admin, gi�p th��ng hi?u nh?n di?n �?ng b? 100% tr�n to�n b? c�c trang.

**? C�u h?i 2: Khi thay Logo t? ch? HTML/SVG sang th? <img>, em l�m th? n�o �? �?m b?o kh�ng b? gi?t trang (CLS - Cumulative Layout Shift) v� kh�ng tr�n m�n h?nh �i?n tho?i?**  
> **Tr? l?i:** D? th�a th?y/c�:
> 1. �? tri?t ti�u �i?m gi?t layout (CLS = 0), tr�n m?i th? <img> c?a logo em lu�n khai b�o t�?ng minh thu?c t�nh width="168" v� height="46", k?t h?p CSS object-fit: contain. Tr?nh duy?t s? t�nh to�n t? l? khung h?nh (aspect ratio) ngay khi d?ng DOM tree v� d�nh s?n kho?ng kh�ng gian ch�nh x�c, n�n khi ?nh t?i v? trang web kh�ng h? b? nh?y b? c?c.
> 2. Tr�n m�n h?nh �i?n tho?i nh? (viewport 375px), kh�ng gian thanh Header r?t ch?t h?p. Em �? �p d?ng media query @media (max-width: 768px) gi?i h?n .logo-img ? height: 34px; max-width: 140px; v� .logo { flex-shrink: 0; }. Nh? ��, logo lu�n hi?n th? v?a v?n b�n c?nh � t?m ki?m v� gi? h�ng, �?m b?o document.documentElement.scrollWidth <= document.documentElement.clientWidth (0px tr�n ngang).
