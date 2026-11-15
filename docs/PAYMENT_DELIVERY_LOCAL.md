# Thanh toán và giao hàng tự quản lý — bản local

> Phạm vi: hoàn thiện và chạy thử trong môi trường local. Không kết nối SePay để thu tiền thật, không chạy migration trên database đang cấu hình, không triển khai và không push.

## 1. Luồng khách đặt hàng

1. Khách chọn quận/khu vực quen thuộc (tên cũ để lọc), rồi chọn phường hiện hành; nhập số nhà/tên đường và chỉ dẫn giao.
2. Checkout gọi `POST /api/delivery/quote`. Backend tra mức phí cố định theo phường từ bảng cấu hình dùng chung; không gọi API định tuyến và không tính km từ ghim.
3. Khách ghim vị trí/cổng nhận trên Google Maps. Ghim chỉ lưu tọa độ giúp người giao tìm nhà; nó không xác minh số nhà, địa giới phường hay tuyến đi.
4. Mức phí khởi điểm hiện tại: Phường Tân Phú 0₫; bốn phường lân cận Tân Sơn Nhì, Phú Thọ Hòa, Phú Thạnh, Tây Thạnh 35.000₫; các phường còn lại trong danh sách phục vụ 50.000₫. Đây là biểu phí thử do tiệm đặt, không phải cước hãng giao hàng.
5. Server tính lại phí khi tạo đơn và lưu snapshot tên phường, vùng phí, phí, phiên bản bảng giá và tọa độ ghim. Không lưu khoảng cách hoặc hình học tuyến cho đơn theo biểu phí mới.

## 2. Thanh toán

- Đơn mới có hai lựa chọn: **SePay trả đủ 100%**, hoặc **trả trước 50% tổng cuối qua SePay và trả phần còn lại bằng tiền mặt khi nhận**. Đây không phải luồng COD không cọc.
- Cọc được tính trên tổng cuối sau voucher và phí giao: `floor(totalAmount / 2)`. Phần còn lại bằng `totalAmount - amountPaidFirst`.
- SePay intent giữ mã tham chiếu riêng, số tiền và mục đích. Webhook phải khớp intent; giao dịch trùng/thiếu/thừa/đến sau khi hủy không tự cộng nhầm vào đơn.
- Non-production chỉ trả cấu hình `LOCAL-MOCK`, không đọc/hiển thị tài khoản ngân hàng thật và không tạo QR thật. Nút mô phỏng ghi payment intent với mã `SIM-*`; SePay API polling bị chặn khỏi gọi mạng. Production cần bật riêng `SEPAY_LIVE_ENABLED=true` sau khi đã cấu hình và xác minh; mặc định false.
- Webhook ngân hàng thật chỉ được xử lý ở production (test được phép gọi controller/service theo cấu hình test); mô phỏng thanh toán chỉ dành cho non-production và bị chặn trong production.
- Production chỉ trả cấu hình SePay thật nếu đủ biến môi trường. Luồng live chưa được xác minh trong lượt làm local này.

## 3. Địa chỉ, bản đồ và phí

- Checkout có hai bước rõ ràng: chọn quận/khu vực cũ để lọc, sau đó chọn phường hiện hành. Giá trị lưu vào đơn là phường hiện hành; nhãn quận cũ chỉ hỗ trợ người quen địa chỉ trước sắp xếp.
- Bản đồ dùng Google Maps JavaScript API. Người dùng bấm bản đồ hoặc kéo ghim để chỉ điểm nhận. Cần Internet, browser API key có giới hạn HTTP referrer, bật Maps JavaScript API và billing; key được gửi tới trình duyệt nên tuyệt đối không dùng key server-side hoặc key không giới hạn.
- V1 không dùng Google Routes, Places, Geocoding, ORS hay dịch vụ tính km. Ghim không đổi phí. Nếu key chưa cấu hình hoặc API không tải được, khu vực bản đồ sẽ hiện thông báo lỗi cụ thể thay vì để khung xám trống.
- Phí hiện được tra từ danh sách dùng chung `public/js/delivery-areas.js`; server là nguồn chốt phí. Thay đổi bảng giá cần tăng `rateVersion` để đơn cũ giữ nguyên snapshot.
- Tọa độ giao được lưu cùng đơn để tiệm mở bản đồ tìm địa điểm, và được xóa 30 ngày sau khi đơn hoàn tất/hủy bởi tác vụ nền. Địa chỉ chữ và snapshot phí vẫn được giữ theo hồ sơ đơn.

## 4. Yêu cầu báo giá thủ công (luồng cũ)

Các endpoint và bảng yêu cầu báo giá thủ công vẫn được giữ để đọc dữ liệu cũ. Biểu phí hiện hành gán sẵn mức cho các phường đang phục vụ, nên checkout mới không tạo yêu cầu báo giá thủ công. Phường không có trong danh sách sẽ bị từ chối, không tự gán vùng hoặc mức phí.

