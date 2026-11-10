import { Request, Response, NextFunction } from 'express';

interface RateLimiterOptions {
  windowMs: number; // e.g. 15 * 60 * 1000 (15 minutes)
  maxRequests: number; // e.g. 10
  message?: string;
  skipInTests?: boolean;
}

interface RequestRecord {
  timestamps: number[];
}

export const createRateLimiter = (options: RateLimiterOptions) => {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests from this IP, please try again later.',
    skipInTests = true,
  } = options;

  const hits = new Map<string, RequestRecord>();

  // Cleanup old keys every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
      if (record.timestamps.length === 0) {
        hits.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // In automated testing environments, allow rapid executions unless testing rate limiter itself
    if (skipInTests && (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true')) {
      return next();
    }

    // If behind a trusted reverse proxy (e.g. Azure App Gateway/Cloudflare/Nginx),
    // express 'trust proxy' setting should be enabled so req.ip is validated.
    // Fall back safely to socket remoteAddress if headers are absent.
    const clientIp =
      req.ip ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const routeKey = `${clientIp}:${req.baseUrl}${req.path}`;
    const now = Date.now();

    let record = hits.get(routeKey);
    if (!record) {
      record = { timestamps: [] };
      hits.set(routeKey, record);
    }

    // Filter out timestamps outside the sliding window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    const remaining = Math.max(0, maxRequests - record.timestamps.length);
    const oldestTimestamp = record.timestamps[0] || now;
    const resetTime = Math.ceil((oldestTimestamp + windowMs - now) / 1000);

    res.setHeader('RateLimit-Limit', maxRequests.toString());
    res.setHeader('RateLimit-Remaining', remaining.toString());
    res.setHeader('RateLimit-Reset', resetTime.toString());

    if (record.timestamps.length >= maxRequests) {
      res.setHeader('Retry-After', resetTime.toString());
      res.status(429).json({
        message,
        retryAfterSeconds: resetTime,
      });
      return;
    }

    record.timestamps.push(now);
    next();
  };
};

// Standard rate limiters
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

export const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 15,
  message: 'Too many registration attempts from this address. Please try again later.',
});

export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many password reset requests. Please try again in 15 minutes.',
});

