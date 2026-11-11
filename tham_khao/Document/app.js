// Cấu hình định danh sản phẩm mẫu và địa chỉ API cùng origin với trang web.
const PRODUCT_ID = 1;
const api = axios.create({ baseURL: "/" });

// Lưu trạng thái đăng nhập ở trình duyệt; đây chỉ là phiên mẫu, không thay thế xác thực phía máy chủ.
const elements = {
  productImage: document.querySelector("#product-image"),
  productName: document.querySelector("#product-name"),
  productDescription: document.querySelector("#product-description"),
  productPrice: document.querySelector("#product-price"),
  productRating: document.querySelector("#product-rating"),
  loginForm: document.querySelector("#login-form"),
  loginEmail: document.querySelector("#login-email"),
  loginPassword: document.querySelector("#login-password"),
  accountSession: document.querySelector("#account-session"),
  welcomeMessage: document.querySelector("#welcome-message"),
  logoutButton: document.querySelector("#logout-button"),
  accountMessage: document.querySelector("#account-message"),
  reviewForm: document.querySelector("#review-form"),
  reviewLoginHint: document.querySelector("#review-login-hint"),
  reviewComment: document.querySelector("#review-comment"),
  reviewSubmit: document.querySelector("#review-submit"),
  reviewMessage: document.querySelector("#review-message"),
  reviewCount: document.querySelector("#review-count"),
  reviewsList: document.querySelector("#reviews-list"),
};

let currentUser = readSavedUser();
let product = null;

// Читаем сессию без хранения пароля и сообщаем пользователю, если данные браузера повреждены.
function readSavedUser() {
  const savedUser = localStorage.getItem("sample-review-user");
  if (!savedUser) return null;

  try {
    const user = JSON.parse(savedUser);
    if (user && Number.isInteger(user.id) && typeof user.name === "string") {
      return user;
    }
  } catch (error) {
    console.error("Không thể đọc phiên đăng nhập đã lưu:", error);
    elements.accountMessage.textContent = "Phiên đăng nhập bị lỗi. Vui lòng đăng nhập lại.";
  }

  localStorage.removeItem("sample-review-user");
  return null;
}

// Chèn dữ liệu từ JSON vào HTML an toàn, tránh diễn giải tên/bình luận thành mã HTML.
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

