/**
 * Logging Utility
 * 
 * Provides structured logging with different levels and production/development modes.
 * Replaces console statements throughout the codebase.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

interface LogConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
}

class Logger {
  private config: LogConfig;

  constructor() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const logLevel = (process.env.NEXT_PUBLIC_LOG_LEVEL || (isDevelopment ? 'DEBUG' : 'WARN')).toUpperCase();
    
    this.config = {
      level: LogLevel[logLevel as keyof typeof LogLevel] ?? LogLevel.INFO,
      enableConsole: true, // Always enable console in browser
      enableRemote: !isDevelopment, // Enable remote logging in production
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private formatMessage(level: string, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    
    if (args.length > 0) {
      return `${prefix} ${message} ${JSON.stringify(args, null, 2)}`;
    }
    return `${prefix} ${message}`;
  }

  private log(level: LogLevel, levelName: string, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(levelName, message, ...args);

    if (this.config.enableConsole) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage, ...args);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage, ...args);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage, ...args);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage, ...args);
          break;
      }
    }

    // TODO: Implement remote logging (e.g., Sentry, LogRocket) in production
    if (this.config.enableRemote && level >= LogLevel.ERROR) {
      // Remote error logging would go here
      // Example: sendToErrorTrackingService(formattedMessage, args);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, 'INFO', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, 'WARN', message, ...args);
  }

  error(message: string, error?: unknown, ...args: unknown[]): void {
    const errorDetails = error instanceof Error 
      ? { message: error.message, stack: error.stack, name: error.name }
      : error;
    
    this.log(LogLevel.ERROR, 'ERROR', message, errorDetails, ...args);
  }

  // Convenience method for API calls
  apiCall(method: string, endpoint: string, status?: number, duration?: number): void {
    const message = `API ${method} ${endpoint}${status ? ` ${status}` : ''}${duration ? ` (${duration}ms)` : ''}`;
    if (status && status >= 400) {
      this.error(message);
    } else {
      this.info(message);
    }
  }

  // Convenience method for user actions
  userAction(action: string, details?: Record<string, unknown>): void {
    this.info(`User Action: ${action}`, details);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export default for convenience
export default logger;

