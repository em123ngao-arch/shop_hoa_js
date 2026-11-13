/**
 * OrderRepositoryPort.js - Outbound Port (Cổng ra) thao tác CSDL Đơn hàng & Giao dịch
 * Định nghĩa hợp đồng mà Application Service (OrderExpiryService, PaymentService...)
 * cần để truy xuất CSDL (MySQL qua Prisma ORM)
 * Thuộc tầng Ports (Hexagonal Architecture) - Pure JavaScript, 0 dependencies
 */

export class OrderRepositoryPort {
  /**
   * Tra cuu danh sach phu kien dang hoat dong theo mang ID
   * @param {string[]} addonIds
   * @returns {Promise<Array<{ id: string, name: string, price: number, is_active: boolean }>>}
   */
  async findActiveAddonsByIds(addonIds) {
    throw new Error('Phương thức findActiveAddonsByIds() chưa được triển khai');
  }

  /**
   * Tra cuu thong tin san pham de tinh toan don gia
   * @param {string[]} productIds
   * @returns {Promise<Array<Object>>}
   */
  async findProductsForPricing(productIds) {
    throw new Error('Phương thức findProductsForPricing() chưa được triển khai');
  }

  /**
   * Tra cuu voucher de kiem tra tinh hop le
   * @param {string} code
   * @returns {Promise<Object|null>}
   */
  async findVoucherByCode(code) {
    throw new Error('Phương thức findVoucherByCode() chưa được triển khai');
  }

  /**
   * Tạo đơn hàng mới cùng các dòng sản phẩm và phụ kiện trong một ACID transaction
   * @param {Object} params
   * @param {Object} params.orderData - Dữ liệu đơn hàng từ khách
   * @param {string|null} params.userId - ID người dùng đặt (null nếu là khách vãng lai)
   * @returns {Promise<Object>} Đơn hàng vừa tạo kèm danh sách items
   */
  async createOrder({ orderData, userId }) {
    throw new Error('Phương thức createOrder() chưa được triển khai');
  }

  /**
   * Cập nhật đơn hàng nháp đang ở trạng thái pending + chưa thanh toán trong cùng ACID transaction
   * Tránh tạo đơn trùng lặp khi khách quay lại sửa thông tin hoặc đổi phương thức thanh toán
   * @param {Object} params
   * @param {string} params.orderId
   * @param {string|null} params.userId
   * @param {Object} params.orderData
   * @returns {Promise<Object>}
   */
  async updateDraftOrder({ orderId, userId, orderData }) {
    throw new Error('Phương thức updateDraftOrder() chưa được triển khai');
  }

  /**
   * Lấy danh sách đơn hàng theo người dùng hoặc quyền hạn (RBAC)
   * @param {Object} filter
   * @param {string} [filter.userId]
   * @param {string} [filter.role]
   * @returns {Promise<Array<Object>>}
   */
  async findOrders({ userId, role }) {
    throw new Error('Phương thức findOrders() chưa được triển khai');
  }

  /**
   * Tìm chi tiết đơn hàng theo ID hoặc Order Code
   * @param {string} orderId
   * @returns {Promise<Object|null>}
   */
  async findOrderById(orderId) {
    throw new Error('Phương thức findOrderById() chưa được triển khai');
  }

  /**
   * Hủy đơn hàng của khách hàng (hoàn kho và voucher)
   * @param {string} orderId
   * @param {string|null} userId
   * @returns {Promise<Object>}
   */
  async cancelCustomerOrder(orderId, userId) {
    throw new Error('Phương thức cancelCustomerOrder() chưa được triển khai');
  }

  /**
   * Cập nhật trạng thái đơn hàng tuân thủ State Machine
   * @param {string} orderId
   * @param {string} newStatus
   * @returns {Promise<Object>}
   */
  async updateOrderStatus(orderId, newStatus) {
    throw new Error('Phương thức updateOrderStatus() chưa được triển khai');
  }

  /**
   * Tìm các đơn hàng SePay pending quá hạn TTL
   * @param {Date} cutoffDate
   * @returns {Promise<Array<{ id: string, order_code: string, created_at: Date }>>}
   */
  async findExpiredPendingSepayOrders(cutoffDate) {
    throw new Error('Phương thức findExpiredPendingSepayOrders() chưa được triển khai');
  }

  /**
   * Hủy nguyên tử đơn SePay quá hạn và hoàn kho, hoàn voucher
   * @param {string} orderId
   * @returns {Promise<Object|null>}
   */
  async cancelExpiredPendingOrder(orderId) {
    throw new Error('Phương thức cancelExpiredPendingOrder() chưa được triển khai');
  }

  /**
   * Tim don hang SePay phu hop co order_code xuat hien trong noi dung chuyen khoan (pending hoac cancelled)
   * @param {string} content - Noi dung chuyen khoan tu SePay webhook
   * @returns {Promise<Object|null>}
   */
  async findSepayOrderByContent(content) {
    throw new Error('Phương thức findSepayOrderByContent() chưa được triển khai');
  }

  /**
   * Alias tuong thich nguoc cho findSepayOrderByContent
   * @param {string} content
   * @returns {Promise<Object|null>}
   */
  async findPendingSepayOrderByContent(content) {
    return this.findSepayOrderByContent(content);
  }

  /**
   * Ghi nhận giao dịch thanh toán thành công vào CSDL (ACID transaction)
   * Chuyển trạng thái pending -> confirmed, payment_status -> paid
   * Chặn không cho đơn đã cancelled bị cập nhật
   * @param {Object} params
   * @param {string} params.orderId
   * @param {string} params.providerTxId
   * @param {number} params.amount
   * @param {Object} params.transaction
   * @returns {Promise<{ processed: boolean, duplicate: boolean, cancelled?: boolean }>}
   */
  async recordPayment({ orderId, providerTxId, amount, transaction }) {
    throw new Error('Phương thức recordPayment() chưa được triển khai');
  }
}
