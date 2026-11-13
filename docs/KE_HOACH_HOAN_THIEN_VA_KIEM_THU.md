# Kế hoạch hoàn thiện shopHoa theo nghiệp vụ hiện tại

## Phạm vi đánh giá

Kế hoạch này được cập nhật sau khi đối chiếu mã trong `public/`, `server/`, `prisma/schema.prisma` và hai bản nhận định bên ngoài. Đây là rà soát tĩnh mã nguồn; các mục dưới đây chưa được kiểm thử lại trên trình duyệt hoặc cơ sở dữ liệu trong lượt rà soát này. Không xem các tỷ lệ hoàn thiện định lượng như 85–90% là kết quả đo được.

## Những phần nghiệp vụ đã có nền tảng tốt

- Luồng mua hàng hỗ trợ COD/SePay, người đặt tách khỏi người nhận, thiệp và lời nhắn, chọn khung giờ giao trong ngày, voucher và phụ kiện.
- Backend định giá lại đơn, kiểm tra tồn và giữ giao dịch tạo đơn trong transaction; có xử lý hết hạn đơn SePay, giao dịch webhook trùng và late payment.
- Có phân quyền admin/staff, quản lý đơn, đánh giá, tài khoản, yêu cầu hoàn tiền theo Maker–Checker, dashboard và xuất báo cáo.
- Reviews hỗ trợ kiểm tra điều kiện mua hàng đã hoàn tất; ảnh review, phản hồi và quản trị đánh giá đã có cấu trúc.

## Các điểm đã xác minh cần xử lý

### P0 — Tính đúng đắn dữ liệu và tiền

1. **Cập nhật tồn kho bằng số tuyệt đối có thể ghi đè thay đổi đồng thời.** Admin gửi số tồn đọc từ lần tải trước; form sửa sản phẩm gửi tồn nhập vào; bộ chiến dịch lễ gửi cả object sản phẩm cũ qua `...p`. Nếu đơn hàng trừ kho đồng thời, giá trị cũ có thể ghi đè tồn mới. Chuyển thao tác điều chỉnh tồn sang API delta/nhập-xuất có khóa hoặc điều kiện phiên bản; không để cập nhật giá gửi kèm stock cũ.
2. **Duyệt hoàn một phần hiện đánh dấu toàn đơn đã hoàn tiền.** `approveRequest` đặt `payment_status='refunded'`; với đơn chưa hoàn tất còn hủy đơn và hoàn toàn bộ số lượng vào kho, dù `refund_requests.amount` có thể nhỏ hơn tiền đã thu. Cần phân biệt hoàn một phần/toàn phần, số tiền đã hoàn lũy kế, trạng thái đơn và quyết định nhập lại hàng theo tình trạng hàng thực tế.
3. **Lợi nhuận chưa phải số kế toán đáng tin.** Admin chưa có trường nhập `cost_price`, dù schema/repository có cột này. Báo cáo fallback giả định giá vốn 65%; khi có giá vốn thì lấy giá hiện tại, không phải snapshot lúc bán. Bổ sung giá vốn và snapshot cost vào order item; định nghĩa rõ lợi nhuận gộp, phí giao hàng, phí thanh toán, giảm giá và hoàn tiền.
4. **Không được xóa lịch sử sản phẩm đã bán.** API xóa sản phẩm có thể vướng khóa ngoại với order items và trả lỗi; cần nút ngừng bán dựa trên `is_active`, danh sách Admin phải tải cả sản phẩm ngừng bán. Chỉ cho xóa cứng bản ghi chưa phát sinh giao dịch theo chính sách rõ ràng.
5. **Lỗi lưu sản phẩm không được bắt ở submit handler.** Khi `createProduct`/`updateProduct` lỗi, người dùng có thể không nhận được thông báo rõ. Bọc thao tác trong try/catch/finally, giữ dữ liệu form và hiển thị lỗi API.

### P1 — Hoàn thiện nghiệp vụ cửa hàng hoa

