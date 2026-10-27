import { createProduct } from './storage.js';
import { formatPrice, showToast } from './utils.js';

/**
 * excel-pdf.js - Module Xử lý Nhập Excel (Import) và Xuất Báo Cáo PDF (Export)
 * Dành cho trang Quản trị viên (admin.html)
 * Kế thừa và phát triển từ bài giảng xuất PDF & bảng tính của cô giáo
 */

let pendingImportProducts = []; // Biến tạm lưu danh sách hoa vừa đọc từ Excel chờ người dùng bấm Lưu

// ==========================================================================
// 1. CHỨC NĂNG 1: TẢI FILE EXCEL MẪU CHUẨN (TEMPLATE)
// ==========================================================================
/**
 * Tạo và tải xuống file Excel mẫu chuẩn cột để người quản trị dễ dàng điền dữ liệu
 */
export function downloadExcelTemplate() {
  if (typeof window.XLSX === 'undefined') {
    showToast('Chưa tải được thư viện Excel (SheetJS). Vui lòng thử lại!', 'error');
    return;
  }

  // Tiêu đề các cột chuẩn
  const headers = ['Tên mẫu hoa', 'Danh mục', 'Giá bán (VND)', 'Giá gốc (VND)', 'Tồn kho', 'Mô tả'];

  // Một vài dòng dữ liệu mẫu để người dùng dễ hình dung
  const sampleData = [
    [
      'Bó Hoa Baby Trắng Tinh Khôi',
      'Hoa Kẽm Nhung',
      280000,
      320000,
      25,
      'Hoa kẽm nhung mềm mịn màu trắng thanh khiết, bền đẹp theo thời gian'
    ],
    [
      'Giỏ Hoa Hướng Dương May Mắn',
      'Giỏ & Hộp Hoa',
      390000,
      450000,
      15,
      'Món quà rực rỡ thích hợp chúc mừng sinh nhật, khai trương hồng phát'
    ],
    [
      'Bó Hoa Hồng Đỏ Kẽm Nhung Lãng Mạn',
      'Bó Hoa Sinh Nhật',
      350000,
      400000,
      20,
      'Tone đỏ nhung quyến rũ cho các dịp kỷ niệm và lễ tình nhân'
    ]
  ];

  // Tạo một Workbook mới và thêm Sheet chứa dữ liệu mẫu
  const worksheet = window.XLSX.utils.aoa_to_sheet([headers, ...sampleData]);

  // Căn chỉnh độ rộng các cột (Column Widths) để chữ không bị che khuất khi mở trong Excel
  worksheet['!cols'] = [
    { wch: 38 }, // Tên mẫu hoa (rộng rãi, không bị cụt chữ)
    { wch: 22 }, // Danh mục
    { wch: 18 }, // Giá bán (VND)
    { wch: 18 }, // Giá gốc (VND)
    { wch: 12 }, // Tồn kho
    { wch: 65 }  // Mô tả
  ];

  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, 'Mau_Nhap_Hoa');

  // Kích hoạt trình duyệt tải file về máy
  window.XLSX.writeFile(workbook, 'Mau_Hoa_Nhap_Kho_Template.xlsx');
  showToast('Đã tải xuống file Excel mẫu thành công!');
}

// ==========================================================================
// 2. CHỨC NĂNG 2: ĐỌC VÀ NHẬP DỮ LIỆU TỪ FILE EXCEL (IMPORT EXCEL)
// ==========================================================================
/**
 * Đọc file Excel người dùng vừa chọn, phân tích thành Object và mở Modal xem trước
 */
