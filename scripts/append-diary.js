import fs from 'fs';

const content = `

---

## 16. KHẮC PHỤC TRIỆT ĐỂ BỘ LỌC STOREFRONT & ĐỒNG BỘ DỮ LIỆU ADMIN (CACHE-BUSTING & DATA INTEGRITY)

### 16.1. Bối cảnh & Sự cố thực tế (Bug Report)
- **Hiện tượng:** Sau khi Admin cập nhật mẫu hoa **"Cam tulip" (#PROD-MWFTAMC6)** với Màu sắc: "Màu Cam", Loài hoa: "Hoa Tulip", Giá: 5.000đ; người dùng vào trang chủ lọc theo URL \`?price=200-300&color=cam&flowerType=tulip\`.
- **Lỗi xuất hiện:** Giao diện hiển thị đủ 3 tag lọc (\`[Màu Cam]\`, \`[Hoa Tulip]\`, \`[200.000đ - 300.000đ]\`), nhưng danh sách hiển thị toàn bộ 19 sản phẩm (không lọc được). Mẫu "Cam tulip" không xuất hiện.

### 16.2. Phân tích nguyên nhân gốc rễ (Root Cause Analysis)
1. **Tiến trình Node.js Server giữ code cũ trong RAM:**
   - Server Node.js chạy từ trước khi cập nhật 4 trường metadata vào \`PrismaCatalogRepository.updateProduct\`. Khi client gửi \`PUT /api/products/PROD-MWFTAMC6\`, server cũ bỏ qua 4 trường này, khiến CSDL MySQL vẫn giữ giá trị mặc định (\`color: "ket-hop"\`, \`flower_type: "khac"\`).
   - **Khắc phục:** Khởi động lại máy chủ và cập nhật dữ liệu CSDL.
2. **Lệch khoảng giá nghiệp vụ (Business Rule Mismatch):**
   - Mẫu hoa "Cam tulip" có giá bán là **5.000đ**. Mức giá \`200.000đ - 300.000đ\` chỉ chấp nhận sản phẩm trong khoảng 200k - 300k (mẫu chuẩn duy nhất thỏa mãn là \`PROD-018\` 260.000đ).
   - Mẫu "Cam tulip" thuộc mức giá \`Dưới 50.000đ\` (\`under-50\`) hoặc \`Tất cả mức giá\` (\`all\`).
3. **Trình duyệt Chrome lưu Cache ES6 Module cũ:**
   - Chrome lưu cache file \`business-rules.js\` phiên bản cũ (trước khi có bộ lọc đa tiêu chí). Khi chạy, hàm \`filterCatalogProducts\` cũ bỏ qua \`color\`, \`flowerType\`, \`priceRange\`, dẫn tới trả về toàn bộ 19 sản phẩm.
   - **Khắc phục:** Thêm query versioning \`?v=20261114_filter_v7\` cho script imports và tăng cường header \`Cache-Control: no-cache, no-store, must-revalidate\` trên server.

### 16.3. Bản đồ File & Thay đổi kỹ thuật

| File | Đường dẫn | Thay đổi chính |
| :--- | :--- | :--- |
| **Index & Admin HTML** | [public/index.html](file:///d:/shopHoa/souce_shopHoa/public/index.html), [public/admin.html](file:///d:/shopHoa/souce_shopHoa/public/admin.html) | Bổ sung versioning cache-busting \`?v=20261114_filter_v7\` cho \`main.js\`, \`chatbot.js\`, \`admin.js\`. |
| **Main JS Client** | [public/js/main.js](file:///d:/shopHoa/souce_shopHoa/public/js/main.js) | Cập nhật import \`business-rules.js?v=20261114_filter_v7\` đảm bảo nạp đúng phiên bản lọc đa tiêu chí mới nhất. |
| **TiDB Sync SQL** | [prisma/migrations_tidb/update_product_rows.sql](file:///d:/shopHoa/souce_shopHoa/prisma/migrations_tidb/update_product_rows.sql) | Script cập nhật 19 bản ghi sản phẩm có đầy đủ 4 trường \`color\`, \`flower_type\`, \`occasion\`, \`material\` cho TiDB Cloud. |
| **Bộ kiểm thử tự động Playwright** | [scripts/verify-storefront-filters.js](file:///d:/shopHoa/souce_shopHoa/scripts/verify-storefront-filters.js) | Kiểm thử E2E 5 trường hợp (Test 1: 200k-300k ra 1 mẫu; Test 2: dưới 50k ra 1 mẫu Cam tulip; Test 3: tất cả giá ra 2 mẫu; Test 4: click trực tiếp sidebar thời gian thực; Test 5: Modal Admin). Đạt 100% PASS. |

### 16.4. Kịch bản Vấn Đáp Giáo Viên Phản Biện Đồ Án

**❓ Câu hỏi 1: Làm thế nào để giải quyết triệt để vấn đề Browser Cache khi dự án sử dụng Vanilla JS ES6 Modules thuần không dùng Webpack/Vite?**  
> **Trả lời:** Dạ thưa thầy/cô:
> 1. Khi không dùng bundler (Webpack/Vite) sinh hash động (contenthash), trình duyệt theo mặc định sẽ cache các file ES6 Module (\`.js\`) theo URL.
> 2. Dự án đã áp dụng giải pháp kép:
>    - **Phía Server (HTTP Headers):** Cấu hình \`setHeaders\` trong \`express.static\` gửi \`Cache-Control: no-store, no-cache, must-revalidate\` và \`Pragma: no-cache\` cho các file HTML/JS/CSS ở môi trường phát triển.
>    - **Phía Client (Query Versioning):** Gắn tham số phiên bản \`?v=YYYYMMDD_vX\` vào cả thẻ \`<script type="module" src="...">\` lẫn câu lệnh \`import ... from './business-rules.js?v=...'\`. Khi nâng cấp logic, chỉ cần đổi số version, trình duyệt bắt buộc phải tải file mới từ server mà không thể dùng bản cache cũ trong ổ đĩa.

**❓ Câu hỏi 2: Tại sao khi lọc theo mức giá "Từ 200.000đ - 300.000đ" kèm Màu Cam và Hoa Tulip, hệ thống chỉ hiển thị đúng 1 sản phẩm thay vì hiển thị cả mẫu hoa 5.000đ em vừa tạo bên Admin?**  
> **Trả lời:** Dạ thưa thầy/cô:
> 1. Đây là nguyên tắc toàn vẹn nghiệp vụ (Business Rule Integrity). Phép lọc danh mục áp dụng toán tử logic giao nhau (\`AND\` condition):
>    $$\\text{Match} = (\\text{Color} = \\text{'cam'}) \\land (\\text{Flower} = \\text{'tulip'}) \\land (200.000 \\le \\text{Price} \\le 300.000)$$
> 2. Mẫu hoa vừa tạo bên Admin có giá bán là **5.000đ**, thuộc khoảng giá \`under-50\` (< 50.000đ). Do đó việc mẫu này không hiển thị trong khoảng 200k-300k là **hoàn toàn chính xác theo đúng logic toán học và nghiệp vụ thương mại điện tử**.
> 3. Khi người dùng chọn khoảng giá "Dưới 50.000đ" hoặc "Tất cả mức giá", hệ thống hiển thị chính xác mẫu hoa này.
`;

fs.appendFileSync('docs/NHAT_KY_TINH_NANG_VA_VAN_DAP.md', content, 'utf8');
console.log('Diary section 16 appended successfully.');
