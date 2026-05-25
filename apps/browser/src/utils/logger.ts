/* eslint-disable */
/**
 * Centralized Logging Service
 * 
 * Provides consistent logging across the application with:
 * - Log levels (debug, info, warn, error)
 * - Namespace-based filtering
 * - Production vs. development differentiation
 * - Structured error logging
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LogContext {
  peerId?: string;
  channelID?: string;
  messageId?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, error?: Error, context?: LogContext) => void;
  setLevel: (level: LogLevel) => void;
  getLevel: () => LogLevel;
}

class LoggerService implements Logger {
  private level: LogLevel;
  private readonly useColors: boolean;

  constructor() {
    // Auto-detect environment
    const isDev = typeof process !== 'undefined' 
      ? process.env?.NODE_ENV === 'development'
      : typeof window !== 'undefined' && window.location?.hostname === 'localhost';
    
    this.level = isDev ? LogLevel.DEBUG : LogLevel.INFO;
    this.useColors = isDev;
  }

  debug = (message: string, context?: LogContext): void => {
    if (this.level > LogLevel.DEBUG) return;
    this.log('DEBUG', message, context);
  };

  info = (message: string, context?: LogContext): void => {
    if (this.level > LogLevel.INFO) return;
    this.log('INFO', message, context);
  };

  warn = (message: string, context?: LogContext): void => {
    if (this.level > LogLevel.WARN) return;
    this.log('WARN', message, context);
  };

  error = (message: string, error?: Error, context?: LogContext): void => {
    if (this.level > LogLevel.ERROR) return;
    this.log('ERROR', message, context, error);
  };

  setLevel = (level: LogLevel): void => {
    this.level = level;
  };

  getLevel = (): LogLevel => {
    return this.level;
  };

  private log(
    level: string,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    const timestamp = new Date().toISOString();
    const logMessage = this.useColors
      ? this.colorize(level, message)
      : `[${timestamp}] [${level}] ${message}`;

    const logData = {
      timestamp,
      level,
      message,
      ...context,
    };

    switch (level) {
      case 'DEBUG':
        console.debug(logMessage, logData);
        break;
      case 'INFO':
        console.info(logMessage, logData);
        break;
      case 'WARN':
        console.warn(logMessage, logData);
        break;
      case 'ERROR':
        console.error(logMessage, logData, error);
        break;
    }
  }

  private colorize(level: string, message: string): string {
    const colors: Record<string, string> = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m',  // Green
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m', // Red
    };
    const reset = '\x1b[0m';
    return `${colors[level]}[${level}]${reset} ${message}`;
  }
}

// Create namespace-based loggers
function createLogger(namespace: string): Logger {
  const service = new LoggerService();
  
  const prefix = `[${namespace}]`;
  
  return {
    debug: (message, context) => service.debug(`${prefix} ${message}`, context),
    info: (message, context) => service.info(`${prefix} ${message}`, context),
    warn: (message, context) => service.warn(`${prefix} ${message}`, context),
    error: (message, error, context) => service.error(`${prefix} ${message}`, error, context),
    setLevel: (level) => service.setLevel(level),
    getLevel: () => service.getLevel(),
  };
}

// Singleton instance
const defaultLogger = new LoggerService();

// Pre-configured namespace loggers
export const loggers = {
  app: createLogger('App'),
  dht: createLogger('DHT'),
  chat: createLogger('Chat'),
  video: createLogger('Video'),
  embed: createLogger('Embedding'),
  channel: createLogger('Channel'),
  discover: createLogger('Discover'),
  social: createLogger('Social'),
  offline: createLogger('Offline'),
  crypto: createLogger('Crypto'),
  delegation: createLogger('Delegation'),
  network: createLogger('Network'),
  state: createLogger('State'),
  ui: createLogger('UI'),
};

// Default logger for general use
export const logger = defaultLogger;

// Export for convenience
export { createLogger };
export default defaultLogger;