export function handleExcelFile(file, categories, onPreviewOpen) {
  if (!file) return;

  if (typeof window.XLSX === 'undefined') {
    showToast('Chưa tải được thư viện Excel. Vui lòng thử lại!', 'error');
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      // Đọc file Excel dạng Array nhị phân
      const workbook = window.XLSX.read(data, { type: 'array' });

      // Lấy sheet đầu tiên trong file
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Chuyển nội dung sheet thành mảng JSON
      const rawRows = window.XLSX.utils.sheet_to_json(worksheet);

      if (!rawRows || rawRows.length === 0) {
        showToast('File Excel không có dữ liệu!', 'error');
        return;
      }

      // Chuẩn hóa dữ liệu đọc từ Excel thành cấu trúc Product chuẩn của Shop Hoa
      pendingImportProducts = rawRows.map((row, index) => {
        // Hỗ trợ cả tên cột tiếng Việt có dấu lẫn không dấu
        const name = (row['Tên mẫu hoa'] || row['Ten mau hoa'] || row['Tên sản phẩm'] || row['name'] || '').trim();
        const catNameInput = (row['Danh mục'] || row['Danh muc'] || row['categoryName'] || 'Hoa Kẽm Nhung').trim();
        const price = Number(row['Giá bán (VND)'] || row['Gia ban'] || row['price'] || 200000);
        const originalPrice = Number(row['Giá gốc (VND)'] || row['Gia goc'] || row['originalPrice'] || price);
        const stock = Number(row['Tồn kho'] || row['Ton kho'] || row['stock'] || 10);
        const description = (row['Mô tả'] || row['Mo ta'] || row['description'] || 'Mẫu hoa kẽm nhung thủ công tinh xảo.').trim();

        // Tìm danh mục khớp trong hệ thống, nếu không có mặc định lấy danh mục đầu tiên
        const matchedCategory = categories.find(
          c => c.name.toLowerCase() === catNameInput.toLowerCase()
        ) || categories[0] || { id: 1, name: 'Hoa Kẽm Nhung', slug: 'kem-nhung' };

        return {
          name: name || `Mẫu hoa nhập kho #${index + 1}`,
          price: isNaN(price) ? 200000 : price,
          originalPrice: isNaN(originalPrice) ? price : originalPrice,
          categoryId: matchedCategory.id,
          categoryName: matchedCategory.name,
          categorySlug: matchedCategory.slug || 'kem-nhung',
          image: './images/300.png', // Ảnh mặc định hoa kẽm nhung
          stock: isNaN(stock) ? 10 : stock,
          soldCount: 0,
          rating: 5,
          reviewCount: 0,
          featured: false,
          badge: 'Mới',
          description: description
        };
      });

      // Mở modal xem trước dữ liệu
      if (typeof onPreviewOpen === 'function') {
        onPreviewOpen(pendingImportProducts);
      }
    } catch (err) {
      console.error('Lỗi khi đọc file Excel:', err);
      showToast('Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file!', 'error');
    }
  };

  reader.readAsArrayBuffer(file);
}

// ==========================================================================
// 3. CHỨC NĂNG 3: XUẤT BÁO CÁO DANH SÁCH MẪU HOA RA FILE PDF (EXPORT PDF)
// ==========================================================================
/**
 * Chuẩn hóa chuỗi hiển thị rõ ràng trên font chuẩn của jsPDF
 */
function sanitizeText(str) {
  if (!str) return '';
  return str.toString().trim();
}

/**
 * Xuất danh sách sản phẩm ra file PDF chuyên nghiệp
 * Có tiêu đề shop, ngày giờ xuất, bảng danh sách và dòng tổng kết
 */
