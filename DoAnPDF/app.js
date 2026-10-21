// địa chỉ của JSON Server

const API_URL = "http://localhost:3000/sanpham";
// lấy danh sách các sản phẩm
const danhSachSanPham = document.getElementById("danhSachSanPham");
// lấy btn tải dữ liệu
const btnTaiDuLieu = document.getElementById("btnTaiDuLieu");
// lấy btn xuất PDF
const btnXuatPDF = document.getElementById("btnXuatPDF");
// lấy thông báo
const thongBao = document.getElementById("thongBao");
// tạo ra mảng chứa ds các sản phẩm 
let danhSach = [];
// định dạng tiền tệ
function dinhDangTienTe(gia) {
    return Number(gia).toLocaleString("vi-VN", { style: "currency", currency: "VND" });
}
// lấy dữ liệu từ api về
async function layDanhSachSanPham() {
    try {
        thongBao.textContent = "Đang tải dữ liệu...";
        // gọi API để lấy danh sách sản phẩm
        const response = await axios.get(API_URL);
        // lấy dữ liệu từ response
        danhSach = response.data;
        hienthiSanPham(danhSach);
        thongBao.textContent = "Đã tải dữ liệu thành công.";
    } catch (error) {
        thongBao.textContent = "Lỗi khi tải dữ liệu: " + error.message;
    }
}
// hiển thị sản phẩm`
function hienthiSanPham(ds) {
    // danh sách luôn làm mới
    danhSachSanPham.innerHTML = "";
    // kiểm tra
    if (ds.length === 0) {
        danhSachSanPham.innerHTML = `
        <tr>
            <td colspan="5">Không có sản phẩm nào</td>
        </tr>`
    }
    else {
        ds.forEach((sp, index) => {
            // tạo dòng
            const tr = document.createElement("tr");
            // trong dòng có ô, tạo ô là số tt
            const tdSTT = document.createElement("td");
            tdSTT.textContent = index + 1;
            // tạo ô tên sản phẩm
            const tdTen = document.createElement("td");
            tdTen.textContent = sp.ten;
            // tạo ô loại
            const tdLoai = document.createElement("td");
            tdLoai.textContent = sp.loai;
            // tạo gia
            const tdGia = document.createElement("td");
            tdGia.textContent = dinhDangTienTe(sp.gia);
            // tạo ô số lượng
            const tdSoLuong = document.createElement("td");
            tdSoLuong.textContent = sp.soluong;
            // ô(td) thuộc về tr
            tr.append(tdSTT, tdTen, tdLoai, tdGia, tdSoLuong);
            // thêm dòng (tr) vào bảng(table)
            danhSachSanPham.appendChild(tr);

        })
    }
}
// phương thức xuất file PDF
async function xuatPDF() {
    // console.log("Bắt đầu xuất PDF");
    try {
        // nếu ko có dữ liệu thì thông báo
        if (danhSach.length === 0) {
            thongBao.textContent = "Không có sản phẩm để xuất PDF.";
            return;
        }
        // xuất PDF ở đây
        btnXuatPDF.disabled = true; // vô hiệu hóa nút xuất PDF trong khi xử lý
        thongBao.textContent = "Đang xuất PDF...";
        // lớp jsPDF để tạo PDF, đây là lớp có sẵn khi cài đặt thư viện jsPDF
        // lấy constructor của jsPDF
        const { jsPDF } = window.jspdf;
        // tạo file pdf mới
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm", // đơn vị đo lường trong PDF
            format: "a4" // định dạng giấy A4, có thể định dạng khác như "letter" hoặc a5...
        });
        // thuộc tính tiêu đề
        doc.setFontSize(18);
        // cú pháp doc.text(text, x, y, options)
        /**
         * x là tọa độ ngang (theo chiều rộng) của văn bản trên trang PDF
         * y là tọa độ dọc (theo chiều cao) của văn bản trên trang PDF
         * options là các tùy chọn bổ sung, ví dụ: { align: "center" } để căn giữa văn bản
         */
        doc.text("Danh sách sản phẩm", 105, 20, { align: "center" });
        // 105 là tọa độ x để căn giữa trang A4 (chiều rộng 210mm)
        // 20 là tọa độ y để đặt tiêu đề cách mép trên 20mm
        // ngày xuất
        const ngayHienTai = new Date().toLocaleDateString("vi-VN");
        doc.setFontSize(11);
        doc.text(`Ngày xuất: ${ngayHienTai}`, 105, 30, { align: "center" });
        // định xuất ra dạng bảng trên pdf
        // chuẩn bị dữ liệu cho bảng
        const headers = ["STT", "Tên sản phẩm", "Loại", "Giá", "Số lượng"];
        // bảng phải có dòng 
        const rows = danhSach.map((sp, index) => [
            index + 1,
            sp.ten,
            sp.loai,
            dinhDangTienTe(sp.gia),
            sp.soluong
        ]);
        // sử dụng autoTable để xuất bảng
        // cú pháp của autoTable: doc.autoTable({ head: [headers], body: rows, startY: 40 });
        //startY là tọa độ y bắt đầu vẽ bảng trên trang PDF
        doc.autoTable({
            head: [headers],
            body: rows,
            startY: 40
        });
        // tải dữ liệu về máy tính
        doc.save("Danh_sach_san_pham.pdf"); // tải file PDF về máy tính

    } catch (error) {
        console.error("Lỗi khi xuất PDF:", error);
        thongBao.textContent = "Có lỗi xảy ra khi xuất PDF.";
    } finally {
        btnXuatPDF.disabled = false; // luôn bật lại nút xuất PDF sau khi xử lý xong
    }
}
layDanhSachSanPham();
// phương thức xuất pDF được gọi khi người dùng nhấn nút
btnXuatPDF.addEventListener("click", xuatPDF);

const btnImportExcel = document.getElementById('btnImportExcel');
const fileExcel = document.getElementById('fileExcel');

async function importExcel(){
    try{
        //lay file duoi dang arrayBuffer

    }catch(err){
        
    }
}