6. **Ngày giao hẹn trước:** hiện có khung giờ và tùy chọn hỏa tốc, nhưng chưa có ngày giao trong form, schema hay bộ lọc đơn. Thêm ngày giao, kiểm tra ngày quá khứ/giới hạn đặt trước, giờ cắt đơn và năng lực giao trong dịp cao điểm.
7. **Hoa handmade đặt làm:** quyết định cách xử lý hết tồn: ngừng nhận, nhận đặt trước với thời gian làm dự kiến, hoặc sản xuất theo đơn. Không cam kết giao trong ngày nếu chưa kiểm tra công suất.
8. **Thanh toán trước/cọc cho đơn rủi ro:** cân nhắc ngưỡng theo tổng tiền, hoa thiết kế riêng và chi phí không thu hồi được. Nếu làm cọc, mô hình dữ liệu cần hỗ trợ số tiền phải trả, số đã thu, số còn lại và chính sách hủy.
9. **Ảnh thành phẩm trước giao:** bổ sung ảnh proof, người tải, thời điểm và hiển thị cho khách trước/trong trạng thái giao hàng.
10. **Phiếu giao quà không lộ giá:** tách phiếu giao cho người nhận khỏi hóa đơn/biên nhận của người mua; kiểm tra không đưa giá, thông tin thanh toán hoặc tên người gửi khi chọn chế độ ẩn danh.
11. **Ẩn danh người gửi:** hiện tách người đặt/người nhận nhưng chưa thấy tùy chọn ẩn danh được lưu và áp dụng cho phiếu giao, thông báo và giao diện người nhận.

### P2 — Kiểm soát Admin và vận hành

12. **Phân quyền giao diện/API cần một ma trận thống nhất.** Staff chỉ thấy đơn/hoàn tiền trên Admin, nhưng một số API sản phẩm, voucher, banner và review vẫn cấp quyền `staff`. Đây không phải vượt quyền qua lỗ hổng xác thực; đó là khác biệt giữa quyền server đã cấp và giao diện đang ẩn. Chốt nghiệp vụ staff được phép làm gì rồi đồng bộ cả hai phía.
13. **Lịch sử thao tác:** thêm audit log cho thay đổi trạng thái đơn, giá, tồn, quyền tài khoản và hoàn tiền; lưu tác nhân, thời điểm, giá trị trước/sau và lý do.
14. **Lý do hủy/đổi trạng thái và giao nhận:** lưu lý do, người thao tác, thời điểm; cân nhắc lịch sử trạng thái riêng thay vì chỉ giữ trạng thái hiện tại.
15. **Đơn mới và dữ liệu stale:** Admin hiện tải danh sách theo đợt, chưa có cơ chế cập nhật đơn mới định kỳ hoặc thông báo realtime. Thêm polling có giới hạn hoặc cơ chế push phù hợp; đồng thời hiển thị rõ trạng thái lỗi tải thay vì biến lỗi API thành danh sách rỗng.
16. **Tài khoản:** backend hỗ trợ `is_active`, nhưng bảng Admin chưa có thao tác khóa/mở khóa. Xóa khách có thể làm mất dữ liệu liên quan hoặc tách chủ sở hữu đơn; ưu tiên khóa tài khoản và giữ nguyên hồ sơ giao dịch.
17. **Nhập Excel:** hiện luồng nhập tạo sản phẩm mới và tự điền mặc định cho dữ liệu thiếu; không phải phiếu nhập kho và không chống nhập trùng. Tách nhập danh mục khỏi nghiệp vụ nhập kho; kiểm tra dữ liệu bắt buộc, xem trước và báo từng dòng lỗi. Xác minh parser CSV có xử lý đúng dấu phẩy nằm trong trường được quote trước khi coi đây là lỗi.
18. **Duyệt hoàn:** mã giao dịch hoàn hiện có thể để trống. Nếu hoàn tiền thực tế diễn ra ngoài hệ thống, yêu cầu mã tham chiếu hoặc lưu trạng thái “đã duyệt/chưa chi tiền” riêng để tránh nhầm duyệt với đã chuyển tiền.
19. **Phân trang và tổng hợp:** đơn/tài khoản được nạp danh sách lớn rồi lọc/tính phía trình duyệt. Chuyển phân trang, lọc ngày và tổng hợp dashboard sang API khi dữ liệu tăng; kiểm tra giới hạn thời gian và chỉ mục truy vấn.

