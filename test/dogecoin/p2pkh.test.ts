import { expect } from "chai";
import { DogecoinP2PKH } from "../../src/services/dogecoin/scripts/p2pkh";
import { randomBytes } from "crypto";

describe("DogecoinP2PKH", function () {
    describe("Address Generation", function () {
        it("should generate valid Dogecoin legacy address", function () {
            const privateKey = randomBytes(32).toString('hex');
            const dogecoin = new DogecoinP2PKH(privateKey);
            const address = dogecoin.generateAddress();
            expect(address).to.match(/^D[1-9A-HJ-NP-Za-km-z]{33}$/);
        });

        it("should generate different address with different private key", function () {
            const privateKey1 = randomBytes(32).toString('hex');
            const privateKey2 = randomBytes(32).toString('hex');
            const dogecoin1 = new DogecoinP2PKH(privateKey1);
            const dogecoin2 = new DogecoinP2PKH(privateKey2);
            expect(dogecoin1.generateAddress()).to.not.equal(dogecoin2.generateAddress());
        });

        it("should throw error with invalid private key", function () {
            expect(() => new DogecoinP2PKH("invalid_key"))
                .to.throw("Invalid private key length");
        });

        it("should generate same address for same private key", function () {
            const privateKey = randomBytes(32).toString('hex');
            const dogecoin1 = new DogecoinP2PKH(privateKey);
            const dogecoin2 = new DogecoinP2PKH(privateKey);
            expect(dogecoin1.generateAddress()).to.equal(dogecoin2.generateAddress());
        });
    });

    describe("Message Signing", function () {
        let validPrivateKey: string;
        
        beforeEach(function() {
            validPrivateKey = randomBytes(32).toString('hex');
        });
        
        it("should sign message successfully", function () {
            const dogecoin = new DogecoinP2PKH(validPrivateKey);
            const message = "test message";
            const signature = dogecoin.signMessage(message);
            expect(signature).to.be.a('string');
            expect(signature).to.have.length.greaterThan(0);
        });

        it("should generate different signatures for different messages", function () {
            const dogecoin = new DogecoinP2PKH(validPrivateKey);
            const message1 = "test message 1";
            const message2 = "test message 2";
            const signature1 = dogecoin.signMessage(message1);
            const signature2 = dogecoin.signMessage(message2);
            expect(signature1).to.not.equal(signature2);
        });

        it("should throw error when signing with invalid key", function () {
            expect(() => {
                const dogecoin = new DogecoinP2PKH("invalid_key");
                dogecoin.signMessage("test");
            }).to.throw("Invalid private key length");
        });
    });
}); 