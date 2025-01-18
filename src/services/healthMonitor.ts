import { ethers } from 'ethers';
import { AlertManager } from './alerting';
import os from 'os';

export interface HealthMetrics {
  isHealthy: boolean;
  responseTime: number;
  successRate: number;
  averageResponseTime: number;
  errorCount: number;
  lastNRequests: Array<{
    timestamp: number;
    success: boolean;
    responseTime: number;
  }>;
  averageGasUsed: number;
  processingQueueSize: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  transactionMetrics: {
    totalProcessed: number;
    successfulDeposits: number;
    failedDeposits: number;
    averageConfirmationTime: number;
    pendingTransactions: number;
    lastProcessedTimestamp: number;
  };
  systemMetrics: {
    cpuUsage: number;
    uptime: number;
    lastAlertTime?: number;
    loadAverage: number[];
    networkConnections: number;
  };
  errorMetrics: {
    lastError?: {
      message: string;
      timestamp: number;
      count: number;
    };
    errorTypes: Record<string, number>;
  };
}

export interface HealthStatus {
  isHealthy: boolean;
  services: {
    bridge: {
      isHealthy: boolean;
      lastCheck: number;
      errors: string[];
      performance: HealthMetrics;
    };
    dogecoin: {
      isHealthy: boolean;
      lastProcessedBlock: number;
      lastProcessedTime: number;
      errors: string[];
      performance: HealthMetrics;
    };
  };
  lastUpdate: number;
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: number;
  metrics: HealthMetrics;
  errors: string[];
}

export class HealthMonitor {
  private services: Map<string, ServiceStatus> = new Map();
  private alertManager: AlertManager;
  private readonly checkInterval: number;
  private readonly alertThreshold: number;
  private lastMemoryUsage: NodeJS.MemoryUsage;
  private startTime: number;
  private readonly DEGRADED_THRESHOLD = 0.95;
  private readonly RESPONSE_TIME_THRESHOLD = 5000;
  private readonly MAX_ERROR_TYPES = 100;

  constructor(
    alertManager: AlertManager,
    checkInterval: number = 60000,
    alertThreshold: number = 3
  ) {
    this.alertManager = alertManager;
    this.checkInterval = checkInterval;
    this.alertThreshold = alertThreshold;
    this.lastMemoryUsage = process.memoryUsage();
    this.startTime = Date.now();
    this.validateConfiguration();
  }

  private validateConfiguration(): void {
    if (this.checkInterval < 1000) {
      throw new Error('Check interval must be at least 1 second');
    }
    if (this.alertThreshold < 1) {
      throw new Error('Alert threshold must be at least 1');
    }
  }

  registerService(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error('Service name must be a non-empty string');
    }
    if (this.services.has(name)) {
      throw new Error(`Service ${name} is already registered`);
    }

