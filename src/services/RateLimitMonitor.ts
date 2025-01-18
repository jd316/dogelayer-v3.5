import { AlertManager } from './alerting';
import { RateLimiter } from '../utils/rateLimit';

interface RateLimitEvent {
  clientId: string;
  timestamp: number;
  endpoint: string;
  isLimited: boolean;
  userTier: 'standard' | 'premium';
}

interface RateLimitStats {
  totalRequests: number;
  limitedRequests: number;
  uniqueClients: number;
  topClients: Array<{
    clientId: string;
    requests: number;
    userTier: 'standard' | 'premium';
  }>;
}

export class RateLimitMonitor {
  private events: RateLimitEvent[] = [];
  private alertManager: AlertManager;
  private rateLimiter: RateLimiter;
  private readonly ALERT_THRESHOLD = 0.8; // 80% of limit
  private readonly MONITORING_WINDOW = 3600000; // 1 hour

  constructor(alertManager: AlertManager, rateLimiter: RateLimiter) {
    this.alertManager = alertManager;
    this.rateLimiter = rateLimiter;
    this.startPeriodicCleanup();
  }

  public recordEvent(event: RateLimitEvent): void {
    this.events.push(event);
    this.checkThresholds(event.clientId, event.userTier);
  }

  private checkThresholds(clientId: string, userTier: 'standard' | 'premium'): void {
    const remaining = this.rateLimiter.getRemainingRequests(clientId);
    const maxRequests = userTier === 'premium' ? 50 : 10;
    const usagePercent = (maxRequests - remaining) / maxRequests;

    if (usagePercent >= this.ALERT_THRESHOLD) {
      this.alertManager.sendAlert({
        type: 'RATE_LIMIT_WARNING',
        message: `Client ${clientId} (${userTier}) is approaching rate limit: ${Math.round(usagePercent * 100)}% used`,
        severity: 'warning',
        metadata: {
          clientId,
          userTier,
          usagePercent,
          remaining
        }
      });
    }
  }

  public getStats(windowMs: number = this.MONITORING_WINDOW): RateLimitStats {
    const now = Date.now();
    const windowEvents = this.events.filter(e => now - e.timestamp <= windowMs);

    const clientRequests = new Map<string, { count: number; tier: 'standard' | 'premium' }>();
    windowEvents.forEach(event => {
      const client = clientRequests.get(event.clientId) || { count: 0, tier: event.userTier };
      client.count++;
      clientRequests.set(event.clientId, client);
    });

    const topClients = Array.from(clientRequests.entries())
      .map(([clientId, { count, tier }]) => ({ clientId, requests: count, userTier: tier }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    return {
      totalRequests: windowEvents.length,
      limitedRequests: windowEvents.filter(e => e.isLimited).length,
      uniqueClients: clientRequests.size,
      topClients
    };
  }

  private startPeriodicCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      this.events = this.events.filter(e => now - e.timestamp <= this.MONITORING_WINDOW);
    }, this.MONITORING_WINDOW);
  }

  public destroy(): void {
    this.events = [];
  }
} 