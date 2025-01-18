import { expect } from "chai";
import { RateLimitMonitor } from "../../src/services/rateLimitMonitor";
import { AlertManager } from "../../src/services/alerting";
import { RateLimiter } from "../../src/utils/rateLimit";

describe("RateLimitMonitor", function () {
  let monitor: RateLimitMonitor;
  let alertManager: AlertManager;
  let rateLimiter: RateLimiter;

  beforeEach(function () {
    alertManager = new AlertManager({
      webhookUrl: "https://test.webhook.url"
    });
    
    rateLimiter = new RateLimiter({
      maxRequests: 10,
      windowMs: 1000 // 1 second
    });
    
    monitor = new RateLimitMonitor(alertManager, rateLimiter);
  });

  it("should initialize with correct configuration", function () {
    expect(monitor).to.not.be.undefined;
  });

  it("should record rate limit events", function () {
    const event = {
      clientId: "test-user",
      timestamp: Date.now(),
      endpoint: "/api/test",
      isLimited: false,
      userTier: "standard" as const
    };

    monitor.recordEvent(event);
    const stats = monitor.getStats();
    expect(stats.totalRequests).to.equal(1);
  });

  it("should track rate limit statistics", function () {
    // Record multiple events
    for (let i = 0; i < 5; i++) {
      monitor.recordEvent({
        clientId: "test-user",
        timestamp: Date.now(),
        endpoint: "/api/test",
        isLimited: false,
        userTier: "standard" as const
      });
    }

    const stats = monitor.getStats();
    expect(stats.totalRequests).to.equal(5);
    expect(stats.limitedRequests).to.equal(0);
    expect(stats.uniqueClients).to.equal(1);
  });
}); 