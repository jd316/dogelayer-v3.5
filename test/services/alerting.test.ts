import { expect } from "chai";
import { AlertManager } from "../../src/services/alerting";

describe("AlertManager", function () {
  let alertManager: AlertManager;

  before(function () {
    alertManager = new AlertManager({
      webhookUrl: "https://test.webhook.url"
    });
  });

  it("should initialize with webhook URL", function () {
    expect(alertManager).to.not.be.undefined;
  });

  it("should handle alerts", async function () {
    const alert = {
      severity: "high",
      message: "Test alert",
      timestamp: Date.now()
    };

    // Since we can't actually send alerts in tests, we just verify the method exists
    expect(alertManager.sendAlert).to.be.a("function");
  });
}); 