// Định dạng giá theo tiền Việt và ngày giờ theo ngôn ngữ tiếng Việt.
function formatPrice(price) {
  return new Intl.NumberFormat("vi-VN").format(Number(price)) + " đ";
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Vừa xong";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

// Tải sản phẩm và các nhận xét hiện có từ JSON Server.
async function loadPageData() {
  try {
    const [productResponse, reviewsResponse] = await Promise.all([
      api.get(`/products/${PRODUCT_ID}`),
      api.get("/reviews", {
        params: {
          productId: PRODUCT_ID,
          _sort: "createdAt",
          _order: "desc",
        },
      }),
    ]);

    product = productResponse.data;
    renderProduct(product, reviewsResponse.data);
    renderReviews(reviewsResponse.data);
  } catch (error) {
    console.error("Không thể tải dữ liệu sản phẩm:", error);
    elements.productName.textContent = "Không tải được sản phẩm";
    elements.reviewsList.innerHTML =
      '<p class="muted">Không thể tải dữ liệu. Hãy kiểm tra JSON Server đang chạy.</p>';
  }
}

// Hiển thị sản phẩm; khi chưa có đánh giá mới, điểm số dùng rating trong db.json.
function renderProduct(productData, reviews) {
  elements.productName.textContent = productData.name;
  elements.productDescription.textContent = productData.description;
  elements.productPrice.textContent = formatPrice(productData.price);
  elements.productImage.src = productData.image;
  elements.productImage.alt = productData.name;

  // PHẦN RATING: tính điểm trung bình từ nhận xét mới; nếu chưa có thì dùng rating gốc trong db.json.
  const reviewAverage = reviews.length
    ? reviews.reduce((total, review) => total + Number(review.rating), 0) / reviews.length
    : Number(productData.rating);
  elements.productRating.textContent =
    `★ ${reviewAverage.toFixed(1)} · ${reviews.length} đánh giá mới`;
}

// Chuyển phần giao diện đăng nhập và form đánh giá theo trạng thái người dùng.
function renderAccount() {
  const isLoggedIn = Boolean(currentUser);
  elements.loginForm.hidden = isLoggedIn;
  elements.accountSession.hidden = !isLoggedIn;
  elements.reviewForm.hidden = !isLoggedIn;
  elements.reviewLoginHint.hidden = isLoggedIn;

  if (isLoggedIn) {
    elements.welcomeMessage.textContent = `Xin chào, ${currentUser.name}!`;
  }
}

// Vẽ các nhận xét và số lượng sao; escapeHTML bảo vệ nội dung do người dùng nhập.
function renderReviews(reviews) {
  elements.reviewCount.textContent = `${reviews.length} nhận xét`;

  if (!reviews.length) {
    elements.reviewsList.innerHTML =
      '<p class="muted">Chưa có nhận xét nào. Hãy là người đầu tiên đánh giá nhé!</p>';
    return;
  }

  elements.reviewsList.innerHTML = reviews
    .map((review) => {
      // PHẦN RATING: đổi số sao trong dữ liệu thành chuỗi sao để hiển thị.
      const rating = Math.min(5, Math.max(1, Number(review.rating)));
      const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
      // PHẦN COMMENT: đưa tên, nội dung và ngày viết nhận xét ra danh sách.
      return `
        <article class="review-item">
          <div class="review-item-header">
            <p class="review-author">${escapeHTML(review.userName)}</p>
            <span class="review-stars" aria-label="${rating} trên 5 sao">${stars}</span>
          </div>
          <p class="review-comment">${escapeHTML(review.comment)}</p>
          <time class="review-date" datetime="${escapeHTML(review.createdAt)}">
            ${escapeHTML(formatDate(review.createdAt))}
          </time>
        </article>
      `;
    })
    .join("");
}

// Đăng nhập bằng email và mật khẩu mẫu trong collection user của db.json.
elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.accountMessage.textContent = "";

  const email = elements.loginEmail.value.trim();
  const password = elements.loginPassword.value;

  try {
    const response = await api.get("/user", { params: { email } });
    const matchedUser = response.data.find((user) => user.password === password);

    if (!matchedUser) {
      elements.accountMessage.textContent = "Email hoặc mật khẩu không đúng.";
      return;
    }

    currentUser = { id: matchedUser.id, name: matchedUser.name, email: matchedUser.email };
    localStorage.setItem("sample-review-user", JSON.stringify(currentUser));
    elements.loginForm.reset();
    renderAccount();
  } catch (error) {
    console.error("Đăng nhập thất bại:", error);
    elements.accountMessage.textContent = "Không thể đăng nhập. Hãy kiểm tra JSON Server.";
  }
});

// Đăng xuất khỏi giao diện mẫu và xóa thông tin phiên đã lưu.
elements.logoutButton.addEventListener("click", () => {
  currentUser = null;
  localStorage.removeItem("sample-review-user");
  elements.accountMessage.textContent = "";
  elements.reviewMessage.textContent = "";
  renderAccount();
});

// Gửi điểm sao và bình luận lên collection reviews để JSON Server ghi vào db.json.
elements.reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.reviewMessage.textContent = "";

  if (!currentUser || !product) {
    elements.reviewMessage.textContent = "Vui lòng đăng nhập trước khi gửi đánh giá.";
    return;
  }

  // PHẦN RATING: lấy lựa chọn 1-5 sao từ các radio name="rating" trong index.html.
  const formData = new FormData(elements.reviewForm);
  const rating = Number(formData.get("rating"));
  // PHẦN COMMENT: lấy nội dung đã nhập trong ô #review-comment.
  const comment = elements.reviewComment.value.trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment) {
    elements.reviewMessage.textContent = "Hãy chọn số sao và nhập bình luận.";
    return;
  }

  elements.reviewSubmit.disabled = true;
  try {
    // Lưu rating và comment cùng thông tin người dùng/sản phẩm vào collection reviews.
    await api.post("/reviews", {
      productId: PRODUCT_ID,
      userId: currentUser.id,
      userName: currentUser.name,
      rating,
      comment,
      createdAt: new Date().toISOString(),
    });

    elements.reviewForm.reset();
    elements.reviewMessage.textContent = "Đã gửi đánh giá thành công!";
    await loadPageData();
  } catch (error) {
    console.error("Không thể gửi đánh giá:", error);
    elements.reviewMessage.textContent = "Gửi đánh giá thất bại. Hãy thử lại.";
  } finally {
    elements.reviewSubmit.disabled = false;
  }
});

