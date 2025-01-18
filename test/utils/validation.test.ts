import { expect } from "chai";
import { validateDogeAddress, validatePolygonAddress, validateAmount, validateTxHash, validateSignature, sanitizeInput } from "../../src/utils/validation";

describe("Validation Utils", function () {
  describe("validateDogeAddress", function () {
    it("should validate correct Dogecoin addresses", function () {
      const validAddresses = [
        "D8mHXhuo9XFH5LGDxvqkwN6u2EhBbxxcfb",
        "DRkbCLhvzhdBvMbfvqYogXpL7sjeFFyFFb"
      ];

      validAddresses.forEach(address => {
        expect(validateDogeAddress(address)).to.be.true;
      });
    });

    it("should reject invalid Dogecoin addresses", function () {
      const invalidAddresses = [
        "",
        "invalid",
        "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", // Bitcoin address
        "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" // Ethereum address
      ];

      invalidAddresses.forEach(address => {
        expect(validateDogeAddress(address)).to.be.false;
      });
    });
  });

  describe("validatePolygonAddress", function () {
    it("should validate correct Polygon addresses", function () {
      const validAddresses = [
        "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        "0x123456789012345678901234567890123456abcd",
        "0xABCDEF0123456789ABCDEF0123456789ABCDEF01"
      ];

      validAddresses.forEach(address => {
        expect(validatePolygonAddress(address)).to.be.true;
      });
    });

    it("should reject invalid Polygon addresses", function () {
      const invalidAddresses = [
        "",
        "invalid",
        "0xinvalid",
        "0x742d35Cc6634C0532925a3b844Bc454e4438f44", // Too short
        "0x742d35Cc6634C0532925a3b844Bc454e4438f44ef", // Too long
        "0x742d35Cc6634C0532925a3b844Bc454e4438f44g" // Invalid character
      ];

      invalidAddresses.forEach(address => {
        expect(validatePolygonAddress(address)).to.be.false;
      });
    });
  });

  describe("validateAmount", function () {
    it("should validate correct amounts", function () {
      const validAmounts = [
        "1.0",
        "100",
        "0.001"
      ];

      validAmounts.forEach(amount => {
        expect(validateAmount(amount)).to.be.true;
      });
    });

    it("should validate amounts within range", function () {
      expect(validateAmount("5", "1", "10")).to.be.true;
      expect(validateAmount("1", "1", "10")).to.be.true;
      expect(validateAmount("10", "1", "10")).to.be.true;
    });

    it("should reject invalid amounts", function () {
      const invalidAmounts = [
        "-1",
        "0",
        "",
        "abc"
      ];

      invalidAmounts.forEach(amount => {
        expect(validateAmount(amount)).to.be.false;
      });
    });

    it("should reject amounts outside range", function () {
      expect(validateAmount("0.5", "1", "10")).to.be.false;
      expect(validateAmount("11", "1", "10")).to.be.false;
    });
  });

  describe("validateTxHash", function () {
    it("should validate correct transaction hashes", function () {
      const validHashes = [
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "0xABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789"
      ];

      validHashes.forEach(hash => {
        expect(validateTxHash(hash)).to.be.true;
      });
    });

    it("should reject invalid transaction hashes", function () {
      const invalidHashes = [
        "",
        "invalid",
        "0x123", // Too short
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefg", // Invalid character
        "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" // Missing 0x prefix
      ];

      invalidHashes.forEach(hash => {
        expect(validateTxHash(hash)).to.be.false;
      });
    });
  });

  describe("validateSignature", function () {
    it("should validate correct signatures", function () {
      const validSig = "0x" + "1".repeat(130);
      expect(validateSignature(validSig)).to.be.true;
    });

    it("should reject invalid signatures", function () {
      const invalidSigs = [
        "",
        "invalid",
        "0x123", // Too short
        "0x" + "1".repeat(129), // Too short
        "0x" + "1".repeat(131), // Too long
        "0x" + "1".repeat(129) + "g" // Invalid character
      ];

      invalidSigs.forEach(sig => {
        expect(validateSignature(sig)).to.be.false;
      });
    });
  });

  describe("sanitizeInput", function () {
    it("should remove HTML tags and special characters", function () {
      expect(sanitizeInput('<script>alert("xss")</script>')).to.equal('alert("xss")');
      expect(sanitizeInput("Hello <b>World</b>")).to.equal("Hello World");
      expect(sanitizeInput("Test'\"\<\>")).to.equal("Test");
    });

    it("should remove potentially dangerous content", function () {
      expect(sanitizeInput("javascript:alert(1)")).to.equal("alert(1)");
      expect(sanitizeInput("<img onerror=alert(1)>")).to.equal("");
      expect(sanitizeInput("data:text/html,<script>alert(1)</script>")).to.equal("text/html,alert(1)");
    });

    it("should trim whitespace", function () {
      expect(sanitizeInput("  hello  ")).to.equal("hello");
    });
  });
}); 