export function exportProductsToPdf(products) {
  if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
    showToast('Chưa nạp được thư viện jsPDF. Vui lòng thử lại sau!', 'error');
    return;
  }

  if (!products || products.length === 0) {
    showToast('Không có sản phẩm nào để xuất PDF!', 'error');
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    // Khởi tạo trang giấy A4 dọc (portrait), đơn vị mm
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Tiêu đề Thương Hiệu Cửa Hàng
    doc.setFontSize(15);
    doc.setTextColor(16, 132, 116); // Màu xanh ngọc thương hiệu Flower Chimp (#108474)
    doc.text('TIEM HOA KEM NHUNG & HOA TUOI HANDMADE', 105, 16, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text('BANG KIEM KE HANG HOA & BAO CAO TON KHO SAN PHAM', 105, 23, { align: 'center' });

    // 2. Thông tin liên hệ và ngày xuất
    const now = new Date();
    const dateStr = now.toLocaleDateString('vi-VN');
    const timeStr = now.toLocaleTimeString('vi-VN');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    doc.text(`Dia chi: TP. Ho Chi Minh | Hotline: 0901.234.567 | Ngay lap: ${dateStr} ${timeStr}`, 105, 29, { align: 'center' });

    // Đường kẻ phân cách trang nhã
    doc.setDrawColor(16, 132, 116);
    doc.setLineWidth(0.4);
    doc.line(14, 32, 196, 32);

    // 3. Chuẩn bị tiêu đề cột và các dòng dữ liệu cho bảng
    const tableHeaders = ['STT', 'Ten Mau Hoa', 'Danh Muc', 'Gia Ban (VND)', 'Ton Kho', 'Da Ban'];

    const tableRows = products.map((sp, idx) => [
      idx + 1,
      sanitizeText(sp.name),
      sanitizeText(sp.categoryName || 'Hoa Kem Nhung'),
      formatPrice(sp.price || 0),
      sp.stock || 0,
      sp.soldCount || 0
    ]);

    // 4. Tính toán số liệu tổng kết
    const totalProducts = products.length;
    const totalStock = products.reduce((sum, sp) => sum + (Number(sp.stock) || 0), 0);
    const totalInventoryValue = products.reduce((sum, sp) => sum + ((Number(sp.price) || 0) * (Number(sp.stock) || 0)), 0);

    // Dòng tổng kết ở cuối bảng
    tableRows.push([
      'TONG',
      `${totalProducts} mau hoa`,
      '-',
      `Gia tri kho: ${formatPrice(totalInventoryValue)}`,
      `${totalStock} sp`,
      '-'
    ]);

    // 5. Sử dụng jsPDF AutoTable để vẽ bảng tự động căn chỉnh
    doc.autoTable({
      head: [tableHeaders],
      body: tableRows,
      startY: 38,
      theme: 'grid',
      headStyles: {
        fillColor: [16, 132, 116], // Màu xanh ngọc thương hiệu Flower Chimp (#108474)
        textColor: [255, 255, 255],
        fontSize: 9,
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [50, 50, 50]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { cellWidth: 60 },
        2: { cellWidth: 35 },
        3: { halign: 'right', cellWidth: 30 },
        4: { halign: 'center', cellWidth: 20 },
        5: { halign: 'center', cellWidth: 20 }
      },
      didParseCell: function (data) {
        // Dòng TỔNG ở cuối tô nền đậm nổi bật
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 245, 244];
        }
      }
    });

    // 6. Ghi chú chữ ký ở góc dưới
    const finalY = doc.lastAutoTable.finalY + 12;
    if (finalY < 270) {
      doc.setFontSize(9);
      doc.text('Nguoi Lap Bieu', 35, finalY);
      doc.text('(Ky va ghi ro ho ten)', 28, finalY + 5);

      doc.text('Quan Ly Cua Hang', 155, finalY);
      doc.text('(Xac nhan dong dau)', 148, finalY + 5);
    }

    // 7. Tải file về máy tính
    const fileName = `Bao_Cao_Mau_Hoa_${dateStr.replace(/\//g, '-')}.pdf`;
    doc.save(fileName);
    showToast(`Đã xuất báo cáo PDF thành công: ${fileName}!`);
  } catch (error) {
    console.error('Lỗi khi xuất PDF:', error);
    showToast('Có lỗi xảy ra khi tạo file PDF. Vui lòng thử lại!', 'error');
  }
}

// ==========================================================================
// 4. KHỞI TẠO VÀ GẮN SỰ KIỆN CHO GIAO DIỆN ADMIN (INIT)
// ==========================================================================
/**
 * Gắn kết các sự kiện nút bấm Excel & PDF vào DOM của admin.html
 */
