import { exportOrderInvoicePdf } from './excel-pdf.js';
import {
  saveOrder,
  updateDraftOrder,
  getCartSummary,
  getDirectBuySummary
} from './storage.js';
import { formatPrice, showToast, updateCartBadge } from './utils.js';
import { DELIVERY_AREA_GROUPS } from './delivery-areas.js?v=20261115_area_rates_v2';
import { createDeliveryPinMap } from './delivery-map.js?v=20261115_google_maps_v2';

/**
 * checkout.js - Universal Checkout & SePay VietQR Payment Workflow
 * Hỗ trợ mở modal đặt hàng và thanh toán trực tiếp trên mọi trang (index.html, detail.html)
 */

let currentSepayConfig = null;

async function fetchSepayConfig() {
  const res = await fetch('/api/sepay/config');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Cổng thanh toán tạm thời không khả dụng');
  }
  const config = await res.json();
  currentSepayConfig = config;
  return config;
}
let activeCheckoutOptions = { mode: 'cart', directItems: null };
let currentDeliveryQuote = null;
let deliveryQuoteRequestId = 0;
let checkoutDeliveryMap = null;
let checkoutDeliveryPin = null;
let checkoutMapInitPromise = null;
let currentDraftOrder = null;
let currentDraftToken = null;
let currentDraftSignature = null;
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
    try { pollingAbortController.abort(); } catch (e) { }
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

function getActiveCheckoutSummary() {
  if (
    activeCheckoutOptions.mode === 'buy-now' &&
    Array.isArray(activeCheckoutOptions.directItems) &&
    activeCheckoutOptions.directItems.length > 0
  ) {
    return getDirectBuySummary(activeCheckoutOptions.directItems);
  }
  return getCartSummary();
}

function getDeliveryAddressInput() {
  return {
    address: document.querySelector('#checkoutAddress')?.value.trim() || '',
    addressDetails: document.querySelector('#checkoutAddressDetails')?.value.trim() || '',
    area: document.querySelector('#checkoutDeliveryArea')?.value || '',
    latitude: checkoutDeliveryPin?.latitude ?? null,
    longitude: checkoutDeliveryPin?.longitude ?? null
  };
}

function getDeliveryInputSignature(input = getDeliveryAddressInput()) {
  return JSON.stringify({ area: input.area });
}

/** Xóa ghim cũ khi khách sửa thông tin mô tả điểm giao để tránh giữ tọa độ lỗi thời. */
function invalidateCheckoutDeliveryPin(message = 'Địa chỉ vừa thay đổi. Hãy ghim lại đúng vị trí nhận hoa.') {
  checkoutDeliveryPin = null;
  checkoutDeliveryMap?.clearPin(false);
  const hint = document.querySelector('#checkoutMapPinHint');
  if (hint) {
    hint.classList.remove('delivery-pin-hint-error');
    hint.textContent = message;
  }
}

function clearDeliveryQuote(message = 'Chọn phường để hiện phí giao cố định.', cancelPendingRequest = true) {
  currentDeliveryQuote = null;
  if (cancelPendingRequest) deliveryQuoteRequestId += 1;
  const fee = document.querySelector('#checkoutShippingFee');
  if (fee) fee.textContent = 'Chưa báo giá';
  const hint = document.querySelector('#deliveryQuoteHint');
  if (hint) hint.textContent = message;
  const total = document.querySelector('#checkoutTotal');
  if (total) {
    const summary = getActiveCheckoutSummary();
    total.textContent = `${formatPrice(summary.totalPrice)} + phí theo phường`;
  }
}

async function requestDeliveryQuote() {
  const input = getDeliveryAddressInput();
  const hint = document.querySelector('#deliveryQuoteHint');
  if (!input.area) {
    clearDeliveryQuote('Chọn phường để xem phí giao theo khu vực.');
    return null;
  }
  const requestId = ++deliveryQuoteRequestId;
  const inputSignature = getDeliveryInputSignature(input);
  currentDeliveryQuote = null;
  const fee = document.querySelector('#checkoutShippingFee');
  if (fee) fee.textContent = 'Đang lấy phí khu vực…';
  if (hint) hint.textContent = 'Đang tra mức phí cố định của phường…';
  try {
    const response = await fetch('/api/delivery/quote', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || 'Chưa tính được phí giao; vui lòng kiểm tra lại địa chỉ.');
    if (!data.serviceable) throw new Error(data.message || 'Vị trí ghim nằm ngoài phạm vi tự giao hiện tại.');
    if (requestId !== deliveryQuoteRequestId || inputSignature !== getDeliveryInputSignature()) {
      throw new Error('Phường giao vừa thay đổi. Đang cập nhật phí khu vực, vui lòng thử lại.');
    }
    currentDeliveryQuote = { ...data, inputSignature };
    const needsManualQuote = Boolean(data.manualQuoteRequired || data.requiresShopConfirmation);
    if (fee) fee.textContent = needsManualQuote || !Number.isSafeInteger(Number(data.fee))
      ? 'Shop sẽ báo sau khi kiểm tra' : data.fee === 0 ? 'Miễn phí' : formatPrice(data.fee);
    if (hint) hint.textContent = needsManualQuote
      ? `${data.message || 'Tiệm cần xác nhận khu vực trước khi báo phí.'} Chưa giữ khung giờ.`
      : `${data.zoneName || 'Phí cố định theo phường'}: ${data.fee === 0 ? 'miễn phí' : formatPrice(data.fee)}. Phí không đổi khi ghim lại vị trí.`;
    const summary = getActiveCheckoutSummary();
    const total = document.querySelector('#checkoutTotal');
    if (total) total.textContent = needsManualQuote || !Number.isSafeInteger(Number(data.fee))
      ? 'Sẽ chốt sau khi shop báo phí' : formatPrice(Math.max(0, summary.totalPrice) + data.fee);
    const submitBtn = document.querySelector('#checkoutSubmitBtn');
    if (submitBtn) submitBtn.textContent = needsManualQuote
      ? 'Yêu Cầu Shop Báo Phí →'
      : (document.querySelector('#labelPaymentDeposit input')?.checked ? 'Thanh Toán Trước 50% →' : 'Thanh Toán Đủ Qua SePay →');
    return data;
  } catch (error) {
    if (requestId === deliveryQuoteRequestId) clearDeliveryQuote(error.message, false);
    throw error;
  } finally { /* Không có nút bấm riêng; phí được tra ngay khi chọn phường. */ }
}

