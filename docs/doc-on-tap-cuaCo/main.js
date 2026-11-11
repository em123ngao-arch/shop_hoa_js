/**
 * optional chaining
 * Là cú pháp cho phép truy cập thuộc tính, phần tử hoặc gọi phương thức một cách an toàn
 * khi giá trị đứng trước nó có thể là null hoặc undefined
 * Nếu gặp null hoặc undefined tại vị trí được kiểm tra, JS sẽ dừng việc truy cập tạo đó
 * và trả về undefined thay vì phát sinh lỗi do truy cập thuộc tính của giá trị ko tồn tại
 */
const sanpham={
    ten:"hoa tulip",
    gia:100000
}
const sanpham1=null;
// console.log(sanpham1.ten);
console.log(sanpham1?.ten);
/**
 * Nếu sản phẩm 1 là đối tượng hợp lệ, truy cập thuộc tính là tên
 * Nếu sản phẩm 1 là null hoặc undefined, trả về undefined
 * Không phát sinh lỗi khi truy cập thuộc tính của giá trị null hoặc undefined
 */

console.log(sanpham.ten);
console.log(sanpham.gia);
console.log(sanpham.image);
// ví dụ 2
const sinhVien={
    masv:"SV001",
    hoten:"Nguyễn Văn An",
    diachi:{
        tinh:"TPHCM",
        phuong:"Phường tân phú"
    }
}
// lấy tên tinh
console.log(sinhVien.diachi.tinh);
console.log(sinhVien.diachi?.tinh);
// nếu diachi là null hoặc undefined, truy cập tinh sẽ không phát sinh lỗi mà trả về undefined
console.log(sinhVien?.diachi?.tinh);
// optinal chaining với mảng
// cú pháp mang?.[vị trí]
const mang = [1, 2, 3];
console.log(mang?.[0]); // 1
console.log(mang?.[5]); // undefined
const mang1 = null;
console.log(mang1?.[0]); // undefined
const sanpham2={
    ten:"hoa hồng",
    gia:200000,
    hinhanh:[
        "hinhanh1.jpg",
        "hinhanh2.jpg"
    ]
}
console.log(sanpham2.hinhanh?.[3]); // undefined
// optional chaining với phương thức
const noidung={
    hoten: "Nguyễn Văn An",
    xinChao(){
        console.log(`Xin chào, tôi là ${this.hoten}`);
    }
}
console.log(noidung?.xinChao?.()); // Xin chào, tôi là Nguyễn Văn An
/**
 * NULLISH COALESCING OPERATOR (??)
 * là toán tử cho phép cung cấp giá trị mặc định khi biểu thức bên trái là null hoặc undefined
 * Cú pháp: biểu_thức_bên_trái ?? giá_trị_mặc_định
 * + Nếu giá trị là null lấy giá trị mặc định
 * + Nếu giá trị là undefined lấy giá trị mặc định
 * +Nếu giá trị là bất kỳ giá trị nào khác là null hoặc undefined, giữ nguyên giá trị đó
 */
 const name="Nguyễn văn Bình";
 const ketqua = name ?? "Giá trị mặc định";
 console.log(ketqua);
 const ten1=null;
 const ketqua1 = ten1 ?? "Giá trị mặc định";
 console.log(ketqua1);
 /**
  * ĐIểm khác biệt giữa ?? và || là ?? 
  * chỉ kiểm tra null hoặc undefined, 
  * trong khi || kiểm tra tất cả giá trị bên phải là falsy 
  * Các giá trị falsy 
  * + false
  * + 0
  * + ""
  * + null
  * + undefined
  */
 const soluong=0;
 console.log(soluong ?? "Giá trị mặc định"); // 0
 console.log(soluong || 10); // Giá trị mặc định
 /**
  * Kết hợp giữa optional chaining và nullish coalescing operator
  * giúp truy cập thuộc tính an toàn và cung cấp giá trị mặc định khi gặp null hoặc undefined
  */
 const sanpham3 = null;
 console.log(sanpham3?.ten ?? "Tên sản phẩm mặc định"); // Tên sản phẩm mặc định
  /**
   * Hai cú pháp này sẽ giúp code JS ngắn gọn hơn và an toàn hơn, đặc biệt khi
   * làm việc với object lồng nhau, mảng và dữ liệu API
   */