## Nhận định cần diễn giải thận trọng

- **“Staff chỉ thấy đơn và hoàn tiền”** đúng với menu hiện tại; **không đúng nếu hiểu là staff chỉ có quyền đó ở API**. Một số API khác cũng chấp nhận staff.
- **“Đã bán”** đang được tính từ đơn thực tế trong bảng Admin; trường `soldCount` gửi từ form không phải nguồn thống kê chuẩn và không cần cho Admin sửa.
- **Các trường rating/reviewCount/featured khi import** hiện được tạo trong object import, nhưng backend sản phẩm không lưu một số trường này. Nên loại khỏi mẫu import hoặc tính rating từ review; xác định rõ featured có phải nghiệp vụ cần hỗ trợ không.
- **Tab thống kê không tự thân là thừa.** GMV/doanh thu theo nhiều kỳ hữu ích, nhưng cần đổi nhãn và công thức lợi nhuận cho chính xác trước khi dùng ra quyết định. Có thể rút gọn giao diện nếu cửa hàng chưa cần phân tích nhiều chiều.
- **Ngày giao, ẩn danh, đặt làm, proof ảnh và phiếu giao không giá** là khoảng trống xác đáng với shop hoa, nhưng ưu tiên triển khai dựa theo quy trình thực tế của tiệm.

## Trình tự đề xuất

| Giai đoạn | Nội dung | Điều kiện hoàn tất |
| --- | --- | --- |
| 1. Bảo toàn kho | API điều chỉnh tồn theo delta/phiên bản; bỏ gửi stock cũ trong cập nhật giá; lưu lịch sử nhập-xuất | Đặt hàng đồng thời với điều chỉnh kho không làm mất biến động; có thể đối chiếu từng lần thay đổi |
| 2. Đúng tiền | Nhập giá vốn; snapshot cost; phân biệt hoàn một phần/toàn phần; định nghĩa doanh thu, tiền thu, giá vốn, lợi nhuận | Báo cáo khớp dữ liệu giao dịch mẫu, hoàn tiền và bảng giá vốn; không dùng tỷ lệ cost mặc định trong số liệu chính thức |
| 3. Quản lý hàng | Ngừng/mở bán; không xóa sản phẩm đã có order item; nhập Excel có xác thực và preview | Sản phẩm ngừng bán không xuất hiện ngoài storefront nhưng vẫn xem được trong Admin và đơn cũ |
| 4. Giao hoa | Ngày giao, đặt trước, công suất/lead time; chính sách cọc; ẩn danh và phiếu giao không giá | Dữ liệu được lưu xuyên suốt checkout → Admin → theo dõi đơn → tài liệu giao |
| 5. Admin vận hành | Chốt role matrix; lịch sử trạng thái/audit; cập nhật đơn mới; khóa tài khoản; xử lý lỗi rõ ràng | Staff không làm vượt quyền; mọi thao tác nhạy cảm có tác nhân, thời điểm và kết quả |
| 6. Kiểm thử hồi quy | Kiểm thử cạnh tranh kho, partial refund, role API, đơn đặt trước, import, xuất phiếu/hóa đơn | Chạy trên DB test cô lập; có kết quả test lưu lại; không dùng DB thật của cửa hàng để thử |

## Phạm vi ưu tiên cho đồ án

Nếu cần giới hạn khối lượng, ưu tiên theo thứ tự: **(1) chống ghi đè tồn kho, (2) khóa/ngừng bán thay cho xóa sản phẩm đã có đơn, (3) xử lý đúng hoàn một phần, (4) nhập và snapshot giá vốn, (5) ngày giao dự kiến.** Các tính năng proof ảnh, ẩn danh, đặt cọc và audit log có thể triển khai theo giai đoạn sau khi chốt quy trình cửa hàng.
