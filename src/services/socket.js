import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.handlers = new Map();
    this.maxReconnectAttempts = 5;
    this.connected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve(this.socket);
        return;
      }

      const socketUrl = import.meta.env.VITE_SOCKET_URL ||
        (import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin);

      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000
      });

      this.socket.once('connect', () => {
        this.connected = true;
        resolve(this.socket);
      });

      this.socket.once('connect_error', reject);

      this.socket.on('disconnect', () => {
        this.connected = false;
      });

      this.handlers.forEach((handlers, event) => {
        handlers.forEach((handler) => this.socket.on(event, handler));
      });
    });
  }

  send(event, data = {}) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    this.handlers.get(event).add(handler);
    if (this.socket) {
      this.socket.on(event, handler);
    }

    return () => this.off(event, handler);
  }

  off(event, handler) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      if (handler) {
        handlers.delete(handler);
      } else {
        handlers.clear();
      }

      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    }

    if (this.socket) {
      this.socket.off(event, handler);
    }
  }

  disconnect() {
    if (this.socket) {
      this.handlers.forEach((handlers, event) => {
        handlers.forEach((handler) => this.socket.off(event, handler));
      });
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }

    this.handlers.clear();
  }

  isConnected() {
    return Boolean(this.socket?.connected);
  }
}

export const socketService = new SocketService();