| Trạng thái | Ý nghĩa | Hành động tiếp theo |
|---|---|---|
| `requested` | Dữ liệu yêu cầu cũ, chưa có phí | Shop xem lại thông tin và quyết định xử lý thủ công |
| `reviewing` | Shop đang kiểm tra yêu cầu cũ | Chưa giữ lịch hoặc tồn kho |
| `quoted` | Shop đã chốt phí, ngày, khung giờ | Khách xác nhận/từ chối trong 24 giờ |
| `accepted` | Khách đã xác nhận báo giá cũ, đơn đã được tạo | Chờ SePay nhận đủ khoản phải trả trước |
| `declined` | Shop hoặc khách từ chối | Không tạo đơn, không trừ kho |
| `expired` | Hết hạn | Khách gửi yêu cầu mới để được báo lại |

Hạn 24 giờ áp dụng cho yêu cầu/báo giá. Sau khi khách xác nhận nhưng chưa thanh toán, TTL đơn SePay hiện hữu sẽ hủy đơn và trả tồn kho; giao dịch đến muộn cần shop đối soát. Không tự nhận lại chỗ giao nếu sức chứa có thể đã thay đổi.

## 5. File chính

| Phần | File |
|---|---|
| UI checkout và Google Maps | [public/index.html](../public/index.html), [public/detail.html](../public/detail.html), [public/js/checkout.js](../public/js/checkout.js), [public/js/delivery-map.js](../public/js/delivery-map.js) |
| Danh sách khu vực | [public/js/delivery-areas.js](../public/js/delivery-areas.js), [server/application/DeliveryZoneRules.js](../server/application/DeliveryZoneRules.js) |
| Tra phí cố định theo phường | [server/application/DeliveryService.js](../server/application/DeliveryService.js), [public/js/delivery-areas.js](../public/js/delivery-areas.js) |
| Trạng thái, báo giá, tạo đơn | [server/application/OrderService.js](../server/application/OrderService.js), [server/adapters/in/web/OrderController.js](../server/adapters/in/web/OrderController.js) |
| Lưu trữ và hết hạn/xóa tọa độ | [server/adapters/out/persistence/PrismaOrderRepository.js](../server/adapters/out/persistence/PrismaOrderRepository.js), [server/application/OrderExpiryService.js](../server/application/OrderExpiryService.js) |
| Màn hình khách tra cứu/SePay | [public/delivery-quote.html](../public/delivery-quote.html), [public/js/delivery-quote.js](../public/js/delivery-quote.js) |
| Màn hình shop xử lý | [public/admin.html](../public/admin.html), [public/js/admin.js](../public/js/admin.js) |
| Prisma và migration mới | [prisma/schema.prisma](../prisma/schema.prisma), [migration SQL](../prisma/migrations/20261115_manual_delivery_quotes/migration.sql) |

## 6. Việc cần làm trước khi mở môi trường public

- Nhập `GOOGLE_MAPS_API_KEY` là browser key đã giới hạn đúng domain và chỉ bật Maps JavaScript API. Tọa độ `DELIVERY_STORE_LAT/LNG` chỉ dùng làm tâm mở bản đồ, không dùng tính phí.
- Rà danh sách phường được phục vụ và mức phí vùng; các phường xa cần được loại khỏi danh sách hoặc có mức giá riêng trước khi mở bán rộng.
- Tạo một database test cô lập, áp dụng migration mới tại đó, sinh Prisma Client và kiểm tra API/UI/E2E trên DB test.
- Xác minh SePay webhook bằng HTTPS, secret thật và giao dịch thử; không bật nhận tiền thật từ local.
- Kiểm tra phí ở Phường Tân Phú, Phường Tân Sơn Nhì và một phường ngoài vùng lân cận; kéo ghim phải không làm đổi phí.
- Mở bản đồ trên trình duyệt thật sau khi có API key hợp lệ; kiểm tra điểm ghim, lưu tọa độ và mở hướng dẫn đường trên điện thoại.

## 7. Trạng thái kiểm tra lần này

- Checkout tra phí cố định theo phường; Google Maps chỉ cung cấp bản đồ và tọa độ ghim, không chạy định tuyến.
- API key Google Maps chưa được cấu hình trong `.env` của môi trường local tại thời điểm cập nhật; map thật sẽ báo rõ yêu cầu cấu hình cho tới khi có browser key hợp lệ.
- Migration `20261115_manual_delivery_quotes` mới chỉ được tạo; chưa áp dụng vào database.
- Không chạy test suite, migration, webhook thật hay giao dịch SePay trong lượt này. Trước khi dùng cần kiểm tra trên database test cô lập.

## Tham khảo kỹ thuật

- [Google Maps JavaScript API: tạo API key](https://developers.google.com/maps/documentation/javascript/get-api-key)
- [Google Maps Platform: giá dịch vụ](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Google Maps Platform: bảo vệ API key](https://developers.google.com/maps/api-security-best-practices)
- [Nghị quyết 1685/NQ-UBTVQH15 về sắp xếp đơn vị hành chính TP.HCM năm 2025](https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-quyet-so-1685-nq-ubtvqh15-sap-xep-cac-dvhc-cap-xa-cua-thanh-pho-ho-chi-minh-nam-2025-119250616211341304.htm)
- [SePay — Hướng dẫn webhook](https://docs.sepay.vn/tich-hop-webhooks.html)
