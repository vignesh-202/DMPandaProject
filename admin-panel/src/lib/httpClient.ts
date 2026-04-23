import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
        'X-App-Context': 'admin',
    },
});

let adminSessionValidationPromise: Promise<boolean> | null = null;

const validateAdminSession = async () => {
    if (adminSessionValidationPromise) {
        return adminSessionValidationPromise;
    }

    adminSessionValidationPromise = (async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/me`, {
                credentials: 'include',
                headers: {
                    'X-App-Context': 'admin'
                }
            });
            return response.ok;
        } catch {
            return true;
        } finally {
            adminSessionValidationPromise = null;
        }
    })();

    return adminSessionValidationPromise;
};

api.interceptors.response.use(
    (response) => {
        if (
            response?.data
            && typeof response.data === 'object'
            && Object.prototype.hasOwnProperty.call(response.data, 'success')
            && Object.prototype.hasOwnProperty.call(response.data, 'data')
        ) {
            response.data = response.data.data;
        }
        return response;
    },
    async (error) => {
        if (error.response?.status === 401 && window.location.pathname !== '/login') {
            const requestUrl = String(error.config?.url || '');
            const isSessionActive = requestUrl.includes('/api/me')
                ? false
                : await validateAdminSession();

            if (!isSessionActive) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
