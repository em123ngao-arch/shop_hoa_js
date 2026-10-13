import axios from 'axios';
// phương thức lấy dữ liệu từ API, cụ thể là lấy sản phẩm product về
// cấu hình axios
const API_URL = 'http://localhost:3000';
const api = axios.create({
    baseURL: API_URL,
    timeout: 5000
});
// lấy dữ liệu về cần có nơi chứa nó
let allCategories = [];
let allProducts = [];
// phương thức lấy dữ liệu từ API và lưu vào các biến allCategories và allProducts
async function getCategories() {
    try {
        const response = await api.get('/categories');
        allCategories = response.data;
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }

}
// có dữ liệu thì render ra giao diện cho người dùng thấy
function renderCategories(categories) {

    const categoryList = document.querySelector('#categoryList');

    if (!categoryList) return;
    // tạo nơi chứa nhưng danh mục sản phẩm
    categoryList.innerHTML = `
        <button class="category-btn active" data-category="0">
            Tất cả
        </button>
    `
    categories.forEach(category => {
        categoryList.innerHTML += `
            <button class="category-btn" data-category="${category.id}">
                ${category.name}
            </button>
        `
    })

}
// gọi hàm renderCategories khi đã có dữ liệu
getCategories().then(() => {
    renderCategories(allCategories);

});
//  2- hiển thị sản phẩm
// lấy dữ liệu từ api về và đỗ vào biến allProducts
async function getProducts() {
    try {
        const response = await api.get('/products');
        allProducts = response.data;
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}
// hàm định dạng tiền tệ
function formatPrice(price) {
    return Number(price).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
}
/**
 * Định dạng giá tiền theo chuẩn Việt Nam (VND)
 * toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }) 
 * dùng để định dạng số thành chuỗi tiền tệ theo chuẩn Việt Nam (VND)
 * 
 */
// hiển thị trên view
function renderProducts(products) {
    const productList = document.querySelector('#productList');
    if (!productList) return;
    // không có sản phẩm thì hiển thị thông báo
    if (products.length === 0) {
        productList.innerHTML = '<p>Không có sản phẩm nào.</p>';
        return;
    }
    // nhiều sản phẩm thì phải làm mới danh sách sản phẩm
    productList.innerHTML = '';
    // duyệt qua từng sản phẩm và hiển thị
    products.forEach(product => {
        // xây trong producstList
        productList.innerHTML += `
       <div class="product-card">


                <!-- HÌNH ẢNH -->
                <div class="product-image">

                    <img
                        src="${product.image}"
                        alt="${product.name}"
                    >

                </div>

                <!-- THÔNG TIN -->
                <div class="product-info">
                    <h3>
                        ${product.name}
                    </h3>

                    <p class="description">

                        ${product.description || ""}

                    </p>

                    <div class="product-bottom">

                        <!-- GIÁ -->

                        <span class="price">

                            ${formatPrice(product.price)}

                        </span>

                        <!-- THÊM GIỎ -->

                        <button
                            class="add-cart"
                            data-id="${product.id}">

                            + Thêm

                        </button>

                    </div>

                    <!-- XEM CHI TIẾT -->
                    <a
                        href="./product-detail.html?id=${product.id}"
                        class="detail-btn">

                        Xem chi tiết →

                    </a>

                </div>

            </div>
       `
    });
}

getProducts().then(() => {
    renderProducts(allProducts);
});
// thực hiện tìm kiếm
// b1: thấy được thẻ input tên là searchInput
const searchInput = document.querySelector('#searchInput');
if (searchInput) {
    searchInput.addEventListener('input', (event) => {
        const searchTerm = event.target.value.toLowerCase();// lấy giá trị trên input
        if (searchTerm === '') {
            renderProducts(allProducts)
        }
        else {

            const filteredProducts = allProducts.filter(product =>
                product.name.toLowerCase().includes(searchTerm) ||
                (product.description && product.description.toLowerCase().includes(searchTerm))
            );
            renderProducts(filteredProducts);
        }
    });
}
// đăng nhập
const userName=document.getElementById('userName');
// lấy user từ localStorage
const user = JSON.parse(localStorage.getItem('user'));
if(user)
{
    userName.textContent = user.name;
}
