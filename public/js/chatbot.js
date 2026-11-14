import {
  fetchProducts,
  fetchCategories,
  fetchPromotions,
  addToCart
} from './storage.js';
import { formatPrice, showToast, updateCartBadge, escapeHTML } from './utils.js';
import { formatVoucherDisplay } from './business-rules.js';
import { chatApi } from './api.js';

/**
 * chatbot.js - Trợ Lý Tư Vấn Hoa Nghệ Thuật (AI Florist ChatBot + Dual-Engine RAG)
 * Đạt chuẩn đồ án JavaScript ES6+ & Giao diện chuẩn Flower Chimp (Zero-AI-Vibe)
 */

const STORAGE_KEYS = {
  CHAT_HISTORY: 'SHOP_HOA_CHAT_HISTORY',
  CHAT_OPEN: 'SHOP_HOA_CHAT_OPEN'
};

// Dữ liệu bộ nhớ tạm
let allProducts = [];
let allCategories = [];
let allPromotions = [];
let chatHistory = [];
let isGenerating = false;

// ============================================================================
// 1. DỰNG GIAO DIỆN CHATBOT (DOM INJECTION)
// ============================================================================
function injectChatbotDOM() {
  let widgetContainer = document.querySelector('#aiChatWidget');
  if (!widgetContainer) {
    widgetContainer = document.createElement('div');
    widgetContainer.id = 'aiChatWidget';
    document.body.appendChild(widgetContainer);
  }

  widgetContainer.innerHTML = `
    <!-- CỤM NÚT LIÊN HỆ NỔI ĐA KÊNH: CHỈ GIỮ 3 KÊNH (AI EM LY, ZALO, MESSENGER) - BỎ NÚT GỌI ĐIỆN THOẠI TRÒN -->
    <div class="floating-contact-stack floating-speed-dial" id="floatingContactStack">
      <!-- 1. CHAT ZALO CSKH 0374 905 296 -->
      <div class="contact-stack-item">
        <a href="https://zalo.me/0374905296" target="_blank" rel="noopener noreferrer" class="contact-stack-btn btn-zalo-chat" title="Chat Zalo: 0374 905 296 (Gửi ảnh bill chuyển khoản & hoa mẫu)" aria-label="Mở Zalo CSKH 0374905296">
          <span class="contact-pulse-ring zalo-ring"></span>
          <span class="zalo-badge-text">Zalo</span>
        </a>
        <span class="contact-stack-tooltip">Chat Zalo: 0374 905 296</span>
      </div>

      <!-- 2. NHẮN TIN MESSENGER FANPAGE TIỆM HOA -->
      <div class="contact-stack-item">
        <a href="https://m.me/61582337523237" target="_blank" rel="noopener noreferrer" class="contact-stack-btn btn-messenger-chat" title="Nhắn tin qua Fanpage Messenger" aria-label="Mở Messenger Fanpage">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.43 3.14 7.15.16.14.26.35.26.57v2.16c0 .54.55.9 1.03.66l2.36-1.18c.17-.08.35-.11.53-.08.85.23 1.75.36 2.68.36 5.64 0 10-4.13 10-9.64C22 6.13 17.64 2 12 2zm1.09 12.72l-2.61-2.79-5.1 2.79 5.61-5.96 2.69 2.79 5.02-2.79-5.61 5.96z"/>
          </svg>
        </a>
        <span class="contact-stack-tooltip">Messenger Fanpage</span>
      </div>

      <!-- 3. TRỢ LÝ AI EM LY (24/7) - NÚT KÍCH HOẠT CHÍNH -->
      <div class="contact-stack-item item-trigger">
        <button type="button" class="contact-stack-btn btn-ai-chat chat-launcher-btn" id="chatLauncherBtn" title="Hỏi Trợ Lý Em Ly (AI Tư Vấn 24/7)" aria-label="Mở Trợ lý Em Ly AI">
          <span class="chat-online-dot"></span>
          <svg class="ai-flower-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a3 3 0 0 0-3 3c0 1.5 1.5 2.5 3 4 1.5-1.5 3-2.5 3-4a3 3 0 0 0-3-3z"/>
            <path d="M22 12a3 3 0 0 0-3-3c-1.5 0-2.5 1.5-4 3 1.5 1.5 2.5 3 4 3a3 3 0 0 0 3-3z"/>
            <path d="M12 22a3 3 0 0 0 3-3c0-1.5-1.5-2.5-3-4-1.5 1.5-3 2.5-3 4a3 3 0 0 0 3 3z"/>
            <path d="M2 12a3 3 0 0 0 3 3c1.5 0 2.5-1.5 4-3-1.5-1.5-2.5-3-4-3a3 3 0 0 0-3 3z"/>
            <circle cx="12" cy="12" r="2.5"/>
          </svg>
        </button>
        <span class="contact-stack-tooltip">Trợ Lý Em Ly (AI 24/7)</span>
      </div>
    </div>

    <!-- CỬA SỔ CHAT WINDOW -->
    <div class="chat-window hidden" id="chatWindow">
      <!-- HEADER -->
      <div class="chat-header">
        <div class="chat-header-profile">
          <div class="chat-avatar-wrap">
            <svg class="chat-avatar-flower" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
              <path d="M12 2a3 3 0 0 0-3 3c0 1.5 1.5 2.5 3 4 1.5-1.5 3-2.5 3-4a3 3 0 0 0-3-3z"/>
              <path d="M22 12a3 3 0 0 0-3-3c-1.5 0-2.5 1.5-4 3 1.5 1.5 2.5 3 4 3a3 3 0 0 0 3-3z"/>
              <path d="M12 22a3 3 0 0 0 3-3c0-1.5-1.5-2.5-3-4-1.5 1.5-3 2.5-3 4a3 3 0 0 0 3 3z"/>
              <path d="M2 12a3 3 0 0 0 3 3c1.5 0 2.5-1.5 4-3-1.5-1.5-2.5-3-4-3a3 3 0 0 0-3 3z"/>
              <circle cx="12" cy="12" r="2.5"/>
            </svg>
            <span class="chat-avatar-status"></span>
          </div>
          <div class="chat-header-info">
            <h4>Em Ly • Nghệ Nhân Hoa</h4>
            <span><span style="color: #6EE7B7;">●</span> Đang trực tuyến (Gemini AI)</span>
          </div>
        </div>

        <div class="chat-header-actions">
          <button type="button" class="chat-btn-icon" id="chatClearHistoryBtn" title="Xóa lịch sử trò chuyện">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
          <button type="button" class="chat-btn-icon" id="chatCloseBtn" title="Thu nhỏ khung chat">✕</button>
        </div>
      </div>

      <!-- BODY HỘI THOẠI -->
      <div class="chat-body" id="chatBody">
        <!-- BẢNG GIỚI THIỆU: CHATBOT CÓ THỂ GIÚP GÌ CHO BẠN (ONBOARDING CARD) -->
        <div class="chat-welcome-card" id="chatWelcomeCard">
          <div class="chat-welcome-title">
            <span>🌸</span>
            <span>Xin chào! Em Ly có thể giúp gì cho bạn?</span>
          </div>
          <div class="chat-welcome-desc">
            Mình là trợ lý nghệ nhân hoa kẽm nhung thủ công. Mình sẵn sàng hỗ trợ bạn chọn quà tặng và mua sắm:
          </div>

          <ul class="chat-help-list">
            <li class="chat-help-item"><span class="icon">💐</span> <b>Tư vấn chọn mẫu hoa:</b> Theo dịp sinh nhật, tỏ tình, kỷ niệm, khai trương.</li>
            <li class="chat-help-item"><span class="icon">💰</span> <b>Lọc theo ngân sách:</b> Tìm hoa dưới 300k, 350k hoặc hoa cao cấp.</li>
            <li class="chat-help-item"><span class="icon">🎟️</span> <b>Mã giảm giá & Voucher:</b> Nhận ưu đãi giảm 10% - 20% hôm nay.</li>
            <li class="chat-help-item"><span class="icon">🚚</span> <b>Chính sách cửa hàng:</b> Giao hỏa tốc 2h, bảo hành hoa vĩnh cửu.</li>
          </ul>

          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 10px;">
            Gợi ý câu hỏi nhanh:
          </div>

          <div class="chat-quick-prompts">
            <button type="button" class="quick-prompt-btn" data-query="Tư vấn giúp mình bó hoa sinh nhật dưới 350k với">
              🎂 Hoa sinh nhật &lt; 350k
            </button>
            <button type="button" class="quick-prompt-btn" data-query="Gợi ý mẫu hoa hồng tỏ tình ngày Valentine 14/2 lãng mạn">
              💝 Hoa tỏ tình ngày 14/2
            </button>
            <button type="button" class="quick-prompt-btn" data-query="Hôm nay shop có mã giảm giá hoặc voucher nào không?">
              🎟️ Mã giảm giá hôm nay
            </button>
            <button type="button" class="quick-prompt-btn" data-query="Shop có giao hỏa tốc không và chính sách bảo hành hoa thế nào?">
              🚚 Chính sách giao hàng
            </button>
          </div>
        </div>

        <!-- DANH SÁCH TIN NHẮN (ĐỔ ĐỘNG) -->
        <div id="chatMessagesList" style="display: flex; flex-direction: column; gap: 14px;"></div>

        <!-- TYPING INDICATOR -->
        <div class="chat-msg bot hidden" id="chatTypingIndicator">
          <div class="chat-msg-avatar">🌸</div>
          <div class="chat-msg-bubble chat-typing-bubble">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
        </div>
      </div>

      <!-- FOOTER NHẬP TIN NHẮN -->
      <form class="chat-footer" id="chatForm">
        <input type="text" class="chat-input" id="chatInput" placeholder="Hỏi Em Ly về hoa, giá cả, voucher..." autocomplete="off">
        <button type="submit" class="chat-send-btn" id="chatSendBtn" title="Gửi câu hỏi">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  `;
}

