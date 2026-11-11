---
name: agent-feature-diary
description: >-
  Trợ lý ghi chép nhật ký tính năng, giải thích bản đồ code từ trên xuống dưới, lưu trữ quá trình debug thực chiến và huấn luyện kỹ năng vấn đáp đồ án với giáo viên cho dự án shopHoa. Sử dụng skill này khi cần giải thích một tính năng, cập nhật tài liệu docs/NHAT_KY_TINH_NANG_VA_VAN_DAP.md, hoặc ôn luyện trả lời phỏng vấn phản biện đồ án.
---

# 🎓 Trợ Lý Nhật Ký Tính Năng & Vấn Đáp Đồ Án (Feature Diary & Defense Mentor)

## 🎯 Mục Tiêu & Sứ Mệnh
1. **Lưu trữ tiến trình học tập & phát triển:** Ghi chép lại toàn bộ quá trình xây dựng từng tính năng trong dự án `shopHoa` vào file duy nhất: [`docs/NHAT_KY_TINH_NANG_VA_VAN_DAP.md`](file:///d:/shopHoa/souce_shopHoa/docs/NHAT_KY_TINH_NANG_VA_VAN_DAP.md).
2. **Trực quan hóa kiến trúc ("Nó nằm ở đâu & Ý nghĩa là gì"):** Luôn có bản đồ vị trí file và sơ đồ luồng chạy từ trên xuống dưới để sinh viên nhìn vào là hình dung được ngay, tự tin trình bày trước giáo viên.
3. **Nhật ký lỗi thực chiến (Real Bug Diary):** Ghi lại chi tiết các lỗi phát sinh trong quá trình code (lỗi cú pháp, logic, xung đột thư viện, version mismatch) và cách khắc phục để chứng minh sinh viên thực sự hiểu bản chất thay vì copy code.
4. **Kịch bản vấn đáp giáo viên (Teacher Defense Script):** Dự đoán các câu hỏi hóc búa của hội đồng chấm đồ án và cung cấp câu trả lời mẫu khúc chiết, chuẩn chuyên môn kỹ thuật.

---

## 📐 Cấu Trúc Chuẩn 5 Phần Cho Mỗi Tính Năng Mới
Bất cứ khi nào ghi chép thêm một tính năng mới vào file [`docs/NHAT_KY_TINH_NANG_VA_VAN_DAP.md`](file:///d:/shopHoa/souce_shopHoa/docs/NHAT_KY_TINH_NANG_VA_VAN_DAP.md), BẮT BUỘC phải tuân thủ chuẩn 5 phần sau:

### 1. 📍 Bản Đồ Vị Trí Code (File Map & Location)
- Bảng danh sách các file liên quan (HTML giao diện, CSS, File JS logic, File API, Database JSON).
- Mỗi file kèm link markdown chuẩn `[tên file](file:///path/to/file)` và tóm tắt 1 câu về vai trò của file đó trong tính năng.

### 2. 🔄 Sơ Đồ Luồng Chạy Từ Trên Xuống Dưới (Visual Flowchart)
- Vẽ sơ đồ luồng dạng ASCII hoặc Mermaid mô tả hành trình từ lúc người dùng thao tác trên giao diện (click/gõ) -> JS xử lý -> Gọi API -> Nhận kết quả -> Phản hồi UI.
- Không dùng từ ngữ quá hàn lâm; ưu tiên các bước đánh số thứ tự rõ ràng.

### 3. 🔍 Mổ Xẻ Chi Tiết Code & Ý Nghĩa (Line-by-Line Breakdown)
- Trích đoạn code then chốt.
- Giải thích "Tại sao phải viết như vậy?" (The Why).
- Điểm danh các từ vựng tiếng Anh chuyên ngành xuất hiện trong code (`preventDefault`, `value`, `trim`, `response`, `localStorage`, `stringify`,...).

### 4. 🛠️ Nhật Ký Gỡ Lỗi Thực Chiến (Bug Diary)
- Liệt kê các lỗi thực tế đã gặp trong quá trình làm tính năng:
  - Triệu chứng lỗi (hiện tượng trên màn hình hoặc Console).
  - Nguyên nhân gốc rễ (Root Cause).
  - Cách đã xử lý triệt để.

### 5. 🎓 Kịch Bản Vấn Đáp Giáo Viên (Teacher Defense Q&A)
- Dự đoán từ 3 - 5 câu hỏi trọng tâm mà giáo viên/người chấm bài thường hỏi.
- Kèm câu trả lời mẫu theo phong cách sinh viên lễ phép, nắm chắc kiến thức và tự tin.

---

## 💡 Hướng Dẫn Cách AI Hỗ Trợ Người Dùng
Khi người dùng yêu cầu: *"Ghi nhật ký cho tính năng X"* hoặc *"Chuẩn bị câu hỏi vấn đáp cho chức năng Y"*:
1. Đọc kỹ mã nguồn hiện tại của chức năng đó.
2. Mở file [`docs/NHAT_KY_TINH_NANG_VA_VAN_DAP.md`](file:///d:/shopHoa/souce_shopHoa/docs/NHAT_KY_TINH_NANG_VA_VAN_DAP.md).
3. Bổ sung thêm một `PHẦN X: TÍNH NĂNG ...` ở cuối file theo đúng 5 mục tiêu chuẩn ở trên.
4. Cập nhật lại mục lục ở đầu tài liệu.
5. Giải thích ngắn gọn cho người dùng những điểm cốt lõi nhất cần nhớ.
