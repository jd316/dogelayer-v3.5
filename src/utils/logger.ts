import { performance } from 'perf_hooks';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = 'info';
  private performanceMarks: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    return logEntry;
  }

  startTimer(label: string): void {
    const now = typeof window !== 'undefined' && window.performance
      ? window.performance.now()
      : Date.now();
    this.performanceMarks.set(label, now);
  }

  endTimer(label: string): number | undefined {
    const start = this.performanceMarks.get(label);
    if (start) {
      const now = typeof window !== 'undefined' && window.performance
        ? window.performance.now()
        : Date.now();
      const duration = now - start;
      this.performanceMarks.delete(label);
      return duration;
    }
    return undefined;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(JSON.stringify(this.formatLog('debug', message, context)));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.info(JSON.stringify(this.formatLog('info', message, context)));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(JSON.stringify(this.formatLog('warn', message, context)));
    }
  }

  error(message: string, error: Error, context?: LogContext): void {
    if (this.shouldLog('error')) {
      console.error(JSON.stringify(this.formatLog('error', message, context, error)));
    }
  }

  async trackPerformance<T>(
    label: string,
    operation: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    this.startTimer(label);
    try {
      const result = await operation();
      const duration = this.endTimer(label);
      this.info(`Operation ${label} completed`, { ...context, duration });
      return result;
    } catch (error) {
      const duration = this.endTimer(label);
      this.error(
        `Operation ${label} failed`,
        error instanceof Error ? error : new Error(String(error)),
        { ...context, duration }
      );
      throw error;
    }
  }
}

export const logger = Logger.getInstance(); 