// ============================================================================
// 2. BỘ TRÍ TUỆ RAG NỘI BỘ (KNOWLEDGE RETRIEVAL & SMART FALLBACK)
// ============================================================================

/**
 * Lấy ngữ cảnh toàn diện từ db.json / localStorage để nạp cho AI
 */
function getKnowledgeContext() {
  const productsSummary = allProducts.map(p => {
    const orig = p.originalPrice || p.price;
    const isSale = orig > p.price;
    const pct = isSale ? Math.round(((orig - p.price) / orig) * 100) : 0;
    return `[ID: ${p.id}] Tên: "${p.name}" | Giá: ${formatPrice(p.price)} ${isSale ? `(Giá gốc: ${formatPrice(orig)}, Giảm: -${pct}%)` : ''} | Danh mục: ${p.categoryName || 'Hoa Kẽm Nhung'} | Badge: ${p.badge || 'Không'} | Đã bán: ${p.soldCount || 0} | Mô tả: ${p.description || ''}`;
  }).join('\n');

  const promotionsSummary = allPromotions.map(pr => {
    const meta = formatVoucherDisplay(pr, formatPrice);
    return `- Mã "${pr.code}": ${meta.badgeText} (${meta.conditionText} - ${meta.nameText})`;
  }).join('\n');

  return `
DANH SÁCH MẪU HOA HIỆN CÓ CỦA CỬA HÀNG:
${productsSummary}

DANH SÁCH MÃ GIẢM GIÁ VOUCHER:
${promotionsSummary}

CHÍNH SÁCH VẬN CHUYỂN & DỊCH VỤ CỬA HÀNG:
- VẬN CHUYỂN & FREESHIP:
  + MIỄN PHÍ VẬN CHUYỂN (FreeShip) toàn quốc cho mọi đơn hàng từ 350.000₫ trở lên.
  + Đơn hàng dưới 350.000₫: Phí ship đồng giá chỉ 25.000₫ - 30.000₫ tùy khu vực.
  + Giao hàng hỏa tốc trong 2 giờ tại khu vực nội thành cho khách hàng cần hoa gấp.
  + Được mở hộp ĐỒNG KIỂM (kiểm tra hoa thực tế) trước khi thanh toán tiền mặt (COD).
- CHẤT LIỆU HOA:
  + 100% làm thủ công bằng sợi kẽm nhung (Chenille) cao cấp loại 1 mềm mịn, cánh hoa uốn tay tỉ mỉ sống động.
  + Độ bền vĩnh cửu theo năm tháng, không bao giờ phai tàn hay úa héo, không độc hại, an toàn tuyệt đối.
- BẢO HÀNH & ĐỔI TRẢ:
  + Bảo hành 1 đổi 1 miễn phí trong 7 ngày nếu hoa bị móp méo, hư hỏng trong quá trình vận chuyển.
- QUÀ TẶNG KÈM:
  + Tặng kèm miễn phí thiệp chúc mừng viết tay theo yêu cầu và túi quà thắt nơ ruy băng sang trọng.
- ĐỊA CHỈ SHOWROOM:
  + 14 Trịnh Đình Thảo, Phường Hòa Thạnh, Quận Tân Phú, TP. Hồ Chí Minh. Nhận giao hàng tận nơi trên toàn quốc.
- KÊNH LIÊN HỆ & CSKH:
  + Hotline: 0374 905 296
  + Chat Zalo gửi bill & hoa mẫu: zalo.me/0374905296
  + Facebook Messenger: m.me/61582337523237
  + Fanpage Facebook: https://www.facebook.com/profile.php?id=61582337523237
`;
}

