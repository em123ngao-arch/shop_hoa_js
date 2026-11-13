import axios from 'axios';

/**
 * api.js - Cấu hình Axios gọi API backend Shop Hoa (Chuẩn RESTful với tiền tố /api)
 * Tương thích 100% với cả 2 phương án: Node.js (server.js port 4000) và Spring Boot (port 8080)
 */
// Sử dụng relative URL (cùng origin) để hỗ trợ truy cập qua IP LAN, domain tùy biến và localhost
const API_URL = '';

const api = axios.create({
  baseURL: API_URL,
  timeout: 8000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Dọn credential cũ một lần; các phiên mới chỉ dùng cookie HttpOnly.
if (typeof localStorage !== 'undefined') {
  localStorage.removeItem('token');
  localStorage.removeItem('auth_token');
}

// ============================================================================
// CÁC HÀM GỌI API CHUYÊN BIỆT THEO HỢP ĐỒNG (API CONTRACT HELPERS)
// ============================================================================

export const authApi = {
  register: (data) => api.post('/api/auth/register', data),
  login: (credentials) => api.post('/api/auth/login', credentials),
  logout: () => api.post('/api/auth/logout'),
  logoutAllDevices: () => api.post('/api/auth/logout-all'),
  getMe: () => api.get('/api/auth/me'),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/api/auth/reset-password', { token, newPassword })
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
  getReviewedProductIds: (productIds = []) => api.post('/api/reviews/mine', { productIds }),
  checkEligibility: (productId) => api.get('/api/reviews/check-eligibility', { params: { productId } }),
  createReview: (reviewData) => api.post('/api/reviews', reviewData),
  toggleHelpful: (id) => api.post(`/api/reviews/${id}/helpful`),
  addComment: (id, content) => api.post(`/api/reviews/${id}/comments`, { content }),
  deleteComment: (reviewId, commentId) => api.delete(`/api/reviews/${reviewId}/comments/${commentId}`),
  replyReview: (id, reply) => api.post(`/api/reviews/${id}/reply`, { reply }),
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

export const refundApi = {
  getAll: (status = '') => api.get('/api/refunds', { params: status ? { status } : {} }),
  create: (payload) => api.post('/api/refunds', payload),
  approve: (id, payload = {}) => api.post(`/api/refunds/${encodeURIComponent(id)}/approve`, payload),
  reject: (id, payload = {}) => api.post(`/api/refunds/${encodeURIComponent(id)}/reject`, payload)
};

export const chatApi = {
  sendMessage: (message, history = []) => api.post('/api/chat', { message, history })
};

export default api;
export { API_URL };
