import api from './api.js';

//1.thay form
const registerForm = document.getElementById('registerForm');

// 2. Gắn tai nghe sự kiện khi người dùng nhấn nút Đăng Ký (submit form)
registerForm.addEventListener('submit', function (event) {
    event.preventDefault(); // Chặn hành vi tải lại trang mặc định của form
    registerUser();
});


//
async function registerUser() {
    // lấy tên
    let name = document.getElementById("name").value;// an
    let email = document.getElementById("email").value;// an@gmail.com
    let password = document.getElementById("password").value;// 123456
    let confirmPassword = document.getElementById("confirmPassword").value;// 123456
    // kiểm tra ko rỗng
    if (!name || !email || !password || !confirmPassword) {
        alert("Vui lòng điền đầy đủ thông tin!");
        return;
    }
    // kiểm tra mật khẩu và xác nhận mật khẩu có khớp không
    if (password !== confirmPassword) {
        alert("Mật khẩu và xác nhận mật khẩu không khớp!");
        return;
    }
    // kiểm tra email đã tồn tại có phải là lấy từ api lên đúng
    let response = await api.get("/users", {
        params: {
            email: email
        }
    });
    // response.data là một mảng
    if (response.data.length > 0) {

        alert("Email đã tồn tại!");

        return;
    }
    // Tạo đối tượng user mới
    let newUser = {

        name: name,

        email: email,

        password: password
    };
    // Gửi user lên json-server
    await api.post("/users", newUser);
    // 7. Thông báo
    alert("Đăng ký thành công!");

    // Chuyển sang trang đăng nhập
    window.location.href = "login.html";
}


