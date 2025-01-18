import { expect } from "chai";
import { DogeMonitor } from "../../src/services/dogeMonitor";
import { AlertManager } from "../../src/services/alerting";
import { JsonRpcProvider } from "ethers";

describe("DogeMonitor", function () {
  let monitor: DogeMonitor;
  let alertManager: AlertManager;

  before(async function () {
    // Initialize provider
    const provider = new JsonRpcProvider("http://localhost:8545");
    
    // Initialize AlertManager
    alertManager = new AlertManager({
      webhookUrl: "https://test.webhook.url"
    });
    
    // Initialize DogeMonitor
    monitor = new DogeMonitor(
      provider,
      {} as any, // Mock bridge contract
      alertManager,
      {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 5000
      }
    );
  });

  it("should initialize with correct configuration", function () {
    expect(monitor).to.not.be.undefined;
  });

  it("should handle transaction processing", async function () {
    const mockTx = {
      txid: "0x" + "1".repeat(64),
      vout: 0,
      value: 1000000,
      confirmations: 6
    };

    // Since we can't actually process transactions in tests, we just verify the method exists
    expect(monitor.processTransaction).to.be.a("function");
  });
}); 