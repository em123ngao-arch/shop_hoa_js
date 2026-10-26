import api from './api.js';

// để cho nos tim thay form 
const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', function (even) {
    even.preventDefault();
    login();
});

// 3.Viết hàm login 
async function login() {
    //3.1. post value
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    //3.2 check not empty
    if (!email || !password) {
        alert("you must input email and password ")
        return;

    }

    //4 respont api backend to find matching user ... credenci
    try {
        const respont = await api.get('/users', {
            params: {
                email: email,
                password: password
            }
        });
        // get data main
        const users = respont.data;

        //check data co ton tai k
        if (users.length === 0) {
            alert('email or password k ton tai ')
            return
        }
        const user = users[0];
        localStorage.setItem('user', JSON.stringify(user))
        alert(`xin chao ${user.email || user.name}`)
        window.location.href = 'index.html';
    } catch (error) {
        console.log("error")
        alert('not conecting server')
    }
}