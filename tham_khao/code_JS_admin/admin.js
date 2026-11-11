const API_URL = "http://localhost:3000";

// 1: lấy các phần tử DOM
const form = document.getElementById("productForm");
const productList = document.getElementById("productList");
const categorySelect = document.getElementById("categoryId");
const submitBtn = document.getElementById("submitBtn");
const cancelBtn = document.getElementById("cancelBtn");
const preView = document.getElementById("preview");
const imageInput = document.getElementById("image");
const pagination = document.getElementById("pagination");
// Lấy dữ liệu từ database về thì nơi chứa nó và đem nó lên giao diện
const products = [];
const categories = [];
let currentPage = 1;
let pageSize = 5; // Số sản phẩm trên mỗi trang (bạn có thể đổi thành 10 tùy thầy cô)

// 3: lấy danh mục sản phẩm về
async function loadCategories() {
  try {
    const response = await axios.get(`${API_URL}/categories`);
    categories.length = 0;
    categories.push(...response.data);
    categorySelect.innerHTML = "";
    // tạo option mặc định "Chọn danh mục" và thêm vào select trước khi thêm các option khác
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Chọn danh mục";
    placeholder.disabled = true;
    placeholder.selected = true;
    categorySelect.appendChild(placeholder);
    // tạo mấy option? nhiều, cụ thể phụ thuộc vào mảng của mình
    categories.forEach((category) => {
      const option = document.createElement("option");
      // lưu id
      option.value = category.id;
      // hiển thị là tên
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}

loadCategories();

// lấy sản phẩm về
async function loadProducts() {
  try {
    const response = await axios.get(`${API_URL}/products`);

    // cập nhật mảng sản phẩm, tránh bị lặp dữ liệu
    products.length = 0;
    products.push(...response.data);

    // 2. Tính tổng số trang
    const totalPages = Math.ceil(products.length / pageSize);
    // 3. ràng buộc nếu số trang hiện tại lớn totalPage
    if (currentPage > totalPages) {
      currentPage = Math.max(1, totalPages);
    }
    //4tìm vị trí bắt đầu của mỗi trang: page(bắt đầu, ketthuc)
    const startIndex = (currentPage - 1) * pageSize;
    //5. tìm kết thúc
    const pageProduct = products.slice(startIndex, startIndex + pageSize);
    // làm mới danh sách sản phẩm trên giao diện
    productList.innerHTML = "";
    //duyệt qua mảng của mình
    pageProduct.forEach((product) => {
      // hiển thị thông tin tên danh mục chứ ko phải là mã danh mục
      const cat = categories.find((c) => c.id === product.categoryId);
      // nếu là true thì đã bán
      const statusText = product.status ? "Đã bán" : "Chưa bán";
      // tạo dòng
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${product.id}</td>
        <td><img src="${product.image}" alt="${product.name}"></td>
        <td>${product.name}</td>
        <td>${product.price}đ</td>
        <td>${cat ? cat.name : "Chưa phân loại"}</td>
        <td>${statusText}</td>
        <td>
          <button class="editBtn" data-id="${product.id}">Sửa</button>
          <button class="deleteBtn" data-id="${product.id}">Xóa</button>
        </td>
      `;
      productList.appendChild(tr);
    });

    // hiển thị các nút phân trang
    renderProductPage(totalPages);
  } catch (error) {
    console.error("Error loading products:", error);
  }
}

loadProducts();

// hiển thị số trang ra
function renderProductPage(totalPages) {
  if (!pagination) return;
  pagination.innerHTML = "";

  // Tạo nút Trước
  const preBtn = document.createElement("button");
  preBtn.textContent = "Trước";
  // nếu đầu tiên trang hiện tại ==1 thì ẩn đi
  preBtn.disabled = currentPage === 1;
  preBtn.addEventListener("click", async () => {
    if (currentPage > 1) {
      currentPage--;
      await loadProducts();
    }
  });
  pagination.appendChild(preBtn);

  // duyệt qua từng trang để tạo nút
  for (let i = 1; i <= totalPages; i++) {
    // tạo nút
    const button = document.createElement("button");
    button.textContent = i;
    if (i === currentPage) {
      button.classList.add("active");
    }
    button.addEventListener("click", async () => {
      currentPage = i;
      // clik là load lại sản phẩm
      await loadProducts();
    });
    pagination.appendChild(button);
  }

  // tạo nút tới
  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Sau";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.addEventListener("click", async () => {
    if (currentPage < totalPages) {
      currentPage++;
      await loadProducts();
    }
  });
  pagination.appendChild(nextBtn);
}

// phương thức xóa
async function deleteProduct(id) {
  // confirm trước khi xóa
  if (!confirm("Bạn có chắc muốn xóa hay không?")) return;
  try {
    await axios.delete(`${API_URL}/products/${id}`);
    // sau khi xóa thì phải load lại danh sách sản phẩm
    await loadProducts();
  } catch (error) {
    console.error("Error loading products:", error);
  }
}

// phương thức update
async function editProduct(id) {
  // lấy thông tin sản phẩm đổ lên lại thông tin trên form
  updateForm(id);
}

// phương thức đổ dữ liệu lên form khi sửa sản phẩm
function updateForm(id) {
  // với id tìm ra được sản phẩm
  const sanpham = products.find((p) => p.id == id);
  // thấy được các thẻ input trên form
  if (!sanpham) return;
  document.querySelector("#productId").value = sanpham.id;
  document.querySelector("#name").value = sanpham.name;
  document.querySelector("#price").value = sanpham.price;
  // document.querySelector("#productImage").value = sanpham.image;
  (document.querySelector("#productCategory") || document.querySelector("#categoryId")).value = sanpham.categoryId;
  (document.querySelector("#productStatus") || document.querySelector("#status")).checked = sanpham.status;
}

// gắn tai nghe cho sự kiện xóa và sửa
productList.addEventListener("click", async (event) => {
  if (event.target.classList.contains("deleteBtn")) {
    const id = event.target.dataset.id; //16
    await deleteProduct(id);
  }
  if (event.target.classList.contains("editBtn")) {
    const id = event.target.dataset.id;
    editProduct(id);
  }
});

// thực hiện phương thức thêm
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  // thực hiện thêm hoặc cập nhật sản phẩm ở đây
  // lấy giá trị input name
  const name = document.querySelector("#name").value;
  const price = document.querySelector("#price").value;
  const categoryId = document.querySelector("#categoryId").value;
  const imageFile = document.querySelector("#imageFile").files[0];
  const description = document.querySelector("#description").value;
  const status = document.querySelector("#status").checked;
  // tạo object
  const product = {
    name: name,
    price: price,
    categoryId: categoryId,
    imageFile: "image/" + imageFile.name,
    description: description,
    status: status
  };

  // kiểm tra có id hay không
  const id = document.querySelector("#productId").value;
  if (id) {
    // cập nhật sản phẩm
    const oldProduct = { ...product, id: id };
    await axios.put(`http://localhost:3000/products/${id}`, oldProduct);
    await loadProducts();
  } else {
    // thêm sản phẩm mới
    await addProduct(product);
  }
});

// phương thức thêm sản phẩm mới
async function addProduct(product) {
  try {
    await axios.post(`${API_URL}/products`, product);
    await loadProducts();
  } catch (error) {
    console.error("Error adding product:", error);
  }
}

// b1: Lấy nút xuất Excel từ HTML
const exportExcelBtn = document.getElementById("exportExcelBtn");

// b2: lắng nghe sự kiện click
exportExcelBtn.addEventListener("click", async function() {
  await exportExcel();
});

// Bước 3: viết hàm xuất excel
async function exportExcel() {
  try {
    // lấy danh sách sản phẩm từ jsonserver
    const reponse = await axios.get(`${API_URL}/products`);
    const productData = reponse.data;

    // kiểm tra xem danh sách  sản phẩm có hay không
    if (productData.length === 0) {
      alert("Ko có sản phẩm xuất ra Excel");
      return;
    }

    // lấy danh sách danh mục từ json server
    const cateloryReponse = await axios.get(`${API_URL}/categories`);
    const categoryData = cateloryReponse.data;

    // lấy về dạng json, chuyển đổi dữ liệu sản phẩm thành dữ liệu phù hợp để xuất ra file Excel
    const excelData = productData.map((product, index) => {
      // tìm tên danh mục theo Category
      const category = categoryData.find((cat) => cat.id == product.categoryId);

      return {
        "STT": index + 1,
        "Mã sản phẩm": product.id,
        "Tên sản phẩm": product.name,
        "Giá": product.price,
        "Danh mục": category ? category.name : "Không xác định",
        "Mô tả": product.description || "",
        "Trạng thái": product.status ? "Đang bán" : "Ngừng bán",
        "Đường link hình": product.image || ""
      };
    });

    // Tạo worksheet từ mảng dữ liệu JSON
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Tạo workbook mới và gắn worksheet vào
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Danh sách sản phẩm"
    );

    // thiết lập độ rộng của mỗi cột
    worksheet["!cols"] = [
      { wch: 8 },  // STT
      { wch: 15 }, // Mã sản phẩm
      { wch: 30 }, // Tên sản phẩm
      { wch: 18 }, // Giá
      { wch: 25 }, // Danh mục
      { wch: 40 }, // mô tả
      { wch: 18 }, // Trạng thái
      { wch: 40 }  // đường link hình
    ];

    // xuất và tải file excel
    XLSX.writeFile(workbook, "DanhSachSanPham.xlsx");
  } catch (error) {
    console.error("Lỗi xuất file Excel:", error);
    alert("Có lỗi khi xuất Excel!");
  }
}
