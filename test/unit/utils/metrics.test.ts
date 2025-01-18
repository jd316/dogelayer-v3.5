import { expect } from "chai";
import { metrics } from "../../../src/utils/metrics";

describe("Metrics", function () {
  beforeEach(function () {
    // Reset metrics before each test
    metrics.reset();
  });

  it("should record metric values", function () {
    const metricName = "test_metric";
    const value = 100;
    const labels = { service: "test" };

    metrics.recordValue(metricName, value, labels);
    const metric = metrics.getMetric(metricName, labels);

    expect(metric).to.not.be.undefined;
    expect(metric?.count).to.equal(1);
    expect(metric?.sum).to.equal(value);
    expect(metric?.min).to.equal(value);
    expect(metric?.max).to.equal(value);
  });

  it("should update existing metrics", function () {
    const metricName = "test_metric";
    const labels = { service: "test" };

    metrics.recordValue(metricName, 100, labels);
    metrics.recordValue(metricName, 200, labels);

    const metric = metrics.getMetric(metricName, labels);
    expect(metric?.count).to.equal(2);
    expect(metric?.sum).to.equal(300);
    expect(metric?.min).to.equal(100);
    expect(metric?.max).to.equal(200);
  });

  it("should handle different label combinations", function () {
    const metricName = "test_metric";
    
    metrics.recordValue(metricName, 100, { service: "A" });
    metrics.recordValue(metricName, 200, { service: "B" });

    const metricA = metrics.getMetric(metricName, { service: "A" });
    const metricB = metrics.getMetric(metricName, { service: "B" });

    expect(metricA?.sum).to.equal(100);
    expect(metricB?.sum).to.equal(200);
  });

  it("should provide summary statistics", function () {
    const metricName = "test_metric";
    const labels = { service: "test" };

    metrics.recordValue(metricName, 100, labels);
    metrics.recordValue(metricName, 200, labels);
    metrics.recordValue(metricName, 300, labels);

    const summary = metrics.getSummary(metricName, labels);
    expect(summary).to.not.be.undefined;
    expect(summary?.count).to.equal(3);
    expect(summary?.min).to.equal(100);
    expect(summary?.max).to.equal(300);
    expect(summary?.avg).to.equal(200);
  });
}); 