export function initExcelPdf({ getProducts, getCategories, onProductsImported }) {
  const btnDownloadTemplate = document.querySelector('#btnDownloadTemplate');
  const btnTriggerImport = document.querySelector('#btnTriggerImportExcel');
  const fileInput = document.querySelector('#excelFileInput');
  const btnExportPdf = document.querySelector('#btnExportProductPdf');

  // Modal xem trước
  const previewModal = document.querySelector('#excelPreviewModal');
  const previewSummary = document.querySelector('#excelPreviewSummary');
  const previewTableBody = document.querySelector('#excelPreviewTableBody');
  const previewCloseBtn = document.querySelector('#excelPreviewCloseBtn');
  const previewCancelBtn = document.querySelector('#excelPreviewCancelBtn');
  const previewConfirmBtn = document.querySelector('#excelPreviewConfirmBtn');

  // 1. Sự kiện Tải File Mẫu
  if (btnDownloadTemplate) {
    btnDownloadTemplate.addEventListener('click', () => {
      downloadExcelTemplate();
    });
  }

  // 2. Sự kiện Kích hoạt chọn file Excel
  if (btnTriggerImport && fileInput) {
    btnTriggerImport.addEventListener('click', () => {
      fileInput.value = ''; // Reset input để chọn lại file cũ vẫn ăn sự kiện
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const categories = typeof getCategories === 'function' ? getCategories() : [];

      handleExcelFile(file, categories, (parsedList) => {
        // Hiển thị danh sách lên Modal xem trước
        if (previewSummary) {
          previewSummary.textContent = `Đã đọc thành công ${parsedList.length} mẫu hoa từ file Excel. Vui lòng kiểm tra lại trước khi lưu:`;
        }

        if (previewTableBody) {
          previewTableBody.innerHTML = parsedList.map((item, idx) => `
            <tr>
              <td style="text-align: center;">${idx + 1}</td>
              <td><strong>${item.name}</strong></td>
              <td>${item.categoryName}</td>
              <td style="color: var(--color-primary); font-weight: 700;">${formatPrice(item.price)}</td>
              <td style="text-align: center;">${item.stock}</td>
            </tr>
          `).join('');
        }

        if (previewModal) previewModal.classList.remove('hidden');
      });
    });
  }

  // 3. Đóng Modal Xem trước
  function closePreview() {
    if (previewModal) previewModal.classList.add('hidden');
    pendingImportProducts = [];
  }

  if (previewCloseBtn) previewCloseBtn.addEventListener('click', closePreview);
  if (previewCancelBtn) previewCancelBtn.addEventListener('click', closePreview);

  // 4. Xác nhận Lưu dữ liệu từ Excel vào Hệ thống
  if (previewConfirmBtn) {
    previewConfirmBtn.addEventListener('click', async () => {
      if (pendingImportProducts.length === 0) {
        showToast('Không có dữ liệu để lưu!', 'error');
        closePreview();
        return;
      }

      previewConfirmBtn.disabled = true;
      previewConfirmBtn.textContent = '⏳ Đang lưu...';

      try {
        let successCount = 0;
        // Lưu lần lượt các sản phẩm vào hệ thống
        for (const item of pendingImportProducts) {
          await createProduct(item);
          successCount++;
        }

        showToast(`Nhập thành công ${successCount} mẫu hoa từ Excel vào hệ thống!`);
        closePreview();

        // Kích hoạt callback tải lại dữ liệu trên giao diện admin
        if (typeof onProductsImported === 'function') {
          await onProductsImported();
        }
      } catch (err) {
        console.error('Lỗi khi lưu sản phẩm từ Excel:', err);
        showToast('Có lỗi xảy ra khi lưu một số sản phẩm vào hệ thống!', 'error');
      } finally {
        previewConfirmBtn.disabled = false;
        previewConfirmBtn.textContent = '✅ Xác Nhận Lưu Vào Hệ Thống';
      }
    });
  }

  // 5. Sự kiện Xuất PDF
  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', () => {
      const currentProducts = typeof getProducts === 'function' ? getProducts() : [];
      exportProductsToPdf(currentProducts);
    });
  }

  // Hỗ trợ kiểm thử trực tiếp Modal xem trước qua query param ?preview_test=true
  if (new URLSearchParams(window.location.search).get('preview_test') === 'true') {
    const samplePreview = [
      { name: 'Bó Hoa Baby Trắng Tinh Khôi', categoryName: 'Hoa Kẽm Nhung', price: 280000, stock: 25 },
      { name: 'Giỏ Hoa Hướng Dương May Mắn', categoryName: 'Giỏ & Hộp Hoa', price: 390000, stock: 15 },
      { name: 'Bó Hoa Hồng Đỏ Lãng Mạn', categoryName: 'Bó Hoa Sinh Nhật', price: 350000, stock: 20 }
    ];
    if (previewSummary) previewSummary.textContent = `Đã đọc thành công ${samplePreview.length} mẫu hoa từ file Excel. Vui lòng kiểm tra lại trước khi lưu:`;
    if (previewTableBody) {
      previewTableBody.innerHTML = samplePreview.map((item, idx) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td><strong>${item.name}</strong></td>
          <td>${item.categoryName}</td>
          <td style="color: var(--color-primary); font-weight: 700;">${formatPrice(item.price)}</td>
          <td style="text-align: center;">${item.stock}</td>
        </tr>
      `).join('');
    }
    if (previewModal) previewModal.classList.remove('hidden');
  }
}

// ==========================================================================
// 4. CHỨC NĂNG 4: XUẤT HÓA ĐƠN BÁN LẺ DẠNG PDF CHO KẾ TOÁN (STAFF)
// ==========================================================================
/**
 * Xuất hóa đơn bán lẻ chi tiết của đơn hàng ra file PDF chuẩn in ấn A4
 * @param {object} order - Đối tượng đơn hàng cần in hóa đơn
 */
export function exportOrderInvoicePdf(order) {
  if (!order) {
    showToast('Không tìm thấy thông tin đơn hàng để in hóa đơn!', 'error');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('Chưa tải được thư viện jsPDF. Vui lòng thử lại!', 'error');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // 1. HEADER CỬA HÀNG
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(16, 132, 116); // Màu xanh ngọc thương hiệu
  doc.text('TIEM HOA KEM NHUNG HANDMADE', 105, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Chuyen Hoa Kem Nhung Thu Cong & Hoa Tuoi Nghe Thuat Cao Cap', 105, 21, { align: 'center' });
  doc.text('Hotline: 0901.234.567 | Website: tiemplovers.vn | Dia chi: Quan 1, TP. Ho Chi Minh', 105, 26, { align: 'center' });

  // Đường kẻ phân cách
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(14, 29, 196, 29);

  // 2. TIÊU ĐỀ HÓA ĐƠN
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('HOA DON BAN LE / PHIEU GIAO HANG', 105, 37, { align: 'center' });

  // 3. THÔNG TIN KHÁCH HÀNG & ĐƠN HÀNG
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : 'Vua dat';
  const orderId = order.id || 'DH-TEMP';
  const customerName = order.customerName || order.recipientName || 'Khach vang lai';
  const phone = order.phone || '---';
  const address = order.address || 'Nhan tai quay';
  const note = order.note || 'Khong co';

  doc.text(`Ma don hang: #${orderId}`, 14, 46);
  doc.text(`Ngay dat hang: ${orderDate}`, 120, 46);
  doc.text(`Khach hang: ${customerName}`, 14, 52);
  doc.text(`So dien thoai: ${phone}`, 120, 52);
  doc.text(`Dia chi giao: ${address}`, 14, 58);
  doc.text(`Ghi chu: ${note}`, 14, 64);

  // 4. BẢNG DANH SÁCH SẢN PHẨM (AUTOTABLE)
  const items = Array.isArray(order.items) ? order.items : [];
  const tableRows = items.map((item, index) => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.price) || 0;
    const total = qty * price;
    return [
      (index + 1).toString(),
      item.name || 'San pham hoa',
      formatPrice(price),
      qty.toString(),
      formatPrice(total)
    ];
  });

  const tableHeaders = ['STT', 'Ten Mau Hoa', 'Don Gia', 'SL', 'Thanh Tien'];

  doc.autoTable({
    head: [tableHeaders],
    body: tableRows,
    startY: 69,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 3.5,
      textColor: [30, 41, 59]
    },
    headStyles: {
      fillColor: [16, 132, 116],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'left', cellWidth: 85 },
      2: { halign: 'right', cellWidth: 30 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 35 }
    }
  });

  // 5. TỔNG KẾT TIỀN HÓA ĐƠN
  const finalY = doc.lastAutoTable.finalY + 6;
  const subtotal = order.subtotal || order.total || 0;
  const discount = order.discountAmount || 0;
  const totalAmount = order.totalAmount || order.finalTotal || (subtotal - discount);

  doc.setFontSize(9.5);
  doc.text('Tam tinh:', 125, finalY);
  doc.text(formatPrice(subtotal), 180, finalY, { align: 'right' });

  if (discount > 0) {
    doc.text('Giam gia Voucher:', 125, finalY + 5);
    doc.text(`- ${formatPrice(discount)}`, 180, finalY + 5, { align: 'right' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(16, 132, 116);
  doc.text('TONG TIEN THANH TOAN:', 125, finalY + (discount > 0 ? 11 : 6));
  doc.text(formatPrice(totalAmount), 180, finalY + (discount > 0 ? 11 : 6), { align: 'right' });

  // 6. PHẦN CHỮ KÝ XÁC NHẬN (KẾ TOÁN & KHÁCH HÀNG)
  const signY = finalY + (discount > 0 ? 25 : 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  doc.text('Nguoi Nhan Hang', 40, signY, { align: 'center' });
  doc.setFontSize(8);
  doc.text('(Ky va ghi ro ho ten)', 40, signY + 4, { align: 'center' });

  doc.setFontSize(9);
  doc.text('Nhan Vien Ke Toan / Lap Phieu', 155, signY, { align: 'center' });
  doc.setFontSize(8);
  doc.text('(Ky va ghi ro ho ten)', 155, signY + 4, { align: 'center' });

  // Chữ ký điện tử của hệ thống
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Cam on quy khach da tin tuong ung ho Tiem Hoa Kem Nhung Handmade!', 105, signY + 30, { align: 'center' });

  // 7. LƯU VÀ TẢI FILE PDF
  doc.save(`Hoa_Don_${orderId}.pdf`);
  showToast(`Đã xuất hóa đơn PDF thành công cho đơn #${orderId}!`, 'success');
}

// ==========================================================================
// 5. CHỨC NĂNG 5: XUẤT BÁO CÁO THỐNG KÊ DOANH THU & LỢI NHUẬN (ADMIN)
// ==========================================================================
/**
 * Xuất bảng thống kê Doanh thu & Lợi nhuận ra file PDF
 * @param {Array} statsData - Mảng dữ liệu thống kê theo kỳ
 * @param {string} periodType - 'month' hoặc 'quarter'
 * @param {number|string} year - Năm báo cáo
 */
export function exportRevenueStatisticsPdf(statsData, periodType, year = 2026) {
  if (!statsData || statsData.length === 0) {
    showToast('Không có dữ liệu thống kê để xuất báo cáo!', 'error');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('Chưa tải được thư viện jsPDF!', 'error');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(16, 132, 116);
  doc.text('TIEM HOA KEM NHUNG HANDMADE', 105, 16, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  const periodLabel = periodType === 'quarter' ? 'THEO QUY' : 'THEO CAC THANG';
  doc.text(`BAO CAO DOANH THU VA LOI NHUAN ${periodLabel} - NAM ${year}`, 105, 24, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Ngay xuat bao cao: ${new Date().toLocaleString('vi-VN')} | Nguoi xuat: Admin Quan Tri`, 105, 29, { align: 'center' });

  // Chuẩn bị dữ liệu bảng
  let totalOrdersAll = 0;
  let totalRevenueAll = 0;
  let totalCostAll = 0;
  let totalProfitAll = 0;

  const tableRows = statsData.map((row) => {
    totalOrdersAll += row.orderCount;
    totalRevenueAll += row.revenue;
    totalCostAll += row.cost;
    totalProfitAll += row.profit;

    return [
      row.label,
      row.orderCount.toString(),
      formatPrice(row.revenue),
      formatPrice(row.cost),
      formatPrice(row.profit),
      `${row.margin}%`
    ];
  });

  // Thêm dòng tổng cộng
  const avgMargin = totalRevenueAll > 0 ? Math.round((totalProfitAll / totalRevenueAll) * 100) : 0;
  tableRows.push([
    'TONG CONG TOAN KY',
    totalOrdersAll.toString(),
    formatPrice(totalRevenueAll),
    formatPrice(totalCostAll),
    formatPrice(totalProfitAll),
    `${avgMargin}%`
  ]);

  const headers = ['Ky Thoi Gian', 'So Don', 'Doanh Thu', 'Chi Phi Von (65%)', 'Loi Nhuan Rong', 'Ty Suat LN'];

  doc.autoTable({
    head: [headers],
    body: tableRows,
    startY: 34,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 3
    },
    headStyles: {
      fillColor: [16, 132, 116],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 42, fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'right', cellWidth: 32 },
      4: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
      5: { halign: 'center', cellWidth: 22 }
    },
    didParseCell: function (data) {
      // Làm nổi bật dòng Tổng cộng cuối cùng
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
        if (data.column.index === 4) {
          data.cell.styles.textColor = [16, 132, 116];
        }
      }
    }
  });

  doc.save(`Bao_Cao_Doanh_Thu_Loi_Nhuan_${year}.pdf`);
  showToast('Đã tải xuống file Báo Cáo Doanh Thu & Lợi Nhuận PDF!', 'success');
}

/**
 * Xuất bảng thống kê Doanh thu & Lợi nhuận ra file Excel (.xlsx)
 * @param {Array} statsData - Mảng dữ liệu thống kê
 * @param {string} periodType - 'month' hoặc 'quarter'
 * @param {number|string} year - Năm báo cáo
 */
export function exportRevenueStatisticsExcel(statsData, periodType, year = 2026) {
  if (!statsData || statsData.length === 0) {
    showToast('Không có dữ liệu để xuất Excel!', 'error');
    return;
  }

  if (typeof window.XLSX === 'undefined') {
    showToast('Chưa nạp thư viện SheetJS (XLSX)!', 'error');
    return;
  }

  const periodTitle = periodType === 'quarter' ? 'QUÝ' : 'THÁNG';
  const headers = ['Kỳ Báo Cáo', 'Số Đơn Hàng', 'Doanh Thu (VND)', 'Chi Phí Giá Vốn (VND)', 'Lợi Nhuận Ròng (VND)', 'Tỷ Suất Lợi Nhuận (%)'];

  let totalOrdersAll = 0;
  let totalRevenueAll = 0;
  let totalCostAll = 0;
  let totalProfitAll = 0;

  const rows = statsData.map((row) => {
    totalOrdersAll += row.orderCount;
    totalRevenueAll += row.revenue;
    totalCostAll += row.cost;
    totalProfitAll += row.profit;

    return [
      row.label,
      row.orderCount,
      row.revenue,
      row.cost,
      row.profit,
      `${row.margin}%`
    ];
  });

  const avgMargin = totalRevenueAll > 0 ? Math.round((totalProfitAll / totalRevenueAll) * 100) : 0;
  rows.push([
    'TỔNG CỘNG TOÀN KỲ',
    totalOrdersAll,
    totalRevenueAll,
    totalCostAll,
    totalProfitAll,
    `${avgMargin}%`
  ]);

  const worksheet = window.XLSX.utils.aoa_to_sheet([
    [`BÁO CÁO DOANH THU & LỢI NHUẬN NĂM ${year} (THEO ${periodTitle})`],
    [`Ngày lập: ${new Date().toLocaleDateString('vi-VN')} | Đơn vị: Tiệm Hoa Kẽm Nhung Handmade`],
    [],
    headers,
    ...rows
  ]);

  worksheet['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 20 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 }
  ];

  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, 'Thống Kê Doanh Thu');
  window.XLSX.writeFile(workbook, `Bao_Cao_Doanh_Thu_Loi_Nhuan_${year}.xlsx`);
  showToast('Đã tải xuống file Excel Báo Cáo Doanh Thu thành công!', 'success');
}

