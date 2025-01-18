import { logger } from './logger';

interface MetricValue {
  count: number;
  sum: number;
  min: number;
  max: number;
  lastUpdate: number;
}

interface MetricLabels {
  [key: string]: string;
}

class Metrics {
  private static instance: Metrics;
  private metrics: Map<string, MetricValue> = new Map();
  private readonly retentionPeriod = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {
    // Clean up old metrics every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  static getInstance(): Metrics {
    if (!Metrics.instance) {
      Metrics.instance = new Metrics();
    }
    return Metrics.instance;
  }

  private getMetricKey(name: string, labels?: MetricLabels): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.metrics.entries()) {
      if (now - value.lastUpdate > this.retentionPeriod) {
        this.metrics.delete(key);
      }
    }
  }

  recordValue(name: string, value: number, labels?: MetricLabels): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.metrics.get(key);

    if (existing) {
      existing.count++;
      existing.sum += value;
      existing.min = Math.min(existing.min, value);
      existing.max = Math.max(existing.max, value);
      existing.lastUpdate = Date.now();
    } else {
      this.metrics.set(key, {
        count: 1,
        sum: value,
        min: value,
        max: value,
        lastUpdate: Date.now()
      });
    }

    logger.debug('Recorded metric', {
      metric: name,
      value,
      labels
    });
  }

  getMetric(name: string, labels?: MetricLabels): MetricValue | undefined {
    const key = this.getMetricKey(name, labels);
    return this.metrics.get(key);
  }

  getSummary(name: string, labels?: MetricLabels): {
    count: number;
    min: number;
    max: number;
    avg: number;
  } | undefined {
    const metric = this.getMetric(name, labels);
    if (!metric) return undefined;

    return {
      count: metric.count,
      min: metric.min,
      max: metric.max,
      avg: metric.sum / metric.count
    };
  }

  getAllMetrics(): Array<{
    name: string;
    value: MetricValue;
  }> {
    return Array.from(this.metrics.entries()).map(([key, value]) => ({
      name: key,
      value
    }));
  }

  reset(): void {
    this.metrics.clear();
  }
}

export const metrics = Metrics.getInstance(); 