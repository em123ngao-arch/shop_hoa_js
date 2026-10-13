import axios from "axios";
const API_URL = 'http://localhost:3000';
const api = axios.create({
    baseURL: API_URL,
    timeout: 5000
});
// thấy đc form
const loginForm = document.getElementById("loginForm");
// gắn tai nghe
loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    login();
});
// viết hàm login
async function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    // kiểm tra user và password ko trống
    if (!username || !password) {
        alert("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu");
        return;
    }
    let reponse = await api.get('/user', {
        params: {
            name: username,
            password: password
        }
    }); 
   let users = reponse.data;// mảng các user thỏa mãn điều kien lấy về
//    console.log(users);
   if(users.length===0){
    alert("User name hoặc mật khẩu không thành công");
    return;
   }
   let user=users[0];// vì chỉ trả 1 đối tượng thỏa đk, mảng chứa 1 đối tượng ở vị trí thứ 0
   // lưu trạng thái xuống localstorage
   localStorage.setItem("user", JSON.stringify(user));
   alert("Đăng nhập thành công");
   window.location.href = "index.html";
}
