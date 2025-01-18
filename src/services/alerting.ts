import { HealthStatus } from './healthMonitor';

export interface AlertConfig {
  webhookUrl?: string;
  emailConfig?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
}

export interface BaseAlert {
  message: string;
  timestamp: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'warning';
}

export interface Alert extends BaseAlert {
  type: 'error' | 'warning' | 'info';
  service?: string;
}

export interface MonitorAlert extends BaseAlert {
  type: 'monitor';
  metadata?: {
    metrics?: {
      successRate: number;
      errorCount: number;
      lastError?: {
        message: string;
        timestamp: number;
        count: number;
      };
    };
  };
}

export class AlertManager {
  private config: AlertConfig;
  private alertHandlers: Array<(alert: Alert) => void>;

  constructor(config: AlertConfig) {
    this.config = config;
    this.alertHandlers = [];
  }

  addAlertHandler(handler: (alert: Alert) => void): void {
    this.alertHandlers.push(handler);
  }

  sendAlert(alert: MonitorAlert): void {
    this.notify({
      type: alert.severity === 'critical' ? 'error' : 'warning',
      message: alert.message,
      timestamp: Date.now(),
      severity: alert.severity
    });
  }

  checkHealthStatus(status: HealthStatus): void {
    // Check bridge service
    const bridgeService = status.services.bridge;
    const bridgePerf = bridgeService.performance;

    if (bridgePerf.successRate < 95) {
      this.notify({
        type: 'error',
        severity: 'critical',
        service: 'bridge',
        message: `Low success rate: ${bridgePerf.successRate}%`,
        timestamp: Date.now()
      });
    }

    if (bridgePerf.responseTime > 5000) {
      this.notify({
        type: 'warning',
        severity: 'warning',
        service: 'bridge',
        message: `High response time: ${bridgePerf.responseTime}ms`,
        timestamp: Date.now()
      });
    }

    if (bridgePerf.errorCount > 3) {
      this.notify({
        type: 'error',
        severity: 'critical',
        service: 'bridge',
        message: `High error count: ${bridgePerf.errorCount}`,
        timestamp: Date.now()
      });
    }

    if (!bridgeService.isHealthy) {
      this.notify({
        type: 'error',
        severity: 'critical',
        service: 'bridge',
        message: 'Bridge service is unhealthy',
        timestamp: Date.now()
      });
    }

    // Check dogecoin service
    const dogecoinService = status.services.dogecoin;
    const dogecoinPerf = dogecoinService.performance;

    if (dogecoinPerf.successRate < 95) {
      this.notify({
        type: 'error',
        severity: 'critical',
        service: 'dogecoin',
        message: `Low success rate: ${dogecoinPerf.successRate}%`,
        timestamp: Date.now()
      });
    }

    if (!dogecoinService.isHealthy) {
      this.notify({
        type: 'error',
        severity: 'critical',
        service: 'dogecoin',
        message: 'Dogecoin service is unhealthy',
        timestamp: Date.now()
      });
    }
  }

  private notify(alert: Alert | MonitorAlert): void {
    if (alert.type === 'monitor') {
      // Convert MonitorAlert to Alert
      const baseAlert: Alert = {
        type: alert.severity === 'critical' ? 'error' : 'warning',
        message: alert.message,
        timestamp: alert.timestamp,
        severity: alert.severity
      };
      this.alertHandlers.forEach(handler => handler(baseAlert));
    } else {
      // Handle regular Alert
      this.alertHandlers.forEach(handler => handler(alert));
    }
  }
} 