/**
 * Smart Local RAG Fallback - Phân tích ngữ nghĩa cục bộ cực thông minh khi không có API Key
 */
function smartLocalRAG(query) {
  const q = query.toLowerCase().trim();

  // 1. RÀNG BUỘC PHẠM VI (GUARDRAIL): Chặn và từ chối lịch sự câu hỏi ngoài lề (Toán học, Lập trình, Thời tiết, Ngoài shop)
  const isMathQuery = /\d+\s*[\+\-\*\/xX÷=]\s*\d+/.test(q) || (/(1\s*\+\s*1|mấy|bằng mấy|cộng|trừ|nhân|chia)/i.test(q) && /\d+/.test(q));
  const isOffTopicQuery = isMathQuery ||
    q.includes('thời tiết') || q.includes('trời mưa') || q.includes('trời nắng') ||
    q.includes('lập trình') || q.includes('viết code') || q.includes('javascript') || q.includes('python') ||
    q.includes('ai là') || q.includes('tổng thống') || q.includes('thủ tướng') ||
    q.includes('tiếng anh') || q.includes('dịch giúp') || q.includes('dịch hộ') ||
    q.includes('bài tập') || q.includes('vật lý') || q.includes('hóa học') ||
    q.includes('chứng khoán') || q.includes('bitcoin') || q.includes('bóng đá') ||
    q.includes('kể chuyện cười') || (q.includes('bạn là ai') && !q.includes('shop'));

  if (isOffTopicQuery) {
    return {
      text: `Dạ Em Ly chỉ là chuyên viên tư vấn hoa nghệ thuật của Shop Hoa thôi ạ! 😊 Môn này Em Ly chưa được học qua nên không dám trả lời bừa nè.<br><br>Nếu mình cần tư vấn một bó hoa kẽm nhung thật xinh để tặng người thương, kỷ niệm sinh nhật hay trang trí bàn làm việc thì cứ để Em Ly hỗ trợ hết mình nha! 🌸`,
      recommendIds: []
    };
  }

  // 2. CÂU HỎI CỐ ĐỊNH: Vận chuyển, Giao hàng & FreeShip
  if (q.includes('ship') || q.includes('vận chuyển') || q.includes('giao hàng') || q.includes('freeship') || q.includes('miễn phí ship') || q.includes('giao hoa')) {
    return {
      text: `Dạ có ạ! Shop Hoa bên em có chính sách vận chuyển cực kỳ ưu đãi cho mình luôn nè: 🚚🌸<br><br>
        🌸 <b>Miễn phí vận chuyển (FreeShip)</b>: Tự động miễn phí cho mọi đơn hàng từ <b>350.000₫</b> trở lên!<br>
        🌸 <b>Đơn dưới 350.000₫</b>: Phí ship đồng giá siêu hạt dẻ chỉ <b>25.000₫ - 30.000₫</b> toàn quốc.<br>
        ⚡ <b>Giao hỏa tốc 2 giờ</b>: Hỗ trợ giao nhanh nội thành nếu mình cần hoa gấp trong ngày.<br>
        🔍 <b>Đồng kiểm khi nhận</b>: Mình được kiểm tra hoa tận mắt, ưng ý mới thanh toán tiền (COD) ạ.<br><br>
        Hôm nay mình đang muốn tìm mẫu hoa cho dịp nào chưa, để Em Ly gợi ý cho mình mẫu ưng ý nhất nha! 😊`,
      recommendIds: []
    };
  }

  // 3. CÂU HỎI CỐ ĐỊNH: Chất liệu hoa, Kẽm nhung có tàn không
  if (q.includes('chất liệu') || q.includes('kẽm nhung') || q.includes('làm bằng gì') || q.includes('hoa thật') || q.includes('hoa giả') || q.includes('có héo') || q.includes('có tàn') || q.includes('độ bền')) {
    return {
      text: `Dạ hoa tại Shop Hoa Nghệ Thuật là <b>100% Hoa Kẽm Nhung thủ công</b> cao cấp ạ! 🌿🌸<br><br>
        • Từng cánh hoa được nghệ nhân uốn tỉ mỉ bằng sợi kẽm bọc nhung loại 1 mềm mịn, màu sắc tươi tắn rạng ngời.<br>
        • <b>Ưu điểm đặc biệt:</b> Hoa có độ bền vĩnh cửu theo năm tháng, không bao giờ phai tàn hay úa héo, không bám bụi bẩn độc hại.<br>
        • Là món quà lưu giữ kỷ niệm tình cảm mãi mãi bền lâu cùng thời gian! 💖`,
      recommendIds: [1, 2]
    };
  }

  // 4. CÂU HỎI CỐ ĐỊNH: Bảo hành, Đổi trả, Địa chỉ cửa hàng
  if (q.includes('bảo hành') || q.includes('đổi trả') || q.includes('móp') || q.includes('hư') || q.includes('lỗi')) {
    return {
      text: `Dạ bạn hoàn toàn an tâm khi đặt hoa tại shop nhé ạ! 🛡️🌸<br><br>
        • <b>Đổi trả 1-1 miễn phí trong 7 ngày:</b> Nếu hoa có bất kỳ lỗi nào do vận chuyển hoặc không đúng mẫu yêu cầu.<br>
        • <b>Đồng kiểm khi nhận:</b> Khách hàng được mở hộp kiểm tra kỹ càng trước khi thanh toán.<br>
        • <b>Quà tặng kèm:</b> Mỗi bó hoa đều tặng kèm thiệp chúc mừng viết tay và túi đựng quà thắt nơ sang trọng.`,
      recommendIds: []
    };
  }

  // 4.1. CÂU HỎI CỐ ĐỊNH: Địa chỉ cửa hàng
  if (q.includes('địa chỉ') || q.includes('ở đâu') || q.includes('showroom') || q.includes('cửa hàng ở') || q.includes('shop ở')) {
    return {
      text: `Dạ Showroom và xưởng hoa chính thức của shop tại: <b>14 Trịnh Đình Thảo, Phường Hòa Thạnh, Quận Tân Phú, TP. Hồ Chí Minh</b> ạ! 🏡💐<br><br>
        Bên cạnh đó, shop nhận đặt online và giao hoa hỏa tốc 2 giờ nội thành cũng như giao hàng tận nơi toàn quốc (FreeShip đơn từ 350k). Bạn có thể đặt trực tiếp ngay trên website nhé!`,
      recommendIds: []
    };
  }

  // 4.2. CÂU HỎI CỐ ĐỊNH: Kênh liên hệ, Hotline, Zalo, Fanpage, Messenger
  if (q.includes('liên hệ') || q.includes('hotline') || q.includes('số điện thoại') || q.includes('sđt') || q.includes('zalo') || q.includes('facebook') || q.includes('fanpage') || q.includes('messenger') || q.includes('người thật') || q.includes('chủ shop')) {
    return {
      text: `Dạ bạn có thể liên hệ trực tiếp với tiệm hoa qua các kênh chính thức sau nhé: 🌸📞<br><br>
        • <b>Hotline hỗ trợ gấp:</b> <a href="tel:0374905296" style="color: var(--color-primary, #108474); font-weight: 700;">0374 905 296</a><br>
        • <b>Chat Zalo CSKH (gửi bill/mẫu hoa):</b> <a href="https://zalo.me/0374905296" target="_blank" rel="noopener noreferrer" style="color: #0068FF; font-weight: 700;">zalo.me/0374905296</a><br>
        • <b>Fanpage Messenger:</b> <a href="https://m.me/61582337523237" target="_blank" rel="noopener noreferrer" style="color: #7E22CE; font-weight: 700;">m.me/61582337523237</a><br>
        • <b>Facebook Fanpage:</b> <a href="https://www.facebook.com/profile.php?id=61582337523237" target="_blank" rel="noopener noreferrer" style="color: #0068FF; text-decoration: underline;">Tiệm Hoa Kẽm Nhung</a><br>
        • <b>Địa chỉ xưởng:</b> 14 Trịnh Đình Thảo, P. Hòa Thạnh, Q. Tân Phú, TP.HCM<br><br>
        Nghệ nhân tiệm luôn sẵn sàng hỗ trợ bạn đổi mẫu, dặn thiệp hoặc đối soát chuyển khoản 24/7 ạ!`,
      recommendIds: []
    };
  }

  // 5. Ý định Voucher / Khuyến mãi
  if (q.includes('voucher') || q.includes('giảm giá') || q.includes('mã') || q.includes('khuyến mãi') || q.includes('sale') || q.includes('ưu đãi')) {
    const promoList = allPromotions.map(pr => {
      const meta = formatVoucherDisplay(pr, formatPrice);
      return `• <b>${escapeHTML(pr.code || '')}</b>: ${escapeHTML(meta.badgeText)} (${escapeHTML(meta.conditionText)})`;
    }).join('<br>');
    return {
      text: promoList
        ? `Dạ hiện tại Shop Hoa đang có các mã ưu đãi cực hot dành cho bạn đây ạ:<br><br>${promoList}<br><br>👉 Bạn chỉ cần chọn hoa rồi nhập mã vào ô <b>"Áp dụng Voucher"</b> trong Giỏ hàng nhé!`
        : 'Dạ hiện chưa có mã voucher công khai nào, bạn để lại tin nhắn để Em Ly kiểm tra ưu đãi riêng cho mình nha!',
      recommendIds: [1, 2]
    };
  }

  // 6. Ý định Lọc theo ngân sách (Ví dụ: dưới 350k, 300k, 400k)
  let maxBudget = null;
  const priceMatches = q.match(/(\d{2,3})\s*k/);
  if (priceMatches) {
    maxBudget = parseInt(priceMatches[1]) * 1000;
  } else if (q.includes('350') || q.includes('350.000') || q.includes('350000')) {
    maxBudget = 350000;
  } else if (q.includes('300') || q.includes('300.000') || q.includes('300000')) {
    maxBudget = 300000;
  }

  // 7. Ý định theo Dịp lễ: Sinh nhật
  if (q.includes('sinh nhật') || q.includes('sn')) {
    let matched = allProducts.filter(p => p.categorySlug === 'sinh-nhat' || p.name.toLowerCase().includes('sinh nhật') || p.name.toLowerCase().includes('tulip') || p.name.toLowerCase().includes('hướng dương'));
    if (maxBudget) matched = matched.filter(p => p.price <= maxBudget);
    if (matched.length === 0) matched = allProducts.filter(p => maxBudget ? p.price <= maxBudget : true).slice(0, 3);

    const ids = matched.slice(0, 3).map(p => p.id);
    return {
      text: `Dạ chúc mừng sinh nhật người thương của bạn nhé! 🎉<br>Với dịp sinh nhật${maxBudget ? ` trong tầm giá dưới ${formatPrice(maxBudget)}` : ''}, Em Ly xin gợi ý các mẫu hoa kẽm nhung tươi tắn, ngập tràn sức sống và mang ý nghĩa may mắn, rạng rỡ nhất:`,
      recommendIds: ids
    };
  }

  // 8. Ý định Valentine / Tỏ tình / Người yêu / 14/2 / 8/3
  if (q.includes('valentine') || q.includes('tỏ tình') || q.includes('người yêu') || q.includes('bạn gái') || q.includes('14/2') || q.includes('8/3') || q.includes('hồng')) {
    let matched = allProducts.filter(p => p.name.toLowerCase().includes('hồng') || p.name.toLowerCase().includes('tulip') || p.name.toLowerCase().includes('sunset'));
    if (maxBudget) matched = matched.filter(p => p.price <= maxBudget);
    if (matched.length === 0) matched = allProducts.slice(0, 3);

    const ids = matched.slice(0, 3).map(p => p.id);
    return {
      text: `Dạ để trao gửi yêu thương đến người thương của bạn, không gì tuyệt vời hơn những đóa hồng hoặc tulip kẽm nhung mềm mại tượng trưng cho tình yêu vĩnh cửu không phai tàn! 💖<br>Em Ly gợi ý cho bạn các mẫu hoa lãng mạn nhất:`,
      recommendIds: ids
    };
  }

  // 9. Ý định Để bàn / Mini / Văn phòng
  if (q.includes('để bàn') || q.includes('mini') || q.includes('bàn làm việc') || q.includes('trang trí')) {
    let matched = allProducts.filter(p => p.categorySlug === 'de-ban' || p.name.toLowerCase().includes('để bàn') || p.name.toLowerCase().includes('mini') || p.name.toLowerCase().includes('chậu'));
    if (matched.length === 0) matched = allProducts.slice(0, 2);

    return {
      text: `Dạ nếu bạn cần mẫu hoa nhỏ xinh để góc làm việc hay bàn học, hoa kẽm nhung mini vừa bền đẹp lại tạo cảm giác thư giãn cực kỳ! Em Ly gợi ý cho bạn mẫu này nhé:`,
      recommendIds: matched.slice(0, 3).map(p => p.id)
    };
  }

  // 10. Mặc định: Gợi ý các mẫu hoa bán chạy nhất
  const topProducts = allProducts.filter(p => p.badge === 'Bán chạy' || p.featured).slice(0, 3);
  const ids = topProducts.length > 0 ? topProducts.map(p => p.id) : allProducts.slice(0, 3).map(p => p.id);

  return {
    text: `Dạ Em Ly rất vui được hỗ trợ bạn ạ! 🌸<br>Tại Shop Hoa Nghệ Thuật, mỗi bó hoa đều được nghệ nhân uốn tỉ mỉ bằng sợi kẽm nhung mềm mịn. Dưới đây là những mẫu hoa được yêu thích và đặt nhiều nhất hiện nay, bạn tham khảo qua nhé:`,
    recommendIds: ids
  };
}



