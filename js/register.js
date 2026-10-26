import api from './api.js';

// 1. Lấy phần tử form và nút bấm submit từ giao diện HTML
const registerForm = document.getElementById('registerForm');
const submitBtn = document.getElementById('submitBtn');

// 2. Gắn sự kiện submit khi người dùng nhấn nút "Đăng Ký"
registerForm.addEventListener('submit', function (event) {
    event.preventDefault(); // Chặn hành vi tải lại trang mặc định của trình duyệt
    registerUser();
});

// 3. Hàm xử lý logic đăng ký tài khoản mới
async function registerUser() {
    // 3.1 Lấy giá trị từ các ô input và loại bỏ khoảng trắng thừa (.trim())
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // 3.2 Kiểm tra dữ liệu không được để trống (Validation)
    if (!name || !email || !password || !confirmPassword) {
        alert('Vui lòng điền đầy đủ tất cả các trường thông tin!');
        return;
    }

    // 3.3 Kiểm tra độ dài mật khẩu tối thiểu 6 ký tự
    if (password.length < 6) {
        alert('Mật khẩu phải có độ dài tối thiểu từ 6 ký tự trở lên!');
        return;
    }

    // 3.4 Kiểm tra mật khẩu và xác nhận mật khẩu có trùng khớp không
    if (password !== confirmPassword) {
        alert('Mật khẩu và xác nhận mật khẩu không khớp!');
        return;
    }

    // 3.5 Khối try ... catch bọc các thao tác gọi API mạng
    try {
        // Tạm khóa nút submit để tránh người dùng nhấn liên tục (chống spam request)
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Đang xử lý...';
        }

        // Bước 4: Kiểm tra xem Email đã tồn tại trong database chưa (Check Duplicate)
        const checkEmailResponse = await api.get('/users', {
            params: {
                email: email
            }
        });

        // Nếu mảng trả về có phần tử > 0 nghĩa là email này đã có người đăng ký
        if (checkEmailResponse.data.length > 0) {
            alert('Địa chỉ Email này đã được đăng ký, vui lòng sử dụng Email khác hoặc Đăng Nhập!');
            return;
        }

        // Bước 5: Tạo đối tượng người dùng mới (User Object)
        const newUser = {
            name: name,
            email: email,
            password: password,
            role: 'customer', // Phân quyền mặc định là khách hàng
            createdAt: new Date().toISOString() // Thời điểm đăng ký tài khoản
        };

        // Bước 6: Gửi HTTP POST lên server để lưu tài khoản vào db.json
        await api.post('/users', newUser);

        // Bước 7: Thông báo thành công và chuyển hướng về trang Đăng Nhập
        alert('🎉 Đăng ký tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ.');
        window.location.href = 'login.html';

    } catch (error) {
        // Xử lý khi mất kết nối mạng hoặc server json-server gặp sự cố
        console.error('Lỗi khi đăng ký:', error);
        alert('Không thể kết nối đến máy chủ! Vui lòng kiểm tra server (npm run server).');
    } finally {
        // Khôi phục trạng thái nút bấm dù thành công hay thất bại
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Đăng Ký';
        }
    }
}



