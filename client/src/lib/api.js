import axios from 'axios';

let csrfToken = null;

const api = axios.create({
  withCredentials: true,
});

// Attach CSRF token to all state-changing requests
api.interceptors.request.use((config) => {
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method)) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

export function setCsrfToken(token) {
  csrfToken = token;
}

export default api;
