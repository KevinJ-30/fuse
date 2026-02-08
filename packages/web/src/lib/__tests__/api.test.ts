import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to test the API client configuration
// Since it uses import.meta.env, we test the configuration logic

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct base URL from env', async () => {
    // The setup.ts mock sets VITE_API_URL to http://localhost:3001
    const { default: apiClient } = await import('../api');
    expect(apiClient.defaults.baseURL).toBe('http://localhost:3001');
  });

  it('should have Content-Type header set', async () => {
    const { default: apiClient } = await import('../api');
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('should have API key header set', async () => {
    const { default: apiClient } = await import('../api');
    expect(apiClient.defaults.headers['X-API-Key']).toBe('test-key');
  });

  it('should have request interceptor configured', async () => {
    const { default: apiClient } = await import('../api');
    // Axios stores interceptors in an internal manager
    // @ts-ignore accessing internal
    const requestInterceptors = apiClient.interceptors.request.handlers;
    expect(requestInterceptors.length).toBeGreaterThan(0);
  });

  it('should have response interceptor configured', async () => {
    const { default: apiClient } = await import('../api');
    // @ts-ignore accessing internal
    const responseInterceptors = apiClient.interceptors.response.handlers;
    expect(responseInterceptors.length).toBeGreaterThan(0);
  });
});

describe('Demo API helpers', () => {
  it('exports demoApi object with expected methods', async () => {
    const { demoApi } = await import('../api');
    expect(demoApi).toBeDefined();
    expect(typeof demoApi.refund).toBe('function');
    expect(typeof demoApi.scenario).toBe('function');
    expect(typeof demoApi.rateLimitTest).toBe('function');
    expect(typeof demoApi.fullDemo).toBe('function');
    expect(typeof demoApi.start).toBe('function');
    expect(typeof demoApi.stop).toBe('function');
    expect(typeof demoApi.getStatus).toBe('function');
  });
});
