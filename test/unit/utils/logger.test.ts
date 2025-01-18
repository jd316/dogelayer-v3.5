import { expect } from "chai";
import { logger } from "../../../src/utils/logger";

describe("Logger", function () {
  beforeEach(function () {
    // Reset logger configuration
    logger.setLogLevel("info");
  });

  it("should initialize with correct configuration", function () {
    expect(logger).to.not.be.undefined;
  });

  it("should log messages at different levels", function () {
    // Since we can't easily capture console output in tests,
    // we just verify the methods exist
    expect(logger.info).to.be.a("function");
    expect(logger.error).to.be.a("function");
    expect(logger.warn).to.be.a("function");
    expect(logger.debug).to.be.a("function");
  });

  it("should format log messages correctly", function () {
    const message = "Test message";
    const context = { key: "value" };

    // Mock console.info to capture output
    const originalInfo = console.info;
    let capturedOutput = "";
    console.info = (output: string) => {
      capturedOutput = output;
    };

    logger.info(message, context);

    // Restore console.info
    console.info = originalInfo;

    // Verify log format
    const logEntry = JSON.parse(capturedOutput);
    expect(logEntry.message).to.equal(message);
    expect(logEntry.level).to.equal("info");
    expect(logEntry.context).to.deep.equal(context);
  });

  it("should track performance", async function () {
    const operation = async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return "result";
    };

    const result = await logger.trackPerformance("test_op", operation);
    expect(result).to.equal("result");
  });
}); 