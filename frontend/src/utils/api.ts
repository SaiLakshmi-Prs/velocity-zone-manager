import axios from 'axios';

let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Automatically detect GitHub Codespaces URL and route port 3000 -> 5000
if (window.location.hostname.includes('github.dev')) {
  API_URL = `${window.location.protocol}//${window.location.hostname.replace('-3000', '-5000')}`;
}

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('velocity_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('velocity_token');
      localStorage.removeItem('velocity_user');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
