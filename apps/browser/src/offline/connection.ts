/**
 * Connection Monitor
 * 
 * Tracks online/offline status and triggers sync when connection is restored.
 */

export type ConnectionStatus = 'online' | 'offline' | 'slow';

export interface ConnectionInfo {
  status: ConnectionStatus;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

type ConnectionListener = (info: ConnectionInfo) => void;

const listeners = new Set<ConnectionListener>();
let currentInfo: ConnectionInfo = {
  status: navigator.onLine ? 'online' : 'offline',
};

/**
 * Initialize connection monitoring
 */
export function initConnectionMonitor(): ConnectionInfo {
  updateConnectionInfo();

  // Listen for online/offline events
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Listen for connection changes (Chrome/Edge only)
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn) {
      conn.addEventListener('change', handleConnectionChange);
    }
  }

  return currentInfo;
}

/**
 * Get current connection status
 */
export function getConnectionInfo(): ConnectionInfo {
  return { ...currentInfo };
}

/**
 * Check if currently online
 */
export function isOnline(): boolean {
  return currentInfo.status !== 'offline';
}

/**
 * Check if connection is slow (2G/3G)
 */
export function isSlowConnection(): boolean {
  return currentInfo.status === 'slow';
}

/**
 * Subscribe to connection status changes
 */
export function subscribeToConnectionChanges(listener: ConnectionListener): () => void {
  listeners.add(listener);
  // Immediately call with current status
  listener(currentInfo);
  // Return unsubscribe function
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Update connection info from Network Information API
 */
function updateConnectionInfo(): void {
  const wasOffline = currentInfo.status === 'offline';
  
  currentInfo = {
    status: getConnectionStatus(),
  };

  // Add detailed info if available
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn) {
      currentInfo.effectiveType = conn.effectiveType;
      currentInfo.downlink = conn.downlink;
      currentInfo.rtt = conn.rtt;
      currentInfo.saveData = conn.saveData;
    }
  }

  // Notify listeners if status changed
  if (wasOffline && currentInfo.status !== 'offline') {
    // Connection restored
    notifyListeners();
  } else if (!wasOffline && currentInfo.status === 'offline') {
    // Connection lost
    notifyListeners();
  }
}

/**
 * Determine connection status
 */
function getConnectionStatus(): ConnectionStatus {
  if (!navigator.onLine) {
    return 'offline';
  }

  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn) {
      const type = conn.effectiveType;
      if (type === 'slow-2g' || type === '2g') {
        return 'slow';
      }
      if (type === '3g') {
        return 'slow';
      }
    }
  }

  return 'online';
}

/**
 * Handle online event
 */
function handleOnline(): void {
  updateConnectionInfo();
  console.log('[ConnectionMonitor] Connection restored');
}

/**
 * Handle offline event
 */
function handleOffline(): void {
  updateConnectionInfo();
  console.log('[ConnectionMonitor] Connection lost');
}

/**
 * Handle connection change event
 */
function handleConnectionChange(): void {
  const oldStatus = currentInfo.status;
  updateConnectionInfo();
  
  if (oldStatus !== currentInfo.status) {
    console.log('[ConnectionMonitor] Connection type changed:', currentInfo.status);
  }
}

/**
 * Notify all listeners
 */
function notifyListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener(currentInfo);
    } catch (err) {
      console.error('[ConnectionMonitor] Listener error:', err);
    }
  });
}

/**
 * Cleanup - remove event listeners
 */
export function cleanupConnectionMonitor(): void {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn) {
      conn.removeEventListener('change', handleConnectionChange);
    }
  }
  
  listeners.clear();
}
