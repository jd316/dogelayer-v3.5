interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  burstLimit?: number;
  minWindowMs?: number;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
  burstCount: number;
  lastBurstReset: number;
  dynamicWindow: number;
}

interface RateLimitStore {
  [key: string]: RateLimitRecord;
}

export interface RateLimitResult {
  isLimited: boolean;
  remaining: number;
  resetTime: number;
  burstRemaining: number;
}

export class RateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  private maxRequests: number;
  private burstLimit: number;
  private minWindowMs: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
    this.burstLimit = config.burstLimit || Math.ceil(config.maxRequests * 1.5);
    this.minWindowMs = config.minWindowMs || Math.floor(config.windowMs / 2);
    
    // Cleanup old records every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async checkLimit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const record = this.store[key];

    if (!record) {
      this.store[key] = this.createNewRecord(now);
      return {
        isLimited: false,
        remaining: this.maxRequests - 1,
        resetTime: now + this.windowMs,
        burstRemaining: this.burstLimit - 1
      };
    }

    // Reset if window expired
    if (now > record.resetTime) {
      this.store[key] = this.createNewRecord(now);
      return {
        isLimited: false,
        remaining: this.maxRequests - 1,
        resetTime: now + this.windowMs,
        burstRemaining: this.burstLimit - 1
      };
    }

    // Check burst limit
    const burstWindowExpired = now - record.lastBurstReset > 1000; // 1 second burst window
    if (burstWindowExpired) {
      record.burstCount = 0;
      record.lastBurstReset = now;
    }

    if (record.burstCount >= this.burstLimit) {
      return {
        isLimited: true,
        remaining: 0,
        resetTime: record.resetTime,
        burstRemaining: 0
      };
    }

    // Adjust window size based on request rate
    const requestRate = record.count / ((now - (record.resetTime - this.windowMs)) / 1000);
    if (requestRate > this.maxRequests / (this.windowMs / 1000)) {
      record.dynamicWindow = Math.min(record.dynamicWindow * 1.5, this.windowMs);
    } else {
      record.dynamicWindow = Math.max(record.dynamicWindow * 0.9, this.minWindowMs);
    }

    if (record.count >= this.maxRequests) {
      return {
        isLimited: true,
        remaining: 0,
        resetTime: record.resetTime,
        burstRemaining: this.burstLimit - record.burstCount
      };
    }

    record.count++;
    record.burstCount++;

    return {
      isLimited: false,
      remaining: this.maxRequests - record.count,
      resetTime: record.resetTime,
      burstRemaining: this.burstLimit - record.burstCount
    };
  }

  private createNewRecord(now: number): RateLimitRecord {
    return {
      count: 1,
      resetTime: now + this.windowMs,
      burstCount: 1,
      lastBurstReset: now,
      dynamicWindow: this.windowMs
    };
  }

  getRemainingRequests(key: string): number {
    const now = Date.now();
    const record = this.store[key];

    if (!record || now > record.resetTime) {
      return this.maxRequests;
    }

    return Math.max(0, this.maxRequests - record.count);
  }

  getResetTime(key: string): number {
    const record = this.store[key];
    return record ? record.resetTime : Date.now() + this.windowMs;
  }

  getBurstRemaining(key: string): number {
    const now = Date.now();
    const record = this.store[key];

    if (!record || now - record.lastBurstReset > 1000) {
      return this.burstLimit;
    }

    return Math.max(0, this.burstLimit - record.burstCount);
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (now > this.store[key].resetTime) {
        delete this.store[key];
      }
    });
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store = {};
  }
} 