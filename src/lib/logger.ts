/**
 * Centralized logging utility for consistent error/debug logging.
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Helper function to get a safe string representation of any error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Logger class for structured logging
 */
class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatLog(level: LogLevel, context: string, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] [${context}] ${message}`;

    const logLevel = LogLevel[level];
    const isError = level === LogLevel.ERROR || level === LogLevel.WARN;

    // Log to console in development, only errors in production
    if (this.isDevelopment || isError) {
      const consoleMethod = level === LogLevel.ERROR ? 'error' : level === LogLevel.WARN ? 'warn' : 'log';
      console[consoleMethod as keyof Console](logMessage, data || '');
    }

    // In production, could send critical errors to external logging service
    if (!this.isDevelopment && level === LogLevel.ERROR) {
      // TODO: Send to external error tracking service (e.g., Sentry)
    }
  }

  debug(context: string, message: string, data?: unknown): void {
    this.formatLog(LogLevel.DEBUG, context, message, data);
  }

  info(context: string, message: string, data?: unknown): void {
    this.formatLog(LogLevel.INFO, context, message, data);
  }

  warn(context: string, message: string, data?: unknown): void {
    this.formatLog(LogLevel.WARN, context, message, data);
  }

  error(context: string, message: string, error?: unknown): void {
    const errorMessage = getErrorMessage(error);
    this.formatLog(LogLevel.ERROR, context, message, errorMessage);
  }
}

export const logger = new Logger();
