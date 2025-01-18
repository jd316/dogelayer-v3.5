import { expect } from 'chai';
import { CircuitBreaker } from '../../src/utils/circuitBreaker';

describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;
    const config = {
        failureThreshold: 3,
        resetTimeout: 1000 // 1 second
    };

    beforeEach(() => {
        circuitBreaker = new CircuitBreaker(config);
    });

    it('should execute successful operations', async () => {
        const result = await circuitBreaker.execute(async () => 'success');
        expect(result).to.equal('success');
        
        const status = circuitBreaker.getStatus();
        expect(status.failures).to.equal(0);
        expect(status.isOpen).to.be.false;
    });

    it('should track failures and open circuit', async () => {
        const failingOperation = async () => {
            throw new Error('Operation failed');
        };

        for (let i = 0; i < config.failureThreshold - 1; i++) {
            try {
                await circuitBreaker.execute(failingOperation);
            } catch (error: any) {
                if (error instanceof Error) {
                    expect(error.message).to.equal('Operation failed');
                }
            }
        }

        const status = circuitBreaker.getStatus();
        expect(status.failures).to.equal(config.failureThreshold - 1);
        expect(status.isOpen).to.be.false;

        // One more failure should open the circuit
        try {
            await circuitBreaker.execute(failingOperation);
        } catch (error: any) {
            if (error instanceof Error) {
                expect(error.message).to.equal('Operation failed');
            }
        }

        const finalStatus = circuitBreaker.getStatus();
        expect(finalStatus.failures).to.equal(config.failureThreshold);
        expect(finalStatus.isOpen).to.be.true;
    });

    it('should reset after timeout', async () => {
        const failingOperation = async () => {
            throw new Error('Operation failed');
        };

        // Cause circuit to open
        for (let i = 0; i < config.failureThreshold; i++) {
            try {
                await circuitBreaker.execute(failingOperation);
            } catch (error: any) {
                if (error instanceof Error) {
                    expect(error.message).to.equal('Operation failed');
                }
            }
        }

        expect(circuitBreaker.getStatus().isOpen).to.be.true;

        // Wait for reset timeout
        await new Promise(resolve => setTimeout(resolve, config.resetTimeout + 100));

        // Circuit should be closed now
        expect(circuitBreaker.getStatus().isOpen).to.be.false;
        expect(circuitBreaker.getStatus().failures).to.equal(0);
    });

    it('should reset failure count on successful operation', async () => {
        const failingOperation = async () => {
            throw new Error('Operation failed');
        };

        // Accumulate some failures
        for (let i = 0; i < config.failureThreshold - 1; i++) {
            try {
                await circuitBreaker.execute(failingOperation);
            } catch (error: any) {
                if (error instanceof Error) {
                    expect(error.message).to.equal('Operation failed');
                }
            }
        }

        expect(circuitBreaker.getStatus().failures).to.equal(config.failureThreshold - 1);

        // Successful operation should reset failure count
        await circuitBreaker.execute(async () => 'success');
        expect(circuitBreaker.getStatus().failures).to.equal(0);
    });
}); 