import axios from 'axios';

/**
 * 自定义 axios 实例
 * - baseURL 设为 '/api'，由 Vite 代理转发到后端 localhost:3000
 * - 超时 120 秒，与原来 axiosForBackend 保持一致
 */
export const apiClient = axios.create({
    baseURL: '/api',
    timeout: 120000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 请求拦截器（如果需要 JWT，可在此添加）
apiClient.interceptors.request.use(
    (config) => {
        // 本地开发无需 token，留空
        return config;
    },
    (error) => Promise.reject(error),
);

// 响应拦截器
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 403) {
            throw new Error('您没有该操作的权限，请联系管理员');
        }
        return Promise.reject(error);
    },
);