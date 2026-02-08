import '@testing-library/jest-dom';

// Mock CSS imports (vitest css: true handles most, but this catches edge cases)
// Mock import.meta.env
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_API_URL: 'http://localhost:3001',
    VITE_API_KEY: 'test-key',
    MODE: 'test',
    DEV: true,
    PROD: false,
    SSR: false,
  },
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver (used by ReactFlow)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// Suppress console errors in tests for cleaner output
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  // Suppress React Router and act() warnings in tests
  const message = typeof args[0] === 'string' ? args[0] : '';
  if (
    message.includes('inside a test was not wrapped in act') ||
    message.includes('ReactDOMTestUtils.act')
  ) {
    return;
  }
  originalConsoleError.call(console, ...args);
};
