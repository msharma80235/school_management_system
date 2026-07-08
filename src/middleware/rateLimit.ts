import { Request, Response, NextFunction } from 'express';

// Lightweight in-memory rate limiter with escalating lockout. Sized for the
// current single-server SQLite deployment; when the app moves to a multi-server
// setup (see IMPLEMENTATION_PLAN.md Phase 6) this should move to a shared store
// (Redis) so limits are enforced across instances.
//
// Protects auth endpoints from credential stuffing / brute force. Counts every
// request from an IP to the guarded route within a sliding window; once the cap
// is exceeded the IP is blocked, and repeat offenders are blocked for longer
// (exponential backoff, capped).

interface Bucket {
  hits: number[];        // timestamps within the current window
  blockedUntil: number;  // epoch ms; 0 when not blocked
  offenses: number;      // consecutive block escalations
}

export interface RateLimitOptions {
  windowMs: number;   // sliding window size
  max: number;        // max requests per window before blocking
  blockMs: number;    // base block duration (doubles per repeat offense)
  maxBlockMs?: number; // cap on block duration
}

export function rateLimit(opts: RateLimitOptions) {
  const { windowMs, max, blockMs, maxBlockMs = 60 * 60 * 1000 } = opts;
  const buckets = new Map<string, Bucket>();
  let lastSweep = Date.now();

  function sweep(now: number) {
    // Drop idle, unblocked buckets so memory can't grow unbounded.
    for (const [key, b] of buckets) {
      const recent = b.hits.length > 0 ? b.hits[b.hits.length - 1] : 0;
      if (b.blockedUntil < now && recent < now - windowMs) buckets.delete(key);
    }
    lastSweep = now;
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // Tests exercise these endpoints repeatedly; limiting there would create
    // flaky failures unrelated to what's under test.
    if (process.env.NODE_ENV === 'test') { next(); return; }

    const now = Date.now();
    if (now - lastSweep > windowMs) sweep(now);

    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { hits: [], blockedUntil: 0, offenses: 0 };
      buckets.set(key, bucket);
    }

    if (bucket.blockedUntil > now) {
      const retryAfter = Math.ceil((bucket.blockedUntil - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: `Too many attempts. Try again in ${retryAfter}s.` });
      return;
    }

    // Prune timestamps outside the window, then record this request.
    bucket.hits = bucket.hits.filter((t) => t > now - windowMs);
    bucket.hits.push(now);

    if (bucket.hits.length > max) {
      const duration = Math.min(blockMs * 2 ** bucket.offenses, maxBlockMs);
      bucket.blockedUntil = now + duration;
      bucket.offenses += 1;
      bucket.hits = [];
      const retryAfter = Math.ceil(duration / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: `Too many attempts. Try again in ${retryAfter}s.` });
      return;
    }

    next();
  };
}

// Sensible default for login-style endpoints: 10 attempts / 15 min, then a
// 15-minute block that doubles for repeat offenders (capped at 1 hour).
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  blockMs: 15 * 60 * 1000,
});
