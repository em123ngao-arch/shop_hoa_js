const params = new URLSearchParams(window.location.search);
const codeInput = document.querySelector('#deliveryQuoteCode');
const phoneInput = document.querySelector('#deliveryQuotePhone');
const lookupForm = document.querySelector('#deliveryQuoteLookupForm');
const lookupButton = document.querySelector('#deliveryQuoteLookupButton');
const errorBox = document.querySelector('#deliveryQuoteError');
const resultBox = document.querySelector('#deliveryQuoteResult');
let currentQuote = null;
let customerPhone = '';
let paymentPollTimer = null;

if (codeInput) codeInput.value = (params.get('code') || '').toUpperCase();

function showError(message = '') {
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function money(amount) {
  return `${Number(amount || 0).toLocaleString('vi-VN')} ₫`;
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

async function sendJson(url, body) {
  const response = await fetch(url, {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || 'Không xử lý được yêu cầu.');
  return data;
}

function quoteDetails(quote) {
  const address = escapeHTML([quote.shippingAddress, quote.deliveryArea].filter(Boolean).join(', '));
  return `
    <h2 style="font-size:19px;margin:0 0 12px;">${quote.status === 'quoted' ? 'Tiệm đã gửi báo giá' : 'Trạng thái yêu cầu'}</h2>
    <div class="quote-details">
      <div class="quote-detail"><span>Mã yêu cầu</span><strong>${escapeHTML(quote.requestCode)}</strong></div>
      <div class="quote-detail"><span>Địa chỉ</span><strong style="text-align:right;max-width:65%;">${address}</strong></div>
      <div class="quote-detail"><span>Ngày / khung giờ</span><strong>${escapeHTML(quote.quotedDeliveryDate || quote.deliveryDate || 'Chưa chốt')} · ${escapeHTML(quote.deliverySlot || 'Chưa chốt')}</strong></div>
      ${quote.distanceMeters != null ? `<div class="quote-detail"><span>Tuyến tham khảo</span><strong>${(Number(quote.distanceMeters) / 1000).toFixed(2)} km (ô tô)</strong></div>` : ''}
      ${quote.shippingFee != null ? `<div class="quote-detail"><span>Phí giao</span><strong>${money(quote.shippingFee)}</strong></div>` : ''}
      ${quote.totalAmount != null ? `<div class="quote-detail"><span>Tổng đơn hàng</span><strong>${money(quote.totalAmount)}</strong></div>` : ''}
      ${quote.expiresAt ? `<div class="quote-detail"><span>Hạn báo giá</span><strong>${new Date(quote.expiresAt).toLocaleString('vi-VN')}</strong></div>` : ''}
      ${quote.orderCode ? `<div class="quote-detail"><span>Mã đơn</span><strong>${escapeHTML(quote.orderCode)}</strong></div>` : ''}
    </div>
    ${quote.shopNote ? `<p><strong>Ghi chú của tiệm:</strong> ${escapeHTML(quote.shopNote)}</p>` : ''}
    ${quote.distanceMeters != null && quote.routeProvider === 'heigit-ors-driving-car'
      ? '<p class="quote-muted">Tuyến tham khảo tính bằng openrouteservice (HeiGIT) trên dữ liệu OpenStreetMap; đường ô tô có thể không phản ánh lối vào hẻm hoặc cấm đường.</p>' : ''}
    <p class="quote-muted">Phí và khung giờ ở trên chỉ được chốt khi bạn xác nhận. Hoa và lịch giao chưa được giữ trong thời gian chờ báo giá.</p>
    ${quote.status === 'quoted' ? `
      <div class="payment-choice" role="radiogroup" aria-label="Chọn cách thanh toán">
        <label><input type="radio" name="quotePaymentPlan" value="sepay_full" checked><span>Chuyển khoản đủ 100% qua SePay</span></label>
        <label><input type="radio" name="quotePaymentPlan" value="sepay_deposit"><span>Trả trước 50% qua SePay, phần còn lại bằng tiền mặt khi nhận</span></label>
      </div>
      <button type="button" class="quote-button" id="acceptDeliveryQuoteButton">Xác nhận báo giá và tiếp tục thanh toán</button>` : ''}
      ${quote.status === 'quoted' ? '<button type="button" id="declineDeliveryQuoteButton" style="margin-left:8px;padding:11px 14px;border:1px solid #d6dbe1;border-radius:8px;background:white;cursor:pointer;">Không đồng ý báo giá</button>' : ''}
    ${['requested','reviewing'].includes(quote.status) ? '<p>Tiệm đang kiểm tra tuyến và lịch giao. Bạn có thể quay lại tra cứu sau.</p>' : ''}
    ${quote.status === 'declined' ? '<p>Tiệm chưa thể nhận giao theo yêu cầu này. Vui lòng liên hệ tiệm để trao đổi lựa chọn khác.</p>' : ''}
    ${quote.status === 'expired' ? '<p>Báo giá đã hết hạn. Vui lòng gửi yêu cầu mới để tiệm kiểm tra lại giá và lịch.</p>' : ''}
    ${quote.status === 'accepted' ? (quote.orderStatus === 'cancelled'
      ? '<p><strong>Đơn từ báo giá này đã hết hạn hoặc bị hủy.</strong> Vui lòng liên hệ tiệm để được hỗ trợ.</p>'
      : '<div id="quotePaymentArea"></div>') : ''}
  `;
}

async function renderQuote(quote) {
  currentQuote = quote;
  if (!resultBox) return;
  resultBox.innerHTML = quoteDetails(quote);
  resultBox.hidden = false;
  const acceptButton = resultBox.querySelector('#acceptDeliveryQuoteButton');
  if (acceptButton) acceptButton.addEventListener('click', acceptQuote);
  const declineButton = resultBox.querySelector('#declineDeliveryQuoteButton');
  if (declineButton) declineButton.addEventListener('click', declineQuote);
  if (quote.status === 'accepted') {
    const paymentArea = resultBox.querySelector('#quotePaymentArea');
    if (paymentArea) await renderPayment(paymentArea, {
      id: quote.orderId, orderCode: quote.orderCode, paymentPlan: quote.paymentPlan,
      totalAmount: quote.totalAmount, paymentStatus: quote.paymentStatus,
      paymentIntent: quote.paymentIntent, phone: customerPhone
    });
  }
}

async function declineQuote(event) {
  if (!window.confirm('Bạn muốn từ chối báo giá này?')) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await sendJson(`/api/delivery/quote-requests/${encodeURIComponent(currentQuote.requestCode)}/decline`, { phone: customerPhone });
    await lookupQuote();
  } catch (error) {
    showError(error.message);
    button.disabled = false;
  }
}

async function lookupQuote(event) {
  if (event) event.preventDefault();
  showError('');
  if (paymentPollTimer) { clearInterval(paymentPollTimer); paymentPollTimer = null; }
  customerPhone = phoneInput?.value.trim() || '';
  const code = codeInput?.value.trim().toUpperCase() || '';
  if (!code || !customerPhone) { showError('Nhập mã yêu cầu và số điện thoại người đặt.'); return; }
  if (lookupButton) { lookupButton.disabled = true; lookupButton.textContent = 'Đang tra cứu…'; }
  try {
    const quote = await sendJson(`/api/delivery/quote-requests/${encodeURIComponent(code)}/lookup`, { phone: customerPhone });
    await renderQuote(quote);
  } catch (error) {
    showError(error.message);
  } finally {
    if (lookupButton) { lookupButton.disabled = false; lookupButton.textContent = 'Tra cứu báo giá'; }
  }
}

async function acceptQuote(event) {
  const button = event.currentTarget;
  const paymentPlan = resultBox.querySelector('input[name="quotePaymentPlan"]:checked')?.value || 'sepay_full';
  button.disabled = true;
  button.textContent = 'Đang xác nhận…';
  showError('');
  try {
    const order = await sendJson(`/api/delivery/quote-requests/${encodeURIComponent(currentQuote.requestCode)}/accept`, {
      phone: customerPhone, paymentPlan
    });
    const quote = {
      ...currentQuote, status: 'accepted', orderId: order.id,
      orderCode: order.orderCode || order.order_code,
      paymentStatus: order.paymentStatus || order.payment_status,
      paymentPlan: order.paymentPlan,
      totalAmount: order.totalAmount ?? order.total_amount,
      paymentIntent: order.paymentIntent || order.paymentIntents?.find(intent => intent.status === 'pending'),
      shippingFee: order.shippingFee
    };
    await renderQuote(quote);
  } catch (error) {
    showError(error.message);
    button.disabled = false;
    button.textContent = 'Xác nhận báo giá và tiếp tục thanh toán';
  }
}

async function renderPayment(target, order) {
  if (!order.id) { target.textContent = 'Đơn đã được xác nhận nhưng thiếu mã thanh toán. Vui lòng liên hệ tiệm.'; return; }
  if (order.paymentStatus === 'paid') {
    target.innerHTML = '<p><strong>Đã nhận đủ thanh toán.</strong> Tiệm sẽ cập nhật tiến độ đơn hàng.</p>';
    return;
  }
  if (order.paymentStatus === 'partially_paid' && order.paymentPlan === 'sepay_deposit') {
    target.innerHTML = '<p><strong>Đã nhận khoản trả trước.</strong> Phần còn lại được thu bằng tiền mặt khi giao.</p>';
    return;
  }
  const intent = order.paymentIntent;
  if (!intent?.referenceCode || intent.status !== 'pending' || !Number.isSafeInteger(Number(intent.amount))) {
    target.textContent = 'Đơn được tạo nhưng chưa có khoản thanh toán chờ. Hãy tra cứu lại hoặc liên hệ tiệm.';
    return;
  }
  try {
    const configResponse = await fetch('/api/sepay/config', { credentials: 'same-origin' });
    const config = await configResponse.json().catch(() => ({}));
    if (!configResponse.ok) throw new Error(config.error?.message || 'Cổng thanh toán chưa sẵn sàng.');
    if (config.simulationOnly) {
      target.innerHTML = `
        <h3 style="font-size:17px;margin:18px 0 8px;">Mô phỏng thanh toán local</h3>
        <p class="quote-muted">Không có QR thật và không chuyển tiền. Dùng nút dưới đây để kiểm tra giao diện/đối soát local.</p>
        <div class="quote-details">
          <div class="quote-detail"><span>Số tiền mô phỏng</span><strong>${money(intent.amount)}</strong></div>
          <div class="quote-detail"><span>Mã thanh toán</span><strong>${escapeHTML(intent.referenceCode)}</strong></div>
        </div>
        <p id="quotePaymentStatus" aria-live="polite">Đang chờ thao tác mô phỏng.</p>
        <button type="button" class="quote-button" id="quoteSimulatePaymentButton">Mô phỏng đã thanh toán (local)</button>`;
      const status = target.querySelector('#quotePaymentStatus');
      const simulateButton = target.querySelector('#quoteSimulatePaymentButton');
      simulateButton?.addEventListener('click', async () => {
        simulateButton.disabled = true;
        simulateButton.textContent = 'Đang ghi nhận mô phỏng…';
        try {
          await sendJson(`/api/sepay/simulate-payment/${encodeURIComponent(order.id)}`, {
            phone: customerPhone, intentId: intent.id
          });
          if (status) status.textContent = 'Đã ghi nhận khoản mô phỏng local; không có tiền thật được chuyển.';
          await lookupQuote();
        } catch (error) {
          showError(error.message);
          simulateButton.disabled = false;
          simulateButton.textContent = 'Mô phỏng đã thanh toán (local)';
        }
      });
      return;
    }
    const qrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(config.accountNumber)}&bank=${encodeURIComponent(config.bankCode)}&amount=${Number(intent.amount)}&des=${encodeURIComponent(intent.referenceCode)}&template=compact`;
    target.innerHTML = `
      <h3 style="font-size:17px;margin:18px 0 8px;">Quét QR để thanh toán</h3>
      <img class="quote-qr" src="${qrUrl}" alt="Mã QR thanh toán SePay">
      <div class="quote-details">
        <div class="quote-detail"><span>Ngân hàng</span><strong>${escapeHTML(config.bankCode)}</strong></div>
        <div class="quote-detail"><span>Số tài khoản</span><strong>${escapeHTML(config.accountNumber)}</strong></div>
        <div class="quote-detail"><span>Số tiền</span><strong>${money(intent.amount)}</strong></div>
        <div class="quote-detail"><span>Nội dung chuyển khoản</span><strong>${escapeHTML(intent.referenceCode)}</strong></div>
      </div>
      <p class="quote-muted">Mã thanh toán riêng của đơn; vui lòng giữ nguyên nội dung chuyển khoản.</p>
      <p id="quotePaymentStatus" aria-live="polite">Đang chờ SePay xác nhận…</p>
      <button type="button" class="quote-button" id="quoteCheckPaymentButton">Tôi đã chuyển khoản – kiểm tra ngay</button>`;
    const status = target.querySelector('#quotePaymentStatus');
    const checkButton = target.querySelector('#quoteCheckPaymentButton');
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      if (attempts > 180) { clearInterval(paymentPollTimer); paymentPollTimer = null; return; }
      try {
        const result = await sendJson(`/api/sepay/check-payment/${encodeURIComponent(order.id)}`, {
          phone: customerPhone, intentId: intent.id
        });
        if (result.paid || result.order?.paymentStatus === 'paid') {
          if (status) status.textContent = 'Đã nhận đủ thanh toán.';
          clearInterval(paymentPollTimer); paymentPollTimer = null;
          if (checkButton) checkButton.disabled = true;
        } else if (result.order?.paymentStatus === 'partially_paid' && order.paymentPlan === 'sepay_deposit') {
          if (status) status.textContent = 'Đã nhận khoản trả trước; phần còn lại thanh toán bằng tiền mặt khi giao.';
          clearInterval(paymentPollTimer); paymentPollTimer = null;
          if (checkButton) checkButton.disabled = true;
        } else if (result.cancelled) {
          if (status) status.textContent = 'Đơn đã hết hạn hoặc bị hủy. Giao dịch cần shop đối soát.';
          clearInterval(paymentPollTimer); paymentPollTimer = null;
        }
      } catch (error) {
        if (status) status.textContent = error.message || 'Chưa đối soát được; hệ thống sẽ thử lại.';
      }
    };
    checkButton?.addEventListener('click', check);
    paymentPollTimer = setInterval(check, 4000);
  } catch (error) {
    target.textContent = `${error.message} Vui lòng liên hệ tiệm để được hỗ trợ.`;
  }
}

lookupForm?.addEventListener('submit', lookupQuote);
if (codeInput?.value) {
  const savedPhone = sessionStorage.getItem(`delivery-quote-phone:${codeInput.value}`);
  if (savedPhone && phoneInput) {
    phoneInput.value = savedPhone;
    lookupQuote();
  }
}
phoneInput?.addEventListener('change', () => {
  if (codeInput?.value && phoneInput.value) sessionStorage.setItem(`delivery-quote-phone:${codeInput.value}`, phoneInput.value);
});
