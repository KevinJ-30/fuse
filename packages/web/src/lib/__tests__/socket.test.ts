import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock socket.io-client before importing
vi.mock('socket.io-client', () => {
  const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    id: 'mock-socket-id',
  };
  return {
    io: vi.fn(() => mockSocket),
  };
});

describe('Socket utility', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports getSocket function', async () => {
    const { getSocket } = await import('../socket');
    expect(typeof getSocket).toBe('function');
  });

  it('exports disconnectSocket function', async () => {
    const { disconnectSocket } = await import('../socket');
    expect(typeof disconnectSocket).toBe('function');
  });

  it('getSocket returns a socket instance', async () => {
    const { getSocket } = await import('../socket');
    const socket = getSocket();
    expect(socket).toBeDefined();
    expect(socket.on).toBeDefined();
    expect(socket.off).toBeDefined();
  });

  it('getSocket returns the same instance on multiple calls', async () => {
    const { getSocket } = await import('../socket');
    const socket1 = getSocket();
    const socket2 = getSocket();
    expect(socket1).toBe(socket2);
  });

  it('getSocket sets up connection handlers', async () => {
    const { getSocket } = await import('../socket');
    const socket = getSocket();
    // Should have registered connect, disconnect, and error handlers
    expect(socket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('disconnectSocket cleans up the socket', async () => {
    const { getSocket, disconnectSocket } = await import('../socket');
    const socket = getSocket();
    disconnectSocket();
    expect(socket.disconnect).toHaveBeenCalled();
  });
});
