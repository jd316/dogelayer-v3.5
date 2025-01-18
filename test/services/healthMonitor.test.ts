import { expect } from "chai";
import { HealthMonitor } from "../../src/services/healthMonitor";
import { AlertManager } from "../../src/services/alerting";

describe("HealthMonitor", function () {
  let healthMonitor: HealthMonitor;
  let alertManager: AlertManager;

  before(function () {
    // Initialize AlertManager
    alertManager = new AlertManager({
      webhookUrl: "https://test.webhook.url"
    });
    
    // Initialize HealthMonitor
    healthMonitor = new HealthMonitor(alertManager);
  });

  it("should initialize with alert manager", function () {
    expect(healthMonitor).to.not.be.undefined;
  });

  it("should register and monitor services", function () {
    healthMonitor.registerService("test-service");
    const status = healthMonitor.getServiceStatus("test-service");
    expect(status).to.not.be.undefined;
  });

  it("should update service metrics", function () {
    const metrics = {
      isHealthy: true,
      successRate: 100,
      averageResponseTime: 100,
      errorCount: 0,
      transactionMetrics: {
        totalProcessed: 100,
        successfulDeposits: 95,
        failedDeposits: 5,
        averageConfirmationTime: 300,
        pendingTransactions: 0,
        lastProcessedTimestamp: Date.now()
      }
    };

    healthMonitor.updateMetrics("test-service", metrics);
    const status = healthMonitor.getServiceStatus("test-service");
    expect(status.metrics).to.deep.include(metrics);
  });
}); 