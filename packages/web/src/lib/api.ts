import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_KEY = import.meta.env.VITE_API_KEY || 'test-key';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  }
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default apiClient;

// Demo API helpers
export const demoApi = {
  /**
   * Trigger refund scenario from customer portal
   */
  async refund(data: { orderId: string; amount: number; reason: string; customerId?: string }) {
    return apiClient.post('/api/demo/refund', data);
  },

  /**
   * Trigger pre-defined scenario by name
   */
  async scenario(scenarioName: string) {
    return apiClient.post('/api/demo/scenario', { scenarioName });
  },

  /**
   * Trigger rate limit test (burst of 15 refunds)
   */
  async rateLimitTest() {
    return apiClient.post('/api/demo/rate-limit-test');
  },

  /**
   * Run full demo (all scenarios in sequence)
   */
  async fullDemo() {
    return apiClient.post('/api/demo/full-demo');
  },

  /**
   * Start agent in continuous mode
   */
  async start(minInterval?: number, maxInterval?: number) {
    return apiClient.post('/api/demo/start', { minInterval, maxInterval });
  },

  /**
   * Stop agent
   */
  async stop() {
    return apiClient.post('/api/demo/stop');
  },

  /**
   * Get agent status and stats
   */
  async getStatus() {
    return apiClient.get('/api/demo/status');
  },
};