// ============================================================================
// 4. PARSER & RENDER THẺ HOA TƯƠNG TÁC (INTERACTIVE MINI CARDS)
// ============================================================================

/**
 * Tạo HTML thẻ sản phẩm mini tương tác từ Product Object
 */
function createMiniCardHtml(product) {
  if (!product) return '';
  const orig = product.originalPrice || product.price;
  const isSale = orig > product.price;
  const pct = isSale ? Math.round(((orig - product.price) / orig) * 100) : 0;
  const badgeHtml = (isSale && pct >= 5) ? `<span class="chat-mini-badge">-${pct}%</span>` : '';

  return `
    <div class="chat-mini-card" data-id="${product.id}">
      <div class="chat-mini-thumb">
        ${badgeHtml}
        <img src="${product.image}" alt="${product.name}" loading="lazy">
      </div>
      <div class="chat-mini-info">
        <div class="chat-mini-title" title="${product.name}">${product.name}</div>
        <div class="chat-mini-prices">
          <span class="chat-mini-price">${formatPrice(product.price)}</span>
          ${isSale ? `<span class="chat-mini-was-price">${formatPrice(orig)}</span>` : ''}
        </div>
        <div class="chat-mini-actions">
          <a href="./detail.html?id=${product.id}" class="chat-mini-btn-view">Xem chi tiết →</a>
          <button type="button" class="chat-mini-btn-buy" data-id="${product.id}" title="Thêm nhanh vào giỏ hàng">+ Giỏ Hàng</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Phân tích tin nhắn của bot để tách đoạn text và danh sách ID mẫu hoa
 */
function parseBotResponse(rawText) {
  let cleanText = rawText;
  let recommendIds = [];

  const match = rawText.match(/\[RECOMMEND:([^\]]+)\]/);
  if (match) {
    cleanText = rawText.replace(match[0], '').trim();
    recommendIds = match[1].split(',').map(s => s.trim()).filter(Boolean);
  }

  return { cleanText, recommendIds };
}

/**
 * Chuyển đổi định dạng Markdown cơ bản (chữ đậm, gạch đầu dòng, xuống dòng)
 */
function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    .replace(/^\s*[\*\-]\s+(.*)$/gm, '• $1')
    .replace(/\n/g, '<br>');
}

/**
 * Hiển thị tin nhắn người dùng hoặc bot lên UI
 */
function appendMessage(sender, content, recommendIds = [], isAnimated = false) {
  const container = document.querySelector('#chatMessagesList');
  const chatBody = document.querySelector('#chatBody');
  const welcomeCard = document.querySelector('#chatWelcomeCard');

  if (welcomeCard && chatHistory.length > 0) {
    welcomeCard.style.display = 'none';
  }

  const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const msgEl = document.createElement('div');
  msgEl.className = `chat-msg ${sender}`;

  let cardsHtml = '';
  if (recommendIds && recommendIds.length > 0) {
    const cards = recommendIds.map(id => {
      const p = allProducts.find(item => {
        if (item.id === id) return true;
        const numId = parseInt(String(id).replace(/\D/g, ''), 10);
        const itemNumId = parseInt(String(item.id).replace(/\D/g, ''), 10);
        return numId > 0 && numId === itemNumId;
      });
      return createMiniCardHtml(p);
    }).filter(Boolean).join('');

    if (cards) {
      cardsHtml = `<div class="chat-product-recommendations">${cards}</div>`;
    }
  }

  if (sender === 'user') {
    msgEl.innerHTML = `
      <div class="chat-msg-content">
        <div class="chat-msg-bubble">${content}</div>
        <span class="chat-msg-time">${timeStr}</span>
      </div>
    `;
    container.appendChild(msgEl);
    chatBody.scrollTop = chatBody.scrollHeight;
  } else {
    // Tin nhắn của Bot
    msgEl.innerHTML = `
      <div class="chat-msg-avatar">🌸</div>
      <div class="chat-msg-content">
        <div class="chat-msg-bubble" id="bubble-${Date.now()}"></div>
        ${cardsHtml}
        <span class="chat-msg-time">${timeStr}</span>
      </div>
    `;
    container.appendChild(msgEl);

    const bubbleEl = msgEl.querySelector('.chat-msg-bubble');
    const formattedHtml = formatMarkdown(content);
    
    if (isAnimated) {
      // Hiệu ứng Typewriter mượt mà
      bubbleEl.innerHTML = formattedHtml;
      chatBody.scrollTop = chatBody.scrollHeight;
    } else {
      bubbleEl.innerHTML = formattedHtml;
      chatBody.scrollTop = chatBody.scrollHeight;
    }
  }
}

// ============================================================================
// 5. QUẢN LÝ SỰ KIỆN GIAO TIẾP & LƯU PHIÊN (SESSION PERSISTENCE)
// ============================================================================

function saveChatHistory() {
  try {
    sessionStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(chatHistory));
  } catch (e) {}
}

function loadChatHistory() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
    if (raw) {
      chatHistory = JSON.parse(raw);
      if (Array.isArray(chatHistory) && chatHistory.length > 0) {
        const welcomeCard = document.querySelector('#chatWelcomeCard');
        if (welcomeCard) welcomeCard.style.display = 'none';

        chatHistory.forEach(msg => {
          appendMessage(msg.sender, msg.content, msg.recommendIds || [], false);
        });
      }
    }
  } catch (e) {}
}

async function handleSendMessage(userText) {
  const text = (userText || '').trim();
  if (!text || isGenerating) return;

  const chatInput = document.querySelector('#chatInput');
  const typingIndicator = document.querySelector('#chatTypingIndicator');
  const chatBody = document.querySelector('#chatBody');

  if (chatInput) chatInput.value = '';

  // 1. Thêm tin nhắn của User vào UI và Lịch sử
  appendMessage('user', text);
  chatHistory.push({ sender: 'user', content: text });
  saveChatHistory();

  // 2. Hiện Typing Indicator
  isGenerating = true;
  if (typingIndicator) typingIndicator.classList.remove('hidden');
  chatBody.scrollTop = chatBody.scrollHeight;

  let botReply = '';
  let recommendIds = [];

  try {
    // Chế độ 1: Ưu tiên gọi qua Server-side Proxy (/api/chat) giấu kín Gemini API Key trong .env
    const proxyRes = await chatApi.sendMessage(text, chatHistory);
    if (proxyRes.data && proxyRes.data.reply) {
      botReply = proxyRes.data.reply;
      recommendIds = (proxyRes.data.suggestedProducts || []).map(p => p.id);
    } else {
      throw new Error('Proxy không trả về dữ liệu hợp lệ');
    }
  } catch (err) {
    console.warn('[AI Florist] Gọi Server Proxy lỗi hoặc server chưa chạy, chuyển sang Smart Local RAG:', err.message);
    const localResult = smartLocalRAG(text);
    botReply = localResult.text;
    recommendIds = localResult.recommendIds;
  } finally {
    if (typingIndicator) typingIndicator.classList.add('hidden');
    isGenerating = false;
  }

  // 3. Hiển thị tin nhắn trả lời của Bot
  appendMessage('bot', botReply, recommendIds, true);
  chatHistory.push({ sender: 'bot', content: botReply, recommendIds });
  saveChatHistory();
}

// ============================================================================
// 6. KHỞI TẠO VÀ LẮNG NGHE SỰ KIỆN (INITIALIZATION)
// ============================================================================
export async function initAIFloristChatbot() {
  injectChatbotDOM();

  // Nạp dữ liệu sản phẩm, danh mục, voucher
  allProducts = await fetchProducts();
  allCategories = await fetchCategories();
  allPromotions = await fetchPromotions();

  const launcherBtn = document.querySelector('#chatLauncherBtn');
  const chatWindow = document.querySelector('#chatWindow');
  const closeBtn = document.querySelector('#chatCloseBtn');
  const clearBtn = document.querySelector('#chatClearHistoryBtn');
  const chatForm = document.querySelector('#chatForm');
  const chatInput = document.querySelector('#chatInput');

  // Khôi phục lịch sử chat đã lưu
  loadChatHistory();

  const stack = document.querySelector('#floatingContactStack');

  // Toggle mở/đóng khung chat
  function toggleChat(open = null) {
    const isCurrentlyHidden = chatWindow.classList.contains('hidden');
    const shouldOpen = open !== null ? open : isCurrentlyHidden;

    if (shouldOpen) {
      if (stack) stack.classList.remove('mobile-active');
      chatWindow.classList.remove('hidden');
      if (chatInput) chatInput.focus();
      sessionStorage.setItem(STORAGE_KEYS.CHAT_OPEN, 'true');
    } else {
      chatWindow.classList.add('hidden');
      sessionStorage.setItem(STORAGE_KEYS.CHAT_OPEN, 'false');
    }
  }

  // Click vào nút Em Ly AI trong cụm liên hệ nổi: mở/đóng khung chat AI
  if (launcherBtn) {
    launcherBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleChat();
    });
  }

  // Đóng cụm nút mobile khi click ra ngoài
  document.addEventListener('click', (e) => {
    if (stack && !stack.contains(e.target)) {
      stack.classList.remove('mobile-active');
    }
  });

  if (closeBtn) closeBtn.addEventListener('click', () => toggleChat(false));

  // Tự động mở lại nếu trang trước đang mở
  if (sessionStorage.getItem(STORAGE_KEYS.CHAT_OPEN) === 'true') {
    toggleChat(true);
  }

  // Submit form chat
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSendMessage(chatInput.value);
    });
  }

  // Bấm nút câu hỏi nhanh (Quick Prompts)
  document.addEventListener('click', (e) => {
    const quickBtn = e.target.closest('.quick-prompt-btn');
    if (quickBtn) {
      const q = quickBtn.dataset.query;
      handleSendMessage(q);
    }

    // Bấm nút "+ Giỏ Hàng" trên thẻ hoa mini trong tin nhắn
    const buyBtn = e.target.closest('.chat-mini-btn-buy');
    if (buyBtn) {
      const productId = buyBtn.dataset.id;
      const product = allProducts.find(p => p.id == productId);
      if (product) {
        addToCart(product, 1);
        updateCartBadge();
        showToast(`Đã thêm "${product.name}" vào giỏ hàng!`);
      }
    }
  });

  // Xóa lịch sử chat
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      chatHistory = [];
      sessionStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
      const container = document.querySelector('#chatMessagesList');
      if (container) container.innerHTML = '';
      const welcomeCard = document.querySelector('#chatWelcomeCard');
      if (welcomeCard) welcomeCard.style.display = 'block';
      showToast('Đã xóa sạch lịch sử trò chuyện.');
    });
  }

}

// Tự động khởi tạo khi tài liệu tải xong
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAIFloristChatbot);
} else {
  initAIFloristChatbot();
}
