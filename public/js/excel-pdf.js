import { createProduct } from './storage.js';
import { formatPrice, showToast, escapeHTML } from './utils.js';
import { resolveInvoicePdfMeta, resolveGiftDeliverySlipMeta } from './business-rules.js';

/**
 * excel-pdf.js - Module Nhập/Xuất Excel (ExcelJS) và Xuất Báo Cáo/Hóa Đơn PDF (jsPDF + Noto Sans Unicode)
 * Hỗ trợ đầy đủ tiếng Việt có dấu, xuất báo cáo theo Ngày / Tháng / Năm kèm bảng Mặt Hàng.
 */

let pendingImportProducts = [];

// Bộ nhớ đệm font Noto Sans (Regular & Bold) cho jsPDF
const pdfFontCache = {
  ready: false,
  loadingPromise: null,
  regularBase64: '',
  boldBase64: ''
};

/**
 * Chuyển ArrayBuffer nhị phân sang chuỗi Base64 an toàn (không tràn stack)
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * Nạp trước cặp font Noto Sans (Regular & Bold) từ public/vendor/fonts/
 */
export async function preloadPdfVietnameseFonts() {
  if (pdfFontCache.ready) return true;
  if (pdfFontCache.loadingPromise) return pdfFontCache.loadingPromise;

  pdfFontCache.loadingPromise = (async () => {
    try {
      const [regRes, boldRes] = await Promise.all([
        fetch('./vendor/fonts/NotoSans-Regular.ttf'),
        fetch('./vendor/fonts/NotoSans-Bold.ttf')
      ]);
      if (!regRes.ok || !boldRes.ok) {
        throw new Error('Không thể tải font Noto Sans từ /vendor/fonts/');
      }
      const [regBuf, boldBuf] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()]);
      pdfFontCache.regularBase64 = arrayBufferToBase64(regBuf);
      pdfFontCache.boldBase64 = arrayBufferToBase64(boldBuf);
      pdfFontCache.ready = Boolean(pdfFontCache.regularBase64 && pdfFontCache.boldBase64);
      return pdfFontCache.ready;
    } catch (err) {
      console.warn('[PDF Font] Dùng font dự phòng không dấu:', err.message);
      return false;
    } finally {
      pdfFontCache.loadingPromise = null;
    }
  })();

  return pdfFontCache.loadingPromise;
}

// Khởi động nạp nền ngay khi module được load trong trình duyệt thực
if (typeof window !== 'undefined' && typeof fetch === 'function') {
  preloadPdfVietnameseFonts();
}

/**
 * Đăng ký font Noto Sans Unicode vào instance jsPDF; trả về tên font sử dụng ('NotoSans' hoặc 'helvetica')
 */
function registerUnicodeFontOnDoc(doc) {
  if (
    pdfFontCache.ready &&
    typeof doc?.addFileToVFS === 'function' &&
    typeof doc?.addFont === 'function'
  ) {
    doc.addFileToVFS('NotoSans-Regular.ttf', pdfFontCache.regularBase64);
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    doc.addFileToVFS('NotoSans-Bold.ttf', pdfFontCache.boldBase64);
    doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
    // Map thêm italic về regular để tránh cảnh báo jsPDF khi có đoạn ghi chú nghiêng
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'italic');
    doc.setFont('NotoSans', 'normal');
    return 'NotoSans';
  }
  return 'helvetica';
}

/**
 * Chuyển đổi chuỗi tiếng Việt có dấu thành không dấu (chỉ dùng làm fallback khi thiếu Noto Sans)
 */
export function toNonAccentVietnamese(str) {
  if (!str) return '';
  str = String(str);
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  str = str.replace(/đ/g, 'd');
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
  str = str.replace(/Đ/g, 'D');
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Helper tải Workbook ExcelJS về trình duyệt
 */
async function triggerExcelDownload(workbook, fileName) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Trích xuất text thuần từ ô ExcelJS (hỗ trợ richText / formula / hyperlink)
 */
function extractCellPrimitive(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (val.result !== undefined) return val.result;
    if (Array.isArray(val.richText)) return val.richText.map(t => t.text || '').join('');
    if (val.text !== undefined) return val.text;
    if (val instanceof Date) return val.toISOString();
  }
  return val;
}

