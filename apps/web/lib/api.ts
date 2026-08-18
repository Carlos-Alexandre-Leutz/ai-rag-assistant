import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_BFF_URL || 'https://bff-staging.onrender.com';
const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token && token !== 'undefined' && token !== 'null') {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;
