import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface TransactionRequest {
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  date: string;
}

export interface Transaction {
  id: number;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  date: string;
}

export const authAPI = {
  login: (data: LoginRequest) => api.post('/auth/login', data),
  register: (data: RegisterRequest) => api.post('/auth/register', data),
};

export const transactionAPI = {
  getAll: () => api.get<Transaction[]>('/transactions'),
  create: (data: TransactionRequest) => api.post<Transaction>('/transactions', data),
  update: (id: number, data: TransactionRequest) => api.put<Transaction>(`/transactions/${id}`, data),
  delete: (id: number) => api.delete(`/transactions/${id}`),
};

export default api;