// Khởi tạo giao diện, khôi phục phiên mẫu và tải sản phẩm cùng danh sách nhận xét.
renderAccount();
loadPageData();
/**
 * Vẽ workflow ở định dạng markdown cho một sample đơn giản của một web application
 * Export software architecture design ra file .md
 * Trong quá trình phát triển web application, có thể theo trình tự:
 * 1- Phân tích yêu cầu (Requirements Analysis)
 * 2- Xác định chức năng (Feature Identification)
 * 3- Vẽ workflow cho từng chức năng (Workflow Diagram)
 * 4- Thiết kế kiến trúc phần mềm (Software Architecture Design)
 * 5- Thiết kế database
 * 6- Thiết kế API
 * 7- Lập trình Frontend và Backend
 * 8- Kiểm thử (Testing)
 * Mardown là một ngôn ngữ đánh dấu (Makup Language) đơn giản, dễ đọc và dễ viết,
 *  thường được sử dụng để tạo tài liệu, 
 * ghi chú, blog, README file, v.v.
 *  Nó cho phép người dùng định dạng văn bản bằng cách sử dụng 
 * các ký tự đặc biệt như #, *, -, >, v.v. 
 * để tạo tiêu đề, danh sách, liên kết, hình ảnh, trích dẫn, v.v.
 * bài tập:
 * 1. README.md: Giới thiệu đề tài
 * 2. workflow.md: Vẽ workflow cho từng chức năng
 * 3. Database.md: Thiết kế database
 * 4. API_DOCUMENT.md: Thiết kế API
 * 5.software_architecture_design.md: Thiết kế kiến trúc phần mềm
 * --PHÂN TÍCH YÊU CẦU (REQUIREMENTS ANALYSIS)--
 * là quá trình thu thập, phân tích và xác định các yêu cầu mà hệ thống phần mềm cần đáp ứng
 * Ví dụ: Khách hàng yêu cầu xây dựng website bán hàng
 * Lập trình viên cần tìm hiểu cái gì?
 * + website bán hàng có những chức năng gì?
 * + Ai sử dụng website? Khách hàng, nhân viên, quản trị viên?
 * + Khách hàng có thể xem sản phẩm, đặt hàng, thanh toán, đánh giá sản phẩm
 * + Khách hàng có được đặt hàng không cần đăng nhâp không? Có cần xác thực email không?
 * + Nhân viên có thể quản lý sản phẩm, đơn hàng, khách hàng, đánh giá sản phẩm
 * + Quản trị viên có thể quản lý nhân viên, phân quyền cho nhân viên
 * + Có thanh toán trực tuyến không? Có cần tích hợp với cổng thanh toán không?
 * + Có cần tích hợp với các dịch vụ vận chuyển không?
 * + Có cần tích hợp với các dịch vụ marketing không?
 * + có cần tích hợp với các dịch vụ báo cáo, thống kê không?
 * + có tích hợp AI hay không? Nếu có thì tích hợp AI vào chức năng nào? Chatbot, gợi ý sản phẩm, phân tích dữ liệu khách hàng?
 * + có cần tích hợp báo cáo về excel hay không
 * + Cần có biểu mẫu nào
 * 2- Phân tích yêu cầu gồm nhưng gì?
 * Thường có 2 nhóm
 * 2.1 Functional Requirements: Các yêu cầu chức năng, mô tả các hành vi, chức năng mà hệ thống cần thực hiện. Ví dụ: người dùng có thể đăng nhập, đăng ký, xem sản phẩm, đặt hàng, thanh toán, đánh giá sản phẩm.
 * + Mô tả hệ thống phải làm được nhưng gì?
 * Ví dụ:
 *  - Đăng ký tài khoản người dùng
 *  - Đăng nhập tài khoản người dùng
 * - Đăng xuất tài khoản người dùng
 * - Xem thông tin người dùng
 * - Quản lý sản phẩm
 * - tìm kiếm sản phẩm
 * - Thêm vào giỏ hàng
 * - Đặt hàng và thanh toán
 * 2.2 Non function requiments: yêu cầu phi chức năng, mô tả các thuộc tính, đặc điểm mà hệ thống cần đáp ứng. Ví dụ: hiệu suất, bảo mật, khả năng mở rộng, khả năng sử dụng, khả năng bảo trì.
 * + Mô tả hệ thống cần đáp ứng nhưng tiêu chí chất lượng nào
 * ví dụ:
 * - Hệ thống phải có khả năng xử lý 1000 yêu cầu mỗi giây
 * - Tốc độ tải trang nhanh
 * - Boả mật thông tin người dùng
 * - Dữ liệu được mã hóa khi truyền qua mạng
 * - Hệ thống phải có khả năng mở rộng khi số lượng người dùng tăng
 * - Giao diện thân thiện
 * - Hỗ trợ nhiều ngôn ngữ
 * - Hỗ trợ nhiều thiết bị, như máy tính, điện thoại, máy tính bảng
 * - Hỗ trợ nhiều trình duyệt
 * 3- Phân tích yêu cầu nằm ở đâu trong quy trình phát triển phần mềm?
 * 3.1- Phân tích yêu cầu
 * 3.2- Thiết kế kiến trúc phần mềm
 * 3.3 Lập trình
 * 3.4 Kiểm thử
 * 3.5 Deployment
 * 3.6 Bảo trì
 * Đây là mô hình SDLC (Software Development Life Cycle) 
 * hay còn gọi là vòng đời phát triển phần mềm. 
 * Với Agile, các bước này có thể lặp lại nhiều lần trong các sprint.
 * 4- Sau khi phân tích yêu cầu thì tạo ra sản phẩm gì?
 * Thông thường, lập trình viên hoặc BA(Business Analyst)
 *  sẽ tạo ra các tài liệu yêu cầu phần mềm (Software Requirements Specification - SRS) 
 * hoặc user stories, use cases, wireframes, mockups, prototypes để mô tả các yêu cầu chức
 *  năng và phi chức năng của hệ thống.
 * 4.1 - SRS: Software Requirements Specification Đặt tả yêu cầu phần mềm,
 *  là một tài liệu mô tả chi tiết các yêu cầu chức năng 
 * và phi chức năng của hệ thống phần mềm. 
 * Nó thường được sử dụng để giao tiếp giữa khách hàng,
 *  nhà phát triển và các bên liên quan khác.
 * 4.2 user case Diagram: sơ đồ chức năng người dùng,
 *  mô tả các tác nhân (actors) và các trường hợp sử dụng (use cases) của hệ thống.
 *  Nó giúp xác định các chức năng mà hệ thống cần cung cấp và cách người dùng tương 
 *  tác với hệ thống.
 * 4.3 user case description: mô tả chi tiết các trường hợp sử dụng,
 *  bao gồm các bước, điều kiện tiên quyết, kết quả mong đợi và các luồng thay thế.
 * 4.4 user story: mô tả nhu cầu từ góc nhìn người dùng, thường được viết dưới dạng câu chuyện ngắn gọn,
 * 4.5 Acceptance criteria: tiêu chí chấp nhận, là các điều kiện mà một chức năng
 *  hoặc tính năng phải đáp ứng để được coi là hoàn thành và chấp nhận được.
 * ---> vẽ workflow  khi nào? khi hiểu rõ yêu cầu chức năng và phi chức năng của hệ thống,
 *  và muốn mô tả trực quan các bước, luồng công việc hoặc quy trình mà người dùng
 *  hoặc hệ thống thực hiện để đạt được một mục tiêu cụ thể.
 *  Workflow giúp lập trình viên, nhà thiết kế và các bên liên quan khác hiểu rõ hơn về cách hệ thống hoạt động,
 *  xác định các vấn đề tiềm ẩn và tối ưu hóa trải nghiệm người dùng.
 */