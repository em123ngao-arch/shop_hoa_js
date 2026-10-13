import axios from "axios";
// const axios = require("axios");
const API_URL = 'http://localhost:3000';
const api = axios.create({
    baseURL: API_URL,
    timeout: 5000
});

// thấy được form
const registerForm=document.getElementById("registerForm");
// form lắng nghe thông qua khi người dùng submit
registerForm.addEventListener("submit", function(event) {
    event.preventDefault();
    // xử lý đăng ký ở đây
    registerUser();
});

// phương thức bất đồng bộ
async function registerUser() {
    // lấy tên
    let name=document.getElementById("name").value;// an
    let email=document.getElementById("email").value;// an@gmail.com
    let password=document.getElementById("password").value;// 123456
    let confirmPassword=document.getElementById("confirmPassword").value;// 123456
    // kiểm tra ko rỗng
    if(!name || !email || !password || !confirmPassword) {
        alert("Vui lòng điền đầy đủ thông tin!");
        return;
    }
    // kiểm tra mật khẩu và xác nhận mật khẩu có khớp không
    if(password !== confirmPassword) {
        alert("Mật khẩu và xác nhận mật khẩu không khớp!");
        return;
    }
    // kiểm tra email đã tồn tại có phải là lấy từ api lên đúng
     let response = await api.get("/user", {
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
    await api.post("/user", newUser);
    // 7. Thông báo
    alert("Đăng ký thành công!");

    // Chuyển sang trang đăng nhập
    window.location.href = "index.html";
}