// ==========================================================================
// 1. TẢI FILE EXCEL MẪU CHUẨN (.XLSX) BẰNG EXCELJS
// ==========================================================================
export async function downloadExcelTemplate() {
  if (typeof window.ExcelJS === 'undefined') {
    showToast('Chưa tải được thư viện ExcelJS. Vui lòng thử lại!', 'error');
    return;
  }

  try {
    const workbook = new window.ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Mau_Nhap_Hoa');

    sheet.columns = [
      { header: 'Tên mẫu hoa', key: 'name', width: 38 },
      { header: 'Danh mục', key: 'category', width: 22 },
      { header: 'Giá bán (VND)', key: 'price', width: 18 },
      { header: 'Giá gốc (VND)', key: 'originalPrice', width: 18 },
      { header: 'Giá vốn (VND)', key: 'costPrice', width: 18 },
      { header: 'Tồn kho', key: 'stock', width: 12 },
      { header: 'Mô tả', key: 'description', width: 60 }
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF108474' } };

    sheet.addRows([
      {
        name: 'Bó Hoa Baby Trắng Tinh Khôi',
        category: 'Hoa Kẽm Nhung',
        price: 280000,
        originalPrice: 320000,
        costPrice: 120000,
        stock: 25,
        description: 'Hoa kẽm nhung mềm mịn màu trắng thanh khiết, bền đẹp theo thời gian'
      },
      {
        name: 'Giỏ Hoa Hướng Dương May Mắn',
        category: 'Giỏ & Hộp Hoa',
        price: 390000,
        originalPrice: 450000,
        costPrice: 165000,
        stock: 15,
        description: 'Món quà rực rỡ thích hợp chúc mừng sinh nhật, khai trương hồng phát'
      },
      {
        name: 'Bó Hoa Hồng Đỏ Kẽm Nhung Lãng Mạn',
        category: 'Bó Hoa Sinh Nhật',
        price: 350000,
        originalPrice: 400000,
        costPrice: 150000,
        stock: 20,
        description: 'Tone đỏ nhung quyến rũ cho các dịp kỷ niệm và lễ tình nhân'
      }
    ]);

    await triggerExcelDownload(workbook, 'Mau_Hoa_Nhap_Kho_Template.xlsx');
    showToast('Đã tải xuống file Excel mẫu thành công!');
  } catch (err) {
    console.error('Lỗi tải template ExcelJS:', err);
    showToast('Không thể tạo file Excel mẫu!', 'error');
  }
}

// ==========================================================================
// 2. ĐỌC VÀ NHẬP DỮ LIỆU TỪ FILE EXCEL (.XLSX / .CSV) BẰNG EXCELJS
// ==========================================================================
export function handleExcelFile(file, categories, onPreviewOpen) {
  if (!file) return;

  const lowerName = String(file.name || '').toLowerCase();
  if (lowerName.endsWith('.xls')) {
    showToast('Định dạng .xls cũ không được hỗ trợ vì lý do bảo mật. Vui lòng lưu file sang .xlsx hoặc .csv!', 'warning');
    return;
  }

  if (typeof window.ExcelJS === 'undefined') {
    showToast('Chưa tải được thư viện ExcelJS. Vui lòng thử lại!', 'error');
    return;
  }

  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const workbook = new window.ExcelJS.Workbook();
      let worksheet = null;

      if (lowerName.endsWith('.csv')) {
        const text = new TextDecoder('utf-8').decode(e.target.result);
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        worksheet = workbook.addWorksheet('CSV_Import');
        lines.forEach(line => {
          const cells = line.split(',').map(c => c.trim().replace(/^"(.*)"$/, '$1'));
          worksheet.addRow(cells);
        });
      } else {
        await workbook.xlsx.load(e.target.result);
        worksheet = workbook.worksheets[0];
      }

      if (!worksheet || worksheet.rowCount < 2) {
        showToast('File Excel không có dữ liệu hợp lệ!', 'error');
        return;
      }

      const headerRow = worksheet.getRow(1);
      const headers = [];
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber] = String(extractCellPrimitive(cell.value) || '').trim();
      });

      const rawRows = [];
      for (let r = 2; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        if (!row || !row.hasValues) continue;
        const rowObj = {};
        let hasNonEmpty = false;
        headers.forEach((h, colIdx) => {
          if (!h) return;
          const val = extractCellPrimitive(row.getCell(colIdx).value);
          if (val !== '' && val !== null && val !== undefined) hasNonEmpty = true;
          rowObj[h] = val;
        });
        if (hasNonEmpty) rawRows.push(rowObj);
      }

      if (rawRows.length === 0) {
        showToast('File Excel không có dòng dữ liệu nào!', 'error');
        return;
      }

      pendingImportProducts = rawRows.map((row, index) => {
        const name = String(row['Tên mẫu hoa'] || row['Ten mau hoa'] || row['Tên sản phẩm'] || row['name'] || '').trim();
        const catNameInput = String(row['Danh mục'] || row['Danh muc'] || row['categoryName'] || 'Hoa Kẽm Nhung').trim();
        const price = Number(row['Giá bán (VND)'] || row['Gia ban'] || row['price'] || 200000);
        const originalPrice = Number(row['Giá gốc (VND)'] || row['Gia goc'] || row['originalPrice'] || price);
        const costPrice = Number(row['Giá vốn (VND)'] || row['Gia von'] || row['costPrice'] || 0);
        const stock = Number(row['Tồn kho'] || row['Ton kho'] || row['stock'] || 10);
        const description = String(row['Mô tả'] || row['Mo ta'] || row['description'] || 'Mẫu hoa kẽm nhung thủ công tinh xảo.').trim();

        const matchedCategory = categories.find(
          c => c.name.toLowerCase() === catNameInput.toLowerCase()
        ) || categories[0] || { id: '1', name: 'Hoa Kẽm Nhung', slug: 'kem-nhung' };

        return {
          name: name || `Mẫu hoa nhập kho #${index + 1}`,
          price: isNaN(price) ? 200000 : price,
          originalPrice: isNaN(originalPrice) ? price : originalPrice,
          costPrice: isNaN(costPrice) ? 0 : Math.max(0, costPrice),
          isActive: true,
          categoryId: matchedCategory.id,
          categoryName: matchedCategory.name,
          categorySlug: matchedCategory.slug || 'kem-nhung',
          image: './images/300.png',
          stock: isNaN(stock) ? 10 : stock,
          soldCount: 0,
          rating: 5,
          reviewCount: 0,
          featured: false,
          badge: 'Mới',
          description
        };
      });

      if (typeof onPreviewOpen === 'function') {
        onPreviewOpen(pendingImportProducts);
      }
    } catch (err) {
      console.error('Lỗi khi đọc file ExcelJS:', err);
      showToast('Không thể đọc file Excel. Vui lòng kiểm tra định dạng .xlsx hoặc .csv!', 'error');
    }
  };

  reader.readAsArrayBuffer(file);
}

// ==========================================================================
// 3. XUẤT BÁO CÁO DANH SÁCH MẪU HOA RA PDF (HỖ TRỢ TIẾNG VIỆT CÓ DẤU)
// ==========================================================================
export async function exportProductsToPdf(products) {
  if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
    showToast('Chưa nạp được thư viện jsPDF. Vui lòng thử lại sau!', 'error');
    return;
  }

  if (!products || products.length === 0) {
    showToast('Không có sản phẩm nào để xuất PDF!', 'error');
    return;
  }

  try {
    await preloadPdfVietnameseFonts();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const fontFamily = registerUnicodeFontOnDoc(doc);
    const txt = (str) => (fontFamily === 'NotoSans' ? String(str ?? '') : toNonAccentVietnamese(str));

    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(15);
    doc.setTextColor(16, 132, 116);
    doc.text(txt('TIỆM HOA KẼM NHUNG & HOA TƯƠI HANDMADE'), 105, 16, { align: 'center' });

    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text(txt('BẢNG KIỂM KÊ HÀNG HÓA & BÁO CÁO TỒN KHO SẢN PHẨM'), 105, 23, { align: 'center' });

    const now = new Date();
    const dateStr = now.toLocaleDateString('vi-VN');
    const timeStr = now.toLocaleTimeString('vi-VN');
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    doc.text(txt(`Địa chỉ: TP. Hồ Chí Minh | Hotline: 0901.234.567 | Ngày lập: ${dateStr} ${timeStr}`), 105, 29, { align: 'center' });

    doc.setDrawColor(16, 132, 116);
    doc.setLineWidth(0.4);
    doc.line(14, 32, 196, 32);

    const tableHeaders = [
      txt('STT'),
      txt('Tên Mẫu Hoa'),
      txt('Danh Mục'),
      txt('Giá Bán (VND)'),
      txt('Tồn Kho'),
      txt('Đã Bán')
    ];

    const tableRows = products.map((sp, idx) => [
      idx + 1,
      txt(String(sp.name || '').trim()),
      txt(String(sp.categoryName || 'Hoa Kẽm Nhung').trim()),
      txt(formatPrice(sp.price || 0)),
      sp.stock || 0,
      sp.soldCount || 0
    ]);

    const totalProducts = products.length;
    const totalStock = products.reduce((sum, sp) => sum + (Number(sp.stock) || 0), 0);
    const totalInventoryValue = products.reduce((sum, sp) => sum + ((Number(sp.price) || 0) * (Number(sp.stock) || 0)), 0);

    tableRows.push([
      txt('TỔNG'),
      txt(`${totalProducts} mẫu hoa`),
      '-',
      txt(`Giá trị kho: ${formatPrice(totalInventoryValue)}`),
      txt(`${totalStock} sp`),
      '-'
    ]);

    doc.autoTable({
      head: [tableHeaders],
      body: tableRows,
      startY: 38,
      theme: 'grid',
      styles: {
        font: fontFamily
      },
      headStyles: {
        fillColor: [16, 132, 116],
        textColor: [255, 255, 255],
        font: fontFamily,
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center'
      },
      bodyStyles: {
        font: fontFamily,
        fontSize: 8.5,
        textColor: [50, 50, 50]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { cellWidth: 60 },
        2: { cellWidth: 35 },
        3: { halign: 'right', cellWidth: 32 },
        4: { halign: 'center', cellWidth: 19 },
        5: { halign: 'center', cellWidth: 19 }
      },
      didParseCell: function (data) {
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 245, 244];
        }
      }
    });

    const finalY = doc.lastAutoTable.finalY + 12;
    if (finalY < 270) {
      doc.setFont(fontFamily, 'bold');
      doc.setFontSize(9);
      doc.text(txt('Người Lập Biểu'), 35, finalY);
      doc.setFont(fontFamily, 'normal');
      doc.text(txt('(Ký và ghi rõ họ tên)'), 28, finalY + 5);

      doc.setFont(fontFamily, 'bold');
      doc.text(txt('Quản Lý Cửa Hàng'), 155, finalY);
      doc.setFont(fontFamily, 'normal');
      doc.text(txt('(Xác nhận đóng dấu)'), 148, finalY + 5);
    }

    const fileName = `Bao_Cao_Mau_Hoa_${dateStr.replace(/\//g, '-')}.pdf`;
    doc.save(fileName);
    showToast(`Đã xuất báo cáo PDF thành công: ${fileName}!`);
  } catch (error) {
    console.error('Lỗi khi xuất PDF:', error);
    showToast('Có lỗi xảy ra khi tạo file PDF. Vui lòng thử lại!', 'error');
  }
}

