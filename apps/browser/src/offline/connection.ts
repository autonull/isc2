export type ConnectionStatus = 'online' | 'offline' | 'slow';

export interface ConnectionInfo {
  status: ConnectionStatus;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

type ConnectionListener = (info: ConnectionInfo) => void;

import { loggers } from '../utils/logger.js';

const logger = loggers.offline;

const listeners = new Set<ConnectionListener>();
let currentInfo: ConnectionInfo = { status: navigator.onLine ? 'online' : 'offline' };

export function initConnectionMonitor(): ConnectionInfo {
  updateConnectionInfo();
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn) conn.addEventListener('change', handleConnectionChange);
  }

  return currentInfo;
}

export function getConnectionInfo(): ConnectionInfo {
  return { ...currentInfo };
}

export function isOnline(): boolean {
  return currentInfo.status !== 'offline';
}

export function isSlowConnection(): boolean {
  return currentInfo.status === 'slow';
}

export function subscribeToConnectionChanges(listener: ConnectionListener): () => void {
  listeners.add(listener);
  listener(currentInfo);
  return () => listeners.delete(listener);
}

function updateConnectionInfo(): void {
  const wasOffline = currentInfo.status === 'offline';
  currentInfo = { status: getConnectionStatus() };

  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn) {
      currentInfo.effectiveType = conn.effectiveType;
      currentInfo.downlink = conn.downlink;
      currentInfo.rtt = conn.rtt;
      currentInfo.saveData = conn.saveData;
    }
  }

  if (wasOffline !== (currentInfo.status === 'offline')) notifyListeners();
}

function getConnectionStatus(): ConnectionStatus {
  if (!navigator.onLine) return 'offline';

  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn) {
      const type = conn.effectiveType;
      if (type === 'slow-2g' || type === '2g' || type === '3g') return 'slow';
    }
  }

  return 'online';
}

function handleOnline(): void {
  updateConnectionInfo();
  logger.info('Connection restored');
}

function handleOffline(): void {
  updateConnectionInfo();
  logger.info('Connection lost');
}

function handleConnectionChange(): void {
  const oldStatus = currentInfo.status;
  updateConnectionInfo();
  if (oldStatus !== currentInfo.status) {
    logger.info('Connection type changed', { status: currentInfo.status });
  }
}

function notifyListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener(currentInfo);
    } catch (err) {
      logger.error('Listener error', err as Error);
    }
  });
}

export function cleanupConnectionMonitor(): void {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);

  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn) conn.removeEventListener('change', handleConnectionChange);
  }

  listeners.clear();
}
