import api from './api.js';

// để cho nos tim thay form 
const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', function (even) {
    even.preventDefault();
});

// 3.Viết hàm login 
async function login() {
    //3.1. post value
    const email = document.getElementById('email').trim();
    const password = document.getElementById('password');

    //3.2 check not empty
    if (!email || !password) {
        alert("you must input email and password ")
        return;

    }

    // ham

}