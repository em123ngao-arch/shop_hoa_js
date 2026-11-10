import axios from 'axios';

/**
 * api.js - Cấu hình Axios gọi API backend Shop Hoa (Chuẩn RESTful với tiền tố /api)
 * Tương thích 100% với cả 2 phương án: Node.js (server.js port 4000) và Spring Boot (port 8080)
 */
const API_URL = 'http://localhost:4000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor tự động gắn Bearer Token vào mọi Request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// ============================================================================
// CÁC HÀM GỌI API CHUYÊN BIỆT THEO HỢP ĐỒNG (API CONTRACT HELPERS)
// ============================================================================

export const authApi = {
  register: (data) => api.post('/api/auth/register', data),
  login: (credentials) => api.post('/api/auth/login', credentials),
  getMe: () => api.get('/api/auth/me')
};

export const avatarApi = {
  uploadAvatar: (avatarBase64) => api.post('/api/users/avatar', { avatarBase64 })
};

export const notificationApi = {
  getNotifications: () => api.get('/api/notifications'),
  markAsRead: (id) => api.patch(`/api/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/api/notifications/read-all')
};

export const reviewApi = {
  getReviews: (productId) => api.get('/api/reviews', { params: productId ? { productId } : {} }),
  createReview: (reviewData) => api.post('/api/reviews', reviewData),
  toggleHideReview: (id) => api.patch(`/api/reviews/${id}/toggle-hide`),
  deleteReview: (id) => api.delete(`/api/reviews/${id}`)
};

export const wishlistApi = {
  getWishlist: () => api.get('/api/wishlist'),
  toggleWishlist: (productId) => api.post('/api/wishlist/toggle', { productId })
};

export const orderApi = {
  updateStatus: (orderId, status) => api.patch(`/api/orders/${orderId}/status`, { status })
};

export const chatApi = {
  sendMessage: (message, history = []) => api.post('/api/chat', { message, history })
};

export default api;
export { API_URL };
