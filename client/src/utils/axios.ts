import axios from 'axios';

/**
 * 自定义 axios 实例
 * - baseURL 设为 '/api'，由 Vite 代理转发到后端 localhost:3000
 * - 超时 120 秒，与原来 axiosForBackend 保持一致
 */

const TOKEN_KEY = 'ttp_token';
const USER_KEY = 'ttp_user';

export const apiClient = axios.create({
    baseURL: '/api',
    timeout: 120000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ============ Token 管理 ============
export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

export interface CurrentUser {
    id: string;
    username: string;
    role: 'user' | 'admin';
    mustChangePassword: boolean;
}

export function getStoredUser(): CurrentUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as CurrentUser;
    } catch {
        return null;
    }
}

export function setStoredUser(user: CurrentUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// ============ 请求拦截器：自动带 token ============
apiClient.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ============ 响应拦截器：401 自动跳登录 ============
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        if (status === 401) {
            clearToken();
            // 避免死循环：已经在登录/注册页就不跳
            const path = window.location.pathname;
            if (path !== '/login' && path !== '/register') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    },
);