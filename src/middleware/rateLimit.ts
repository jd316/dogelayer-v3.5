import type { NextApiRequest, NextApiResponse } from 'next';
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AlertManager } from '../services/monitoring/AlertManager';

const alertManager = new AlertManager(process.env.ALERT_WEBHOOK_URL || '');

interface RateLimitRequest extends Request {
    rateLimit?: {
        limit: number;
        remaining: number;
        reset: number;
    };
}

interface RateLimitConfig {
    authenticated: {
        windowMs: number;
        max: number;
    };
    public: {
        windowMs: number;
        max: number;
    };
}

const config: RateLimitConfig = {
    authenticated: {
        windowMs: 60 * 1000, // 1 minute
        max: 1000 // 1000 requests per minute
    },
    public: {
        windowMs: 60 * 1000, // 1 minute
        max: 100 // 100 requests per minute
    }
};

// In-memory store for blocked IPs
const blockedIPs = new Map<string, { until: number; reason: string }>();

async function isValidApiKey(apiKey: string): Promise<boolean> {
    if (!apiKey) return false;
    
    // Check API key format
    if (!/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/.test(apiKey)) {
        return false;
    }
    
    try {
        // Add your API key validation logic here
        // For example, check against environment variables or database
        const validKeys = process.env.VALID_API_KEYS?.split(',') || [];
        return validKeys.includes(apiKey);
    } catch (error) {
        console.error('API key validation error:', error);
        return false;
    }
}

const limiter = rateLimit({
    windowMs: config.public.windowMs,
    max: async (req) => {
        // Check if IP is blocked
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const blocked = blockedIPs.get(ip);
        if (blocked && blocked.until > Date.now()) {
            throw new Error(`IP blocked until ${new Date(blocked.until).toISOString()}: ${blocked.reason}`);
        }
        
        // Clean up expired blocks
        if (blocked && blocked.until <= Date.now()) {
            blockedIPs.delete(ip);
        }
        
        // Check API key
        const apiKey = req.headers.authorization?.replace('Bearer ', '') || '';
        if (apiKey && await isValidApiKey(apiKey)) {
            return config.authenticated.max;
        }
        return config.public.max;
    },
    handler: async (req: Request, res: Response) => {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const violations = await trackViolation(ip);
        
        if (violations >= 5) {
            // Block IP for increasing durations
            const duration = Math.min(Math.pow(2, violations - 5), 24) * 60 * 60 * 1000; // Max 24 hours
            blockedIPs.set(ip, {
                until: Date.now() + duration,
                reason: 'Excessive rate limit violations'
            });
        }
        
        await alertManager.sendAlert(
            'Rate Limit Exceeded',
            `IP ${ip} exceeded rate limit (violations: ${violations})`,
            'warning'
        );
        
        res.status(429).json({
            success: false,
            error: {
                code: 'RATE_LIMITED',
                message: 'Too many requests, please try again later',
                details: {
                    retryAfter: Math.floor(config.public.windowMs / 1000)
                }
            }
        });
    },
    keyGenerator: (req) => {
        const apiKey = req.headers.authorization?.replace('Bearer ', '');
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        return apiKey || ip;
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/api/health';
    }
});

// Track rate limit violations
const violations = new Map<string, { count: number; lastViolation: number }>();

async function trackViolation(ip: string): Promise<number> {
    const now = Date.now();
    const record = violations.get(ip) || { count: 0, lastViolation: 0 };
    
    // Reset count if last violation was more than 24 hours ago
    if (now - record.lastViolation > 24 * 60 * 60 * 1000) {
        record.count = 0;
    }
    
    record.count++;
    record.lastViolation = now;
    violations.set(ip, record);
    
    // Clean up old violations
    for (const [ip, record] of violations.entries()) {
        if (now - record.lastViolation > 24 * 60 * 60 * 1000) {
            violations.delete(ip);
        }
    }
    
    return record.count;
}

export function withRateLimit(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
        try {
            await new Promise((resolve, reject) => {
                limiter(req as unknown as Request, res as unknown as Response, (result: any) => {
                    if (result instanceof Error) {
                        return reject(result);
                    }
                    resolve(result);
                });
            });
            
            // Add rate limit headers
            const rateLimitReq = req as unknown as RateLimitRequest;
            if (rateLimitReq.rateLimit) {
                const { remaining, limit, reset } = rateLimitReq.rateLimit;
                res.setHeader('X-RateLimit-Limit', limit);
                res.setHeader('X-RateLimit-Remaining', remaining);
                res.setHeader('X-RateLimit-Reset', reset);
            }
            
            return handler(req, res);
        } catch (error: any) {
            const isBlocked = error.message?.includes('IP blocked');
            return res.status(isBlocked ? 403 : 500).json({
                success: false,
                error: {
                    code: isBlocked ? 'IP_BLOCKED' : 'SERVER_ERROR',
                    message: error.message || 'Internal server error'
                }
            });
        }
    };
} 