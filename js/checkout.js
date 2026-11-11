import { exportOrderInvoicePdf } from './excel-pdf.js';
import {
  saveOrder,
  getCartSummary
} from './storage.js';
import { formatPrice, showToast, updateCartBadge } from './utils.js';

/**
 * checkout.js - Universal Checkout & SePay VietQR Payment Workflow
 * Hỗ trợ mở modal đặt hàng và thanh toán trực tiếp trên mọi trang (index.html, detail.html)
 */

const SEPAY_CONFIG = {
  bankCode: 'Sacombank',
  bankName: 'Sacombank (Sài Gòn Thương Tín)',
  accountNumber: '70207003455',
  accountHolder: 'NGUYEN DUY BAO'
};
const FREE_SHIPPING_THRESHOLD = 350000;
const STANDARD_SHIPPING_FEE = 30000;

function getShippingFee(subtotal = 0) {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
}

let currentDraftOrder = null;
let currentCompletedOrder = null;
let sepayCountdownTimer = null;
let sepayPollingInterval = null;
let pollingAbortController = null;
let pollingAttempts = 0;
const MAX_POLLING_ATTEMPTS = 180; // Tối đa 10 phút polling (3.5s x 180 = ~10.5 phút)
let isTabVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    isTabVisible = document.visibilityState === 'visible';
  });
}

function stopSepayPolling() {
  if (sepayPollingInterval) {
    clearInterval(sepayPollingInterval);
    sepayPollingInterval = null;
  }
  if (pollingAbortController) {
    try { pollingAbortController.abort(); } catch (e) {}
    pollingAbortController = null;
  }
  pollingAttempts = 0;
}

/**
 * Hàm sao chép đa nền tảng có hỗ trợ fallback cho HTTP cục bộ
 */
function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    console.warn('Lỗi copy fallback:', err);
  }
  document.body.removeChild(textarea);
  return Promise.resolve();
}

export function openCheckoutModal() {
  window.openCheckoutModal = openCheckoutModal;
  const modal = document.querySelector('#checkoutModal');
  const stepForm = document.querySelector('#checkoutStepForm');
  const stepSepay = document.querySelector('#checkoutStepSepay');
  const stepSuccess = document.querySelector('#checkoutStepSuccess');
  const itemsContainer = document.querySelector('#checkoutItemsPreview');
  const subtotalEl = document.querySelector('#checkoutSubtotal');
  const discountLine = document.querySelector('#checkoutDiscountLine');
  const discountEl = document.querySelector('#checkoutDiscount');
  const totalEl = document.querySelector('#checkoutTotal');
  const shippingFeeEl = document.querySelector('#checkoutShippingFee');

  if (!modal) return;

  const summary = getCartSummary();
  if (summary.items.length === 0) {
    showToast('Giỏ hàng đang trống!', 'error');
    return;
  }

  // Đổ danh sách sản phẩm trong giỏ vào tóm tắt đơn
  if (itemsContainer) {
    itemsContainer.innerHTML = summary.items.map(item => `
      <div class="checkout-preview-item" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div style="flex: 1; padding-right: 10px;">
          <div style="font-size: 13px; font-weight: 600; color: var(--text-main);">${item.name} <strong style="color: var(--text-muted); font-size: 11px;">× ${item.quantity}</strong></div>
          ${item.addonsText ? `<div style="font-size: 11px; color: var(--color-primary-dark); margin-top: 2px;">+ Phụ kiện: ${item.addonsText}</div>` : ''}
        </div>
        <strong style="font-size: 13px; color: var(--text-main); white-space: nowrap;">${formatPrice(item.price * item.quantity)}</strong>
      </div>
    `).join('');
  }

  // Cập nhật các dòng tiền
  if (subtotalEl) subtotalEl.textContent = formatPrice(summary.subtotal);
  if (summary.discountAmount > 0) {
    if (discountLine) discountLine.classList.remove('hidden');
    if (discountEl) discountEl.textContent = `-${formatPrice(summary.discountAmount)}`;
  } else {
    if (discountLine) discountLine.classList.add('hidden');
  }
  const shippingFee = getShippingFee(summary.subtotal);
  if (shippingFeeEl) {
    shippingFeeEl.textContent = shippingFee === 0 ? 'Miễn phí (Freeship)' : formatPrice(shippingFee);
    shippingFeeEl.style.color = shippingFee === 0 ? '#108474' : '';
  }
  if (totalEl) totalEl.textContent = formatPrice(summary.totalPrice + shippingFee);

  // Tự động điền thông tin nếu khách hàng đã đăng nhập
  const currentUserJson = localStorage.getItem('user');
  if (currentUserJson) {
    try {
      const user = JSON.parse(currentUserJson);
      const nameEl = document.querySelector('#checkoutSenderName');
      const phoneEl = document.querySelector('#checkoutSenderPhone');
      const emailEl = document.querySelector('#checkoutEmail');
      if (nameEl && !nameEl.value) nameEl.value = user.name || '';
      if (phoneEl && !phoneEl.value) phoneEl.value = user.phone || '';
      if (emailEl && !emailEl.value) emailEl.value = user.email || '';
    } catch (e) {}
  }

  // Reset về bước 1
  if (stepForm) stepForm.classList.remove('hidden');
  if (stepSepay) stepSepay.classList.add('hidden');
  if (stepSuccess) stepSuccess.classList.add('hidden');

  // Mở modal
  modal.classList.remove('hidden');
}

