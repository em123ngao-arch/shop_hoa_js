# 🗺️ BẢN ĐỒ TÍNH NĂNG, NHẬT KÝ CODE & VẤN ĐÁP ĐỒ ÁN
> **Dự án:** Shop Hoa Kẽm Nhung & Hoa Tươi Handmade (`shopHoa`)  
> **Mục tiêu tài liệu:** Ghi chép chi tiết từ trên xuống dưới theo sơ đồ luồng chạy, bản đồ vị trí code, quá trình thực hành, các lỗi thực tế đã gặp và "văn mẫu" trả lời khi giáo viên vấn đáp.

---

## 📌 BẢN ĐỒ ĐIỀU HƯỚNG TỔNG QUAN (FEATURE MAP)

```
[DỰ ÁN SHOP HOA]
   │
   ├── 📂 01. Tính năng Đăng Nhập (Login) ──────────> (Phần 1 bên dưới)
   ├── 📂 02. Nhập Excel & Xuất Báo Cáo PDF (Admin) ─> [MỚI HOÀN THÀNH] (Phần 2 bên dưới)
   ├── 📂 03. Tính năng Đăng Ký (Register) ─────────> [MỚI HOÀN THÀNH] (Phần 3 bên dưới)
   ├── 📂 04. Tính năng Giỏ Hàng (Cart) ────────────> (Sẽ bổ sung tiếp tục)
   └── 📂 05. Quản trị viên (Admin Dashboard) ──────> (Sẽ bổ sung tiếp tục)
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
| **Cơ sở dữ liệu** | [`db.json`](file:///d:/shopHoa/souce_shopHoa/db.json) | Bảng `"products": [ ... ]` lưu trữ thông tin sản phẩm hoa. |
| **Code tham khảo của cô**| [`DoAnPDF/app.js`](file:///d:/shopHoa/souce_shopHoa/DoAnPDF/app.js) | Nguồn tài liệu bài giảng gốc của cô giáo trên lớp. |

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