/** Mở Google Maps sau khi modal hiện để căn đúng kích thước vùng bản đồ. */
async function initializeCheckoutDeliveryMap() {
  const element = document.querySelector('#checkoutDeliveryMap');
  if (!element) return;
  if (checkoutDeliveryMap) {
    requestAnimationFrame(() => checkoutDeliveryMap?.invalidateSize());
    return;
  }
  if (checkoutMapInitPromise) return checkoutMapInitPromise;
  checkoutMapInitPromise = createDeliveryPinMap(element, {
    onChange: pin => {
      checkoutDeliveryPin = pin;
      const hint = document.querySelector('#checkoutMapPinHint');
      if (hint) {
        hint.classList.remove('delivery-pin-hint-error');
        hint.textContent = pin
          ? `✓ Đã ghim vị trí nhận hoa (${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}). Kéo ghim để chỉnh số nhà nếu cần.`
          : 'Chưa ghim vị trí nhận hàng. Bấm bản đồ để đặt ghim.';
      }
    },
    onError: message => {
      const hint = document.querySelector('#checkoutMapPinHint');
      if (hint) {
        hint.textContent = message;
        hint.classList.add('delivery-pin-hint-error');
      }
    }
  }).then(controller => {
    checkoutDeliveryMap = controller;
    bindMapToolbarControls();
    const currentArea = document.querySelector('#checkoutDeliveryArea')?.value;
    if (currentArea && !checkoutDeliveryPin) {
      controller.flyToArea(currentArea, true);
    }
    requestAnimationFrame(() => controller.invalidateSize());
    return controller;
  }).catch(error => {
    const hint = document.querySelector('#checkoutMapPinHint');
    if (hint) {
      hint.textContent = error.message;
      hint.classList.add('delivery-pin-hint-error');
    }
    throw error;
  }).finally(() => {
    checkoutMapInitPromise = null;
  });
  return checkoutMapInitPromise;
}

/** Gắn sự kiện các nút tiện ích định vị trên thanh công cụ bản đồ. */
function bindMapToolbarControls() {
  const btnGps = document.querySelector('#btnMapCurrentGps');
  if (btnGps && btnGps.dataset.bound !== 'true') {
    btnGps.dataset.bound = 'true';
    btnGps.addEventListener('click', async () => {
      btnGps.classList.add('loading');
      try {
        await checkoutDeliveryMap?.locateUser?.();
        showToast('Đã định vị vị trí hiện tại của bạn.', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btnGps.classList.remove('loading');
      }
    });
  }

  const btnFocusWard = document.querySelector('#btnMapFocusWard');
  if (btnFocusWard && btnFocusWard.dataset.bound !== 'true') {
    btnFocusWard.dataset.bound = 'true';
    btnFocusWard.addEventListener('click', () => {
      const area = document.querySelector('#checkoutDeliveryArea')?.value;
      if (!area) {
        showToast('Vui lòng chọn phường/xã trước.', 'warning');
        return;
      }
      const ok = checkoutDeliveryMap?.flyToArea?.(area, true);
      if (ok) {
        showToast(`Đã bay về trung tâm ${area}`, 'success');
      } else {
        showToast('Không tìm thấy tọa độ của phường đã chọn.', 'error');
      }
    });
  }
}

export function openCheckoutModal(options = {}) {
  window.openCheckoutModal = openCheckoutModal;
  const modal = document.querySelector('#checkoutModal');
  const stepForm = document.querySelector('#checkoutStepForm');
  const stepSepay = document.querySelector('#checkoutStepSepay');
  const stepSuccess = document.querySelector('#checkoutStepSuccess');
  const stepManualQuote = document.querySelector('#checkoutStepManualQuote');
  const itemsContainer = document.querySelector('#checkoutItemsPreview');
  const subtotalEl = document.querySelector('#checkoutSubtotal');
  const discountLine = document.querySelector('#checkoutDiscountLine');
  const discountEl = document.querySelector('#checkoutDiscount');
  const totalEl = document.querySelector('#checkoutTotal');
  const shippingFeeEl = document.querySelector('#checkoutShippingFee');
  const errorBanner = document.querySelector('#checkoutFormErrorMessage');

  if (!modal) return;

  if (options?.mode === 'buy-now' && Array.isArray(options?.directItems) && options.directItems.length > 0) {
    activeCheckoutOptions = {
      mode: 'buy-now',
      directItems: options.directItems.map(item => ({ ...item }))
    };
  } else {
    activeCheckoutOptions = { mode: 'cart', directItems: null };
  }

  // Mỗi lần mở mới luồng thanh toán đều bắt đầu phiên đơn nháp sạch
  currentDraftOrder = null;
  currentDraftToken = null;
  currentDraftSignature = null;
  checkoutDeliveryPin = null;
  checkoutDeliveryMap?.clearPin(false);
  const deliveryRegionInput = document.querySelector('#checkoutDeliveryRegion');
  if (deliveryRegionInput) deliveryRegionInput.value = '';
  const mapPinHint = document.querySelector('#checkoutMapPinHint');
  if (mapPinHint) {
    mapPinHint.classList.remove('delivery-pin-hint-error');
    mapPinHint.textContent = 'Chọn phường rồi ghim điểm nhận hàng.';
  }
  const deliveryAreaInput = document.querySelector('#checkoutDeliveryArea');
  if (deliveryAreaInput) {
    deliveryAreaInput.replaceChildren(new Option('Chọn khu vực trước', ''));
    deliveryAreaInput.disabled = true;
  }
  const deliveryStreetInput = document.querySelector('#checkoutAddress');
  const deliveryDetailsInput = document.querySelector('#checkoutAddressDetails');
  if (deliveryAreaInput) deliveryAreaInput.value = '';
  if (deliveryStreetInput) deliveryStreetInput.value = '';
  if (deliveryDetailsInput) deliveryDetailsInput.value = '';
  clearDeliveryQuote();
  if (errorBanner) errorBanner.classList.add('hidden');

  const birthdayModal = document.getElementById('birthdayModal');
  if (birthdayModal) birthdayModal.classList.add('hidden');
  sessionStorage.setItem('birthday_shown', 'true');

  const summary = getActiveCheckoutSummary();
  // Lọc sạch sản phẩm lỗi hoặc không có ID, tên hoặc giá không hợp lệ
  summary.items = (summary.items || []).filter(item => {
    if (!item) return false;
    const idStr = String(item.id || item.productId || '').trim();
    if (!idStr || idStr === 'undefined' || idStr === 'null') return false;
    if (!item.name || item.name === 'undefined' || item.name === 'null') return false;
    if (!item.price || isNaN(Number(item.price)) || Number(item.price) <= 0) return false;
    return true;
  });

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
  if (shippingFeeEl) {
    shippingFeeEl.textContent = 'Chưa báo giá';
    shippingFeeEl.style.color = '';
  }
  if (totalEl) totalEl.textContent = `${formatPrice(summary.totalPrice)} + phí theo phường`;

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
    } catch (e) { }
  }

  // Reset về bước 1
  if (stepForm) stepForm.classList.remove('hidden');
  if (stepSepay) stepSepay.classList.add('hidden');
  if (stepSuccess) stepSuccess.classList.add('hidden');
  if (stepManualQuote) stepManualQuote.classList.add('hidden');

  // Mở modal
  modal.classList.remove('hidden');
  requestAnimationFrame(() => {
    initializeCheckoutDeliveryMap().catch(() => {});
    checkoutDeliveryMap?.invalidateSize();
  });
}