    this.services.set(name, {
      name,
      status: 'healthy',
      lastCheck: Date.now(),
      metrics: this.initializeMetrics(),
      errors: []
    });
  }

  private initializeMetrics(): HealthMetrics {
    return {
      isHealthy: true,
      responseTime: 0,
      successRate: 100,
      averageResponseTime: 0,
      errorCount: 0,
      lastNRequests: [],
      averageGasUsed: 0,
      processingQueueSize: 0,
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0
      },
      transactionMetrics: {
        totalProcessed: 0,
        successfulDeposits: 0,
        failedDeposits: 0,
        averageConfirmationTime: 0,
        pendingTransactions: 0,
        lastProcessedTimestamp: Date.now()
      },
      systemMetrics: {
        cpuUsage: 0,
        uptime: process.uptime(),
        loadAverage: os.loadavg(),
        networkConnections: 0
      },
      errorMetrics: {
        errorTypes: {}
      }
    };
  }

  updateMetrics(
    serviceName: string,
    metrics: Partial<HealthMetrics>,
    error?: Error
  ): void {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    try {
      const currentMetrics = service.metrics;
      const updatedMetrics = this.mergeMetrics(currentMetrics, metrics);
      
      if (error) {
        this.updateErrorMetrics(updatedMetrics, error);
      }

      const status = this.calculateServiceStatus(updatedMetrics);
      
      this.services.set(serviceName, {
        ...service,
        status,
        lastCheck: Date.now(),
        metrics: updatedMetrics,
        errors: error ? [...service.errors, error.message] : service.errors
      });

      this.checkAlerts(serviceName, status, updatedMetrics);
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.alertManager.sendAlert({
          type: 'monitor',
          message: `Failed to update metrics for ${serviceName}: ${error.message}`,
          severity: 'critical',
          timestamp: Date.now()
        });
      } else {
        this.alertManager.sendAlert({
          type: 'monitor',
          message: `Failed to update metrics for ${serviceName}: Unknown error`,
          severity: 'critical',
          timestamp: Date.now()
        });
      }
    }
  }

  private mergeMetrics(current: HealthMetrics, update: Partial<HealthMetrics>): HealthMetrics {
    return {
      ...current,
      ...update,
      memoryUsage: {
        ...current.memoryUsage,
        ...update.memoryUsage
      },
      transactionMetrics: {
        ...current.transactionMetrics,
        ...update.transactionMetrics
      },
      systemMetrics: {
        ...current.systemMetrics,
        ...update.systemMetrics,
        loadAverage: os.loadavg()
      },
      errorMetrics: current.errorMetrics
    };
  }

  private updateErrorMetrics(metrics: HealthMetrics, error: Error): void {
    const errorTypes = metrics.errorMetrics.errorTypes;
    const errorType = error.constructor.name;
    const errorMessage = error.message || 'Unknown error';
    
    errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    
    // Limit the number of error types
    const errorTypeKeys = Object.keys(errorTypes);
    if (errorTypeKeys.length > this.MAX_ERROR_TYPES) {
      delete errorTypes[errorTypeKeys[0]];
    }

    metrics.errorMetrics.lastError = {
      message: errorMessage,
      timestamp: Date.now(),
      count: (metrics.errorMetrics.lastError?.count || 0) + 1
    };
  }

  private calculateServiceStatus(metrics: HealthMetrics): 'healthy' | 'degraded' | 'down' {
    if (!metrics.isHealthy || metrics.errorCount > this.alertThreshold) {
      return 'down';
    }
    if (
      metrics.successRate < this.DEGRADED_THRESHOLD || 
      metrics.averageResponseTime > this.RESPONSE_TIME_THRESHOLD ||
      metrics.systemMetrics.cpuUsage > 90 ||
      metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal > 0.9
    ) {
      return 'degraded';
    }
    return 'healthy';
  }

  private checkAlerts(
    serviceName: string,
    status: 'healthy' | 'degraded' | 'down',
    metrics: HealthMetrics
  ): void {
    const now = Date.now();
    const lastAlertTime = metrics.systemMetrics.lastAlertTime || 0;
    const alertCooldown = 5 * 60 * 1000; // 5 minutes

    if (status !== 'healthy' && now - lastAlertTime > alertCooldown) {
      const severity = status === 'down' ? 'critical' : 'warning';
      const message = this.generateAlertMessage(serviceName, status, metrics);
      
      this.alertManager.sendAlert({
        type: 'monitor',
        message,
        severity,
        timestamp: now,
        metadata: {
          metrics: {
            successRate: metrics.successRate,
            errorCount: metrics.errorCount,
            lastError: metrics.errorMetrics.lastError
          }
        }
      });

      metrics.systemMetrics.lastAlertTime = now;
    }
  }

  private generateAlertMessage(
    serviceName: string,
    status: 'healthy' | 'degraded' | 'down',
    metrics: HealthMetrics
  ): string {
    const lastError = metrics.errorMetrics.lastError;
    const errorInfo = lastError 
      ? `\nLast Error: ${lastError.message} (${lastError.count} occurrences)`
      : '';

    return `Service ${serviceName} is ${status}
Health Metrics:
- Success Rate: ${(metrics.successRate * 100).toFixed(2)}%
- Error Count: ${metrics.errorCount}
- Avg Response Time: ${metrics.averageResponseTime}ms
- Queue Size: ${metrics.processingQueueSize}
Transaction Metrics:
- Total Processed: ${metrics.transactionMetrics.totalProcessed}
- Successful Deposits: ${metrics.transactionMetrics.successfulDeposits}
- Failed Deposits: ${metrics.transactionMetrics.failedDeposits}
- Pending Transactions: ${metrics.transactionMetrics.pendingTransactions}
System Metrics:
- Memory Usage: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB
- Memory RSS: ${(metrics.memoryUsage.rss / 1024 / 1024).toFixed(2)}MB
- CPU Usage: ${metrics.systemMetrics.cpuUsage.toFixed(2)}%
- Load Average: ${metrics.systemMetrics.loadAverage.map(load => load.toFixed(2)).join(', ')}
- Network Connections: ${metrics.systemMetrics.networkConnections}
- Uptime: ${(metrics.systemMetrics.uptime / 3600).toFixed(2)}h${errorInfo}`;
  }

  getServiceStatus(serviceName: string): ServiceStatus {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }
    return service;
  }

  getAllServicesStatus(): ServiceStatus[] {
    return Array.from(this.services.values());
  }

  startMonitoring(): void {
    setInterval(() => {
      for (const [serviceName, service] of this.services) {
        const now = Date.now();
        const timeSinceLastCheck = now - service.lastCheck;
        
        if (timeSinceLastCheck > this.checkInterval * 2) {
          this.updateMetrics(serviceName, {
            isHealthy: false,
            systemMetrics: {
              cpuUsage: process.cpuUsage().user / 1000000,
              uptime: process.uptime(),
              loadAverage: os.loadavg(),
              networkConnections: 0
            }
          });
        }
      }
    }, this.checkInterval);
  }
} 