// ==========================================================================
// 4. GẮN KẾT SỰ KIỆN EXCEL & PDF TRÊN ADMIN.HTML
// ==========================================================================
export function initExcelPdf({ getProducts, getCategories, onProductsImported }) {
  const btnDownloadTemplate = document.querySelector('#btnDownloadTemplate');
  const btnTriggerImport = document.querySelector('#btnTriggerImportExcel');
  const fileInput = document.querySelector('#excelFileInput');
  const btnExportPdf = document.querySelector('#btnExportProductPdf');

  const previewModal = document.querySelector('#excelPreviewModal');
  const previewSummary = document.querySelector('#excelPreviewSummary');
  const previewTableBody = document.querySelector('#excelPreviewTableBody');
  const previewCloseBtn = document.querySelector('#excelPreviewCloseBtn');
  const previewCancelBtn = document.querySelector('#excelPreviewCancelBtn');
  const previewConfirmBtn = document.querySelector('#excelPreviewConfirmBtn');

  if (btnDownloadTemplate) {
    btnDownloadTemplate.addEventListener('click', () => {
      downloadExcelTemplate();
    });
  }

  if (btnTriggerImport && fileInput) {
    btnTriggerImport.addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const categories = typeof getCategories === 'function' ? getCategories() : [];

      handleExcelFile(file, categories, (parsedList) => {
        if (previewSummary) {
          previewSummary.textContent = `Đã đọc thành công ${parsedList.length} mẫu hoa từ file Excel. Vui lòng kiểm tra lại trước khi lưu:`;
        }

        if (previewTableBody) {
          previewTableBody.innerHTML = parsedList.map((item, idx) => `
            <tr>
              <td style="text-align: center;">${idx + 1}</td>
              <td><strong>${escapeHTML(item.name)}</strong></td>
              <td>${escapeHTML(item.categoryName)}</td>
              <td style="color: var(--color-primary); font-weight: 700;">${formatPrice(item.price)}</td>
              <td style="text-align: center;">${Number(item.stock) || 0}</td>
            </tr>
          `).join('');
        }

        if (previewModal) previewModal.classList.remove('hidden');
      });
    });
  }

  function closePreview() {
    if (previewModal) previewModal.classList.add('hidden');
    pendingImportProducts = [];
  }

  if (previewCloseBtn) previewCloseBtn.addEventListener('click', closePreview);
  if (previewCancelBtn) previewCancelBtn.addEventListener('click', closePreview);

  if (previewConfirmBtn) {
    previewConfirmBtn.addEventListener('click', async () => {
      if (pendingImportProducts.length === 0) {
        showToast('Không có dữ liệu để lưu!', 'error');
        closePreview();
        return;
      }

      previewConfirmBtn.disabled = true;
      previewConfirmBtn.textContent = 'Đang lưu dữ liệu...';

      try {
        let successCount = 0;
        for (const item of pendingImportProducts) {
          await createProduct(item);
          successCount++;
        }

        showToast(`Nhập thành công ${successCount} mẫu hoa từ Excel vào hệ thống!`);
        closePreview();

        if (typeof onProductsImported === 'function') {
          await onProductsImported();
        }
      } catch (err) {
        console.error('Lỗi khi lưu sản phẩm từ Excel:', err);
        showToast('Có lỗi xảy ra khi lưu một số sản phẩm vào hệ thống!', 'error');
      } finally {
        previewConfirmBtn.disabled = false;
        previewConfirmBtn.textContent = 'Xác Nhận Lưu Vào Hệ Thống';
      }
    });
  }

  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', () => {
      const currentProducts = typeof getProducts === 'function' ? getProducts() : [];
      exportProductsToPdf(currentProducts);
    });
  }

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
          <td><strong>${escapeHTML(item.name)}</strong></td>
          <td>${escapeHTML(item.categoryName)}</td>
          <td style="color: var(--color-primary); font-weight: 700;">${formatPrice(item.price)}</td>
          <td style="text-align: center;">${item.stock}</td>
        </tr>
      `).join('');
    }
    if (previewModal) previewModal.classList.remove('hidden');
  }
}

// ==========================================================================
// 5. XUẤT HÓA ĐƠN BÁN LẺ / PHIẾU ĐƠN A5 PDF (NOTO SANS UNICODE + AUTOTABLE)
// ==========================================================================
export function exportOrderInvoicePdf(order, options = {}) {
  const invoiceMeta = resolveInvoicePdfMeta(order, options);
  if (!invoiceMeta.canExport) {
    showToast(invoiceMeta.errorMessage || 'Không thể xuất hóa đơn cho đơn hàng này!', 'error');
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
    format: [148, 210]
  });

  if (typeof doc.autoTable !== 'function') {
    showToast('Thiếu plugin jsPDF-AutoTable trên trang hiện tại!', 'error');
    return;
  }

  // Nếu là trình duyệt thực (có addFileToVFS) và font chưa kịp preload xong thì đợi preload rồi mới vẽ
  if (typeof doc.addFileToVFS === 'function' && !pdfFontCache.ready) {
    return preloadPdfVietnameseFonts().then(() => renderInvoicePdfWithDoc(doc, order, invoiceMeta, options));
  }

  return renderInvoicePdfWithDoc(doc, order, invoiceMeta, options);
}

function renderInvoicePdfWithDoc(doc, order, invoiceMeta, options = {}) {
  const isReceipt = invoiceMeta.docKind === 'receipt';
  const autoDownload = Boolean(options.autoDownload);
  const fontFamily = registerUnicodeFontOnDoc(doc);
  const txt = (str) => (fontFamily === 'NotoSans' ? String(str ?? '') : toNonAccentVietnamese(str));

  const pageCenterX = 74;

  // 1. HEADER CỬA HÀNG
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(16, 132, 116);
  doc.text(txt('TIỆM HOA KẼM NHUNG HANDMADE'), pageCenterX, 13, { align: 'center' });

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(txt('Hoa Kẽm Nhung Thủ Công & Nghệ Thuật Trang Trí Cao Cấp'), pageCenterX, 17, { align: 'center' });
  doc.text(txt('Hotline: 0901.234.567 | Website: tiemplovers.vn | Quận 1, TP.HCM'), pageCenterX, 21, { align: 'center' });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(10, 24, 138, 24);

  // 2. TIÊU ĐỀ CHỨNG TỪ
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(invoiceMeta.titleText, pageCenterX, 30, { align: 'center' });

  // 3. THÔNG TIN KHÁCH HÀNG & ĐƠN HÀNG
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN') : 'Vừa đặt';
  const orderId = invoiceMeta.orderCode;
  const customerName = txt(order.customerName || order.recipientName || 'Khách vãng lai');
  const recipientName = order.isGift && order.recipientName ? txt(order.recipientName) : '';
  const phone = order.phone || order.customerPhone || '---';
  const address = txt(order.address || order.shippingAddress || 'Nhận tại quầy');
  const hasCard = Boolean(order.hasGreetingCard || order.cardMessage);
  const hasCardStr = txt(hasCard ? 'Có (Thiệp viết tay riêng)' : 'Không');
  const deliverySlot = txt(order.deliverySlot || 'Tiêu chuẩn trong ngày');
  const isPaid = invoiceMeta.isPaid;
  const paymentMethodStr = txt(invoiceMeta.paymentMethodLabel);

  doc.text(txt(`Mã đơn hàng: #${orderId}`), 10, 37);
  doc.text(txt(`Người đặt: ${customerName}`), 10, 42);
  if (recipientName) {
    doc.text(txt(`Người nhận hoa: ${recipientName}`), 10, 47);
    doc.text(txt(`Địa chỉ giao: ${address}`), 10, 52);
    doc.text(txt(`Kèm thiệp mừng: ${hasCardStr}`), 10, 57);
  } else {
    doc.text(txt(`Địa chỉ giao: ${address}`), 10, 47);
    doc.text(txt(`Kèm thiệp mừng: ${hasCardStr}`), 10, 52);
  }

  doc.text(txt(`Ngày đặt: ${orderDate}`), 76, 37);
  doc.text(txt(`Điện thoại: ${phone}`), 76, 42);
  doc.text(txt(`Khung giờ: ${deliverySlot}`), 76, 47);
  doc.text(txt(`Hình thức: ${paymentMethodStr}`), 76, 52);

  // 4. BẢNG CHI TIẾT HOA
  const formatMoneyPdf = (amount) => Number(amount || 0).toLocaleString('vi-VN') + ' VND';
  const items = Array.isArray(order.items) ? order.items : [];
  const tableRows = items.map((item, index) => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.price ?? item.unitPrice) || 0;
    const total = qty * price;
    const itemName = item.name || item.productName || 'Mẫu hoa kẽm nhung handmade';
    const fullItemName = item.addonsText ? `${itemName} (+ PK: ${item.addonsText})` : itemName;
    return [
      (index + 1).toString(),
      txt(fullItemName),
      formatMoneyPdf(price),
      qty.toString(),
      formatMoneyPdf(total)
    ];
  });

  const tableHeaders = [txt('STT'), txt('Tên Mẫu Hoa'), txt('Đơn Giá'), txt('SL'), txt('Thành Tiền')];
  const tableStartY = recipientName ? 62 : 57;

  doc.autoTable({
    head: [tableHeaders],
    body: tableRows,
    startY: tableStartY,
    theme: 'grid',
    margin: { left: 10, right: 10 },
    styles: {
      font: fontFamily,
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: [30, 41, 59]
    },
    headStyles: {
      fillColor: [16, 132, 116],
      textColor: [255, 255, 255],
      font: fontFamily,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', cellWidth: 58 },
      2: { halign: 'right', cellWidth: 24 },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'right', cellWidth: 24 }
    }
  });

  const finalY = doc.lastAutoTable.finalY + 5;
  const { subtotal, shippingFee, discountAmount: discount, totalAmount } = invoiceMeta.totals;

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  let summaryY = finalY;
  doc.text(txt('Tạm tính tiền hoa:'), 76, summaryY);
  doc.text(formatMoneyPdf(subtotal), 138, summaryY, { align: 'right' });

  summaryY += 4.5;
  // Giữ từ khóa 'Phi van chuyen:' khi không có font Unicode để giữ tương thích test mock
  doc.text(fontFamily === 'NotoSans' ? 'Phí vận chuyển:' : 'Phi van chuyen:', 76, summaryY);
  doc.text(shippingFee > 0 ? formatMoneyPdf(shippingFee) : txt('Miễn phí'), 138, summaryY, { align: 'right' });

  if (discount > 0) {
    summaryY += 4.5;
    doc.text(txt('Giảm giá Voucher:'), 76, summaryY);
    doc.text(`- ${formatMoneyPdf(discount)}`, 138, summaryY, { align: 'right' });
  }

  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(16, 132, 116);
  const totalY = summaryY + 5.5;
  doc.text(txt('TỔNG THANH TOÁN:'), 76, totalY);
  doc.text(formatMoneyPdf(totalAmount), 138, totalY, { align: 'right' });

  const stampX = 10;
  const stampY = finalY - 1;
  const stampW = 58;
  const stampH = 18;
  const { stamp } = invoiceMeta;

  if (isPaid) {
    doc.setDrawColor(22, 163, 74);
    doc.setLineWidth(0.8);
    doc.roundedRect(stampX, stampY, stampW, stampH, 2, 2);
    doc.setLineWidth(0.3);
    doc.roundedRect(stampX + 1, stampY + 1, stampW - 2, stampH - 2, 1.5, 1.5);

    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(22, 163, 74);
    doc.text(stamp.badge, stampX + (stampW / 2), stampY + 6.5, { align: 'center' });

    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(21, 128, 61);
    doc.text(stamp.line1, stampX + (stampW / 2), stampY + 11, { align: 'center' });
    doc.text(stamp.line2, stampX + (stampW / 2), stampY + 15, { align: 'center' });
  } else {
    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(0.8);
    doc.roundedRect(stampX, stampY, stampW, stampH, 2, 2);
    doc.setLineWidth(0.3);
    doc.roundedRect(stampX + 1, stampY + 1, stampW - 2, stampH - 2, 1.5, 1.5);

    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(217, 119, 6);
    doc.text(stamp.badge, stampX + (stampW / 2), stampY + 7, { align: 'center' });

    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(180, 83, 9);
    doc.text(stamp.line1, stampX + (stampW / 2), stampY + 12, { align: 'center' });
    doc.text(stamp.line2, stampX + (stampW / 2), stampY + 15.5, { align: 'center' });
  }

  const signY = Math.max(totalY, stampY + stampH) + 12;
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  doc.text(txt('Người Nhận Hàng'), 35, signY, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text(txt('(Ký và ghi rõ họ tên)'), 35, signY + 3.5, { align: 'center' });

  doc.setFontSize(7.5);
  doc.text(txt('Đại Diện Shop Hoa'), 110, signY, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text(txt('(Kế toán / Thu ngân)'), 110, signY + 3.5, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setFont(fontFamily, 'bold');
  doc.text(txt('Quản Trị Viên Tiệm Hoa'), 110, signY + 12, { align: 'center' });

  doc.setFont(fontFamily, 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(txt('Cảm ơn quý khách đã tin yêu và lựa chọn Tiệm Hoa Kẽm Nhung!'), pageCenterX, 202, { align: 'center' });
  doc.text(txt('Chứng từ hợp lệ kèm phiếu xuất kho nội bộ - TiemLovers.vn'), pageCenterX, 205, { align: 'center' });

  const fileName = !isPaid
    ? `Phieu_Don_${orderId}.pdf`
    : (isReceipt ? `Bien_Nhan_${orderId}.pdf` : `Hoa_Don_${orderId}.pdf`);

  if (autoDownload) {
    doc.save(fileName);
    showToast(`Đã tải hóa đơn #${orderId} về máy!`, 'success');
  } else {
    try {
      const blobUrl = doc.output('bloburl');
      const win = window.open(blobUrl, '_blank');
      if (win) {
        showToast(isReceipt ? 'Đã mở Biên nhận điện tử trong tab mới!' : `Đã mở Hóa đơn điện tử #${orderId} trong tab mới!`, 'success');
      } else {
        doc.save(fileName);
        showToast(`Trình duyệt chặn popup, đã tự động tải ${fileName} về máy!`, 'info');
      }
    } catch (e) {
      doc.save(fileName);
      showToast(`Đã xuất file ${fileName} thành công!`, 'success');
    }
  }
}

// ==========================================================================
// 5B. XUẤT PHIẾU GIAO QUÀ TẶNG A5 PDF (ẨN GIÁ TIỀN, ẨN NGƯỜI GỬI NẾU BÍ MẬT)
// ==========================================================================
export function exportGiftDeliverySlipPdf(order, options = {}) {
  const meta = resolveGiftDeliverySlipMeta(order);
  if (!meta.canExport) {
    showToast(meta.errorMessage || 'Không thể xuất phiếu giao quà tặng!', 'error');
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
    format: [148, 210] // Khổ A5 chuẩn giao hoa
  });

  if (typeof doc.autoTable !== 'function') {
    showToast('Thiếu plugin jsPDF-AutoTable trên trang hiện tại!', 'error');
    return;
  }

  if (typeof doc.addFileToVFS === 'function' && !pdfFontCache.ready) {
    return preloadPdfVietnameseFonts().then(() => renderGiftDeliverySlipPdfWithDoc(doc, order, meta, options));
  }

  return renderGiftDeliverySlipPdfWithDoc(doc, order, meta, options);
}

export function renderGiftDeliverySlipPdfWithDoc(doc, order, meta, options = {}) {
  const autoDownload = Boolean(options.autoDownload);
  const fontFamily = registerUnicodeFontOnDoc(doc);
  const txt = (str) => (fontFamily === 'NotoSans' ? String(str ?? '') : toNonAccentVietnamese(str));
  const pageCenterX = 74;

  // 1. HEADER TIỆM HOA (TÔNG MÀU HỒNG ĐỎ QUÀ TẶNG)
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(225, 29, 72); // Rose/Crimson
  doc.text(txt('TIỆM HOA KẼM NHUNG HANDMADE'), pageCenterX, 13, { align: 'center' });

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(txt('Hoa Kẽm Nhung Thủ Công & Quà Tặng Nghệ Thuật'), pageCenterX, 17, { align: 'center' });
  doc.text(txt('Hotline: 0901.234.567 | Website: tiemplovers.vn | Giao hoa tận tay người nhận'), pageCenterX, 21, { align: 'center' });

  doc.setDrawColor(244, 63, 94);
  doc.setLineWidth(0.4);
  doc.line(10, 24, 138, 24);

  // 2. TIÊU ĐỀ CHỨNG TỪ: PHIẾU GIAO QUÀ TẶNG
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(190, 24, 93);
  doc.text(txt('PHIẾU GIAO QUÀ TẶNG (GIFT DELIVERY SLIP)'), pageCenterX, 30, { align: 'center' });

  // 3. THÔNG TIN GIAO NHẬN
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  const orderId = meta.orderCode;
  const deliveryDate = meta.deliveryDate;
  const deliverySlot = meta.deliverySlot;
  const recipientName = txt(meta.recipientName);
  const recipientPhone = txt(meta.recipientPhone);
  const address = txt(meta.address);
  const senderName = txt(meta.senderName);
  const senderPhone = txt(meta.senderPhone);

  doc.text(txt(`Mã đơn: #${orderId}`), 10, 37);
  doc.text(txt(`Ngày hẹn giao: ${deliveryDate}`), 10, 42);
  doc.text(txt(`Khung giờ: ${deliverySlot}`), 10, 47);

  doc.text(txt(`Người gửi: ${senderName}`), 76, 37);
  doc.text(txt(`Điện thoại gửi: ${senderPhone}`), 76, 42);

  doc.setFont(fontFamily, 'bold');
  doc.text(txt(`Người nhận quà: ${recipientName}`), 10, 53);
  doc.setFont(fontFamily, 'normal');
  doc.text(txt(`SĐT nhận: ${recipientPhone}`), 76, 53);
  doc.text(txt(`Địa chỉ nhận: ${address}`), 10, 58);

  let currentY = 63;

  // 4. HỘP THIỆP CHÚC MỪNG (CARD MESSAGE BOX) NẾU CÓ
  if (meta.hasGreetingCard && meta.cardMessage) {
    doc.setDrawColor(254, 205, 211);
    doc.setFillColor(255, 241, 242);
    doc.roundedRect(10, currentY, 128, 14, 2, 2, 'FD');

    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(225, 29, 72);
    doc.text(txt('💌 Lời Nhắn Gửi Yêu Thương (Thiệp Mừng):'), 13, currentY + 4.5);

    doc.setFont(fontFamily, 'italic');
    doc.setFontSize(8);
    doc.setTextColor(159, 18, 57);
    const splitCardText = doc.splitTextToSize(txt(`"${meta.cardMessage}"`), 122);
    doc.text(splitCardText, 13, currentY + 9.5);

    currentY += 18;
  }

  // 5. BẢNG MẪU HOA (CHỈ CÓ TÊN HOA + SỐ LƯỢNG + PHỤ KIỆN, KHÔNG HIỆN GIÁ TIỀN)
  const items = meta.items;
  const tableRows = items.map((item, index) => {
    const qty = String(item.quantity || 1);
    const itemName = item.addons ? `${item.name} (+ PK: ${item.addons})` : item.name;
    return [
      (index + 1).toString(),
      txt(itemName),
      qty,
      txt('Món quà tinh tế gửi trao')
    ];
  });

  const tableHeaders = [txt('STT'), txt('Món Quà Tặng / Bó Hoa'), txt('SL'), txt('Ghi Chú Quà Tặng')];

  doc.autoTable({
    head: [tableHeaders],
    body: tableRows,
    startY: currentY,
    theme: 'grid',
    margin: { left: 10, right: 10 },
    styles: {
      font: fontFamily,
      fontSize: 8,
      cellPadding: 3,
      textColor: [30, 41, 59]
    },
    headStyles: {
      fillColor: [225, 29, 72],
      textColor: [255, 255, 255],
      font: fontFamily,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'left', cellWidth: 68 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'left', cellWidth: 32 }
    }
  });

  const finalY = doc.lastAutoTable.finalY + 6;

  // 6. THÔNG ĐIỆP CHÚC MỪNG VÀ CHỮ KÝ (TUYỆT ĐỐI KHÔNG CÓ GIÁ TIỀN)
  doc.setFont(fontFamily, 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(190, 24, 93);
  doc.text(txt(`✨ ${meta.wishMessage}`), pageCenterX, finalY, { align: 'center' });

  const signY = finalY + 12;
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  doc.text(txt('Người Nhận Hoa Tặng'), 35, signY, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text(txt('(Ký xác nhận đã nhận hoa)'), 35, signY + 3.5, { align: 'center' });

  doc.setFontSize(7.5);
  doc.text(txt('Nhân Viên Giao Hoa'), 110, signY, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text(txt('(Ký & bàn giao nguyên vẹn)'), 110, signY + 3.5, { align: 'center' });

  doc.setFont(fontFamily, 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(txt('Phiếu giao hoa không chứa giá trị thanh toán - Tiệm Hoa Kẽm Nhung Handmade'), pageCenterX, 202, { align: 'center' });
  doc.text(txt('Cảm ơn bạn đã nhận món quà ý nghĩa từ người gửi! Hotline hỗ trợ: 0901.234.567'), pageCenterX, 205, { align: 'center' });

  const fileName = `Phieu_Giao_Qua_${orderId}.pdf`;

  if (autoDownload) {
    doc.save(fileName);
    showToast(`Đã tải phiếu giao quà #${orderId} về máy!`, 'success');
  } else {
    try {
      const blobUrl = doc.output('bloburl');
      const win = window.open(blobUrl, '_blank');
      if (win) {
        showToast(`Đã mở Phiếu giao quà tặng #${orderId} trong tab mới!`, 'success');
      } else {
        doc.save(fileName);
        showToast(`Đã tự động tải file ${fileName} về máy!`, 'info');
      }
    } catch (e) {
      doc.save(fileName);
      showToast(`Đã xuất file ${fileName} thành công!`, 'success');
    }
  }

  return doc;
}

// ==========================================================================
// 6. XUẤT BÁO CÁO DOANH SỐ, DOANH THU & MẶT HÀNG THEO NGÀY / THÁNG / NĂM
// ==========================================================================
function normalizeStatsExportInput(arg1, periodType = 'day', year = new Date().getFullYear()) {
  if (arg1 && !Array.isArray(arg1) && typeof arg1 === 'object') {
    return {
      statsData: arg1.statsData || [],
      productStats: arg1.productStats || [],
      ordersInRange: arg1.ordersInRange || [],
      periodType: arg1.periodType || 'day',
      fromDate: arg1.fromDate || '',
      toDate: arg1.toDate || '',
      periodTitle: arg1.periodTitle || '',
      dayMonthYearSummary: arg1.dayMonthYearSummary || null
    };
  }
  return {
    statsData: Array.isArray(arg1) ? arg1 : [],
    productStats: [],
    ordersInRange: [],
    periodType,
    fromDate: `${year}-01-01`,
    toDate: `${year}-12-31`,
    periodTitle: `Năm ${year}`,
    dayMonthYearSummary: null
  };
}

export async function exportRevenueStatisticsPdf(statsInput, periodTypeArg, yearArg = new Date().getFullYear()) {
  const payload = normalizeStatsExportInput(statsInput, periodTypeArg, yearArg);
  const { statsData, productStats, periodType, fromDate, toDate, periodTitle, dayMonthYearSummary } = payload;

  if (!statsData || statsData.length === 0) {
    showToast('Không có dữ liệu thống kê để xuất báo cáo!', 'error');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('Chưa nạp được thư viện jsPDF!', 'error');
    return;
  }

  try {
    await preloadPdfVietnameseFonts();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const fontFamily = registerUnicodeFontOnDoc(doc);
    const txt = (str) => (fontFamily === 'NotoSans' ? String(str ?? '') : toNonAccentVietnamese(str));

    const pageCenterX = 148.5;
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(15);
    doc.setTextColor(16, 132, 116);
    doc.text(txt('TIỆM HOA KẼM NHUNG HANDMADE'), pageCenterX, 14, { align: 'center' });

    const modeLabel = periodType === 'day'
      ? 'THEO NGÀY'
      : (periodType === 'quarter' ? 'THEO QUÝ' : (periodType === 'year' ? 'THEO NĂM' : 'THEO THÁNG'));
    const rangeLabel = periodTitle || (fromDate && toDate ? `${fromDate} đến ${toDate}` : `Năm ${yearArg}`);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(txt(`BÁO CÁO DOANH SỐ, DOANH THU & MẶT HÀNG (${modeLabel}) — ${rangeLabel}`), pageCenterX, 21, { align: 'center' });

    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(txt(`Ngày xuất báo cáo: ${new Date().toLocaleString('vi-VN')} | Người xuất: Quản Trị Viên`), pageCenterX, 26.5, { align: 'center' });

    let nextY = 32;
    if (dayMonthYearSummary) {
      doc.setFont(fontFamily, 'bold');
      doc.setFontSize(9);
      doc.setTextColor(16, 132, 116);
      const lineSummary = `Hôm nay: DT ${formatPrice(dayMonthYearSummary.today?.revenue || 0)} (DS ${formatPrice(dayMonthYearSummary.today?.gmv || 0)})  |  Tháng này: DT ${formatPrice(dayMonthYearSummary.month?.revenue || 0)} (DS ${formatPrice(dayMonthYearSummary.month?.gmv || 0)})  |  Năm nay: DT ${formatPrice(dayMonthYearSummary.year?.revenue || 0)} (DS ${formatPrice(dayMonthYearSummary.year?.gmv || 0)})`;
      doc.text(txt(lineSummary), pageCenterX, nextY, { align: 'center' });
      nextY += 6;
    }

    let totalGmvOrdersAll = 0;
    let totalGmvAll = 0;
    let totalOrdersAll = 0;
    let totalRevenueAll = 0;
    let totalCostAll = 0;
    let totalProfitAll = 0;

    const tableRows = statsData.map((row) => {
      const gmvOrders = Number(row.gmvOrderCount ?? row.orderCount ?? 0);
      const gmv = Number(row.gmv ?? row.revenue ?? 0);
      totalGmvOrdersAll += gmvOrders;
      totalGmvAll += gmv;
      totalOrdersAll += Number(row.orderCount || 0);
      totalRevenueAll += Number(row.revenue || 0);
      totalCostAll += Number(row.cost || 0);
      totalProfitAll += Number(row.profit || 0);

      return [
        txt(row.label),
        gmvOrders.toString(),
        txt(formatPrice(gmv)),
        Number(row.orderCount || 0).toString(),
        txt(formatPrice(row.revenue || 0)),
        txt(formatPrice(row.cost || 0)),
        txt(formatPrice(row.profit || 0)),
        `${row.margin || 0}%`
      ];
    });

    const avgMargin = totalRevenueAll > 0 ? Math.round((totalProfitAll / totalRevenueAll) * 100) : 0;
    tableRows.push([
      txt('TỔNG CỘNG TOÀN KỲ'),
      totalGmvOrdersAll.toString(),
      txt(formatPrice(totalGmvAll)),
      totalOrdersAll.toString(),
      txt(formatPrice(totalRevenueAll)),
      txt(formatPrice(totalCostAll)),
      txt(formatPrice(totalProfitAll)),
      `${avgMargin}%`
    ]);

    const headers = [
      txt('Kỳ Thời Gian'),
      txt('Đơn Đặt'),
      txt('Doanh Số (GMV)'),
      txt('Đơn Hoàn Thành'),
      txt('Doanh Thu Thực Nhận'),
      txt('Chi Phí Vốn'),
      txt('Lợi Nhuận Ròng'),
      txt('Biên LN')
    ];

    doc.autoTable({
      head: [headers],
      body: tableRows,
      startY: nextY,
      theme: 'grid',
      styles: { font: fontFamily, fontSize: 8.5, cellPadding: 2.8 },
      headStyles: {
        fillColor: [16, 132, 116],
        textColor: [255, 255, 255],
        font: fontFamily,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 46, fontStyle: 'bold' },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 38 },
        3: { halign: 'center', cellWidth: 24 },
        4: { halign: 'right', cellWidth: 40 },
        5: { halign: 'right', cellWidth: 36 },
        6: { halign: 'right', cellWidth: 38, fontStyle: 'bold' },
        7: { halign: 'center', cellWidth: 22 }
      },
      didParseCell: function (data) {
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
          if (data.column.index === 6) {
            data.cell.styles.textColor = [16, 132, 116];
          }
        }
      }
    });

    if (Array.isArray(productStats) && productStats.length > 0) {
      const prodStartY = (doc.lastAutoTable?.finalY || 120) + 10;
      doc.setFont(fontFamily, 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(txt(`THỐNG KÊ CHI TIẾT TỪNG MẶT HÀNG (${rangeLabel})`), 14, prodStartY);

      const prodHeaders = [
        txt('STT'),
        txt('Tên Mẫu Hoa'),
        txt('Danh Mục'),
        txt('Chưa Giao'),
        txt('Đang Giao'),
        txt('Đã Giao'),
        txt('Đã Hủy'),
        txt('Doanh Thu Trong Kỳ'),
        txt('Tồn Kho')
      ];

      const prodRows = productStats.map((item, idx) => [
        String(idx + 1),
        txt(item.name),
        txt(item.categoryName || 'Hoa Kẽm Nhung'),
        String(item.undeliveredQty || 0),
        String(item.shippingQty || 0),
        String(item.deliveredQty || 0),
        String(item.cancelledQty || 0),
        txt(formatPrice(item.deliveredRevenue || 0)),
        String(item.stock ?? 0)
      ]);

      const sumUndelivered = productStats.reduce((s, p) => s + (p.undeliveredQty || 0), 0);
      const sumShipping = productStats.reduce((s, p) => s + (p.shippingQty || 0), 0);
      const sumDelivered = productStats.reduce((s, p) => s + (p.deliveredQty || 0), 0);
      const sumCancelled = productStats.reduce((s, p) => s + (p.cancelledQty || 0), 0);
      const sumProdRev = productStats.reduce((s, p) => s + (p.deliveredRevenue || 0), 0);

      prodRows.push([
        '-',
        txt('TỔNG CỘNG MẶT HÀNG'),
        '-',
        String(sumUndelivered),
        String(sumShipping),
        String(sumDelivered),
        String(sumCancelled),
        txt(formatPrice(sumProdRev)),
        '-'
      ]);

      doc.autoTable({
        head: [prodHeaders],
        body: prodRows,
        startY: prodStartY + 4,
        theme: 'grid',
        styles: { font: fontFamily, fontSize: 8.5, cellPadding: 2.5 },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          font: fontFamily,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'left', cellWidth: 72 },
          2: { halign: 'left', cellWidth: 38 },
          3: { halign: 'center', cellWidth: 22 },
          4: { halign: 'center', cellWidth: 22 },
          5: { halign: 'center', cellWidth: 22 },
          6: { halign: 'center', cellWidth: 20 },
          7: { halign: 'right', cellWidth: 40, fontStyle: 'bold' },
          8: { halign: 'center', cellWidth: 20 }
        },
        didParseCell: function (data) {
          if (data.row.index === prodRows.length - 1) {
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });
    }

    const fileSuffix = fromDate && toDate ? `${fromDate}_den_${toDate}` : `${yearArg}`;
    doc.save(`Bao_Cao_Doanh_Thu_${fileSuffix}.pdf`);
    showToast('Đã tải xuống file Báo Cáo PDF thành công!', 'success');
  } catch (err) {
    console.error('Lỗi xuất PDF thống kê:', err);
    showToast('Không thể tạo file PDF báo cáo!', 'error');
  }
}

export async function exportRevenueStatisticsExcel(statsInput, periodTypeArg, yearArg = new Date().getFullYear()) {
  const payload = normalizeStatsExportInput(statsInput, periodTypeArg, yearArg);
  const { statsData, productStats, ordersInRange, periodType, fromDate, toDate, periodTitle } = payload;

  if (!statsData || statsData.length === 0) {
    showToast('Không có dữ liệu để xuất Excel!', 'error');
    return;
  }

  if (typeof window.ExcelJS === 'undefined') {
    showToast('Chưa nạp thư viện ExcelJS!', 'error');
    return;
  }

  try {
    const workbook = new window.ExcelJS.Workbook();
    workbook.creator = 'Tiệm Hoa Kẽm Nhung Admin';
    workbook.created = new Date();

    const modeTitle = periodType === 'day'
      ? 'THEO NGÀY'
      : (periodType === 'quarter' ? 'THEO QUÝ' : (periodType === 'year' ? 'THEO NĂM' : 'THEO THÁNG'));
    const rangeLabel = periodTitle || (fromDate && toDate ? `${fromDate} đến ${toDate}` : `Năm ${yearArg}`);

    // SHEET 1: DOANH SỐ & DOANH THU THEO KỲ / THEO NGÀY
    const periodSheetName = periodType === 'day' ? 'Doanh_Thu_Theo_Ngay' : 'Doanh_Thu_Theo_Ky';
    const sheet1 = workbook.addWorksheet(periodSheetName);
    sheet1.addRow([`BÁO CÁO DOANH SỐ & DOANH THU (${modeTitle}) — ${rangeLabel}`]);
    sheet1.getRow(1).font = { bold: true, size: 13, color: { argb: 'FF108474' } };
    sheet1.addRow([`Ngày lập: ${new Date().toLocaleString('vi-VN')} | Đơn vị: Tiệm Hoa Kẽm Nhung Handmade`]);
    sheet1.addRow([]);

    const headerRow1 = sheet1.addRow([
      'Kỳ Báo Cáo',
      'Đơn Đặt (GMV)',
      'Doanh Số GMV (VND)',
      'Đơn Hoàn Thành',
      'Doanh Thu Thực Nhận (VND)',
      'Chi Phí Giá Vốn (VND)',
      'Lợi Nhuận Ròng (VND)',
      'Tỷ Suất LN (%)'
    ]);
    headerRow1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow1.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF108474' } };
    });

    let totalGmvOrders = 0;
    let totalGmv = 0;
    let totalOrders = 0;
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;

    statsData.forEach(row => {
      const gmvOrders = Number(row.gmvOrderCount ?? row.orderCount ?? 0);
      const gmv = Number(row.gmv ?? row.revenue ?? 0);
      totalGmvOrders += gmvOrders;
      totalGmv += gmv;
      totalOrders += Number(row.orderCount || 0);
      totalRevenue += Number(row.revenue || 0);
      totalCost += Number(row.cost || 0);
      totalProfit += Number(row.profit || 0);

      const added = sheet1.addRow([
        row.label,
        gmvOrders,
        gmv,
        Number(row.orderCount || 0),
        Number(row.revenue || 0),
        Number(row.cost || 0),
        Number(row.profit || 0),
        `${row.margin || 0}%`
      ]);
      [3, 5, 6, 7].forEach(colIdx => { added.getCell(colIdx).numFmt = '#,##0'; });
    });

    const avgMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
    const totalRow1 = sheet1.addRow([
      'TỔNG CỘNG TOÀN KỲ',
      totalGmvOrders,
      totalGmv,
      totalOrders,
      totalRevenue,
      totalCost,
      totalProfit,
      `${avgMargin}%`
    ]);
    totalRow1.font = { bold: true };
    [3, 5, 6, 7].forEach(colIdx => { totalRow1.getCell(colIdx).numFmt = '#,##0'; });

    sheet1.columns = [
      { width: 28 }, { width: 16 }, { width: 22 }, { width: 18 },
      { width: 24 }, { width: 22 }, { width: 22 }, { width: 15 }
    ];

    // SHEET 2: THỐNG KÊ TỪNG MẶT HÀNG (CHƯA GIAO / ĐANG GIAO / ĐÃ GIAO / DOANH THU)
    const sheet2 = workbook.addWorksheet('Thong_Ke_Mat_Hang');
    sheet2.addRow([`THỐNG KÊ TỪNG MẶT HÀNG (${rangeLabel})`]);
    sheet2.getRow(1).font = { bold: true, size: 13, color: { argb: 'FF108474' } };
    sheet2.addRow([]);

    const headerRow2 = sheet2.addRow([
      'Mã SP',
      'Tên Mẫu Hoa',
      'Danh Mục',
      'Chưa Giao (Chờ/Xác nhận)',
      'Đang Giao',
      'Đã Giao (Hoàn tất)',
      'Đã Hủy',
      'Doanh Thu Trong Kỳ (VND)',
      'Tồn Kho Hiện Tại'
    ]);
    headerRow2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow2.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    });

    let sumUndelivered = 0;
    let sumShipping = 0;
    let sumDelivered = 0;
    let sumCancelled = 0;
    let sumProdRev = 0;

    productStats.forEach(item => {
      sumUndelivered += Number(item.undeliveredQty || 0);
      sumShipping += Number(item.shippingQty || 0);
      sumDelivered += Number(item.deliveredQty || 0);
      sumCancelled += Number(item.cancelledQty || 0);
      sumProdRev += Number(item.deliveredRevenue || 0);

      const added = sheet2.addRow([
        item.productId,
        item.name,
        item.categoryName || 'Hoa Kẽm Nhung',
        Number(item.undeliveredQty || 0),
        Number(item.shippingQty || 0),
        Number(item.deliveredQty || 0),
        Number(item.cancelledQty || 0),
        Number(item.deliveredRevenue || 0),
        Number(item.stock ?? 0)
      ]);
      added.getCell(8).numFmt = '#,##0';
    });

    const totalRow2 = sheet2.addRow([
      '-',
      'TỔNG CỘNG MẶT HÀNG',
      '-',
      sumUndelivered,
      sumShipping,
      sumDelivered,
      sumCancelled,
      sumProdRev,
      '-'
    ]);
    totalRow2.font = { bold: true };
    totalRow2.getCell(8).numFmt = '#,##0';

    sheet2.columns = [
      { width: 14 }, { width: 34 }, { width: 22 }, { width: 22 },
      { width: 14 }, { width: 18 }, { width: 12 }, { width: 24 }, { width: 18 }
    ];

    // SHEET 3: CHI TIẾT ĐƠN HÀNG TRONG KỲ
    const sheet3 = workbook.addWorksheet('Chi_Tiet_Don_Hang');
    sheet3.addRow([`DANH SÁCH ĐƠN HÀNG TRONG KỲ (${rangeLabel})`]);
    sheet3.getRow(1).font = { bold: true, size: 13, color: { argb: 'FF108474' } };
    sheet3.addRow([]);

    const headerRow3 = sheet3.addRow([
      'Mã Đơn',
      'Ngày Đặt',
      'Khách Hàng',
      'Số Điện Thoại',
      'Phương Thức',
      'TT Thanh Toán',
      'Trạng Thái Đơn',
      'Giảm Giá (VND)',
      'Tổng Tiền (VND)'
    ]);
    headerRow3.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow3.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
    });

    (ordersInRange || []).forEach(o => {
      const added = sheet3.addRow([
        `#${o.orderCode || o.id}`,
        o.createdAt ? new Date(o.createdAt).toLocaleString('vi-VN') : '',
        o.customerName || 'Khách Vãng Lai',
        o.phone || o.customerPhone || '--',
        String(o.paymentMethod || 'cod').toUpperCase(),
        o.paymentStatus || 'pending',
        o.status || 'pending',
        Number(o.discountAmount || 0),
        Number(o.totalAmount || 0)
      ]);
      added.getCell(8).numFmt = '#,##0';
      added.getCell(9).numFmt = '#,##0';
    });

    sheet3.columns = [
      { width: 18 }, { width: 22 }, { width: 24 }, { width: 15 },
      { width: 14 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 20 }
    ];

    const fileSuffix = fromDate && toDate ? `${fromDate}_den_${toDate}` : `${yearArg}`;
    await triggerExcelDownload(workbook, `Bao_Cao_Doanh_Thu_${fileSuffix}.xlsx`);
    showToast('Đã tải xuống file Excel 3 sheet Báo Cáo Doanh Thu thành công!', 'success');
  } catch (err) {
    console.error('Lỗi xuất ExcelJS:', err);
    showToast('Không thể xuất file Excel báo cáo!', 'error');
  }
}