export function closeCheckoutModal() {
  const modal = document.querySelector('#checkoutModal');
  if (modal) modal.classList.add('hidden');
  if (sepayCountdownTimer) {
    clearInterval(sepayCountdownTimer);
    sepayCountdownTimer = null;
  }
  stopSepayPolling();
  currentDraftOrder = null;
  currentDraftToken = null;
  currentDraftSignature = null;
  activeCheckoutOptions = { mode: 'cart', directItems: null };
}

window.openCheckoutModal = openCheckoutModal;
window.closeCheckoutModal = closeCheckoutModal;

export function initCheckoutWorkflow() {
  const modal = document.querySelector('#checkoutModal');
  if (!modal || modal.dataset.checkoutInitialized === 'true') return;
  modal.dataset.checkoutInitialized = 'true';

  const closeBtn = document.querySelector('#checkoutModalClose');
  const manualQuoteDoneBtn = document.querySelector('#manualQuoteDoneBtn');
  const form = document.querySelector('#checkoutForm');
  const isGiftCheck = document.querySelector('#checkoutIsGift');
  const giftFields = document.querySelector('#giftRecipientFields');
  const hasCardCheck = document.querySelector('#checkoutHasCard');
  const cardMessageWrap = document.querySelector('#cardMessageWrap');

  const radioFull = document.querySelector('#labelPaymentFull input');
  const radioDeposit = document.querySelector('#labelPaymentDeposit input');
  const labelFull = document.querySelector('#labelPaymentFull');
  const labelDeposit = document.querySelector('#labelPaymentDeposit');

  const addressInput = document.querySelector('#checkoutAddress');
  const addressDetailsInput = document.querySelector('#checkoutAddressDetails');
  const regionSelect = document.querySelector('#checkoutDeliveryRegion');
  const areaSelect = document.querySelector('#checkoutDeliveryArea');
  if (regionSelect) {
    regionSelect.replaceChildren(new Option('Chọn khu vực để lọc phường', ''));
    DELIVERY_AREA_GROUPS.forEach(group => regionSelect.append(new Option(group.label, group.label)));
  }
  if (areaSelect) {
    areaSelect.replaceChildren(new Option('Chọn khu vực trước', ''));
    areaSelect.disabled = true;
  }
  if (regionSelect && regionSelect.dataset.deliveryBound !== 'true') {
    regionSelect.dataset.deliveryBound = 'true';
    regionSelect.addEventListener('change', () => {
      const selectedGroup = DELIVERY_AREA_GROUPS.find(group => group.label === regionSelect.value);
      areaSelect.replaceChildren(new Option(selectedGroup ? 'Chọn phường/xã' : 'Chọn khu vực trước', ''));
      if (selectedGroup) selectedGroup.areas.forEach(area => areaSelect.append(new Option(area, area)));
      areaSelect.disabled = !selectedGroup;
      areaSelect.value = '';
      invalidateCheckoutDeliveryPin('Chọn lại vị trí nhận hoa sau khi đổi khu vực.');
      clearDeliveryQuote(selectedGroup ? 'Chọn phường để hiện phí giao cố định.' : 'Chọn khu vực để lọc phường.');
    });
  }
  if (areaSelect && areaSelect.dataset.deliveryBound !== 'true') {
    areaSelect.dataset.deliveryBound = 'true';
    areaSelect.addEventListener('change', () => {
      const selectedArea = areaSelect.value;
      clearDeliveryQuote(selectedArea ? 'Đang lấy phí cố định theo phường…' : 'Chọn phường để hiện phí giao cố định.');

      if (selectedArea) {
        // Tự động bay về trung tâm phường và cắm ghim ngay lập tức!
        if (checkoutDeliveryMap?.flyToArea) {
          checkoutDeliveryMap.flyToArea(selectedArea, true);
        }
        requestDeliveryQuote().catch(error => showToast(error.message, 'error'));
      } else {
        invalidateCheckoutDeliveryPin('Chọn phường để hiện phí giao cố định và ghim vị trí.');
      }
    });
  }
  [addressInput, addressDetailsInput].filter(Boolean).forEach(input => {
    if (input.dataset.deliveryAddressBound === 'true') return;
    input.dataset.deliveryAddressBound = 'true';
    input.addEventListener('input', () => {
      if (input.value.length > 255) input.setCustomValidity('Địa chỉ không được vượt quá 255 ký tự.');
      else input.setCustomValidity('');
      // Giữ nguyên ghim đã chọn, không xóa ghim khi khách nhập số nhà/hẻm
    });
  });
  const submitBtn = document.querySelector('#checkoutSubmitBtn');

  const dateInput = document.querySelector('#checkoutDeliveryDate');
  const dateHint = document.querySelector('#deliveryDateHint');
  const isAnonymousCheck = document.querySelector('#checkoutIsAnonymous');

  // Khởi tạo ngày hẹn giao hoa (Delivery Date picker & cutoff time chuẩn 7 ngày)
  const getVnDateStr = (d) => {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(d);
    return `${p.find(x => x.type === 'year')?.value}-${p.find(x => x.type === 'month')?.value}-${p.find(x => x.type === 'day')?.value}`;
  };

  const now = new Date();
  const todayStr = getVnDateStr(now);
  const isPastCutoff = now.getHours() >= 18;
  const minDateObj = isPastCutoff ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : now;
  const minDateStr = getVnDateStr(minDateObj);
  // Ràng buộc thực tế: Tối đa 7 ngày kể từ ngày giao sớm nhất (tròn 1 tuần)
  const maxDateObj = new Date(minDateObj.getTime() + 7 * 24 * 60 * 60 * 1000);
  const maxDateStr = getVnDateStr(maxDateObj);

  if (dateInput) {
    dateInput.min = minDateStr;
    dateInput.max = maxDateStr;
    dateInput.value = minDateStr;

    if (isPastCutoff) {
      if (dateHint) dateHint.textContent = '🌙 Đã qua 18:00, lịch giao sớm nhất xếp từ ngày mai (trong 7 ngày tới).';
    } else {
      if (dateHint) dateHint.textContent = '⚡ Giao trong ngày hoặc đặt lịch hẹn trong 7 ngày tới.';
    }

    dateInput.addEventListener('change', () => {
      const selected = dateInput.value;
      if (!selected) return;
      if (selected < minDateStr) {
        dateInput.value = minDateStr;
        showToast('Không thể chọn ngày hẹn giao trong quá khứ!', 'warning');
        return;
      }
      if (selected > maxDateStr) {
        dateInput.value = maxDateStr;
        showToast('Tiệm chỉ nhận đặt lịch hẹn giao trong vòng 7 ngày tới để hoa được làm mới nhất!', 'warning');
        return;
      }
      const parts = selected.split('-');
      const monthDay = `${parts[1]}-${parts[2]}`;
      if (monthDay === '11-20') {
        if (dateHint) dateHint.textContent = '💐 Ngày Nhà Giáo 20/11: Tiệm ưu tiên uốn hoa kẽm nhung tỉ mỉ và giao đúng khung giờ hẹn!';
      } else if (monthDay === '02-14') {
        if (dateHint) dateHint.textContent = '🌹 Dịp Lễ Valentine 14/02: Tiệm ưu tiên cắm hoa nghệ thuật và giao đúng giờ!';
      } else if (monthDay === '03-08') {
        if (dateHint) dateHint.textContent = '🌸 Quốc Tế Phụ Nữ 08/03: Tiệm chuẩn bị sẵn túi quà và thiệp chúc mừng!';
      } else if (monthDay === '10-20') {
        if (dateHint) dateHint.textContent = '💐 Ngày Phụ Nữ Việt Nam 20/10: Tiệm cam kết giao đúng khung giờ hẹn trước!';
      } else if (selected === todayStr) {
        if (dateHint) dateHint.textContent = isPastCutoff ? '⚠️ Đã sau 18:00, đơn giao trong ngày có thể chuyển sang khung tối hoặc ngày mai.' : '⚡ Giao hỏa tốc hoặc trong ngày hôm nay.';
      } else {
        if (dateHint) dateHint.textContent = `📅 Đã lên lịch giao hoa vào ngày ${parts[2]}/${parts[1]}/${parts[0]} (trong vòng 7 ngày).`;
      }
    });
  }

  const btnBackCheckout = document.querySelector('#btnBackToCheckoutForm');
  const btnViewReceipt = document.querySelector('#btnViewReceiptPdf');
  const btnSuccessContinue = document.querySelector('#btnSuccessContinue');

  // Đóng modal
  if (closeBtn) closeBtn.addEventListener('click', closeCheckoutModal);
  if (manualQuoteDoneBtn) manualQuoteDoneBtn.addEventListener('click', closeCheckoutModal);

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
    if (radioFull && radioFull.checked) {
      if (labelFull) labelFull.classList.add('selected');
      if (labelDeposit) labelDeposit.classList.remove('selected');
      if (submitBtn) submitBtn.textContent = currentDeliveryQuote?.manualQuoteRequired || currentDeliveryQuote?.requiresShopConfirmation
        ? 'Yêu Cầu Shop Báo Phí →' : 'Thanh Toán Đủ Qua SePay →';
    } else {
      if (labelFull) labelFull.classList.remove('selected');
      if (labelDeposit) labelDeposit.classList.add('selected');
      if (submitBtn) submitBtn.textContent = currentDeliveryQuote?.manualQuoteRequired || currentDeliveryQuote?.requiresShopConfirmation
        ? 'Yêu Cầu Shop Báo Phí →' : 'Thanh Toán Trước 50% →';
    }
  }

  if (radioFull) radioFull.addEventListener('change', updatePaymentMethodUi);
  if (radioDeposit) radioDeposit.addEventListener('change', updatePaymentMethodUi);

  // Submit form đặt hàng
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const senderName = document.querySelector('#checkoutSenderName').value.trim();
      const senderPhone = document.querySelector('#checkoutSenderPhone').value.trim();
      const address = document.querySelector('#checkoutAddress').value.trim();
      const addressDetails = document.querySelector('#checkoutAddressDetails')?.value.trim() || '';
      const email = document.querySelector('#checkoutEmail').value.trim();
      const deliveryDate = document.querySelector('#checkoutDeliveryDate') ? document.querySelector('#checkoutDeliveryDate').value : '';
      const deliverySlot = document.querySelector('#checkoutDeliverySlot').value;
      const isGift = Boolean(isGiftCheck && isGiftCheck.checked);
      const isAnonymous = Boolean(isGift && isAnonymousCheck && isAnonymousCheck.checked);
      const recipientName = isGift ? document.querySelector('#checkoutRecipientName').value.trim() : '';
      const recipientPhone = isGift ? document.querySelector('#checkoutRecipientPhone').value.trim() : '';
      const hasGreetingCard = Boolean(hasCardCheck && hasCardCheck.checked);
      const cardMessageEl = document.querySelector('#checkoutCardMessage') || document.querySelector('#cardMessageInput');
      const cardMessage = hasGreetingCard && cardMessageEl ? cardMessageEl.value.trim() : '';
      const note = document.querySelector('#checkoutNote').value.trim();
      const paymentPlan = radioDeposit && radioDeposit.checked ? 'sepay_deposit' : 'sepay_full';
      const deliveryArea = document.querySelector('#checkoutDeliveryArea').value;
      const deliveryPin = checkoutDeliveryPin;
      const fullDeliveryAddress = [address, addressDetails, deliveryArea, 'Thành phố Hồ Chí Minh'].filter(Boolean).join(', ');

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

      const errorBanner = document.querySelector('#checkoutFormErrorMessage');
      if (errorBanner) errorBanner.classList.add('hidden');

      function showCheckoutError(msg) {
        if (errorBanner) {
          errorBanner.textContent = '⚠️ ' + msg;
          errorBanner.classList.remove('hidden');
          errorBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        showToast(msg, 'error');
      }

      if (fullDeliveryAddress.length > 255) {
        showCheckoutError('Địa chỉ quá dài; vui lòng rút gọn chỉ dẫn hoặc thông tin căn hộ.');
        return;
      }

      if (!deliveryDate) {
        showCheckoutError('Vui lòng chọn ngày hẹn giao hoa (trong vòng 7 ngày tới)!');
        return;
      }

      if (deliveryDate < minDateStr || deliveryDate > maxDateStr) {
        showCheckoutError('Tiệm chỉ nhận đặt lịch hẹn giao trong vòng 7 ngày tới (1 tuần)!');
        return;
      }

      if (isGift && !recipientName) {
        showCheckoutError('Vui lòng nhập tên người nhận hoa!');
        return;
      }
      if (isGift && !phoneRegex.test(recipientPhone)) {
        showCheckoutError('Vui lòng nhập số điện thoại người nhận hợp lệ!');
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showCheckoutError('Email nhận biên nhận chưa đúng định dạng!');
        return;
      }

      if (!isValid) {
        const firstMissing = !senderName ? 'Họ và tên người đặt' : (!senderPhone ? 'Số điện thoại người đặt' : 'Địa chỉ nhận hoa');
        showCheckoutError(`Vui lòng cuộn lên đầu form và điền: ${firstMissing}!`);
        return;
      }

      const summary = getActiveCheckoutSummary();
      const validItems = (summary.items || [])
        .filter(item => {
          if (!item) return false;
          const idStr = String(item.id || item.productId || '').trim();
          if (!idStr || idStr === 'undefined' || idStr === 'null') return false;
          if (!item.name || item.name === 'undefined' || item.name === 'null') return false;
          if (!item.price || isNaN(Number(item.price)) || Number(item.price) <= 0) return false;
          return true;
        })
        .map(item => ({
          ...item,
          productId: String(item.productId || item.id || '').replace(/__.*$/, '').trim(),
          addonIds: Array.isArray(item.addonIds) ? item.addonIds : (Array.isArray(item.selectedAddons) ? item.selectedAddons.map(a => a.id || a.addonId) : [])
        }));

      if (validItems.length === 0) {
        showCheckoutError('Giỏ hàng không có sản phẩm hợp lệ để thanh toán!');
        return;
      }

      const termsAccepted = Boolean(document.querySelector('#checkoutTermsAccepted')?.checked);
      const draftPayload = {
        customerName: senderName,
        phone: senderPhone,
        email: email || '',
        isGift: isGift,
        isAnonymous: isAnonymous,
        recipientName: isGift ? recipientName : senderName,
        recipientPhone: isGift ? recipientPhone : senderPhone,
        address: fullDeliveryAddress,
        deliveryDate: deliveryDate || null,
        deliverySlot: deliverySlot,
        hasGreetingCard: hasGreetingCard,
        cardMessage: cardMessage,
        note: note,
        paymentMethod: 'sepay',
        paymentPlan,
        deliveryArea,
        latitude: deliveryPin?.latitude ?? null,
        longitude: deliveryPin?.longitude ?? null,
        termsAccepted,
        paymentStatus: 'pending',
        items: validItems,
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
        status: 'pending'
      };

      if (!deliveryArea) { showCheckoutError('Vui lòng chọn phường/xã giao hàng.'); return; }
      if (!deliveryPin) { showCheckoutError('Vui lòng ghim vị trí nhận hoa trên bản đồ để tiệm giao đúng địa chỉ.'); return; }
      if (!termsAccepted) { showCheckoutError('Vui lòng xác nhận chính sách thanh toán và giao hàng.'); return; }

      try {
        const deliveryQuote = await requestDeliveryQuote();
        if (deliveryQuote?.requiresShopConfirmation || deliveryQuote?.manualQuoteRequired) {
          if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang gửi yêu cầu…'; }
          try {
            const response = await fetch('/api/delivery/quote-requests', {
              method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(draftPayload)
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error?.message || 'Không gửi được yêu cầu báo giá.');
            const requestStep = document.querySelector('#checkoutStepManualQuote');
            const requestCode = document.querySelector('#manualQuoteRequestCode');
            const requestLink = document.querySelector('#manualQuoteCustomerLink');
            const formStep = document.querySelector('#checkoutStepForm');
            if (requestCode) requestCode.textContent = result.requestCode;
            if (requestLink) requestLink.href = result.customerUrl;
            if (formStep) formStep.classList.add('hidden');
            if (requestStep) requestStep.classList.remove('hidden');
            return;
          } catch (requestError) {
            showCheckoutError(requestError.message);
            return;
          } finally {
            if (submitBtn) { submitBtn.disabled = false; updatePaymentMethodUi(); }
          }
        }
        if (deliveryQuote?.fee == null) {
          showCheckoutError('Chưa có phí giao hợp lệ. Vui lòng yêu cầu tiệm báo giá.');
          return;
        }
      } catch (quoteError) {
        showCheckoutError(quoteError.message);
        return;
      }

      const draftSignature = JSON.stringify({
        customerName: senderName,
        phone: senderPhone,
        email: email || '',
        isGift,
        recipientName: draftPayload.recipientName,
        recipientPhone: draftPayload.recipientPhone,
        address,
        addressDetails,
        deliveryArea,
        latitude: deliveryPin.latitude,
        longitude: deliveryPin.longitude,
        deliveryDate,
        deliverySlot,
        hasGreetingCard,
        cardMessage,
        note,
        paymentPlan,
        voucherCode: draftPayload.voucherCode,
        items: validItems.map(i => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          addonIds: [...(i.addonIds || [])].sort()
        }))
      });

      const previousDraft = currentDraftOrder;
      const previousDraftToken = currentDraftToken;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang xử lý đặt hàng...';
      }

      try {
        // Nếu khách bấm quay lại từ VietQR rồi bấm tiếp mà không sửa gì -> dùng lại đúng đơn nháp cũ
        if (
          previousDraft &&
          previousDraftToken &&
          draftSignature === currentDraftSignature &&
          paymentPlan === previousDraft.paymentPlan
        ) {
          showSepayQrStep(previousDraft);
          return;
        }

        // Nếu đã có đơn nháp đang pending & chưa thanh toán -> cập nhật đơn cũ thay vì tạo trùng
        const saved = (previousDraft && previousDraftToken)
          ? await updateDraftOrder(previousDraft.id, draftPayload, previousDraftToken)
          : await saveOrder(draftPayload);

        currentDraftOrder = saved;
        currentDraftToken = saved.draftToken || previousDraftToken || null;
        currentDraftSignature = draftSignature;

        showSepayQrStep(currentDraftOrder);
      } catch (error) {
        const errStatus = error.response?.status;
        const msg = error.response?.data?.error?.message || error.message || 'Không thể tạo đơn hàng để thanh toán. Vui lòng kiểm tra lại thông tin.';
        // Nếu đơn nháp cũ đã hết hạn/bị hủy (nhưng KHÔNG phải đã thanh toán) -> xóa trạng thái nháp để lần bấm tới tạo mới sạch sẽ
        if ((errStatus === 404 || errStatus === 400) && !msg.includes('đã được thanh toán')) {
          currentDraftOrder = null;
          currentDraftToken = null;
          currentDraftSignature = null;
        }
        showCheckoutError(msg);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          updatePaymentMethodUi();
        }
      }
    });
  }

  // Nút quay lại từ màn hình SePay (BUG-10: Dọn dẹp cả countdown và kích hoạt abort controller)
  if (btnBackCheckout) {
    btnBackCheckout.addEventListener('click', () => {
      document.querySelector('#checkoutStepSepay').classList.add('hidden');
      document.querySelector('#checkoutStepForm').classList.remove('hidden');
      if (sepayCountdownTimer) {
        clearInterval(sepayCountdownTimer);
        sepayCountdownTimer = null;
      }
      stopSepayPolling();
    });
  }

  // Nút Tôi Đã Chuyển Khoản (Kích hoạt kiểm tra đối soát tức thì)
  const btnConfirmTransfer = document.querySelector('#btnConfirmTransfer');
  if (btnConfirmTransfer) {
    btnConfirmTransfer.addEventListener('click', async () => {
      if (!currentDraftOrder) return;
      const statusPill = document.querySelector('#sepayStatusText');
      const defaultHtml = currentSepayConfig?.simulationOnly ? '<span>Mô phỏng thanh toán (local)</span>' : `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Tôi Đã Chuyển Khoản (Kiểm Tra Ngay)</span>
      `;
      btnConfirmTransfer.disabled = true;
      btnConfirmTransfer.innerHTML = `
        <svg class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"></path>
        </svg>
        <span>Đang kiểm tra với ngân hàng...</span>
      `;
      if (statusPill) statusPill.textContent = currentSepayConfig?.simulationOnly
        ? 'Đang ghi nhận mô phỏng nội bộ. Không có giao dịch ngân hàng thật.'
        : 'Đang đối soát giao dịch qua SePay...';

      try {
        const phone = currentDraftOrder.phone || currentDraftOrder.customerPhone || '';
        const intent = currentDraftOrder.paymentIntent || currentDraftOrder.paymentIntents?.find(item => item.status === 'pending');
        if (currentSepayConfig?.simulationOnly) {
          const response = await fetch(`/api/sepay/simulate-payment/${encodeURIComponent(currentDraftOrder.id)}`, {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, intentId: intent?.id || null })
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error?.message || 'Không thể mô phỏng thanh toán local.');
          stopSepayPolling();
          showToast('Đã ghi nhận thanh toán mô phỏng local; không có tiền thật được chuyển.', 'success');
          completeOrderSuccess(result.order || currentDraftOrder);
          return;
        }
        const res = await fetch(`/api/sepay/check-payment/${encodeURIComponent(currentDraftOrder.id)}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, intentId: intent?.id || null })
        });
        const data = await res.json();

        if (data.cancelled) {
          stopSepayPolling();
          if (statusPill) statusPill.innerHTML = '<span style="color: #D92D20; font-weight: 700;">⚠️ Đơn hàng đã bị hủy.</span>';
          showToast('Đơn hàng này đã bị hủy.', 'warning');
          return;
        }

        if (data.paid) {
          stopSepayPolling();
          if (sepayCountdownTimer) {
            clearInterval(sepayCountdownTimer);
            sepayCountdownTimer = null;
          }
          if (statusPill) statusPill.innerHTML = '<span style="color: #108474; font-weight: 700;">✓ Đã xác nhận khoản SePay. Đang hoàn tất đơn...</span>';
          showToast('Đã xác nhận khoản thanh toán trực tuyến.', 'success');
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.3;
            audio.play().catch(() => { });
          } catch (e) { }

          const completedOrder = data.order || {
            ...currentDraftOrder,
            paymentStatus: currentDraftOrder.paymentPlan === 'sepay_deposit' ? 'partially_paid' : 'paid',
            status: 'confirmed'
          };
          setTimeout(() => {
            completeOrderSuccess(completedOrder);
          }, 800);
          return;
        }

        // Nếu ngân hàng chưa ghi nhận tiền
        if (statusPill) statusPill.innerHTML = '<span style="color: #D97706; font-weight: 600;">⏳ Đang chờ giao dịch từ ngân hàng Sacombank...</span>';
        showToast('Hệ thống đang chờ ngân hàng Sacombank ghi nhận. Nếu bạn vừa chuyển tiền, vui lòng đợi từ 5–30 giây.', 'info');
      } catch (err) {
        showToast('Chưa thể kết nối với cổng đối soát, hệ thống sẽ tự động thử lại trong giây lát.', 'warning');
      } finally {
        setTimeout(() => {
          if (btnConfirmTransfer) {
            btnConfirmTransfer.disabled = false;
            btnConfirmTransfer.innerHTML = defaultHtml;
          }
        }, 3000);
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
      const targetCode = currentCompletedOrder
        ? (currentCompletedOrder.orderCode || currentCompletedOrder.order_code || currentCompletedOrder.id)
        : '';
      closeCheckoutModal();
      window.location.href = './orders.html' + (targetCode ? '?orderCode=' + encodeURIComponent(targetCode) : '');
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

async function showSepayQrStep(order) {
  const stepForm = document.querySelector('#checkoutStepForm');
  const stepSepay = document.querySelector('#checkoutStepSepay');
  const qrImg = document.querySelector('#sepayQrImage');
  const qrSpinner = document.querySelector('#sepayQrSpinner');
  const qrLocalPlaceholder = document.querySelector('#sepayQrLocalPlaceholder');
  const countdownEl = document.querySelector('#sepayCountdown');
  const transferAmountEl = document.querySelector('#sepayTransferAmount');
  const transferAmountRaw = document.querySelector('#sepayTransferAmountRaw');
  const transferContentEl = document.querySelector('#sepayTransferContent');
  const statusPill = document.querySelector('#sepayStatusText');

  if (stepForm) stepForm.classList.add('hidden');
  if (stepSepay) stepSepay.classList.remove('hidden');

  const orderCode = order.orderCode || order.order_code || order.id;
  const intent = order.paymentIntent || order.paymentIntents?.find(item => item.status === 'pending');
  if (!intent?.referenceCode || !Number.isSafeInteger(Number(intent.amount))) {
    if (statusPill) statusPill.textContent = 'Đơn chưa có mã thanh toán hợp lệ. Vui lòng tải lại đơn hoặc liên hệ shop.';
    return;
  }

  let config;
  try {
    if (statusPill) statusPill.textContent = 'Đang tải thông tin chuyển khoản từ máy chủ...';
    config = await fetchSepayConfig();
  } catch (err) {
    showToast(err.message || 'Cổng thanh toán VietQR tạm thời không khả dụng', 'error');
    if (statusPill) statusPill.innerHTML = `<span style="color: #D92D20; font-weight: 600;">⚠️ ${err.message || 'Không thể lấy thông tin ngân hàng'}</span>`;
    return;
  }

  const amountDueNow = Number(intent.amount);
  const qrUrl = config.simulationOnly ? '' : `https://qr.sepay.vn/img?acc=${encodeURIComponent(config.accountNumber)}&bank=${encodeURIComponent(config.bankCode)}&amount=${amountDueNow}&des=${encodeURIComponent(intent.referenceCode)}&template=compact`;

  const bankNameEl = document.querySelector('#sepayBankName');
  const accountNumberEl = document.querySelector('#sepayAccountNumber');
  const accountHolderEl = document.querySelector('#sepayAccountHolder');
  if (bankNameEl) bankNameEl.textContent = config.bankCode;
  if (accountNumberEl) accountNumberEl.textContent = config.accountNumber;
  if (accountHolderEl) accountHolderEl.textContent = config.accountHolder;
  if (qrImg) {
    if (config.simulationOnly) {
      qrImg.removeAttribute('src');
      qrImg.classList.add('hidden');
    } else {
      qrImg.src = qrUrl;
      qrImg.alt = 'Mã QR VietQR Napas 247 thanh toán SePay';
      qrImg.classList.remove('hidden');
    }
  }
  if (qrSpinner) qrSpinner.classList.add('hidden');
  if (qrLocalPlaceholder) qrLocalPlaceholder.classList.toggle('hidden', !config.simulationOnly);
  if (transferAmountEl) transferAmountEl.textContent = formatPrice(amountDueNow);
  if (transferAmountRaw) transferAmountRaw.value = amountDueNow;
  if (transferContentEl) transferContentEl.textContent = intent.referenceCode;
  if (statusPill) statusPill.textContent = config.simulationOnly
    ? `LOCAL MOCK: khoản ${formatPrice(amountDueNow)}, mã ${intent.referenceCode}. Bấm nút mô phỏng bên dưới; không chuyển khoản thật.`
    : `Đang chờ SePay xác nhận mã ${intent.referenceCode}... (Tự động nhận diện khi chuyển tiền)`;
  const amountLabel = document.querySelector('#sepayAmountLabel');
  if (amountLabel) {
    const purposeLabels = {
      advance_50: 'Khoản trả trước 50%',
      full_payment: 'Khoản thanh toán đủ',
      order_adjustment: 'Khoản phí điều chỉnh đơn',
      redelivery_fee: 'Phí chuyến giao lại'
    };
    amountLabel.textContent = purposeLabels[intent.purpose] || 'Khoản chuyển khoản cần đối soát';
  }

  const btnConfirm = document.querySelector('#btnConfirmTransfer');
  if (btnConfirm) {
    btnConfirm.disabled = false;
    btnConfirm.innerHTML = config.simulationOnly ? '<span>Mô phỏng thanh toán (local)</span>' : `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>Tôi Đã Chuyển Khoản (Kiểm Tra Ngay)</span>
    `;
  }

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
      const phone = order.phone || order.customerPhone || '';
      const res = await fetch(`/api/sepay/check-payment/${encodeURIComponent(order.id)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, intentId: intent.id }),
        signal: pollingAbortController.signal
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.cancelled) {
        stopSepayPolling();
        if (sepayCountdownTimer) {
          clearInterval(sepayCountdownTimer);
          sepayCountdownTimer = null;
        }
        if (statusPill) statusPill.innerHTML = '<span style="color: #D92D20; font-weight: 700;">⚠️ Đơn hàng đã bị hủy. Đã dừng kiểm tra thanh toán.</span>';
        showToast('Đơn hàng này đã bị hủy. Vui lòng liên hệ hỗ trợ nếu bạn đã chuyển khoản.', 'warning');
        return;
      }
      if (data.order?.paymentIntent?.status === 'needs_review') {
        stopSepayPolling();
        if (statusPill) statusPill.textContent = 'SePay đã nhận giao dịch nhưng số tiền/mã cần shop đối soát. Vui lòng liên hệ shop.';
        showToast('Khoản chuyển cần shop đối soát; đơn chưa tự xác nhận.', 'warning');
        return;
      }
      if (data.paid) {
        stopSepayPolling();
        if (sepayCountdownTimer) {
          clearInterval(sepayCountdownTimer);
          sepayCountdownTimer = null;
        }

        if (statusPill) statusPill.innerHTML = '<span style="color: #108474; font-weight: 700;">✓ Đã xác nhận khoản SePay. Đang hoàn tất đơn...</span>';
        showToast('Đã xác nhận khoản thanh toán trực tuyến.', 'success');

        // Bọc âm thanh trong try/catch tránh bị chặn bởi Autoplay Policy
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.volume = 0.3;
          audio.play().catch(() => { });
        } catch (e) { }

        const completedOrder = data.order || {
          ...order,
          paymentStatus: order.paymentPlan === 'sepay_deposit' ? 'partially_paid' : 'paid',
          status: 'confirmed',
          sepayTransaction: {
            bank: data.transaction?.bank_brand_name || currentSepayConfig?.bankCode || 'Ngân hàng',
            account: data.transaction?.account_number || currentSepayConfig?.accountNumber || '',
            amount: data.transaction?.amount_in || amountDueNow,
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

  // 2. Đếm ngược theo hạn thật của intent; không gia hạn giả chỉ trên trình duyệt.
  if (sepayCountdownTimer) clearInterval(sepayCountdownTimer);
  const expiresAtMs = intent.expiresAt ? new Date(intent.expiresAt).getTime() : NaN;
  let timeLeft = Number.isFinite(expiresAtMs)
    ? Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000))
    : 0;
  const renderPaymentCountdown = () => {
    if (!countdownEl) return;
    if (timeLeft <= 0) {
      countdownEl.innerHTML = '<span style="color: var(--color-sale-price); font-weight: 700;">Mã thanh toán đã hết hạn. Không chuyển khoản vào mã này.</span>';
      stopSepayPolling();
      showToast('Mã thanh toán đã hết hạn. Vui lòng tạo đơn mới hoặc liên hệ tiệm nếu bạn đã chuyển khoản.', 'warning');
      return;
    }
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };
  renderPaymentCountdown();
  sepayCountdownTimer = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(sepayCountdownTimer);
      timeLeft = 0;
      renderPaymentCountdown();
    } else {
      renderPaymentCountdown();
    }
  }, 1000);
}

function completeOrderSuccess(order) {
  currentCompletedOrder = order;

  if (sepayCountdownTimer) {
    clearInterval(sepayCountdownTimer);
    sepayCountdownTimer = null;
  }
  stopSepayPolling();

  // Chỉ dọn giỏ hàng khi đặt từ Giỏ hàng; Mua Ngay giữ nguyên giỏ cũ của khách
  if (activeCheckoutOptions.mode !== 'buy-now') {
    localStorage.removeItem('SHOP_HOA_CART');
    localStorage.removeItem('SHOP_HOA_APPLIED_VOUCHER');
  }
  updateCartBadge();

  currentDraftOrder = null;
  currentDraftToken = null;
  currentDraftSignature = null;
  activeCheckoutOptions = { mode: 'cart', directItems: null };

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
  const receivedEl = document.querySelector('#successAmountReceived');
  const balanceEl = document.querySelector('#successAmountDueAtDelivery');

  if (orderIdEl) orderIdEl.textContent = `#${order.orderCode || order.id}`;
  if (recipientEl) recipientEl.textContent = `${order.recipientName} (${order.recipientPhone})`;
  if (addressEl) addressEl.textContent = order.address;
  if (deliverySlotEl) deliverySlotEl.textContent = order.deliverySlot || 'Giao trong ngày';
  if (paymentMethodEl) {
    const isDeposit = order.paymentPlan === 'sepay_deposit';
    paymentMethodEl.textContent = isDeposit
      ? `Đã trả trước ${formatPrice(order.amountReceived || order.amountDueNow || 0)} qua SePay; còn thu ${formatPrice(order.amountToCollectAtDelivery || Math.max(0, order.totalAmount - (order.amountReceived || 0)))} khi giao`
      : 'Đã thanh toán đủ qua SePay';
  }
  if (receivedEl) receivedEl.textContent = formatPrice(order.amountReceived || 0);
  if (balanceEl) balanceEl.textContent = formatPrice(order.amountToCollectAtDelivery || 0);
  if (totalAmountEl) totalAmountEl.textContent = formatPrice(order.totalAmount);
  showToast(`Đặt hoa thành công! Mã đơn #${order.orderCode || order.id}`, 'success');
}
