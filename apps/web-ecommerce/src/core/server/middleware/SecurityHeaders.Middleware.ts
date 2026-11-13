import type { Request, Response, NextFunction } from 'express';

// Browser protections on every response (pages, API, uploads):
// - nosniff: an uploaded file is never executed as a script because its bytes look like one;
// - frame-ancestors/X-Frame-Options: other sites cannot frame the shop or the admin console (clickjacking);
// - Referrer-Policy: other sites see only the origin, never a path with an order or reset token in it;
// - Permissions-Policy: the shop uses no camera, microphone or interest-cohort API, so no embedded script may either;
// - HSTS over HTTPS only (the public tunnel), so plain-HTTP localhost development keeps working.
// A full Content-Security-Policy is not set here: Next.js inlines its hydration scripts, which need per-request nonces.
const HSTS_SECONDS = 365 * 24 * 60 * 60;

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), browsing-topics=()',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
};

export function SecurityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  if (req.secure) res.setHeader('Strict-Transport-Security', `max-age=${HSTS_SECONDS}`);
  next();
}
