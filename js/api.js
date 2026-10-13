import axios from 'axios';

/**
 * api.js - Cấu hình Axios gọi API json-server

 */
const API_URL = 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 4000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default api;
export { API_URL };
