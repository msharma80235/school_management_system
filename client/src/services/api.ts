import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url: string = error.config?.url || '';
    // A 401 from a login/registration attempt is a bad-credentials error the page
    // handles itself — only treat 401s on authenticated calls as an expired session.
    const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/org/') || url.includes('/register');
    const onPublicPage = ['/login', '/parent-login', '/register'].includes(window.location.pathname);
    if (status === 401 && !isAuthAttempt && !onPublicPage) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('org');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