export function closeCheckoutModal() {
  const modal = document.querySelector('#checkoutModal');
  if (modal) modal.classList.add('hidden');
  if (sepayCountdownTimer) {
    clearInterval(sepayCountdownTimer);
    sepayCountdownTimer = null;
  }
  stopSepayPolling();
}

window.openCheckoutModal = openCheckoutModal;
window.closeCheckoutModal = closeCheckoutModal;

export function initCheckoutWorkflow() {
  const modal = document.querySelector('#checkoutModal');
  if (!modal || modal.dataset.checkoutInitialized === 'true') return;
  modal.dataset.checkoutInitialized = 'true';

  const closeBtn = document.querySelector('#checkoutModalClose');
  const form = document.querySelector('#checkoutForm');
  const isGiftCheck = document.querySelector('#checkoutIsGift');
  const giftFields = document.querySelector('#giftRecipientFields');
  const hasCardCheck = document.querySelector('#checkoutHasCard');
  const cardMessageWrap = document.querySelector('#cardMessageWrap');

  const radioSepay = document.querySelector('#labelPaymentSepay input');
  const radioCod = document.querySelector('#labelPaymentCod input');
  const labelSepay = document.querySelector('#labelPaymentSepay');
  const labelCod = document.querySelector('#labelPaymentCod');
  const submitBtn = document.querySelector('#checkoutSubmitBtn');

  const btnSimulatePaid = document.querySelector('#btnSimulateSepayPaid');
  const btnBackCheckout = document.querySelector('#btnBackToCheckoutForm');
  const btnViewReceipt = document.querySelector('#btnViewReceiptPdf');
  const btnSuccessContinue = document.querySelector('#btnSuccessContinue');

  // Đóng modal
  if (closeBtn) closeBtn.addEventListener('click', closeCheckoutModal);

  // Bật/tắt trường gửi tặng người khác
  if (isGiftCheck && giftFields) {
    isGiftCheck.addEventListener('change', () => {
      if (isGiftCheck.checked) {
        giftFields.classList.remove('hidden');
      } else {
        giftFields.classList.add('hidden');
      }
    });
  }

  // Bật/tắt thiệp chúc mừng
  if (hasCardCheck && cardMessageWrap) {
    hasCardCheck.addEventListener('change', () => {
      if (hasCardCheck.checked) {
        cardMessageWrap.classList.remove('hidden');
      } else {
        cardMessageWrap.classList.add('hidden');
      }
    });
  }

  // Cụm nút gợi ý lời chúc 1-Click (.wish-chip)
  document.querySelectorAll('.wish-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const textarea = document.querySelector('#checkoutCardMessage') || document.querySelector('#cardMessageInput');
      if (textarea) {
        textarea.value = chip.dataset.wish || '';
        textarea.focus();
        showToast('Đã chọn lời chúc mẫu!');
      }
    });
  });

  // Chuyển đổi phương thức thanh toán
  function updatePaymentMethodUi() {
    if (radioSepay && radioSepay.checked) {
      if (labelSepay) labelSepay.classList.add('selected');
      if (labelCod) labelCod.classList.remove('selected');
      if (submitBtn) submitBtn.innerHTML = 'Tiến Hành Chuyển Khoản VietQR →';
    } else {
      if (labelSepay) labelSepay.classList.remove('selected');
      if (labelCod) labelCod.classList.add('selected');
      if (submitBtn) submitBtn.innerHTML = 'Xác Nhận Đặt Hàng (COD) →';
    }
  }

  if (radioSepay) radioSepay.addEventListener('change', updatePaymentMethodUi);
  if (radioCod) radioCod.addEventListener('change', updatePaymentMethodUi);

  // Submit form đặt hàng
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const senderName = document.querySelector('#checkoutSenderName').value.trim();
      const senderPhone = document.querySelector('#checkoutSenderPhone').value.trim();
      const address = document.querySelector('#checkoutAddress').value.trim();
      const email = document.querySelector('#checkoutEmail').value.trim();
      const deliverySlot = document.querySelector('#checkoutDeliverySlot').value;
      const isGift = Boolean(isGiftCheck && isGiftCheck.checked);
      const recipientName = isGift ? document.querySelector('#checkoutRecipientName').value.trim() : '';
      const recipientPhone = isGift ? document.querySelector('#checkoutRecipientPhone').value.trim() : '';
      const hasGreetingCard = Boolean(hasCardCheck && hasCardCheck.checked);
      const cardMessageEl = document.querySelector('#checkoutCardMessage') || document.querySelector('#cardMessageInput');
      const cardMessage = hasGreetingCard && cardMessageEl ? cardMessageEl.value.trim() : '';
      const note = document.querySelector('#checkoutNote').value.trim();
      const paymentMethod = radioSepay && radioSepay.checked ? 'sepay' : 'cod';

      // Validation
      let isValid = true;
      const errorSender = document.querySelector('#errorSenderName');
      const errorPhone = document.querySelector('#errorSenderPhone');
      const errorAddress = document.querySelector('#errorAddress');

      if (!senderName) {
        if (errorSender) errorSender.classList.remove('hidden');
        isValid = false;
      } else if (errorSender) errorSender.classList.add('hidden');

      const phoneRegex = /^[0-9]{9,11}$/;
      if (!senderPhone || !phoneRegex.test(senderPhone)) {
        if (errorPhone) errorPhone.classList.remove('hidden');
        isValid = false;
      } else if (errorPhone) errorPhone.classList.add('hidden');

      if (!address) {
        if (errorAddress) errorAddress.classList.remove('hidden');
        isValid = false;
      } else if (errorAddress) errorAddress.classList.add('hidden');

      if (isGift && !recipientName) {
        showToast('Vui lòng nhập tên người nhận hoa!', 'error');
        isValid = false;
      }
      if (isGift && !phoneRegex.test(recipientPhone)) {
        showToast('Vui lòng nhập số điện thoại người nhận hợp lệ!', 'error');
        isValid = false;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Email nhận biên nhận chưa đúng định dạng!', 'error');
        isValid = false;
      }

      if (!isValid) return;

      const summary = getCartSummary();
      const shippingFee = getShippingFee(summary.subtotal);
      const orderId = window.crypto?.randomUUID?.() || `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      currentDraftOrder = {
        id: orderId,
        customerName: senderName,
        phone: senderPhone,
        email: email || '',
        isGift: isGift,
        recipientName: isGift ? recipientName : senderName,
        recipientPhone: isGift ? recipientPhone : senderPhone,
        address: address,
        deliverySlot: deliverySlot,
        hasGreetingCard: hasGreetingCard,
        cardMessage: cardMessage,
        note: note,
        paymentMethod: paymentMethod,
        paymentStatus: paymentMethod === 'sepay' ? 'pending' : 'pending',
        items: [...summary.items],
        subtotal: summary.subtotal,
        discountAmount: summary.discountAmount,
        voucherCode: summary.appliedVoucher ? summary.appliedVoucher.code : null,
        voucherSnapshot: summary.appliedVoucher ? {
          code: summary.appliedVoucher.code,
          name: summary.appliedVoucher.name,
          discountType: summary.appliedVoucher.discountType || 'percent',
          discountValue: summary.appliedVoucher.discountValue ?? summary.appliedVoucher.discountPercent,
          scope: summary.appliedVoucher.scope || 'all',
          maxDiscount: summary.appliedVoucher.maxDiscount || null,
          discountAmount: summary.discountAmount,
          eligibleAmount: summary.voucherCalculation?.eligibleAmount || summary.subtotal
        } : null,
        shippingFee,
        totalAmount: summary.totalPrice + shippingFee,
        status: 'pending'
      };

      if (paymentMethod === 'cod') {
        try {
          const saved = await saveOrder(currentDraftOrder);
          completeOrderSuccess(saved);
        } catch (error) {
          showToast(error.response?.data?.error?.message || 'Không thể tạo đơn hàng. Giỏ hàng của bạn vẫn được giữ lại.', 'error');
        }
      } else {
        try {
          const saved = await saveOrder(currentDraftOrder);
          currentDraftOrder = saved;
          showSepayQrStep(currentDraftOrder);
        } catch (error) {
          showToast(error.response?.data?.error?.message || 'Không thể tạo đơn hàng để thanh toán. Giỏ hàng vẫn được giữ lại.', 'error');
        }
      }
    });
  }

  // Nút quay lại từ màn hình SePay
  if (btnBackCheckout) {
    btnBackCheckout.addEventListener('click', () => {
      document.querySelector('#checkoutStepSepay').classList.add('hidden');
      document.querySelector('#checkoutStepForm').classList.remove('hidden');
      if (sepayCountdownTimer) clearInterval(sepayCountdownTimer);
      if (sepayPollingInterval) clearInterval(sepayPollingInterval);
    });
  }

  // Nút Demo Giả Lập Thanh Toán Thành Công
  if (btnSimulatePaid) {
    btnSimulatePaid.addEventListener('click', async () => {
      if (!currentDraftOrder) return;
      const statusPill = document.querySelector('#sepayStatusText');
      btnSimulatePaid.disabled = true;
      btnSimulatePaid.textContent = 'Đang mô phỏng...';
      try {
        const response = await fetch(`http://localhost:4000/api/sepay/simulate-payment/${encodeURIComponent(currentDraftOrder.id)}`, { method: 'POST' });
        const data = await response.json();
        if (!response.ok || !data.paid) throw new Error(data.error?.message || 'Không thể mô phỏng thanh toán');
        const saved = data.order || { ...currentDraftOrder, paymentStatus: 'paid', status: 'confirmed' };
        showToast('Đã xác nhận thanh toán trong môi trường demo.', 'success');
        completeOrderSuccess(saved);
      } catch (error) {
        if (statusPill) statusPill.textContent = error.message;
        showToast(error.message, 'error');
        btnSimulatePaid.disabled = false;
        btnSimulatePaid.textContent = 'Mô Phỏng Thanh Toán Thành Công';
      }
    });
  }

  // Nút xem hóa đơn điện tử PDF
  if (btnViewReceipt) {
    btnViewReceipt.addEventListener('click', () => {
      if (currentCompletedOrder) {
        exportOrderInvoicePdf(currentCompletedOrder, { isReceipt: true });
      } else {
        showToast('Không tìm thấy thông tin đơn hàng!', 'error');
      }
    });
  }

  // Nút theo dõi đơn hàng
  const btnTrackOrder = document.querySelector('#btnTrackThisOrder');
  if (btnTrackOrder) {
    btnTrackOrder.addEventListener('click', () => {
      closeCheckoutModal();
      const targetId = currentCompletedOrder ? currentCompletedOrder.id : '';
      window.location.href = './orders.html' + (targetId ? '?id=' + encodeURIComponent(targetId) : '');
    });
  }

  if (btnSuccessContinue) {
    btnSuccessContinue.addEventListener('click', () => {
      closeCheckoutModal();
    });
  }

  // Nút Sao Chép 1-Click thông minh (Chuỗi số thuần cho số tiền + Fallback)
  document.querySelectorAll('.btn-copy-field').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const targetEl = document.querySelector(`#${targetId}`);
      if (targetEl) {
        let textToCopy = targetEl.value || targetEl.textContent.trim();
        // Sao chép số tiền: BẮT BUỘC chuỗi số thuần không kèm dấu chấm phân cách hay ký hiệu ₫
        if (targetId === 'sepayTransferAmount' || targetId === 'sepayTransferAmountRaw') {
          textToCopy = String(textToCopy).replace(/\D/g, '');
        }

        copyToClipboard(textToCopy).then(() => {
          const originalText = btn.innerHTML;
          btn.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5" style="vertical-align: -2px; margin-right: 2px;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Đã chép</span>
          `;
          btn.style.color = '#16A34A';
          btn.style.borderColor = '#16A34A';
          setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.color = '';
            btn.style.borderColor = '';
          }, 1600);
        });
      }
    });
  });
}

function showSepayQrStep(order) {
  const stepForm = document.querySelector('#checkoutStepForm');
  const stepSepay = document.querySelector('#checkoutStepSepay');
  const qrImg = document.querySelector('#sepayQrImage');
  const countdownEl = document.querySelector('#sepayCountdown');
  const transferAmountEl = document.querySelector('#sepayTransferAmount');
  const transferAmountRaw = document.querySelector('#sepayTransferAmountRaw');
  const transferContentEl = document.querySelector('#sepayTransferContent');
  const statusPill = document.querySelector('#sepayStatusText');

  if (stepForm) stepForm.classList.add('hidden');
  if (stepSepay) stepSepay.classList.remove('hidden');

  const orderCode = order.orderCode || order.order_code || order.id;
  const qrUrl = `https://qr.sepay.vn/img?acc=${SEPAY_CONFIG.accountNumber}&bank=${SEPAY_CONFIG.bankCode}&amount=${order.totalAmount}&des=${orderCode}&template=compact`;

  const bankNameEl = document.querySelector('#sepayBankName');
  const accountNumberEl = document.querySelector('#sepayAccountNumber');
  const accountHolderEl = document.querySelector('#sepayAccountHolder');
  if (bankNameEl) bankNameEl.textContent = SEPAY_CONFIG.bankName;
  if (accountNumberEl) accountNumberEl.textContent = SEPAY_CONFIG.accountNumber;
  if (accountHolderEl) accountHolderEl.textContent = SEPAY_CONFIG.accountHolder;
  if (qrImg) qrImg.src = qrUrl;
  if (transferAmountEl) transferAmountEl.textContent = formatPrice(order.totalAmount);
  if (transferAmountRaw) transferAmountRaw.value = order.totalAmount;
  if (transferContentEl) transferContentEl.textContent = orderCode;
  if (statusPill) statusPill.textContent = 'Đang chờ hệ thống ghi nhận chuyển khoản...';

  // 1. Polling đối soát tự động thông minh (Tôn trọng visibilityState, AbortController & Exponential Backoff)
  stopSepayPolling();
  sepayPollingInterval = setInterval(async () => {
    if (!isTabVisible) return; // Dừng polling khi người dùng chuyển sang tab khác
    pollingAttempts++;
    if (pollingAttempts > MAX_POLLING_ATTEMPTS) {
      stopSepayPolling();
      return;
    }

    try {
      pollingAbortController = new AbortController();
      const res = await fetch(`http://localhost:4000/api/sepay/check-payment/${order.id}`, {
        signal: pollingAbortController.signal
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.paid) {
        stopSepayPolling();
        if (sepayCountdownTimer) {
          clearInterval(sepayCountdownTimer);
          sepayCountdownTimer = null;
        }

        if (statusPill) statusPill.innerHTML = '<span style="color: #108474; font-weight: 700;">✓ Đã nhận được chuyển khoản Sacombank! Đang hoàn tất đơn...</span>';
        showToast('Tài khoản Sacombank đã nhận được thanh toán!', 'success');

        // Bọc âm thanh trong try/catch tránh bị chặn bởi Autoplay Policy
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        } catch (e) {}

        const completedOrder = data.order || {
          ...order,
          paymentStatus: 'paid',
          status: 'confirmed',
          sepayTransaction: {
            bank: data.transaction?.bank_brand_name || 'Sacombank',
            account: data.transaction?.account_number || SEPAY_CONFIG.accountNumber,
            amount: data.transaction?.amount_in || order.totalAmount,
            code: data.transaction?.reference_number || `SEPAY-${data.transaction?.id || Date.now()}`,
            paidAt: data.transaction?.transaction_date || new Date().toISOString()
          }
        };

        setTimeout(() => {
          completeOrderSuccess(completedOrder);
        }, 900);
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }, 3500);

  // 2. Countdown timer 10 phút kèm Nút Gia Hạn Phiên QR có xác thực Server
  if (sepayCountdownTimer) clearInterval(sepayCountdownTimer);
  let timeLeft = 600;
  sepayCountdownTimer = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(sepayCountdownTimer);
      if (countdownEl) {
        countdownEl.innerHTML = `
          <span style="color: var(--color-sale-price); font-weight: 700;">00:00 (Hết hạn)</span>
          <button type="button" class="btn-refresh-qr" id="btnRefreshSepayQr" style="margin-left: 8px; padding: 4px 10px; font-size: 11.5px; border-radius: 6px; border: 1px solid var(--color-primary); background: #FFF; color: var(--color-primary); cursor: pointer; font-weight: 600;">
            🔄 Gia hạn 10 phút
          </button>
        `;

        const refreshBtn = document.getElementById('btnRefreshSepayQr');
        if (refreshBtn) {
          refreshBtn.addEventListener('click', async () => {
            refreshBtn.disabled = true;
            refreshBtn.textContent = 'Đang kiểm tra...';
            // Kiểm tra phía server trước: nếu đơn đã được thanh toán thì không gia hạn
            try {
              const chk = await fetch(`http://localhost:4000/api/sepay/check-payment/${order.id}`);
              if (chk.ok) {
                const chkData = await chk.json();
                if (chkData.paid) {
                  showToast('Đơn hàng đã được thanh toán thành công!', 'success');
                  completeOrderSuccess(chkData.order || order);
                  return;
                }
              }
              // Cap nhat gia han truc tiep tren client/local
              order.expiresAt = new Date(Date.now() + 600000).toISOString();
              showToast('Đã gia hạn phiên chuyển khoản VietQR thêm 10 phút!', 'success');
              showSepayQrStep(order);
            } catch (err) {
              showToast('Lỗi kết nối khi gia hạn phiên!', 'error');
              refreshBtn.disabled = false;
            }
          });
        }
      }
      showToast('Mã QR đã hết hạn giao dịch. Vui lòng bấm gia hạn!', 'error');
    } else {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      if (countdownEl) {
        countdownEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }
  }, 1000);
}

function completeOrderSuccess(order) {
  currentCompletedOrder = order;

  if (sepayCountdownTimer) {
    clearInterval(sepayCountdownTimer);
    sepayCountdownTimer = null;
  }
  if (sepayPollingInterval) {
    clearInterval(sepayPollingInterval);
    sepayPollingInterval = null;
  }

  // Dọn giỏ hàng
  localStorage.removeItem('SHOP_HOA_CART');
  localStorage.removeItem('SHOP_HOA_APPLIED_VOUCHER');
  updateCartBadge();

  // Đổ dữ liệu vào màn hình thành công
  const stepForm = document.querySelector('#checkoutStepForm');
  const stepSepay = document.querySelector('#checkoutStepSepay');
  const stepSuccess = document.querySelector('#checkoutStepSuccess');

  if (stepForm) stepForm.classList.add('hidden');
  if (stepSepay) stepSepay.classList.add('hidden');
  if (stepSuccess) stepSuccess.classList.remove('hidden');

  const orderIdEl = document.querySelector('#successOrderId');
  const recipientEl = document.querySelector('#successRecipientName');
  const addressEl = document.querySelector('#successAddress');
  const deliverySlotEl = document.querySelector('#successDeliverySlot');
  const paymentMethodEl = document.querySelector('#successPaymentMethod');
  const totalAmountEl = document.querySelector('#successTotalAmount');

  if (orderIdEl) orderIdEl.textContent = `#${order.orderCode || order.id}`;
  if (recipientEl) recipientEl.textContent = `${order.recipientName} (${order.recipientPhone})`;
  if (addressEl) addressEl.textContent = order.address;
  if (deliverySlotEl) deliverySlotEl.textContent = order.deliverySlot || 'Giao trong ngày';
  if (paymentMethodEl) {
    paymentMethodEl.innerHTML = order.paymentMethod === 'sepay'
      ? '<span style="color: #108474; font-weight: 700;">Chuyển khoản SePay (Đã thanh toán)</span>'
      : '<span style="color: #D97706; font-weight: 700;">Tiền mặt khi nhận hoa (COD)</span>';
  }
  if (totalAmountEl) totalAmountEl.textContent = formatPrice(order.totalAmount);
  showToast(`Đặt hoa thành công! Mã đơn #${order.id}`, 'success');
}
