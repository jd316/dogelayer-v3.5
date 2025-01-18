interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeout: number;
}

export class CircuitBreaker {
    private failures: number = 0;
    private lastFailureTime: number = 0;
    private readonly failureThreshold: number;
    private readonly resetTimeout: number;

    constructor(config: CircuitBreakerConfig) {
        this.failureThreshold = config.failureThreshold;
        this.resetTimeout = config.resetTimeout;
    }

    private isOpen(): boolean {
        if (this.failures >= this.failureThreshold) {
            const timeSinceLastFailure = Date.now() - this.lastFailureTime;
            if (timeSinceLastFailure < this.resetTimeout) {
                return true;
            }
            // Reset after timeout
            this.failures = 0;
        }
        return false;
    }

    async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.isOpen()) {
            throw new Error('Circuit breaker is open');
        }

        try {
            const result = await operation();
            // Reset failures on success
            this.failures = 0;
            return result;
        } catch (error) {
            this.failures++;
            this.lastFailureTime = Date.now();
            throw error;
        }
    }

    reset(): void {
        this.failures = 0;
        this.lastFailureTime = 0;
    }

    getStatus(): { isOpen: boolean; failures: number; lastFailureTime: number } {
        return {
            isOpen: this.isOpen(),
            failures: this.failures,
            lastFailureTime: this.lastFailureTime
        };
    }
} 